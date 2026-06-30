import { MatchType, ProductStatus, SelectionMode } from '@prisma/client';
import {
  EngineAttribute,
  EnginePack,
  EngineProduct,
  EngineReference,
  RecommendationEngineService,
  RuleScores,
} from './recommendation-engine.service';

const answers = {
  SKIN_COLOR: 'MEDIUM',
  UNDERTONE: 'WARM',
  SKIN_TYPE: 'OILY',
  STYLE: 'NATURAL',
  BUDGET: 'MEDIUM',
};

const ruleScores: RuleScores = {
  SKIN_COLOR_MATCH: 40,
  UNDERTONE_MATCH: 25,
  STYLE_MATCH: 20,
  SKIN_TYPE_MATCH: 15,
  BUDGET_MATCH: 10,
};

function attribute(
  groupCode: string,
  optionCode: string,
  overrides: Partial<EngineAttribute> = {},
): EngineAttribute {
  return {
    matchType: MatchType.COMPATIBLE,
    scoreValue: 0,
    isHardFilter: false,
    attributeGroup: { code: groupCode },
    attributeOption: { code: optionCode },
    ...overrides,
  };
}

function reference(
  id: string,
  referenceCode: string,
  referenceName: string,
  attributes: EngineAttribute[],
  overrides: Partial<EngineReference> = {},
): EngineReference {
  return {
    id,
    referenceCode,
    referenceName,
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
    attributes,
    ...overrides,
  };
}

function product(
  id: string,
  name: string,
  references: EngineReference[],
  attributes: EngineAttribute[] = [],
): EngineProduct {
  return {
    id,
    name,
    isActive: true,
    status: ProductStatus.ACTIVE,
    attributes,
    references,
  };
}

function pack(input: {
  id: string;
  name: string;
  priority?: number;
  attributes?: EngineAttribute[];
  items: Array<{
    id: string;
    product: EngineProduct;
    selectionMode?: SelectionMode;
    productReferenceId?: string | null;
  }>;
}): EnginePack {
  return {
    id: input.id,
    name: input.name,
    priority: input.priority ?? 0,
    attributes: input.attributes ?? [],
    items: input.items.map((item) => ({
      id: item.id,
      productReferenceId: item.productReferenceId ?? null,
      quantity: 1,
      selectionMode: item.selectionMode ?? SelectionMode.AUTO_BEST_REFERENCE,
      isRequired: true,
      product: item.product,
    })),
  };
}

