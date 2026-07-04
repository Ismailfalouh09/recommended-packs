import { Injectable } from '@nestjs/common';
import {
  PackCompatibilityCriterion,
  PackCompatibilityMode,
} from '@prisma/client';
import {
  BudgetRange,
  CriterionMatchInput,
  CriterionMatchResult,
  CriterionMatcher,
} from './criterion-matcher.interface';
import {
  BUDGET_BELOW_SCORE,
  BUDGET_INSIDE_SCORE,
} from '../scoring/recommendation-weights';

/**
 * Budget - numeric only. Real Pack selling price is authoritative when the
 * selected customer budget option has a complete canonical range:
 *
 *   - inside selected range  -> MATCH, 15 pts
 *   - below selected range   -> MATCH, 12 pts
 *   - above selected range   -> HARD exclusion
 *
 * Legacy/incomplete budget options with no numeric range are treated as
 * NOT_APPLICABLE. The matcher does not invent LOW/MEDIUM/HIGH thresholds.
 */
@Injectable()
export class BudgetMatcher implements CriterionMatcher {
  readonly criterion = PackCompatibilityCriterion.BUDGET;

  match(input: CriterionMatchInput): CriterionMatchResult {
    const { profile, customerValue, customerBudgetRange, packSellingPrice } =
      input;

    if (
      !profile ||
      profile.mode === PackCompatibilityMode.UNIVERSAL ||
      !customerValue
    ) {
      return this.notApplicable();
    }

    if (
      customerBudgetRange &&
      this.hasCompleteRange(customerBudgetRange) &&
      typeof packSellingPrice === 'number' &&
      Number.isFinite(packSellingPrice)
    ) {
      return this.matchAgainstNumericRange(
        packSellingPrice,
        customerBudgetRange,
      );
    }

    return this.notApplicable();
  }

  private matchAgainstNumericRange(
    packSellingPrice: number,
    range: { min: number; max: number },
  ): CriterionMatchResult {
    if (packSellingPrice > range.max) {
      return {
        criterion: this.criterion,
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: true,
      };
    }

    if (packSellingPrice < range.min) {
      return {
        criterion: this.criterion,
        status: 'MATCH',
        score: BUDGET_BELOW_SCORE,
        isHardFailure: false,
        customerReason: 'Within your budget',
      };
    }

    return {
      criterion: this.criterion,
      status: 'MATCH',
      score: BUDGET_INSIDE_SCORE,
      isHardFailure: false,
      customerReason: 'Fits your selected budget',
    };
  }

  private notApplicable(): CriterionMatchResult {
    return {
      criterion: this.criterion,
      status: 'NOT_APPLICABLE',
      score: 0,
      isHardFailure: false,
    };
  }

  private hasCompleteRange(
    range: BudgetRange,
  ): range is { min: number; max: number } {
    return (
      range.min !== null &&
      range.max !== null &&
      Number.isFinite(range.min) &&
      Number.isFinite(range.max) &&
      range.min >= 0 &&
      range.max >= range.min
    );
  }
}
