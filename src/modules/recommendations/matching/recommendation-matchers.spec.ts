import {
  PackCompatibilityCriterion,
  PackCompatibilityMode,
} from '@prisma/client';
import { BudgetRange, CriterionProfile } from './criterion-matcher.interface';
import { BudgetMatcher } from './budget.matcher';
import { MakeupStyleMatcher } from './makeup-style.matcher';
import { OccasionMatcher } from './occasion.matcher';
import { SkinToneMatcher } from './skin-tone.matcher';
import { SkinTypeMatcher } from './skin-type.matcher';

function restricted(...optionCodes: string[]): CriterionProfile {
  return {
    mode: PackCompatibilityMode.RESTRICTED,
    optionCodes,
  };
}

function universal(): CriterionProfile {
  return {
    mode: PackCompatibilityMode.UNIVERSAL,
    optionCodes: [],
  };
}

describe('Pack Recommendation MVP matchers', () => {
  describe('SkinToneMatcher', () => {
    const matcher = new SkinToneMatcher();

    it('scores a restricted exact match', () => {
      expect(
        matcher.match({
          customerValue: 'MEDIUM',
          profile: restricted('MEDIUM'),
        }),
      ).toEqual({
        criterion: PackCompatibilityCriterion.SKIN_TONE,
        status: 'MATCH',
        score: 25,
        isHardFailure: false,
        customerReason: 'Suitable for your selected skin tone',
      });
    });

    it('hard-excludes a restricted mismatch', () => {
      expect(
        matcher.match({
          customerValue: 'MEDIUM',
          profile: restricted('LIGHT'),
        }),
      ).toEqual({
        criterion: PackCompatibilityCriterion.SKIN_TONE,
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: true,
      });
    });

    it('does not score an explicit universal profile', () => {
      expect(
        matcher.match({ customerValue: 'MEDIUM', profile: universal() }),
      ).toEqual({
        criterion: PackCompatibilityCriterion.SKIN_TONE,
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not treat an unconfigured profile as a match', () => {
      expect(matcher.match({ customerValue: 'MEDIUM' })).toEqual({
        criterion: PackCompatibilityCriterion.SKIN_TONE,
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });
  });

  describe('SkinTypeMatcher', () => {
    const matcher = new SkinTypeMatcher();

    it('scores a restricted exact match', () => {
      expect(
        matcher.match({ customerValue: 'OILY', profile: restricted('OILY') }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.SKIN_TYPE,
        status: 'MATCH',
        score: 20,
        isHardFailure: false,
        customerReason: 'Designed for your skin type',
      });
    });

    it('hard-excludes a restricted mismatch', () => {
      expect(
        matcher.match({ customerValue: 'OILY', profile: restricted('DRY') }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.SKIN_TYPE,
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: true,
      });
    });

    it('does not score an explicit universal profile', () => {
      expect(
        matcher.match({ customerValue: 'OILY', profile: universal() }),
      ).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not treat an unconfigured profile as a match', () => {
      expect(matcher.match({ customerValue: 'OILY' })).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });
  });

  describe('MakeupStyleMatcher', () => {
    const matcher = new MakeupStyleMatcher();

    it('scores a restricted exact match', () => {
      expect(
        matcher.match({
          customerValue: 'NATURAL',
          profile: restricted('NATURAL'),
        }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.MAKEUP_STYLE,
        status: 'MATCH',
        score: 30,
        isHardFailure: false,
        customerReason: 'Matches your makeup style',
      });
    });

    it('keeps a restricted mismatch eligible with zero score', () => {
      expect(
        matcher.match({
          customerValue: 'NATURAL',
          profile: restricted('GLAM'),
        }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.MAKEUP_STYLE,
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not score an explicit universal profile', () => {
      expect(
        matcher.match({ customerValue: 'NATURAL', profile: universal() }),
      ).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not treat an unconfigured profile as a match', () => {
      expect(matcher.match({ customerValue: 'NATURAL' })).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });
  });

  describe('OccasionMatcher', () => {
    const matcher = new OccasionMatcher();

    it('scores a restricted exact match', () => {
      expect(
        matcher.match({
          customerValue: 'EVERYDAY',
          profile: restricted('EVERYDAY'),
        }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.OCCASION,
        status: 'MATCH',
        score: 10,
        isHardFailure: false,
        customerReason: 'Suited to your occasion',
      });
    });

    it('keeps a restricted mismatch eligible with zero score', () => {
      expect(
        matcher.match({
          customerValue: 'EVERYDAY',
          profile: restricted('PARTY'),
        }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.OCCASION,
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not score an explicit universal profile', () => {
      expect(
        matcher.match({ customerValue: 'EVERYDAY', profile: universal() }),
      ).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });

    it('does not treat an unconfigured profile as a match', () => {
      expect(matcher.match({ customerValue: 'EVERYDAY' })).toMatchObject({
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });
  });

  describe('BudgetMatcher', () => {
    const matcher = new BudgetMatcher();
    const lowBudget: BudgetRange = { min: 150, max: 220 };

    it('scores Pack price inside the canonical budget range', () => {
      expect(
        matcher.match({
          customerValue: 'LOW',
          profile: restricted('LOW'),
          customerBudgetRange: lowBudget,
          packSellingPrice: 199,
        }),
      ).toMatchObject({
        criterion: PackCompatibilityCriterion.BUDGET,
        status: 'MATCH',
        score: 15,
        isHardFailure: false,
        customerReason: 'Fits your selected budget',
      });
    });

    it('scores Pack price below the canonical budget range', () => {
      expect(
        matcher.match({
          customerValue: 'LOW',
          profile: restricted('LOW'),
          customerBudgetRange: lowBudget,
          packSellingPrice: 120,
        }),
      ).toMatchObject({
        status: 'MATCH',
        score: 12,
        isHardFailure: false,
        customerReason: 'Within your budget',
      });
    });

    it('excludes Pack price above the canonical budget range', () => {
      expect(
        matcher.match({
          customerValue: 'LOW',
          profile: restricted('LOW'),
          customerBudgetRange: lowBudget,
          packSellingPrice: 250,
        }),
      ).toMatchObject({
        status: 'NO_MATCH',
        score: 0,
        isHardFailure: true,
      });
    });

    it('uses real Pack price over coarse tier labels when a range exists', () => {
      expect(
        matcher.match({
          customerValue: 'LOW',
          profile: restricted('HIGH'),
          customerBudgetRange: lowBudget,
          packSellingPrice: 199,
        }),
      ).toMatchObject({
        status: 'MATCH',
        score: 15,
        isHardFailure: false,
      });
    });

    it('treats a legacy budget option with no numeric range as not applicable', () => {
      expect(
        matcher.match({
          customerValue: 'LOW',
          profile: restricted('LOW'),
          customerBudgetRange: null,
          packSellingPrice: 199,
        }),
      ).toEqual({
        criterion: PackCompatibilityCriterion.BUDGET,
        status: 'NOT_APPLICABLE',
        score: 0,
        isHardFailure: false,
      });
    });
  });
});