describe('RecommendationEngineService', () => {
  let service: RecommendationEngineService;

  beforeEach(() => {
    service = new RecommendationEngineService();
  });

  it('averages item scores instead of summing them', () => {
    const first = product('product-1', 'First', [
      reference('ref-1', 'RF1', 'Medium', [attribute('SKIN_COLOR', 'MEDIUM')]),
    ]);
    const second = product('product-2', 'Second', [
      reference('ref-2', 'RF1', 'Natural', [attribute('STYLE', 'NATURAL')]),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'pack-1',
          name: 'Average Pack',
          items: [
            { id: 'item-1', product: first },
            { id: 'item-2', product: second },
          ],
        }),
      ],
    });

    expect(recommendation.reason.rawItemsScore).toBe(60);
    expect(recommendation.reason.scoredItemCount).toBe(2);
    expect(recommendation.reason.normalizedItemsScore).toBe(30);
    expect(recommendation.totalScore).toBe(30);
  });

  it('ignores neutral selected items when calculating the item average', () => {
    const first = product('product-1', 'First', [
      reference('ref-1', 'RF1', 'Medium', [attribute('SKIN_COLOR', 'MEDIUM')]),
    ]);
    const second = product('product-2', 'Second', [
      reference('ref-2', 'RF1', 'Natural', [attribute('STYLE', 'NATURAL')]),
    ]);
    const neutral = product('product-3', 'Neutral', [
      reference('ref-3', 'DEFAULT', 'Neutral', []),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'pack-1',
          name: 'Neutral Pack',
          items: [
            { id: 'item-1', product: first },
            { id: 'item-2', product: second },
            { id: 'item-3', product: neutral },
          ],
        }),
      ],
    });

    expect(recommendation.reason.rawItemsScore).toBe(60);
    expect(recommendation.reason.scoredItemCount).toBe(2);
    expect(recommendation.reason.normalizedItemsScore).toBe(30);
    expect(recommendation.totalScore).toBe(30);
  });

  it('ranks Natural Glow above Full Glam for the acceptance profile', () => {
    const { foundation, concealer, lipstick, mascara, blush, powder } =
      buildAcceptanceProducts();

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'full-glam',
          name: 'Full Glam Pack',
          priority: 2,
          attributes: [attribute('STYLE', 'GLAM'), attribute('BUDGET', 'HIGH')],
          items: [
            { id: 'full-foundation', product: foundation },
            { id: 'full-concealer', product: concealer },
            {
              id: 'full-lipstick',
              product: lipstick,
              selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
            },
            {
              id: 'full-mascara',
              product: mascara,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'mascara-black',
            },
            {
              id: 'full-blush',
              product: blush,
              selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
            },
            {
              id: 'full-powder',
              product: powder,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'powder-default',
            },
          ],
        }),
        pack({
          id: 'natural-glow',
          name: 'Natural Glow Pack',
          priority: 5,
          attributes: [
            attribute('STYLE', 'NATURAL'),
            attribute('BUDGET', 'MEDIUM'),
          ],
          items: [
            { id: 'natural-foundation', product: foundation },
            {
              id: 'natural-mascara',
              product: mascara,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'mascara-black',
            },
            {
              id: 'natural-blush',
              product: blush,
              selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
            },
          ],
        }),
      ],
    });

    const top = recommendations[0];
    const foundationItem = top.selectedItems.find(
      (item) => item.productName === 'Foundation X',
    );

    expect(top.packName).toBe('Natural Glow Pack');
    expect(top.rank).toBe(1);
    expect(foundationItem?.referenceName).toBe('RF2 Medium Warm');
  });

  it('uses deterministic tie-breaking by match percentage, score, priority, then name', () => {
    const matchedProduct = product('product-1', 'Matched', [
      reference('ref-1', 'RF1', 'Medium', [attribute('SKIN_COLOR', 'MEDIUM')]),
    ]);

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'beta',
          name: 'Beta Pack',
          priority: 1,
          items: [{ id: 'beta-item', product: matchedProduct }],
        }),
        pack({
          id: 'alpha',
          name: 'Alpha Pack',
          priority: 1,
          items: [{ id: 'alpha-item', product: matchedProduct }],
        }),
      ],
    });

    expect(
      recommendations.map((recommendation) => recommendation.packName),
    ).toEqual(['Alpha Pack', 'Beta Pack']);
  });

  it('keeps match percentages between 0 and 100', () => {
    const { foundation, concealer, lipstick, mascara, blush, powder } =
      buildAcceptanceProducts();

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'natural',
          name: 'Natural Glow Pack',
          priority: 5,
          attributes: [
            attribute('STYLE', 'NATURAL'),
            attribute('BUDGET', 'MEDIUM'),
          ],
          items: [
            { id: 'foundation', product: foundation },
            { id: 'concealer', product: concealer },
            { id: 'lipstick', product: lipstick },
            { id: 'mascara', product: mascara },
            { id: 'blush', product: blush },
            { id: 'powder', product: powder },
          ],
        }),
      ],
    });

    expect(recommendations.length).toBeGreaterThan(0);
    for (const recommendation of recommendations) {
      expect(recommendation.matchPercentage).toBeGreaterThanOrEqual(0);
      expect(recommendation.matchPercentage).toBeLessThanOrEqual(100);
    }
  });

  it('excludes packs when a hard filter mismatches', () => {
    const matchedProduct = product('product-1', 'Matched', [
      reference('ref-1', 'RF1', 'Medium', [attribute('SKIN_COLOR', 'MEDIUM')]),
    ]);

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'hard-filtered',
          name: 'Hard Filtered Pack',
          attributes: [
            attribute('STYLE', 'GLAM', {
              isHardFilter: true,
            }),
          ],
          items: [{ id: 'item-1', product: matchedProduct }],
        }),
      ],
    });

    expect(recommendations).toEqual([]);
  });

  it('keeps fixed reference selection fixed', () => {
    const fixedProduct = product('product-1', 'Fixed Product', [
      reference('fixed-ref', 'RF1', 'Fixed', [attribute('STYLE', 'NATURAL')]),
      reference('better-ref', 'RF2', 'Better', [
        attribute('SKIN_COLOR', 'MEDIUM'),
        attribute('UNDERTONE', 'WARM'),
      ]),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'fixed-pack',
          name: 'Fixed Pack',
          items: [
            {
              id: 'item-1',
              product: fixedProduct,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'fixed-ref',
            },
          ],
        }),
      ],
    });

    expect(recommendation.selectedItems[0].referenceId).toBe('fixed-ref');
  });

  it('AUTO_BEST_REFERENCE selects RF2 Medium Warm for Foundation X', () => {
    const { foundation } = buildAcceptanceProducts();

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [{ id: 'foundation-item', product: foundation }],
        }),
      ],
    });

    expect(recommendation.selectedItems[0].referenceName).toBe(
      'RF2 Medium Warm',
    );
  });

  it('scores general suitability from product-level attributes', () => {
    const foundation = product(
      'foundation-x',
      'Foundation X',
      [
        reference('foundation-medium-warm', 'RF2', 'Medium Warm', [
          attribute('SKIN_COLOR', 'MEDIUM'),
          attribute('UNDERTONE', 'WARM'),
        ]),
      ],
      [attribute('SKIN_TYPE', 'OILY')],
    );

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [{ id: 'foundation-item', product: foundation }],
        }),
      ],
    });

    expect(recommendation.totalScore).toBe(80);
    expect(
      recommendation.selectedItems[0].reason.productMatches,
    ).toContainEqual(
      expect.objectContaining({
        groupCode: 'SKIN_TYPE',
        optionCode: 'OILY',
      }),
    );
  });

  it('skips unavailable references during automatic selection', () => {
    const foundation = product('foundation-x', 'Foundation X', [
      reference(
        'foundation-medium-warm-oos',
        'RF1',
        'Medium Warm Out',
        [attribute('SKIN_COLOR', 'MEDIUM'), attribute('UNDERTONE', 'WARM')],
        { stockQuantity: 0 },
      ),
      reference('foundation-medium-warm-live', 'RF2', 'Medium Warm Live', [
        attribute('SKIN_COLOR', 'MEDIUM'),
        attribute('UNDERTONE', 'WARM'),
      ]),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [{ id: 'foundation-item', product: foundation }],
        }),
      ],
    });

    expect(recommendation.selectedItems[0].referenceId).toBe(
      'foundation-medium-warm-live',
    );
  });

  it('returns no recommendation when no compatible shade exists', () => {
    const foundation = product('foundation-x', 'Foundation X', [
      reference('foundation-light-cool', 'RF1', 'Light Cool', [
        attribute('SKIN_COLOR', 'LIGHT'),
        attribute('UNDERTONE', 'COOL'),
      ]),
      reference('foundation-dark-cool', 'RF2', 'Dark Cool', [
        attribute('SKIN_COLOR', 'DARK'),
        attribute('UNDERTONE', 'COOL'),
      ]),
    ]);

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [{ id: 'foundation-item', product: foundation }],
        }),
      ],
    });

    expect(recommendations).toEqual([]);
  });

  it('returns actual selected references for mixed fixed and automatic items', () => {
    const fixedProduct = product('mascara-z', 'Mascara Z', [
      reference('mascara-black', 'DEFAULT', 'Black', [
        attribute('STYLE', 'NATURAL'),
      ]),
    ]);
    const dynamicProduct = product('foundation-x', 'Foundation X', [
      reference('foundation-light-cool', 'RF1', 'Light Cool', [
        attribute('SKIN_COLOR', 'LIGHT'),
        attribute('UNDERTONE', 'COOL'),
      ]),
      reference('foundation-medium-warm', 'RF2', 'Medium Warm', [
        attribute('SKIN_COLOR', 'MEDIUM'),
        attribute('UNDERTONE', 'WARM'),
      ]),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'mixed-pack',
          name: 'Mixed Pack',
          items: [
            {
              id: 'fixed-item',
              product: fixedProduct,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'mascara-black',
            },
            { id: 'auto-item', product: dynamicProduct },
          ],
        }),
      ],
    });

    expect(recommendation.selectedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          packItemId: 'fixed-item',
          referenceId: 'mascara-black',
        }),
        expect.objectContaining({
          packItemId: 'auto-item',
          referenceId: 'foundation-medium-warm',
        }),
      ]),
    );
  });

  it('uses dynamic group match rule keys when configured', () => {
    const coverageProduct = product('product-coverage', 'Coverage Product', [
      reference('coverage-full', 'FULL', 'Full Coverage', [
        attribute('COVERAGE', 'FULL'),
      ]),
    ]);

    const [recommendation] = service.generateRecommendations({
      answers: { COVERAGE: 'FULL' },
      ruleScores: { COVERAGE_MATCH: 15 },
      packs: [
        pack({
          id: 'coverage-pack',
          name: 'Coverage Pack',
          items: [{ id: 'coverage-item', product: coverageProduct }],
        }),
      ],
    });

    expect(recommendation.totalScore).toBe(15);
  });

  it('keeps a pack eligible when a required customer-choice item has at least one valid option', () => {
    const { foundation, mascara } = buildAcceptanceProducts();

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'soft-glam',
          name: 'Soft Glam Pack',
          items: [
            {
              id: 'fixed-mascara',
              product: mascara,
              selectionMode: SelectionMode.FIXED_REFERENCE,
              productReferenceId: 'mascara-black',
            },
            {
              id: 'choice-foundation',
              product: foundation,
              selectionMode: SelectionMode.CUSTOMER_CHOICE,
            },
          ],
        }),
      ],
    });

    expect(recommendation).toBeDefined();
    expect(recommendation.packName).toBe('Soft Glam Pack');

    const choiceItem = recommendation.selectedItems.find(
      (item) => item.packItemId === 'choice-foundation',
    );
    expect(choiceItem?.selectionRequired).toBe(true);
    // No arbitrary reference is forced as the final selection.
    expect(choiceItem?.referenceId).toBeNull();
    expect(choiceItem?.availableOptions?.length).toBeGreaterThan(0);
    // Only compatible references are offered (RF2 Medium Warm for this profile).
    expect(
      choiceItem?.availableOptions?.map((option) => option.referenceId),
    ).toEqual(['foundation-medium-warm']);

    // Fixed items remain selected normally.
    const fixedItem = recommendation.selectedItems.find(
      (item) => item.packItemId === 'fixed-mascara',
    );
    expect(fixedItem?.referenceId).toBe('mascara-black');
  });

  it('excludes a pack when a required customer-choice item has zero valid options', () => {
    const foundation = product('foundation-x', 'Foundation X', [
      reference('foundation-light-cool', 'RF1', 'Light Cool', [
        attribute('SKIN_COLOR', 'LIGHT'),
        attribute('UNDERTONE', 'COOL'),
      ]),
      reference('foundation-dark-cool', 'RF2', 'Dark Cool', [
        attribute('SKIN_COLOR', 'DARK'),
        attribute('UNDERTONE', 'COOL'),
      ]),
    ]);

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [
            {
              id: 'choice-foundation',
              product: foundation,
              selectionMode: SelectionMode.CUSTOMER_CHOICE,
            },
          ],
        }),
      ],
    });

    expect(recommendations).toEqual([]);
  });

  it('leaves existing item scoring unchanged when a pending customer-choice item is added', () => {
    const foundation = product(
      'foundation-x',
      'Foundation X',
      [
        reference('foundation-medium-warm', 'RF2', 'Medium Warm', [
          attribute('SKIN_COLOR', 'MEDIUM'),
          attribute('UNDERTONE', 'WARM'),
        ]),
      ],
      [attribute('SKIN_TYPE', 'OILY')],
    );
    const { blush } = buildAcceptanceProducts();

    const [recommendation] = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'mixed-pack',
          name: 'Mixed Pack',
          items: [
            { id: 'auto-foundation', product: foundation },
            {
              id: 'choice-blush',
              product: blush,
              selectionMode: SelectionMode.CUSTOMER_CHOICE,
            },
          ],
        }),
      ],
    });

    // Same score as the foundation-only pack: the pending slot does not score.
    expect(recommendation.totalScore).toBe(80);
    expect(recommendation.reason.scoredItemCount).toBe(1);

    const pendingItem = recommendation.selectedItems.find(
      (item) => item.packItemId === 'choice-blush',
    );
    expect(pendingItem?.selectionRequired).toBe(true);
    expect(pendingItem?.itemScore).toBe(0);
  });

  it('excludes a pack when every compatible customer-choice reference is inactive or out of stock', () => {
    const foundation = product('foundation-x', 'Foundation X', [
      reference(
        'foundation-medium-warm-oos',
        'RF1',
        'Medium Warm Out',
        [attribute('SKIN_COLOR', 'MEDIUM'), attribute('UNDERTONE', 'WARM')],
        { stockQuantity: 0 },
      ),
      reference(
        'foundation-medium-warm-inactive',
        'RF2',
        'Medium Warm Inactive',
        [attribute('SKIN_COLOR', 'MEDIUM'), attribute('UNDERTONE', 'WARM')],
        { isActive: false },
      ),
    ]);

    const recommendations = service.generateRecommendations({
      answers,
      ruleScores,
      packs: [
        pack({
          id: 'foundation-pack',
          name: 'Foundation Pack',
          items: [
            {
              id: 'choice-foundation',
              product: foundation,
              selectionMode: SelectionMode.CUSTOMER_CHOICE,
            },
          ],
        }),
      ],
    });

    expect(recommendations).toEqual([]);
  });
});

