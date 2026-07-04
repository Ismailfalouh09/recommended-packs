import {
  MatchType,
  PackCompatibilityCriterion,
  PackCompatibilityMode,
  PriceMode,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import {
  EngineAttribute,
  EngineCompatibilityProfile,
  EnginePack,
  EnginePackItem,
  EngineProduct,
  EngineReference,
  RecommendationEngineService,
} from './recommendation-engine.service';
import { PackEligibilityService } from './eligibility/pack-eligibility.service';
import { RecommendationExplanationService } from './explanation/recommendation-explanation.service';
import { BudgetMatcher } from './matching/budget.matcher';
import { MakeupStyleMatcher } from './matching/makeup-style.matcher';
import { OccasionMatcher } from './matching/occasion.matcher';
import { SkinToneMatcher } from './matching/skin-tone.matcher';
import { SkinTypeMatcher } from './matching/skin-type.matcher';
import { RecommendationUseCaseService } from './recommendation-use-case.service';
import { PackScoreAggregatorService } from './scoring/pack-score-aggregator.service';

const answers = {
  SKIN_COLOR: 'MEDIUM',
  SKIN_TYPE: 'OILY',
  STYLE: 'NATURAL',
  BUDGET: 'MEDIUM',
  OCCASION: 'EVERYDAY',
};

const budgetRangesByOptionCode = {
  MEDIUM: { min: 200, max: 400 },
};

function buildUseCase() {
  const engine = new RecommendationEngineService();

  return new RecommendationUseCaseService(
    new PackEligibilityService(engine),
    new PackScoreAggregatorService(),
    new RecommendationExplanationService(),
    new SkinToneMatcher(),
    new SkinTypeMatcher(),
    new MakeupStyleMatcher(),
    new BudgetMatcher(),
    new OccasionMatcher(),
  );
}

function attribute(groupCode: string, optionCode: string): EngineAttribute {
  return {
    matchType: MatchType.COMPATIBLE,
    scoreValue: 0,
    isHardFilter: false,
    attributeGroup: { code: groupCode },
    attributeOption: { code: optionCode },
  };
}

function reference(
  id: string,
  attributes: EngineAttribute[] = [],
  overrides: Partial<EngineReference> = {},
): EngineReference {
  return {
    id,
    referenceCode: id.toUpperCase(),
    referenceName: 'Default',
    priceOverride: null,
    priceDelta: 0,
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
    attributes,
    ...overrides,
  };
}

function product(
  id: string,
  references: EngineReference[] = [reference(`${id}-ref`)],
  overrides: Partial<EngineProduct> = {},
): EngineProduct {
  return {
    id,
    name: id,
    basePrice: 250,
    isActive: true,
    status: ProductStatus.ACTIVE,
    references,
    ...overrides,
  };
}

function item(
  id: string,
  itemProduct: EngineProduct,
  overrides: Partial<EnginePackItem> = {},
): EnginePackItem {
  return {
    id,
    productReferenceId: null,
    quantity: 1,
    selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
    isRequired: true,
    product: itemProduct,
    ...overrides,
  };
}

function compatibility(
  criterion: PackCompatibilityCriterion,
  optionCodes: string[],
  mode = PackCompatibilityMode.RESTRICTED,
): EngineCompatibilityProfile {
  return {
    criterion,
    mode,
    values: optionCodes.map((code) => ({
      attributeOption: { code },
    })),
  };
}

function universal(
  criterion: PackCompatibilityCriterion,
): EngineCompatibilityProfile {
  return compatibility(criterion, [], PackCompatibilityMode.UNIVERSAL);
}

function exactProfiles(): EngineCompatibilityProfile[] {
  return [
    compatibility(PackCompatibilityCriterion.SKIN_TONE, ['MEDIUM']),
    compatibility(PackCompatibilityCriterion.SKIN_TYPE, ['OILY']),
    compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
    compatibility(PackCompatibilityCriterion.BUDGET, ['MEDIUM']),
    compatibility(PackCompatibilityCriterion.OCCASION, ['EVERYDAY']),
  ];
}

function pack(overrides: Partial<EnginePack> & { id: string }): EnginePack {
  const defaultProduct = product(`${overrides.id}-product`);

  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    priority: overrides.priority ?? 0,
    priceMode: overrides.priceMode ?? PriceMode.FIXED,
    fixedPrice: overrides.fixedPrice === undefined ? 250 : overrides.fixedPrice,
    discountAmount: overrides.discountAmount ?? null,
    discountPercentage: overrides.discountPercentage ?? null,
    attributes: overrides.attributes ?? [],
    compatibilityProfiles: overrides.compatibilityProfiles ?? [],
    items: overrides.items ?? [item(`${overrides.id}-item`, defaultProduct)],
    images: overrides.images,
  };
}

function recommend(packs: EnginePack[]) {
  return buildUseCase().recommend({
    answers,
    packs,
    ruleScores: {},
    budgetRangesByOptionCode,
  });
}

