import {
  PackItemRole,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import { isAtOrAboveMinAllowedPrice } from '../../common/utils/pack-price-floor.util';
import { availableReferenceStock } from './pack-availability.util';

/**
 * Pack Core Evolution (Phase 5) — pure, server-authoritative validator for a
 * proposed customizable-Pack configuration.
 *
 * This function never persists anything and never trusts a client-supplied
 * price. It recomputes the configured price from the *current* allowed product
 * references, checks every customization rule, validates live stock, enforces
 * the Pack price floor (via the Phase 3 helper {@link isAtOrAboveMinAllowedPrice}),
 * and returns a normalized, privacy-safe result.
 *
 * The caller (PacksService) is responsible for loading the Pack (rejecting a
 * missing / non-customizable Pack) and mapping it onto {@link ValidatorPack}.
 */

/** Base composition roles that are part of the Pack unless validly removed. */
const BASE_ROLES: ReadonlySet<PackItemRole> = new Set([
  PackItemRole.FIXED,
  PackItemRole.REQUIRED_SELECTABLE,
  PackItemRole.OPTIONAL_INCLUDED,
]);

export interface ValidatorReference {
  id: string;
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number;
  priceOverride: Prisma.Decimal | null;
  priceDelta: Prisma.Decimal;
}

export interface ValidatorProduct {
  id: string;
  name: string;
  basePrice: Prisma.Decimal;
  isActive: boolean;
  status: ProductStatus;
  references: ValidatorReference[];
}

export interface ValidatorItem {
  id: string;
  role: PackItemRole;
  selectionMode: SelectionMode;
  quantity: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityEditable: boolean;
  removalAllowed: boolean;
  replacementAllowed: boolean;
  /** The pinned reference for a FIXED_REFERENCE slot, if any. */
  productReferenceId: string | null;
  product: ValidatorProduct;
  /** Reference ids allowed for this slot (from PackItemAllowedReference). */
  allowedReferenceIds: string[];
}

export interface ValidatorAllowedAddOn {
  productId: string;
  /** When set, the add-on is pinned to exactly this reference. */
  productReferenceId: string | null;
  product: ValidatorProduct;
}

export interface ValidatorPack {
  id: string;
  priceMode: PriceMode;
  discountAmount: Prisma.Decimal | null;
  discountPercentage: Prisma.Decimal | null;
  currency: string;
  minAllowedPrice: Prisma.Decimal | null;
  minRequiredItems: number | null;
  maxItemCount: number | null;
  items: ValidatorItem[];
  allowedAddOns: ValidatorAllowedAddOn[];
}

export interface ConfigurationItemInput {
  packItemId: string;
  productReferenceId?: string;
  quantity?: number;
  removed?: boolean;
}

export interface ConfigurationAddOnInput {
  productId: string;
  productReferenceId?: string;
  quantity?: number;
}

export interface ConfigurationInput {
  items?: ConfigurationItemInput[];
  addOns?: ConfigurationAddOnInput[];
}

export type NormalizedItemSource = PackItemRole | 'ADD_ON';

export interface NormalizedConfigurationItem {
  /** The PackItem id for base items; null for add-ons. */
  packItemId: string | null;
  productId: string;
  productReferenceId: string | null;
  role: NormalizedItemSource;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isAddOn: boolean;
  removed: boolean;
}

export interface ConfigurationValidationError {
  code: string;
  message: string;
  packItemId?: string;
  productId?: string;
}

export type ConfigurationStockStatus = 'IN_STOCK' | 'OUT_OF_STOCK';

export interface PackConfigurationValidationResult {
  isValid: boolean;
  computedPrice: number;
  minAllowedPrice: number | null;
  stockStatus: ConfigurationStockStatus;
  normalizedItems: NormalizedConfigurationItem[];
  validationErrors: ConfigurationValidationError[];
}

/**
 * Effective unit price of a reference — mirrors the server-side pricing used by
 * the order paths (`priceOverride` when set, else `basePrice + priceDelta`).
 * Kept pure and local so the validator never trusts a client price.
 */
function effectiveReferenceUnitPrice(
  product: ValidatorProduct,
  reference: ValidatorReference,
): Prisma.Decimal {
  if (reference.priceOverride) {
    return new Prisma.Decimal(reference.priceOverride);
  }

  return new Prisma.Decimal(product.basePrice).plus(reference.priceDelta);
}

function isProductPurchasable(product: ValidatorProduct): boolean {
  return product.isActive && product.status === ProductStatus.ACTIVE;
}

/**
 * Resolves the concrete reference for a base slot given the (optional)
 * client-chosen reference. Returns the reference or null when it cannot be
 * resolved; the caller records the appropriate validation error.
 */
function resolveBaseReference(
  item: ValidatorItem,
  chosenReferenceId: string | undefined,
  requiredQuantity: number,
): ValidatorReference | null {
  const references = item.product.references;

  if (chosenReferenceId) {
    return references.find((ref) => ref.id === chosenReferenceId) ?? null;
  }

  if (item.selectionMode === SelectionMode.FIXED_REFERENCE) {
    return (
      references.find((ref) => ref.id === item.productReferenceId) ?? null
    );
  }

  // AUTO_BEST_REFERENCE / unpinned: first active reference with enough stock,
  // falling back to the first active reference so pricing/stock can be reported.
  return (
    references.find(
      (ref) =>
        ref.isActive && availableReferenceStock(ref) >= requiredQuantity,
    ) ??
    references.find((ref) => ref.isActive) ??
    null
  );
}

export function validatePackConfiguration(
  pack: ValidatorPack,
  input: ConfigurationInput,
): PackConfigurationValidationResult {
  const errors: ConfigurationValidationError[] = [];
  const normalized: NormalizedConfigurationItem[] = [];
  let stockOk = true;

  const itemsById = new Map(pack.items.map((item) => [item.id, item]));
  const inputByItemId = new Map(
    (input.items ?? []).map((entry) => [entry.packItemId, entry]),
  );

  // Reject selections that target a slot the Pack does not own.
  for (const entry of input.items ?? []) {
    if (!itemsById.has(entry.packItemId)) {
      errors.push({
        code: 'UNKNOWN_ITEM',
        message: `Pack item ${entry.packItemId} does not belong to this pack.`,
        packItemId: entry.packItemId,
      });
    }
  }

  // ---- Base items (FIXED / REQUIRED_SELECTABLE / OPTIONAL_INCLUDED) ----------
  for (const item of pack.items) {
    if (!BASE_ROLES.has(item.role)) {
      continue;
    }

    const selection = inputByItemId.get(item.id);
    const requestedRemoval = selection?.removed === true;

    // ---- Removal rules ----
    if (requestedRemoval) {
      if (
        item.role === PackItemRole.FIXED ||
        item.role === PackItemRole.REQUIRED_SELECTABLE
      ) {
        errors.push({
          code: 'REQUIRED_ITEM_REMOVAL',
          message: `Item ${item.product.name} is required and cannot be removed.`,
          packItemId: item.id,
        });
        // Invalid removal → keep the item in the composition below.
      } else if (!item.removalAllowed) {
        errors.push({
          code: 'REMOVAL_NOT_ALLOWED',
          message: `Item ${item.product.name} cannot be removed.`,
          packItemId: item.id,
        });
        // Invalid removal → keep the item in the composition below.
      } else {
        // Valid optional removal: excluded from price, count, and stock.
        normalized.push({
          packItemId: item.id,
          productId: item.product.id,
          productReferenceId: null,
          role: item.role,
          quantity: 0,
          unitPrice: 0,
          lineTotal: 0,
          isAddOn: false,
          removed: true,
        });
        continue;
      }
    }

    // ---- Quantity ----
    let quantity = item.quantity;
    if (selection?.quantity != null && selection.quantity !== item.quantity) {
      if (!item.quantityEditable) {
        errors.push({
          code: 'QUANTITY_NOT_EDITABLE',
          message: `Quantity for ${item.product.name} cannot be changed.`,
          packItemId: item.id,
        });
      } else if (
        item.minQuantity != null &&
        selection.quantity < item.minQuantity
      ) {
        errors.push({
          code: 'QUANTITY_BELOW_MIN',
          message: `Quantity for ${item.product.name} is below the minimum of ${item.minQuantity}.`,
          packItemId: item.id,
        });
        quantity = selection.quantity;
      } else if (
        item.maxQuantity != null &&
        selection.quantity > item.maxQuantity
      ) {
        errors.push({
          code: 'QUANTITY_ABOVE_MAX',
          message: `Quantity for ${item.product.name} is above the maximum of ${item.maxQuantity}.`,
          packItemId: item.id,
        });
        quantity = selection.quantity;
      } else {
        quantity = selection.quantity;
      }
    }

    // ---- Reference resolution & replacement/selection rules ----
    const chosenReferenceId = selection?.productReferenceId;

    if (item.role === PackItemRole.REQUIRED_SELECTABLE) {
      if (!chosenReferenceId) {
        errors.push({
          code: 'MISSING_REQUIRED_SELECTION',
          message: `A selection is required for ${item.product.name}.`,
          packItemId: item.id,
        });
      } else if (!item.allowedReferenceIds.includes(chosenReferenceId)) {
        errors.push({
          code: 'REFERENCE_NOT_ALLOWED',
          message: `The chosen reference is not allowed for ${item.product.name}.`,
          packItemId: item.id,
        });
      }
    } else if (chosenReferenceId && chosenReferenceId !== item.productReferenceId) {
      // A replacement on a FIXED / OPTIONAL_INCLUDED slot.
      if (!item.replacementAllowed) {
        errors.push({
          code: 'REPLACEMENT_NOT_ALLOWED',
          message: `Replacing the reference for ${item.product.name} is not allowed.`,
          packItemId: item.id,
        });
      } else if (!item.allowedReferenceIds.includes(chosenReferenceId)) {
        errors.push({
          code: 'REFERENCE_NOT_ALLOWED',
          message: `The chosen replacement is not allowed for ${item.product.name}.`,
          packItemId: item.id,
        });
      }
    }

    const reference = resolveBaseReference(item, chosenReferenceId, quantity);

    if (!reference) {
      errors.push({
        code: 'REFERENCE_UNRESOLVED',
        message: `No valid reference could be resolved for ${item.product.name}.`,
        packItemId: item.id,
      });
      normalized.push({
        packItemId: item.id,
        productId: item.product.id,
        productReferenceId: chosenReferenceId ?? null,
        role: item.role,
        quantity,
        unitPrice: 0,
        lineTotal: 0,
        isAddOn: false,
        removed: false,
      });
      continue;
    }

    // ---- Stock ----
    const referenceStockOk = evaluateStock(
      item.product,
      reference,
      quantity,
      item.id,
      undefined,
      errors,
    );
    if (!referenceStockOk) {
      stockOk = false;
    }

    const unitPrice = effectiveReferenceUnitPrice(item.product, reference);
    normalized.push({
      packItemId: item.id,
      productId: item.product.id,
      productReferenceId: reference.id,
      role: item.role,
      quantity,
      unitPrice: toMoneyNumber(unitPrice) ?? 0,
      lineTotal: toMoneyNumber(unitPrice.times(quantity)) ?? 0,
      isAddOn: false,
      removed: false,
    });
  }

  // ---- Add-ons (validated against PackAllowedAddOn) --------------------------
  for (const addOn of input.addOns ?? []) {
    const allowed = pack.allowedAddOns.find(
      (candidate) =>
        candidate.productId === addOn.productId &&
        (candidate.productReferenceId === null ||
          candidate.productReferenceId === addOn.productReferenceId),
    );

    if (!allowed) {
      errors.push({
        code: 'ADDON_NOT_ALLOWED',
        message: `Product ${addOn.productId} is not an allowed add-on for this pack.`,
        productId: addOn.productId,
      });
      continue;
    }

    const quantity = addOn.quantity ?? 1;
    const chosenReferenceId =
      addOn.productReferenceId ?? allowed.productReferenceId ?? undefined;
    const references = allowed.product.references;

    const reference = chosenReferenceId
      ? (references.find((ref) => ref.id === chosenReferenceId) ?? null)
      : (references.find(
          (ref) =>
            ref.isActive && availableReferenceStock(ref) >= quantity,
        ) ??
        references.find((ref) => ref.isActive) ??
        null);

    if (!reference) {
      errors.push({
        code: 'ADDON_REFERENCE_UNRESOLVED',
        message: `No valid reference could be resolved for add-on ${allowed.product.name}.`,
        productId: addOn.productId,
      });
      continue;
    }

    const addOnStockOk = evaluateStock(
      allowed.product,
      reference,
      quantity,
      undefined,
      addOn.productId,
      errors,
    );
    if (!addOnStockOk) {
      stockOk = false;
    }

    const unitPrice = effectiveReferenceUnitPrice(allowed.product, reference);
    normalized.push({
      packItemId: null,
      productId: allowed.product.id,
      productReferenceId: reference.id,
      role: 'ADD_ON',
      quantity,
      unitPrice: toMoneyNumber(unitPrice) ?? 0,
      lineTotal: toMoneyNumber(unitPrice.times(quantity)) ?? 0,
      isAddOn: true,
      removed: false,
    });
  }

  // ---- Count constraints (minRequiredItems / maxItemCount) ------------------
  const includedItems = normalized.filter((entry) => !entry.removed);
  const includedCount = includedItems.length;

  if (pack.minRequiredItems != null && includedCount < pack.minRequiredItems) {
    errors.push({
      code: 'MIN_ITEMS_NOT_MET',
      message: `The configuration has ${includedCount} items but at least ${pack.minRequiredItems} are required.`,
    });
  }

  if (pack.maxItemCount != null && includedCount > pack.maxItemCount) {
    errors.push({
      code: 'MAX_ITEMS_EXCEEDED',
      message: `The configuration has ${includedCount} items but at most ${pack.maxItemCount} are allowed.`,
    });
  }

  // ---- Price (server-side, never client-trusted) ----------------------------
  const subtotal = includedItems.reduce(
    (sum, entry) => sum.plus(new Prisma.Decimal(entry.lineTotal)),
    new Prisma.Decimal(0),
  );
  const computed = applyConfiguredDiscount(pack, subtotal);
  const computedPrice = toMoneyNumber(computed) ?? 0;

  // ---- Price floor (Phase 3 helper) -----------------------------------------
  if (!isAtOrAboveMinAllowedPrice(computed, pack.minAllowedPrice)) {
    errors.push({
      code: 'BELOW_MIN_PRICE',
      message: `Configured price ${computedPrice} is below the minimum allowed price ${
        toMoneyNumber(pack.minAllowedPrice) ?? 0
      }.`,
    });
  }

  return {
    isValid: errors.length === 0,
    computedPrice,
    minAllowedPrice: toMoneyNumber(pack.minAllowedPrice),
    stockStatus: stockOk ? 'IN_STOCK' : 'OUT_OF_STOCK',
    normalizedItems: normalized,
    validationErrors: errors,
  };
}

/**
 * Validates a resolved reference against live stock using the shared
 * {@link availableReferenceStock} helper. Records an error and returns false on
 * an inactive product/reference or insufficient available stock.
 */
function evaluateStock(
  product: ValidatorProduct,
  reference: ValidatorReference,
  quantity: number,
  packItemId: string | undefined,
  productId: string | undefined,
  errors: ConfigurationValidationError[],
): boolean {
  if (!isProductPurchasable(product) || !reference.isActive) {
    errors.push({
      code: 'REFERENCE_INACTIVE',
      message: `The selected reference for ${product.name} is inactive.`,
      packItemId,
      productId,
    });
    return false;
  }

  if (availableReferenceStock(reference) < quantity) {
    errors.push({
      code: 'INSUFFICIENT_STOCK',
      message: `The selected reference for ${product.name} does not have enough stock.`,
      packItemId,
      productId,
    });
    return false;
  }

  return true;
}

/**
 * Applies the Pack's configured discount to the summed subtotal. A customizable
 * Pack is priced by summing the current reference prices; only the
 * `SUM_ITEMS_WITH_DISCOUNT` mode applies a discount. Never returns below zero.
 */
function applyConfiguredDiscount(
  pack: ValidatorPack,
  subtotal: Prisma.Decimal,
): Prisma.Decimal {
  if (pack.priceMode !== PriceMode.SUM_ITEMS_WITH_DISCOUNT) {
    return subtotal;
  }

  let discount = new Prisma.Decimal(0);
  if (pack.discountAmount) {
    discount = Prisma.Decimal.min(new Prisma.Decimal(pack.discountAmount), subtotal);
  } else if (pack.discountPercentage) {
    const calculated = subtotal
      .times(new Prisma.Decimal(pack.discountPercentage))
      .div(100);
    discount = Prisma.Decimal.min(calculated, subtotal);
  }

  return Prisma.Decimal.max(subtotal.minus(discount), new Prisma.Decimal(0));
}
