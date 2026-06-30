import { Injectable } from '@nestjs/common';
import { PackCompatibilityCriterion } from '@prisma/client';
import { ExactValueCriterionMatcher } from './criterion-matcher.interface';
import { RECOMMENDATION_WEIGHTS } from '../scoring/recommendation-weights';

/**
 * Makeup style — a non-matching value is a SOFT mismatch: it scores 0 points but
 * does NOT exclude the Pack.
 */
@Injectable()
export class MakeupStyleMatcher extends ExactValueCriterionMatcher {
  readonly criterion = PackCompatibilityCriterion.MAKEUP_STYLE;
  protected readonly matchScore =
    RECOMMENDATION_WEIGHTS[PackCompatibilityCriterion.MAKEUP_STYLE];
  protected readonly hardFailureOnMismatch = false;
  protected readonly matchReason = 'Matches your makeup style';
}
