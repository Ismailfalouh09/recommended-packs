import { Injectable } from '@nestjs/common';
import {
  PackCompatibilityCriterion,
  PackCompatibilityMode,
  PriceMode,
  Prisma,
} from '@prisma/client';
import { PACK_COMPATIBILITY_GROUP_CODE } from '../packs/pack-compatibility.constants';
import { PackEligibilityService } from './eligibility/pack-eligibility.service';
import {
  BudgetRange,
  CriterionMatcher,
  CriterionProfile,
} from './matching/criterion-matcher.interface';
import { BudgetMatcher } from './matching/budget.matcher';
import { MakeupStyleMatcher } from './matching/makeup-style.matcher';
import { OccasionMatcher } from './matching/occasion.matcher';
import { SkinToneMatcher } from './matching/skin-tone.matcher';
import { SkinTypeMatcher } from './matching/skin-type.matcher';
import { RecommendationExplanationService } from './explanation/recommendation-explanation.service';
import { PackScoreAggregatorService } from './scoring/pack-score-aggregator.service';
import {
  EngineCompatibilityProfile,
  EnginePack,
  EngineRecommendation,
  RuleScores,
} from './recommendation-engine.service';

type AnswerMap = Record<string, string>;
type BudgetRangeByCode = Record<string, BudgetRange>;

/** Up to three unique Packs are returned: best match + up to two alternatives. */
const MAX_RECOMMENDATIONS = 3;

/**
 * Pack Recommendation MVP — orchestrates the five-criterion algorithm.
 *
 * Pipeline (each step is a single-responsibility collaborator):
 *   1. eligibility  — which Packs can be considered (engine, Phase-1 safe behavior)
 *   2. matching     — one matcher per criterion over the Pack compatibility profile
 *   3. exclusion    — drop a Pack if ANY matcher reports a hard failure
 *   4. scoring      — sum the weighted criterion scores
 *   5. explanation  — build customer-safe reasons from positive matches only
 *   6. ranking      — sort, dedupe by Pack id, take the top three, tag the type
 *
 * A future change to one criterion's rule touches only that matcher.
 */
@Injectable()
export class RecommendationUseCaseService {
  private readonly matchers: CriterionMatcher[];

  constructor(
    private readonly eligibility: PackEligibilityService,
    private readonly aggregator: PackScoreAggregatorService,
    private readonly explanation: RecommendationExplanationService,
    skinTone: SkinToneMatcher,
    skinType: SkinTypeMatcher,
    makeupStyle: MakeupStyleMatcher,
    budget: BudgetMatcher,
    occasion: OccasionMatcher,
  ) {
    this.matchers = [skinTone, skinType, makeupStyle, budget, occasion];
  }

  recommend(input: {
    answers: AnswerMap;
    packs: EnginePack[];
    ruleScores: RuleScores;
    budgetRangesByOptionCode?: BudgetRangeByCode;
  }): EngineRecommendation[] {
    const candidates = this.eligibility.getEligibleCandidates(input);
    const packsById = new Map(input.packs.map((pack) => [pack.id, pack]));

    const ranked = candidates
      .map((candidate) => {
        const pack = packsById.get(candidate.packId);
        const profiles = this.buildProfiles(pack?.compatibilityProfiles ?? []);
        const sellingPrice = this.resolveSellingPrice(pack, candidate);

        const results = this.matchers.map((matcher) => {
          const customerValue =
            input.answers[PACK_COMPATIBILITY_GROUP_CODE[matcher.criterion]] ??
            null;

          return matcher.match({
            customerValue,
            profile: profiles.get(matcher.criterion),
            customerBudgetRange:
              matcher.criterion === PackCompatibilityCriterion.BUDGET &&
              customerValue
                ? (input.budgetRangesByOptionCode?.[customerValue] ?? null)
                : null,
            packSellingPrice: sellingPrice,
          });
        });

        return { candidate, results };
      })
      // Hard exclusions: any disqualifying criterion removes the Pack entirely.
      .filter((entry) => !entry.results.some((result) => result.isHardFailure))
      .map((entry) => ({
        ...entry,
        compatibilityScore: this.aggregator.aggregate(entry.results),
      }))
      .sort((left, right) => {
        if (right.compatibilityScore !== left.compatibilityScore) {
          return right.compatibilityScore - left.compatibilityScore;
        }
        if (right.candidate.totalScore !== left.candidate.totalScore) {
          return right.candidate.totalScore - left.candidate.totalScore;
        }
        if (right.candidate.priority !== left.candidate.priority) {
          return right.candidate.priority - left.candidate.priority;
        }
        return left.candidate.packName.localeCompare(right.candidate.packName);
      });

    const uniqueRanked = ranked.filter((entry, index, entries) => {
      return (
        entries.findIndex(
          (candidate) => candidate.candidate.packId === entry.candidate.packId,
        ) === index
      );
    });

    return uniqueRanked.slice(0, MAX_RECOMMENDATIONS).map((entry, index) => {
      const customerReasons = this.explanation.buildCustomerReasons(
        entry.results,
      );

      return {
        ...entry.candidate,
        rank: index + 1,
        compatibilityScore: entry.compatibilityScore,
        customerReasons,
        recommendationType: index === 0 ? 'BEST_MATCH' : 'ALTERNATIVE',
      };
    });
  }

