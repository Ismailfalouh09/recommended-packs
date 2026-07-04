import {
  PackCompatibilityCriterion,
  PackCompatibilityMode,
} from '@prisma/client';

/**
 * Pack Recommendation MVP — shared contract for a single compatibility criterion.
 *
 * Each matcher owns exactly one criterion (skin tone, skin type, makeup style,
 * budget, occasion). A matcher is a pure function over normalized values: it
 * receives the customer's canonical answer and the Pack's compatibility data for
 * that one criterion and returns a single standard result. It never touches
 * Prisma, stock, HTTP, or any other criterion. Adding/changing one criterion's
 * rule therefore stays isolated to its own matcher.
 */

export type CriterionMatchStatus = 'MATCH' | 'NO_MATCH' | 'NOT_APPLICABLE';

/**
 * The Pack's compatibility state for one criterion, derived from the
 * PackCompatibilityProfile foundation:
 * - `mode = UNIVERSAL` (no values): the Pack does not depend on this criterion.
 * - `mode = RESTRICTED` (>= 1 value): the Pack is intended only for `optionCodes`.
 * - UNCONFIGURED is represented by the ABSENCE of a profile (`undefined`) and is
 *   intentionally distinct from UNIVERSAL — it must never silently behave as
 *   universal and must never become a strong recommendation candidate.
 */
export interface CriterionProfile {
  mode: PackCompatibilityMode;
  /** Canonical AttributeOption codes (empty for UNIVERSAL). */
  optionCodes: string[];
}

export interface CriterionMatchInput {
  /** Canonical option code from the customer's quiz answer, or null if unanswered. */
  customerValue: string | null;
  /** The Pack's profile for this criterion. `undefined` means UNCONFIGURED. */
  profile?: CriterionProfile;
  /**
   * Canonical numeric range for the selected customer budget option, when the
   * selected AttributeOption provides one. Legacy/incomplete options pass null
   * so the budget matcher contributes no score and no hard exclusion.
   */
  customerBudgetRange?: BudgetRange | null;
  /**
   * Authoritative Pack selling price, passed for transparency/future numeric
   * budget logic. Only the budget matcher consults it. May be null when the
   * final price cannot be resolved safely (for example, pending customer choice).
   */
  packSellingPrice?: number | null;
}

export interface CriterionMatchResult {
  criterion: PackCompatibilityCriterion;
  status: CriterionMatchStatus;
  /** Weighted points contributed by this criterion (0 unless a positive MATCH). */
  score: number;
  /** When true the Pack must be excluded entirely (a disqualifying mismatch). */
  isHardFailure: boolean;
  /**
   * A customer-safe sentence, present only for a real positive MATCH. Never
   * contains scores, weights, margin, cost, stock, or private quiz data.
   */
  customerReason?: string;
}

export interface CriterionMatcher {
  readonly criterion: PackCompatibilityCriterion;
  match(input: CriterionMatchInput): CriterionMatchResult;
}

export interface BudgetRange {
  min: number | null;
  max: number | null;
}

/**
 * Shared base implementing the UNIVERSAL / RESTRICTED / UNCONFIGURED handling so
 * every "exact value" criterion (skin tone, skin type, makeup style, occasion)
 * differs only in its weight, its hard-vs-soft mismatch policy, and its reason.
 * Budget overrides `match` because it is ordinal rather than exact.
 */
export abstract class ExactValueCriterionMatcher implements CriterionMatcher {
  abstract readonly criterion: PackCompatibilityCriterion;
  /** Points awarded on a positive MATCH. */
  protected abstract readonly matchScore: number;
  /** Whether a RESTRICTED non-matching value excludes the Pack. */
  protected abstract readonly hardFailureOnMismatch: boolean;
  /** Customer-safe reason emitted only on a positive MATCH. */
  protected abstract readonly matchReason: string;

  match(input: CriterionMatchInput): CriterionMatchResult {
    const { profile, customerValue } = input;

    // UNCONFIGURED (no profile) and UNIVERSAL both yield NOT_APPLICABLE: no
    // exclusion, no score, no customer reason. They are kept conceptually
    // distinct (see CriterionProfile) but neither boosts nor excludes a Pack, so
    // a fully-unconfigured Pack scores 0 and can never be a strong candidate.
    if (
      !profile ||
      profile.mode === PackCompatibilityMode.UNIVERSAL ||
      !customerValue
    ) {
      return this.notApplicable();
    }

    if (profile.optionCodes.includes(customerValue)) {
      return {
        criterion: this.criterion,
        status: 'MATCH',
        score: this.matchScore,
        isHardFailure: false,
        customerReason: this.matchReason,
      };
    }

    return {
      criterion: this.criterion,
      status: 'NO_MATCH',
      score: 0,
      isHardFailure: this.hardFailureOnMismatch,
    };
  }

  protected notApplicable(): CriterionMatchResult {
    return {
      criterion: this.criterion,
      status: 'NOT_APPLICABLE',
      score: 0,
      isHardFailure: false,
    };
  }
}
