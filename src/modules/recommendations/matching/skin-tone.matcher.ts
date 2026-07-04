import { Injectable } from '@nestjs/common';
import { PackCompatibilityCriterion } from '@prisma/client';
import { ExactValueCriterionMatcher } from './criterion-matcher.interface';
import { RECOMMENDATION_WEIGHTS } from '../scoring/recommendation-weights';

/**
 * Skin tone — a RESTRICTED non-matching value is a HARD exclusion: a Pack built
 * for other skin tones must never be recommended.
 */
@Injectable()
export class SkinToneMatcher extends ExactValueCriterionMatcher {
  readonly criterion = PackCompatibilityCriterion.SKIN_TONE;
  protected readonly matchScore =
    RECOMMENDATION_WEIGHTS[PackCompatibilityCriterion.SKIN_TONE];
  protected readonly hardFailureOnMismatch = true;
  protected readonly matchReason = 'Suitable for your selected skin tone';
}