function buildAcceptanceProducts() {
  const foundation = product('foundation-x', 'Foundation X', [
    reference('foundation-light-cool', 'RF1', 'Light Cool', [
      attribute('SKIN_COLOR', 'LIGHT'),
      attribute('UNDERTONE', 'COOL'),
    ]),
    reference('foundation-medium-warm', 'RF2', 'Medium Warm', [
      attribute('SKIN_COLOR', 'MEDIUM'),
      attribute('UNDERTONE', 'WARM'),
      attribute('SKIN_TYPE', 'OILY'),
    ]),
    reference('foundation-dark-warm', 'RF3', 'Dark Warm', [
      attribute('SKIN_COLOR', 'DARK'),
      attribute('UNDERTONE', 'WARM'),
    ]),
  ]);

  const concealer = product('concealer-x', 'Concealer X', [
    reference('concealer-light', 'RF1', 'Light', [
      attribute('SKIN_COLOR', 'LIGHT'),
    ]),
    reference('concealer-medium', 'RF2', 'Medium', [
      attribute('SKIN_COLOR', 'MEDIUM'),
    ]),
    reference('concealer-dark', 'RF3', 'Dark', [
      attribute('SKIN_COLOR', 'DARK'),
    ]),
  ]);

  const lipstick = product('lipstick-y', 'Lipstick Y', [
    reference('lipstick-nude', 'RF1', 'Nude', [
      attribute('STYLE', 'NATURAL'),
      attribute('STYLE', 'DAILY'),
    ]),
    reference('lipstick-pink', 'RF2', 'Pink', [
      attribute('STYLE', 'SOFT_GLAM'),
    ]),
    reference('lipstick-red', 'RF3', 'Red', [attribute('STYLE', 'GLAM')]),
  ]);

  const mascara = product('mascara-z', 'Mascara Z', [
    reference('mascara-black', 'DEFAULT', 'Black', [
      attribute('STYLE', 'NATURAL'),
      attribute('STYLE', 'SOFT_GLAM'),
      attribute('STYLE', 'GLAM'),
    ]),
  ]);

  const blush = product('blush-a', 'Blush A', [
    reference('blush-peach', 'RF1', 'Peach', [
      attribute('UNDERTONE', 'WARM'),
      attribute('STYLE', 'NATURAL'),
    ]),
    reference('blush-rose', 'RF2', 'Rose', [
      attribute('UNDERTONE', 'COOL'),
      attribute('STYLE', 'SOFT_GLAM'),
    ]),
  ]);

  const powder = product('setting-powder-b', 'Setting Powder B', [
    reference('powder-default', 'DEFAULT', 'Translucent', []),
  ]);

  return { foundation, concealer, lipstick, mascara, blush, powder };
}