describe('RecommendationUseCaseService', () => {
  it('returns the exact profile as the strongest Pack first', () => {
    const results = recommend([
      pack({
        id: 'partial',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
        ],
      }),
      pack({ id: 'exact', compatibilityProfiles: exactProfiles() }),
    ]);

    expect(results.map((result) => result.packId)).toEqual([
      'exact',
      'partial',
    ]);
    expect(results[0].recommendationType).toBe('BEST_MATCH');
    expect(results[1].recommendationType).toBe('ALTERNATIVE');
  });

  it('excludes a Pack on skin tone mismatch', () => {
    expect(
      recommend([
        pack({
          id: 'wrong-tone',
          compatibilityProfiles: [
            compatibility(PackCompatibilityCriterion.SKIN_TONE, ['LIGHT']),
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it('excludes a Pack on skin type mismatch', () => {
    expect(
      recommend([
        pack({
          id: 'wrong-type',
          compatibilityProfiles: [
            compatibility(PackCompatibilityCriterion.SKIN_TYPE, ['DRY']),
          ],
        }),
      ]),
    ).toEqual([]);
  });

  it('lowers ranking for a makeup style mismatch without excluding the Pack', () => {
    const results = recommend([
      pack({
        id: 'style-mismatch',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.SKIN_TONE, ['MEDIUM']),
          compatibility(PackCompatibilityCriterion.SKIN_TYPE, ['OILY']),
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['GLAM']),
          compatibility(PackCompatibilityCriterion.BUDGET, ['MEDIUM']),
        ],
      }),
      pack({
        id: 'style-match',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.SKIN_TONE, ['MEDIUM']),
          compatibility(PackCompatibilityCriterion.SKIN_TYPE, ['OILY']),
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
          compatibility(PackCompatibilityCriterion.BUDGET, ['MEDIUM']),
        ],
      }),
    ]);

    expect(results.map((result) => result.packId)).toEqual([
      'style-match',
      'style-mismatch',
    ]);
  });

  it('lowers ranking for an occasion mismatch without excluding the Pack', () => {
    const results = recommend([
      pack({
        id: 'occasion-mismatch',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
          compatibility(PackCompatibilityCriterion.OCCASION, ['PARTY']),
        ],
      }),
      pack({
        id: 'occasion-match',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
          compatibility(PackCompatibilityCriterion.OCCASION, ['EVERYDAY']),
        ],
      }),
    ]);

    expect(results.map((result) => result.packId)).toEqual([
      'occasion-match',
      'occasion-mismatch',
    ]);
  });

  it('does not falsely treat an unconfigured Pack as universal', () => {
    const results = recommend([
      pack({ id: 'unconfigured', priority: 100 }),
      pack({
        id: 'configured',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
        ],
      }),
    ]);

    expect(results.map((result) => result.packId)).toEqual([
      'configured',
      'unconfigured',
    ]);
    expect(results[1].compatibilityScore).toBe(0);
    expect(results[1].customerReasons).toEqual([]);
  });

  it('emits customer reasons only for genuine positive matches', () => {
    const [result] = recommend([
      pack({
        id: 'reason-check',
        compatibilityProfiles: [
          universal(PackCompatibilityCriterion.SKIN_TONE),
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
          compatibility(PackCompatibilityCriterion.BUDGET, ['MEDIUM']),
          compatibility(PackCompatibilityCriterion.OCCASION, ['PARTY']),
        ],
      }),
    ]);

    expect(result.customerReasons).toEqual([
      'Matches your makeup style',
      'Fits your selected budget',
    ]);
  });

  it('returns at most one result per Pack id', () => {
    const results = recommend([
      pack({ id: 'duplicate', name: 'Duplicate A' }),
      pack({ id: 'duplicate', name: 'Duplicate B' }),
    ]);

    const packIds = results.map((result) => result.packId);
    expect(packIds).toHaveLength(new Set(packIds).size);
  });

  it('preserves a pending CUSTOMER_CHOICE item and its available options', () => {
    const choiceProduct = product('choice-product', [
      reference('choice-light', [attribute('SKIN_COLOR', 'LIGHT')]),
      reference('choice-medium', [attribute('SKIN_COLOR', 'MEDIUM')]),
    ]);
    const [result] = recommend([
      pack({
        id: 'choice-pack',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
        ],
        items: [
          item('choice-item', choiceProduct, {
            selectionMode: SelectionMode.CUSTOMER_CHOICE,
          }),
        ],
      }),
    ]);

    expect(result.selectedItems[0]).toMatchObject({
      packItemId: 'choice-item',
      referenceId: null,
      selectionRequired: true,
    });
    expect(
      result.selectedItems[0].availableOptions?.map(
        (option) => option.referenceId,
      ),
    ).toEqual(['choice-medium']);
  });

  it('leaves fixed and automatic reference selection unchanged', () => {
    const fixedProduct = product('fixed-product', [
      reference('fixed-ref'),
      reference('better-fixed-ref', [attribute('STYLE', 'NATURAL')]),
    ]);
    const autoProduct = product('auto-product', [
      reference('auto-neutral'),
      reference('auto-natural', [attribute('STYLE', 'NATURAL')]),
    ]);

    const [result] = recommend([
      pack({
        id: 'selection-pack',
        compatibilityProfiles: [
          compatibility(PackCompatibilityCriterion.MAKEUP_STYLE, ['NATURAL']),
        ],
        items: [
          item('fixed-item', fixedProduct, {
            selectionMode: SelectionMode.FIXED_REFERENCE,
            productReferenceId: 'fixed-ref',
          }),
          item('auto-item', autoProduct),
        ],
      }),
    ]);

    expect(result.selectedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packItemId: 'fixed-item',
          referenceId: 'fixed-ref',
        }),
        expect.objectContaining({
          packItemId: 'auto-item',
          referenceId: 'auto-natural',
        }),
      ]),
    );
  });

  it('uses selected reference prices for SUM_ITEMS budget exclusion', () => {
    const expensiveProduct = product('expensive-product', [
      reference('expensive-ref', [], { priceOverride: 450 }),
    ]);

    expect(
      recommend([
        pack({
          id: 'expensive-sum-pack',
          priceMode: PriceMode.SUM_ITEMS,
          fixedPrice: null,
          compatibilityProfiles: [
            compatibility(PackCompatibilityCriterion.BUDGET, ['MEDIUM']),
          ],
          items: [item('expensive-item', expensiveProduct)],
        }),
      ]),
    ).toEqual([]);
  });
});
