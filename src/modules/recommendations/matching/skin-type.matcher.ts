import { Injectable } from '@nestjs/common';
import { PackCompatibilityCriterion } from '@prisma/client';
import { ExactValueCriterionMatcher } from './criterion-matcher.interface';
import { RECOMMENDATION_WEIGHTS } from '../scoring/recommendation-weights';

/**
 * Skin type — a RESTRICTED non-matching value is a HARD exclusion: a Pack built
 * for a different skin type must never be recommended.
 */
@Injectable()
export class SkinTypeMatcher extends ExactValueCriterionMatcher {
  readonly criterion = PackCompatibilityCriterion.SKIN_TYPE;
  protected readonly matchScore =
    RECOMMENDATION_WEIGHTS[PackCompatibilityCriterion.SKIN_TYPE];
  protected readonly hardFailureOnMismatch = true;
  protected readonly matchReason = 'Designed for your skin type';
}