  private buildProfiles(
    profiles: EngineCompatibilityProfile[],
  ): Map<PackCompatibilityCriterion, CriterionProfile> {
    const byCriterion = new Map<PackCompatibilityCriterion, CriterionProfile>();

    for (const profile of profiles) {
      byCriterion.set(profile.criterion, {
        mode: profile.mode,
        optionCodes:
          profile.mode === PackCompatibilityMode.UNIVERSAL
            ? []
            : profile.values.map((value) => value.attributeOption.code),
      });
    }

    return byCriterion;
  }

  private resolveSellingPrice(
    pack: EnginePack | undefined,
    candidate: EngineRecommendation,
  ): number | null {
    if (!pack || pack.fixedPrice === null || pack.fixedPrice === undefined) {
      if (
        pack?.priceMode === PriceMode.SUM_ITEMS ||
        pack?.priceMode === PriceMode.SUM_ITEMS_WITH_DISCOUNT
      ) {
        return this.resolveSumItemsSellingPrice(pack, candidate);
      }

      return null;
    }

    return Number(pack.fixedPrice);
  }

  private resolveSumItemsSellingPrice(
    pack: EnginePack,
    candidate: EngineRecommendation,
  ): number | null {
    let subtotal = 0;

    for (const selectedItem of candidate.selectedItems) {
      if (selectedItem.referenceId === null) {
        return null;
      }

      const packItem = pack.items.find(
        (item) => item.id === selectedItem.packItemId,
      );
      const reference = packItem?.product.references.find(
        (itemReference) => itemReference.id === selectedItem.referenceId,
      );
      const unitPrice = this.resolveReferencePrice(
        packItem?.product.basePrice,
        reference?.priceOverride,
        reference?.priceDelta,
      );

      if (unitPrice === null) {
        return null;
      }

      subtotal += unitPrice * selectedItem.quantity;
    }

    if (pack.priceMode === PriceMode.SUM_ITEMS_WITH_DISCOUNT) {
      const discountAmount = this.toNumber(pack.discountAmount);
      const discountPercentage = this.toNumber(pack.discountPercentage);

      if (discountAmount !== null) {
        subtotal -= discountAmount;
      } else if (discountPercentage !== null) {
        subtotal *= 1 - discountPercentage / 100;
      }
    }

    return Math.max(0, Math.round(subtotal * 100) / 100);
  }

  private resolveReferencePrice(
    basePrice: Prisma.Decimal | number | null | undefined,
    priceOverride: Prisma.Decimal | number | null | undefined,
    priceDelta: Prisma.Decimal | number | null | undefined,
  ): number | null {
    const override = this.toNumber(priceOverride);
    if (override !== null) {
      return override;
    }

    const base = this.toNumber(basePrice);
    if (base === null) {
      return null;
    }

    return base + (this.toNumber(priceDelta) ?? 0);
  }

  private toNumber(
    value: Prisma.Decimal | number | string | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof Prisma.Decimal) {
      return value.toNumber();
    }

    return Number(value);
  }
}
