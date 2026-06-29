import { Injectable } from '@nestjs/common';
import { MatchType, ProductStatus, SelectionMode } from '@prisma/client';

type AnswerMap = Record<string, string>;

export type RuleScores = Record<string, number>;

export interface EngineAttribute {
  matchType: MatchType;
  scoreValue: number;
  isHardFilter: boolean;
  attributeGroup: {
    code: string;
  };
  attributeOption: {
    code: string;
  };
}

export interface EngineReference {
  id: string;
  referenceCode: string;
  referenceName: string;
  stockQuantity: number;
  reservedQuantity: number;
  isActive: boolean;
  image?: unknown;
  attributes: EngineAttribute[];
}

export interface EngineProduct {
  id: string;
  name: string;
  isActive: boolean;
  status: ProductStatus;
  images?: unknown[];
  attributes?: EngineAttribute[];
  references: EngineReference[];
}

export interface EnginePackItem {
  id: string;
  productReferenceId: string | null;
  quantity: number;
  selectionMode: SelectionMode;
  isRequired: boolean;
  product: EngineProduct;
}

export interface EnginePack {
  id: string;
  name: string;
  priority: number;
  images?: unknown[];
  attributes: EngineAttribute[];
  items: EnginePackItem[];
}

export interface SelectedRecommendationItem {
  packItemId: string;
  productId: string;
  productName: string;
  referenceId: string;
  referenceName: string;
  productImages?: unknown[];
  referenceImage?: unknown;
  quantity: number;
  itemScore: number;
  itemMaxScore: number;
  scoredForAverage: boolean;
  reason: Record<string, unknown>;
}

export interface EngineRecommendation {
  packId: string;
  packName: string;
  packImages?: unknown[];
  rank: number;
  totalScore: number;
  matchPercentage: number;
  priority: number;
  reason: {
    packScore: number;
    rawItemsScore: number;
    scoredItemCount: number;
    normalizedItemsScore: number;
    priorityBonus: number;
    totalScore: number;
    matchPercentage: number;
    maximumPossibleScore: number;
    packMatches: Record<
      string,
      {
        customerValue: string | null;
        packValue: string;
        matched: boolean;
        score: number;
      }
    >;
    details: Record<string, unknown>;
  };
  selectedItems: SelectedRecommendationItem[];
}

interface AttributeScore {
  score: number;
  maxScore: number;
  matched: boolean;
  matches: Array<Record<string, unknown>>;
}

@Injectable()
export class RecommendationEngineService {
  private readonly referenceFilterGroups = new Set(['SKIN_COLOR', 'UNDERTONE']);

  private readonly fallbackScores: RuleScores = {
    SKIN_COLOR_MATCH: 40,
    UNDERTONE_MATCH: 25,
    STYLE_MATCH: 20,
    SKIN_TYPE_MATCH: 15,
    BUDGET_MATCH: 10,
  };

  generateRecommendations(input: {
    answers: AnswerMap;
    packs: EnginePack[];
    ruleScores: RuleScores;
  }): EngineRecommendation[] {
    const scores = {
      ...this.fallbackScores,
      ...input.ruleScores,
    };

    return input.packs
      .map((pack) => this.scorePack(pack, input.answers, scores))
      .filter(
        (recommendation): recommendation is EngineRecommendation =>
          recommendation !== null,
      )
      .sort((left, right) => {
        if (right.matchPercentage !== left.matchPercentage) {
          return right.matchPercentage - left.matchPercentage;
        }

        if (right.totalScore !== left.totalScore) {
          return right.totalScore - left.totalScore;
        }

        if (right.priority !== left.priority) {
          return right.priority - left.priority;
        }

        return left.packName.localeCompare(right.packName);
      })
      .slice(0, 10)
      .map((recommendation, index) => ({
        ...recommendation,
        rank: index + 1,
      }));
  }

