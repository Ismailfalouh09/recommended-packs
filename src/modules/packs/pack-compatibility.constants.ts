import { PackCompatibilityCriterion } from '@prisma/client';

/**
 * Pack Core Evolution (Phase 2.5) — Pack Compatibility Profile foundation.
 *
 * The single source of truth that maps each of the five supported compatibility
 * dimensions to the canonical `AttributeGroup.code` whose `AttributeOption`s the
 * quiz already uses. Compatibility values are normalized links to those canonical
 * options — there are no duplicate free-text values, and no magic strings outside
 * this map. The future recommendation algorithm can import this map to resolve a
 * criterion to its canonical group without hard-coded literals.
 *
 * Note: the BUDGET tier (LOW/MEDIUM/HIGH) is only a coarse normalized hint. The
 * recommendation engine will later use the Pack's real commercial price as the
 * authoritative source for affordability — this profile never replaces price
 * validation.
 */
export const PACK_COMPATIBILITY_GROUP_CODE: Record<
  PackCompatibilityCriterion,
  string
> = {
  [PackCompatibilityCriterion.SKIN_TONE]: 'SKIN_COLOR',
  [PackCompatibilityCriterion.SKIN_TYPE]: 'SKIN_TYPE',
  [PackCompatibilityCriterion.MAKEUP_STYLE]: 'STYLE',
  [PackCompatibilityCriterion.BUDGET]: 'BUDGET',
  [PackCompatibilityCriterion.OCCASION]: 'OCCASION',
};
