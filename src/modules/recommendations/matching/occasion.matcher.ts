import { Injectable } from '@nestjs/common';
import { PackCompatibilityCriterion } from '@prisma/client';
import { ExactValueCriterionMatcher } from './criterion-matcher.interface';
import { RECOMMENDATION_WEIGHTS } from '../scoring/recommendation-weights';

/**
 * Occasion — a non-matching value is a SOFT mismatch: it scores 0 points but does
 * NOT exclude the Pack. (There is no OCCASION quiz question yet, so in practice
 * the customer value is usually absent and this criterion is NOT_APPLICABLE.)
 */
@Injectable()
export class OccasionMatcher extends ExactValueCriterionMatcher {
  readonly criterion = PackCompatibilityCriterion.OCCASION;
  protected readonly matchScore =
    RECOMMENDATION_WEIGHTS[PackCompatibilityCriterion.OCCASION];
  protected readonly hardFailureOnMismatch = false;
  protected readonly matchReason = 'Suited to your occasion';
}