  private scorePack(
    pack: EnginePack,
    answers: AnswerMap,
    ruleScores: RuleScores,
  ): EngineRecommendation | null {
    let packScore = 0;
    let maximumPackScore = 0;
    let rawItemsScore = 0;
    const priorityBonus = pack.priority;
    const packMatches: EngineRecommendation['reason']['packMatches'] = {};
    const exclusions: string[] = [];

    for (const attribute of pack.attributes) {
      const groupCode = attribute.attributeGroup.code;
      const answerOptionCode = answers[groupCode];
      const matches = answerOptionCode === attribute.attributeOption.code;
      const baseScore = this.scoreForGroup(groupCode, ruleScores);
      const attributeBonus = this.safePositiveScore(attribute.scoreValue);
      const totalAttributeScore = baseScore + attributeBonus;

      if (
        answerOptionCode &&
        (attribute.matchType === MatchType.COMPATIBLE ||
          attribute.matchType === MatchType.BOOST)
      ) {
        maximumPackScore += totalAttributeScore;
      }

      packMatches[groupCode] = {
        customerValue: answerOptionCode ?? null,
        packValue: attribute.attributeOption.code,
        matched: matches,
        score: matches ? totalAttributeScore : 0,
      };

      if (matches && attribute.matchType === MatchType.NOT_COMPATIBLE) {
        if (attribute.isHardFilter) {
          return null;
        }

        continue;
      }

      if (!matches && attribute.isHardFilter) {
        return null;
      }

      if (
        matches &&
        (attribute.matchType === MatchType.COMPATIBLE ||
          attribute.matchType === MatchType.BOOST)
      ) {
        packScore += totalAttributeScore;
      }
    }

    const selectedItems: SelectedRecommendationItem[] = [];

    for (const item of pack.items) {
      if (
        !item.product.isActive ||
        item.product.status !== ProductStatus.ACTIVE
      ) {
        if (item.isRequired) {
          return null;
        }

        exclusions.push(`Inactive optional product ${item.product.name}`);
        continue;
      }

      const selectedReference = this.selectReference(item, answers, ruleScores);

      if (!selectedReference) {
        if (item.isRequired) {
          return null;
        }

        exclusions.push(`No valid optional reference for ${item.product.name}`);
        continue;
      }

      if (selectedReference.scoredForAverage) {
        rawItemsScore += selectedReference.itemScore;
      }

      selectedItems.push(selectedReference);
    }

    const scoredItems = selectedItems.filter((item) => item.scoredForAverage);
    const rawMaximumItemsScore = scoredItems.reduce(
      (sum, item) => sum + item.itemMaxScore,
      0,
    );
    const scoredItemCount = scoredItems.length;
    const normalizedItemsScore =
      scoredItemCount > 0 ? rawItemsScore / scoredItemCount : 0;
    const maximumNormalizedItemsScore =
      scoredItemCount > 0 ? rawMaximumItemsScore / scoredItemCount : 0;
    const totalScore = Math.round(
      packScore + normalizedItemsScore + priorityBonus,
    );
    const maximumPossibleScore =
      maximumPackScore + maximumNormalizedItemsScore + priorityBonus;
    const matchPercentage = this.calculateMatchPercentage(
      totalScore,
      maximumPossibleScore,
    );

    return {
      packId: pack.id,
      packName: pack.name,
      packImages: pack.images,
      rank: 0,
      totalScore,
      matchPercentage,
      priority: pack.priority,
      reason: {
        packScore,
        rawItemsScore,
        scoredItemCount,
        normalizedItemsScore: this.roundScore(normalizedItemsScore),
        priorityBonus,
        totalScore,
        matchPercentage,
        maximumPossibleScore: this.roundScore(maximumPossibleScore),
        packMatches,
        details: {
          maximumPackScore,
          rawMaximumItemsScore,
          maximumNormalizedItemsScore: this.roundScore(
            maximumNormalizedItemsScore,
          ),
          itemScoreNormalization:
            'Item compatibility is averaged across selected items with at least one matching compatibility attribute, so neutral items do not lower the average and larger packs do not gain score just by having more items.',
          exclusions,
        },
      },
      selectedItems,
    };
  }

  private selectReference(
    item: EnginePackItem,
    answers: AnswerMap,
    ruleScores: RuleScores,
  ): SelectedRecommendationItem | null {
    if (item.selectionMode === SelectionMode.CUSTOMER_CHOICE) {
      return null;
    }

    const productScore = this.scoreAttributes(
      item.product.attributes ?? [],
      answers,
      ruleScores,
    );

    if (!productScore) {
      return null;
    }

    if (item.selectionMode === SelectionMode.FIXED_REFERENCE) {
      const fixedReference = item.product.references.find(
        (reference) => reference.id === item.productReferenceId,
      );

      if (!fixedReference || !this.isReferenceAvailable(fixedReference)) {
        return null;
      }

      return this.scoreReference(
        item,
        fixedReference,
        productScore,
        answers,
        ruleScores,
        'FIXED_REFERENCE',
      );
    }

    const bestReference = item.product.references
      .filter((reference) => this.isReferenceAvailable(reference))
      .filter((reference) =>
        this.isReferenceCompatibleWithAnswers(item.product, reference, answers),
      )
      .map((reference) =>
        this.scoreReference(
          item,
          reference,
          productScore,
          answers,
          ruleScores,
          item.selectionMode,
        ),
      )
      .filter(
        (selectedReference): selectedReference is SelectedRecommendationItem =>
          selectedReference !== null,
      )
      .sort((left, right) => {
        if (right.itemScore !== left.itemScore) {
          return right.itemScore - left.itemScore;
        }

        return left.referenceName.localeCompare(right.referenceName);
      })[0];

    return bestReference ?? null;
  }

