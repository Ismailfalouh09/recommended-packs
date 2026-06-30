import { Injectable } from '@nestjs/common';
import { CriterionMatchResult } from '../matching/criterion-matcher.interface';

/**
 * Pack Recommendation MVP — turns match results into customer-safe reasons.
 *
 * Reasons are derived ONLY from real positive matches. This service never emits
 * internal scores, weights, margin, costs, internal stock quantities, or private
 * quiz answers — those concerns live elsewhere and must not leak to the customer.
 */
@Injectable()
export class RecommendationExplanationService {
  buildCustomerReasons(results: CriterionMatchResult[]): string[] {
    return results
      .filter(
        (result): result is CriterionMatchResult & { customerReason: string } =>
          result.status === 'MATCH' && Boolean(result.customerReason),
      )
      .map((result) => result.customerReason);
  }
}
