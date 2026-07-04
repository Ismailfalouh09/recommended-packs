import { Injectable } from '@nestjs/common';
import { CriterionMatchResult } from '../matching/criterion-matcher.interface';

/**
 * Pack Recommendation MVP — adds up the per-criterion scores into one Pack score.
 *
 * This is the only place criterion scores are summed. It has no database access,
 * no response formatting, and no knowledge of individual criteria; it simply
 * totals whatever the matchers produced (weights live in recommendation-weights).
 */
@Injectable()
export class PackScoreAggregatorService {
  aggregate(results: CriterionMatchResult[]): number {
    return results.reduce((total, result) => total + result.score, 0);
  }
}