  private scoreReference(
    item: EnginePackItem,
    reference: EngineReference,
    productScore: AttributeScore,
    answers: AnswerMap,
    ruleScores: RuleScores,
    selectionReason: string,
  ): SelectedRecommendationItem | null {
    const referenceScore = this.scoreAttributes(
      reference.attributes,
      answers,
      ruleScores,
    );

    if (!referenceScore) {
      return null;
    }

    const itemScore = productScore.score + referenceScore.score;
    const itemMaxScore = productScore.maxScore + referenceScore.maxScore;
    const scoredForAverage = productScore.matched || referenceScore.matched;

    return {
      packItemId: item.id,
      productId: item.product.id,
      productName: item.product.name,
      referenceId: reference.id,
      referenceName: `${reference.referenceCode} ${reference.referenceName}`,
      productImages: item.product.images,
      referenceImage: reference.image,
      quantity: item.quantity,
      itemScore,
      itemMaxScore,
      scoredForAverage,
      reason: {
        selectionMode: selectionReason,
        itemMaxScore,
        scoredForAverage,
        productMatches: productScore.matches,
        referenceMatches: referenceScore.matches,
      },
    };
  }

  private scoreAttributes(
    attributes: EngineAttribute[],
    answers: AnswerMap,
    ruleScores: RuleScores,
  ): AttributeScore | null {
    let scoreTotal = 0;
    const maxScoreByGroup = new Map<string, number>();
    const matches: Array<Record<string, unknown>> = [];

    for (const attribute of attributes) {
      const groupCode = attribute.attributeGroup.code;
      const answerOptionCode = answers[groupCode];
      const baseScore = this.scoreForGroup(groupCode, ruleScores);
      const attributeBonus = this.safePositiveScore(attribute.scoreValue);
      const totalAttributeScore = baseScore + attributeBonus;
      const matchesCustomerAnswer =
        answerOptionCode === attribute.attributeOption.code;

      if (
        answerOptionCode &&
        totalAttributeScore > 0 &&
        attribute.matchType !== MatchType.NOT_COMPATIBLE
      ) {
        const currentMax = maxScoreByGroup.get(groupCode) ?? 0;
        maxScoreByGroup.set(
          groupCode,
          Math.max(currentMax, totalAttributeScore),
        );
      }

      if (
        matchesCustomerAnswer &&
        attribute.matchType === MatchType.NOT_COMPATIBLE
      ) {
        if (attribute.isHardFilter) {
          return null;
        }

        continue;
      }

      if (
        answerOptionCode &&
        !matchesCustomerAnswer &&
        attribute.isHardFilter &&
        attribute.matchType !== MatchType.NOT_COMPATIBLE
      ) {
        return null;
      }

      if (
        matchesCustomerAnswer &&
        (attribute.matchType === MatchType.COMPATIBLE ||
          attribute.matchType === MatchType.BOOST)
      ) {
        scoreTotal += totalAttributeScore;
        matches.push({
          groupCode,
          optionCode: attribute.attributeOption.code,
          score: baseScore,
          attributeBonus,
        });
      }
    }

    return {
      score: scoreTotal,
      maxScore: [...maxScoreByGroup.values()].reduce(
        (sum, score) => sum + score,
        0,
      ),
      matched: matches.length > 0,
      matches,
    };
  }

  private isReferenceCompatibleWithAnswers(
    product: EngineProduct,
    reference: EngineReference,
    answers: AnswerMap,
  ): boolean {
    for (const groupCode of this.referenceFilterGroups) {
      const answerOptionCode = answers[groupCode];

      if (!answerOptionCode) {
        continue;
      }

      const productUsesGroup = product.references.some((candidate) =>
        candidate.attributes.some(
          (attribute) => attribute.attributeGroup.code === groupCode,
        ),
      );

      if (!productUsesGroup) {
        continue;
      }

      const matchesCompatibleAnswer = reference.attributes.some(
        (attribute) =>
          attribute.attributeGroup.code === groupCode &&
          attribute.attributeOption.code === answerOptionCode &&
          (attribute.matchType === MatchType.COMPATIBLE ||
            attribute.matchType === MatchType.BOOST),
      );

      if (!matchesCompatibleAnswer) {
        return false;
      }
    }

    return true;
  }

  private scoreForGroup(groupCode: string, ruleScores: RuleScores): number {
    const scoreKeyByGroup: Record<string, string> = {
      SKIN_COLOR: 'SKIN_COLOR_MATCH',
      UNDERTONE: 'UNDERTONE_MATCH',
      STYLE: 'STYLE_MATCH',
      SKIN_TYPE: 'SKIN_TYPE_MATCH',
      BUDGET: 'BUDGET_MATCH',
    };

    const scoreKey = scoreKeyByGroup[groupCode] ?? `${groupCode}_MATCH`;

    return ruleScores[scoreKey] ?? this.fallbackScores[scoreKey] ?? 0;
  }

  private safePositiveScore(scoreValue: number): number {
    return scoreValue > 0 ? scoreValue : 0;
  }

  private isReferenceAvailable(reference: EngineReference): boolean {
    return (
      reference.isActive && reference.stockQuantity > reference.reservedQuantity
    );
  }

  private calculateMatchPercentage(
    totalScore: number,
    maximumPossibleScore: number,
  ): number {
    if (maximumPossibleScore <= 0) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(100, Math.round((totalScore / maximumPossibleScore) * 100)),
    );
  }

  private roundScore(score: number): number {
    return Math.round(score * 100) / 100;
  }
}
