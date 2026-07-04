import { PackCompatibilityCriterion } from '@prisma/client';

/**
 * Pack Recommendation MVP — the single source of truth for criterion weights.
 *
 * Changing how much a criterion is worth happens here and nowhere else. The five
 * weights sum to 100, so an aggregated score doubles as a 0–100 match percentage.
 */
export const RECOMMENDATION_WEIGHTS: Record<
  PackCompatibilityCriterion,
  number
> = {
  [PackCompatibilityCriterion.MAKEUP_STYLE]: 30,
  [PackCompatibilityCriterion.SKIN_TONE]: 25,
  [PackCompatibilityCriterion.SKIN_TYPE]: 20,
  [PackCompatibilityCriterion.BUDGET]: 15,
  [PackCompatibilityCriterion.OCCASION]: 10,
};

/**
 * Budget awards the full weight when real Pack price is inside a known customer
 * budget range. A Pack below that range is still affordable and earns 12 points;
 * a Pack above the range is excluded. When no numeric range exists in data, the
 * budget matcher uses the documented LOW < MEDIUM < HIGH fallback.
 */
export const BUDGET_INSIDE_SCORE =
  RECOMMENDATION_WEIGHTS[PackCompatibilityCriterion.BUDGET]; // 15
export const BUDGET_BELOW_SCORE = 12;

/** Sum of all weights (100); the maximum achievable aggregated score. */
export const RECOMMENDATION_MAX_SCORE = Object.values(
  RECOMMENDATION_WEIGHTS,
).reduce((sum, weight) => sum + weight, 0);
