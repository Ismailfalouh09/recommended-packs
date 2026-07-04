import { PackItemRole, Prisma } from '@prisma/client';
import { toMoneyNumber } from './decimal.util';
import { isAtOrAboveMinAllowedPrice } from './pack-price-floor.util';

/**
 * Pack Core Evolution (Phase 3) — typed, reusable pack-configuration snapshot.
 *
 * This is the immutable payload frozen on `Order.packConfigurationSnapshot` at
 * order creation. It captures *what was bought and why it was valid* so the
 * order stays historically correct even if the source pack/product/stock later
 * changes.
 *
 * Privacy contract (see master plan Q8/Q9): the snapshot NEVER contains private
 * quiz answers, internal recommendation scores, reference costs, or margins.
 * The builder input is a strict allow-list, so those fields cannot leak in.
 */

/** Bump when the snapshot shape changes; consumers can branch on it. */
export const PACK_CONFIGURATION_SNAPSHOT_VERSION = 1;

/**
 * How the configured pack originated. Mirrors the planned
 * `PackConfiguration.sourceType`; declared here as a string union because the
 * `PackConfiguration` entity itself does not exist until later phases.
 */
export type PackConfigurationSourceType =
  | 'FIXED'
  | 'CUSTOMIZED'
  | 'QUIZ_RECOMMENDED'
  | 'QUIZ_GENERATED';

export type PackConfigurationValidationStatus = 'VALID' | 'INVALID';

export interface PackConfigurationSnapshotItem {
  productId: string;
  productReferenceId: string | null;
  productName: string;
  referenceName: string | null;
  role: PackItemRole;
  quantity: number;
  unitPrice: number;
}

export interface PackConfigurationSnapshotValidation {
  status: PackConfigurationValidationStatus;
  priceFloorRespected: boolean;
  messages: string[];
}

export interface PackConfigurationSnapshot {
  version: number;
  sourcePackId: string | null;
  sourcePackName: string | null;
  sourceType: PackConfigurationSourceType;
  currency: string;
  finalPrice: number;
  minAllowedPrice: number | null;
  validation: PackConfigurationSnapshotValidation;
  selectedItems: PackConfigurationSnapshotItem[];
  removedItems: PackConfigurationSnapshotItem[];
  addedItems: PackConfigurationSnapshotItem[];
}

type MoneyLike = Prisma.Decimal | number | string;

interface SnapshotItemInput {
  productId: string;
  productReferenceId?: string | null;
  productName: string;
  referenceName?: string | null;
  role: PackItemRole;
  quantity: number;
  unitPrice: MoneyLike;
}

export interface BuildPackConfigurationSnapshotInput {
  sourcePackId?: string | null;
  sourcePackName?: string | null;
  sourceType: PackConfigurationSourceType;
  currency: string;
  finalPrice: MoneyLike;
  minAllowedPrice?: MoneyLike | null;
  selectedItems?: SnapshotItemInput[];
  removedItems?: SnapshotItemInput[];
  addedItems?: SnapshotItemInput[];
  validationMessages?: string[];
}

function toSnapshotItem(item: SnapshotItemInput): PackConfigurationSnapshotItem {
  return {
    productId: item.productId,
    productReferenceId: item.productReferenceId ?? null,
    productName: item.productName,
    referenceName: item.referenceName ?? null,
    role: item.role,
    quantity: item.quantity,
    unitPrice: toMoneyNumber(item.unitPrice) ?? 0,
  };
}

/**
 * Builds an immutable, privacy-safe pack-configuration snapshot from a strict
 * allow-list of fields. Decimals are normalized to numbers and the price-floor
 * outcome is derived with the shared {@link isAtOrAboveMinAllowedPrice} guard so
 * the snapshot's validation result matches the enforcement logic.
 */
export function buildPackConfigurationSnapshot(
  input: BuildPackConfigurationSnapshotInput,
): PackConfigurationSnapshot {
  const finalPrice = toMoneyNumber(input.finalPrice) ?? 0;
  const minAllowedPrice =
    input.minAllowedPrice === null || input.minAllowedPrice === undefined
      ? null
      : toMoneyNumber(input.minAllowedPrice);

  const priceFloorRespected = isAtOrAboveMinAllowedPrice(
    input.finalPrice,
    input.minAllowedPrice ?? null,
  );

  const messages = input.validationMessages ?? [];

  return {
    version: PACK_CONFIGURATION_SNAPSHOT_VERSION,
    sourcePackId: input.sourcePackId ?? null,
    sourcePackName: input.sourcePackName ?? null,
    sourceType: input.sourceType,
    currency: input.currency,
    finalPrice,
    minAllowedPrice,
    validation: {
      status: priceFloorRespected && messages.length === 0 ? 'VALID' : 'INVALID',
      priceFloorRespected,
      messages,
    },
    selectedItems: (input.selectedItems ?? []).map(toSnapshotItem),
    removedItems: (input.removedItems ?? []).map(toSnapshotItem),
    addedItems: (input.addedItems ?? []).map(toSnapshotItem),
  };
}
