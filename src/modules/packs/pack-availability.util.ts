import { PackItemRole, PackStatus } from '@prisma/client';

/**
 * Pack Core Evolution (Phase 4A) — reusable Pack availability calculation for
 * public browsing.
 *
 * A Pack is "available now" when:
 *  - it is active/public (`status = ACTIVE` and `isActive = true`), and
 *  - every blocking item (role `FIXED` or `REQUIRED_SELECTABLE`) has at least
 *    one valid, active reference with enough available stock to cover the item's
 *    required quantity.
 *
 * Optional items (`OPTIONAL_INCLUDED`) and add-ons (`OPTIONAL_ADDON`) never block
 * availability.
 *
 * This calculation is browsing-only: it does NOT reserve stock and does not
 * change checkout behavior.
 */

/** Item roles that must be satisfiable for a Pack to be considered available. */
const BLOCKING_ROLES: ReadonlySet<PackItemRole> = new Set([
  PackItemRole.FIXED,
  PackItemRole.REQUIRED_SELECTABLE,
]);

export interface AvailabilityReference {
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity?: number | null;
}

export interface AvailabilityItem {
  role: PackItemRole;
  /** Required units of this item per Pack. */
  quantity: number;
  /**
   * The pinned reference for a FIXED_REFERENCE item, when the Pack fixes an exact
   * reference. `null` when the item resolves a reference from the product's set.
   */
  fixedReference?: AvailabilityReference | null;
  /** Candidate references (e.g. the product's active references) for the slot. */
  candidateReferences: AvailabilityReference[];
}

export interface AvailabilityPack {
  status: PackStatus;
  isActive: boolean;
  items: AvailabilityItem[];
}

/** Available units for a reference (never negative). */
export function availableReferenceStock(
  reference: AvailabilityReference,
): number {
  return Math.max(
    reference.stockQuantity - (reference.reservedQuantity ?? 0),
    0,
  );
}

/** A reference can satisfy a slot when it is active and has enough free stock. */
function isReferenceUsable(
  reference: AvailabilityReference,
  requiredQuantity: number,
): boolean {
  return (
    reference.isActive &&
    availableReferenceStock(reference) >= Math.max(requiredQuantity, 1)
  );
}

/** True when a single blocking item has at least one usable reference. */
function isItemSatisfiable(item: AvailabilityItem): boolean {
  const requiredQuantity = item.quantity;

  // A pinned fixed reference is the only candidate for that slot.
  if (item.fixedReference) {
    return isReferenceUsable(item.fixedReference, requiredQuantity);
  }

  return item.candidateReferences.some((reference) =>
    isReferenceUsable(reference, requiredQuantity),
  );
}

/**
 * Computes browsing availability for a Pack. Pure and side-effect free so it can
 * be unit-tested and reused across the public list, detail, and future flows.
 */
export function isPackAvailableNow(pack: AvailabilityPack): boolean {
  if (pack.status !== PackStatus.ACTIVE || !pack.isActive) {
    return false;
  }

  return pack.items
    .filter((item) => BLOCKING_ROLES.has(item.role))
    .every((item) => isItemSatisfiable(item));
}
