import 'dotenv/config';
import {
  MatchType,
  PackStatus,
  PriceMode,
  PrismaClient,
  ProductStatus,
  RecommendationConditionType,
  RecommendationTargetType,
  SelectionMode,
  SelectionType,
  VariationType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL must be defined before seeding.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(databaseUrl),
});

const ids = {
  questionSkinColor: '00000000-0000-4000-8000-000000000001',
  questionUndertone: '00000000-0000-4000-8000-000000000002',
  questionSkinType: '00000000-0000-4000-8000-000000000003',
  questionStyle: '00000000-0000-4000-8000-000000000004',
  questionBudget: '00000000-0000-4000-8000-000000000005',
  naturalFoundation: '00000000-0000-4000-8000-000000000101',
  naturalMascara: '00000000-0000-4000-8000-000000000102',
  naturalBlush: '00000000-0000-4000-8000-000000000103',
  softFoundation: '00000000-0000-4000-8000-000000000201',
  softConcealer: '00000000-0000-4000-8000-000000000202',
  softLipstick: '00000000-0000-4000-8000-000000000203',
  softMascara: '00000000-0000-4000-8000-000000000204',
  glamFoundation: '00000000-0000-4000-8000-000000000301',
  glamConcealer: '00000000-0000-4000-8000-000000000302',
  glamLipstick: '00000000-0000-4000-8000-000000000303',
  glamMascara: '00000000-0000-4000-8000-000000000304',
  glamBlush: '00000000-0000-4000-8000-000000000305',
  glamPowder: '00000000-0000-4000-8000-000000000306',
  dailyMascara: '00000000-0000-4000-8000-000000000401',
  dailyLipstick: '00000000-0000-4000-8000-000000000402',
  dailyPowder: '00000000-0000-4000-8000-000000000403',
  autoTestFoundation: '00000000-0000-4000-8000-000000000501',
  autoTestMascara: '00000000-0000-4000-8000-000000000502',
  autoTestPowder: '00000000-0000-4000-8000-000000000503',
};

type AttributeGroupCode =
  | 'SKIN_COLOR'
  | 'UNDERTONE'
  | 'SKIN_TYPE'
  | 'STYLE'
  | 'BUDGET';

type ProductCode =
  | 'foundation-x'
  | 'concealer-x'
  | 'lipstick-y'
  | 'mascara-z'
  | 'blush-a'
  | 'setting-powder-b';

async function seedAttributeGroups() {
  const groups = [
    {
      code: 'SKIN_COLOR',
      name: 'Skin Color',
      description: 'Customer skin color range.',
      isCustomerAttribute: true,
      isProductAttribute: true,
      sortOrder: 1,
    },
    {
      code: 'UNDERTONE',
      name: 'Undertone',
      description: 'Customer skin undertone.',
      isCustomerAttribute: true,
      isProductAttribute: true,
      sortOrder: 2,
    },
    {
      code: 'SKIN_TYPE',
      name: 'Skin Type',
      description: 'Customer skin type.',
      isCustomerAttribute: true,
      isProductAttribute: true,
      sortOrder: 3,
    },
    {
      code: 'STYLE',
      name: 'Style',
      description: 'Preferred makeup style.',
      isCustomerAttribute: true,
      isProductAttribute: true,
      sortOrder: 4,
    },
    {
      code: 'BUDGET',
      name: 'Budget',
      description: 'Customer budget band.',
      isCustomerAttribute: true,
      isProductAttribute: false,
      sortOrder: 5,
    },
  ] satisfies Array<{
    code: AttributeGroupCode;
    name: string;
    description: string;
    isCustomerAttribute: boolean;
    isProductAttribute: boolean;
    sortOrder: number;
  }>;

  const result = new Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>();

  for (const group of groups) {
    const saved = await prisma.attributeGroup.upsert({
      where: { code: group.code },
      update: {
        name: group.name,
        description: group.description,
        isCustomerAttribute: group.isCustomerAttribute,
        isProductAttribute: group.isProductAttribute,
        sortOrder: group.sortOrder,
        isActive: true,
      },
      create: {
        ...group,
        isActive: true,
      },
    });

    result.set(group.code, saved);
  }

  return result;
}

async function seedAttributeOptions(
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
) {
  const optionDefinitions = {
    SKIN_COLOR: [
      ['LIGHT', 'Light'],
      ['MEDIUM', 'Medium'],
      ['DARK', 'Dark'],
    ],
    UNDERTONE: [
      ['COOL', 'Cool'],
      ['NEUTRAL', 'Neutral'],
      ['WARM', 'Warm'],
    ],
    SKIN_TYPE: [
      ['DRY', 'Dry'],
      ['OILY', 'Oily'],
      ['COMBINATION', 'Combination'],
      ['SENSITIVE', 'Sensitive'],
      ['NORMAL', 'Normal'],
    ],
    STYLE: [
      ['NATURAL', 'Natural'],
      ['SOFT_GLAM', 'Soft Glam'],
      ['GLAM', 'Glam'],
      ['DAILY', 'Daily'],
    ],
    BUDGET: [
      ['LOW', 'Low'],
      ['MEDIUM', 'Medium'],
      ['HIGH', 'High'],
    ],
  } satisfies Record<AttributeGroupCode, Array<[string, string]>>;

  const options = new Map<string, Awaited<ReturnType<typeof prisma.attributeOption.upsert>>>();

  for (const [groupCode, optionList] of Object.entries(optionDefinitions) as Array<
    [AttributeGroupCode, Array<[string, string]>]
  >) {
    const group = groups.get(groupCode);

    if (!group) {
      throw new Error(`Missing attribute group ${groupCode}`);
    }

    for (const [index, [code, label]] of optionList.entries()) {
      const saved = await prisma.attributeOption.upsert({
        where: {
          attributeGroupId_code: {
            attributeGroupId: group.id,
            code,
          },
        },
        update: {
          label,
          sortOrder: index + 1,
          isActive: true,
        },
        create: {
          attributeGroupId: group.id,
          code,
          label,
          sortOrder: index + 1,
          isActive: true,
        },
      });

      options.set(`${groupCode}.${code}`, saved);
    }
  }

  return options;
}

async function seedQuizQuestions(
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
  options: Map<string, Awaited<ReturnType<typeof prisma.attributeOption.upsert>>>,
) {
  const questions = [
    {
      id: ids.questionSkinColor,
      groupCode: 'SKIN_COLOR',
      text: 'What is your skin color?',
      stepOrder: 1,
    },
    {
      id: ids.questionUndertone,
      groupCode: 'UNDERTONE',
      text: 'What is your undertone?',
      stepOrder: 2,
    },
    {
      id: ids.questionSkinType,
      groupCode: 'SKIN_TYPE',
      text: 'What is your skin type?',
      stepOrder: 3,
    },
    {
      id: ids.questionStyle,
      groupCode: 'STYLE',
      text: 'What makeup style do you prefer?',
      stepOrder: 4,
    },
    {
      id: ids.questionBudget,
      groupCode: 'BUDGET',
      text: 'What is your budget?',
      stepOrder: 5,
    },
  ] satisfies Array<{
    id: string;
    groupCode: AttributeGroupCode;
    text: string;
    stepOrder: number;
  }>;

  for (const question of questions) {
    const group = groups.get(question.groupCode);

    if (!group) {
      throw new Error(`Missing attribute group ${question.groupCode}`);
    }

    const savedQuestion = await prisma.quizQuestion.upsert({
      where: { id: question.id },
      update: {
        attributeGroupId: group.id,
        questionText: question.text,
        selectionType: SelectionType.SINGLE,
        isRequired: true,
        stepOrder: question.stepOrder,
        isActive: true,
      },
      create: {
        id: question.id,
        attributeGroupId: group.id,
        questionText: question.text,
        selectionType: SelectionType.SINGLE,
        isRequired: true,
        stepOrder: question.stepOrder,
        isActive: true,
      },
    });

    const groupOptions = [...options.entries()].filter(([key]) =>
      key.startsWith(`${question.groupCode}.`),
    );

    for (const [index, [, option]] of groupOptions.entries()) {
      await prisma.quizQuestionOption.upsert({
        where: {
          questionId_attributeOptionId: {
            questionId: savedQuestion.id,
            attributeOptionId: option.id,
          },
        },
        update: {
          displayLabel: option.label,
          sortOrder: index + 1,
          isActive: true,
        },
        create: {
          questionId: savedQuestion.id,
          attributeOptionId: option.id,
          displayLabel: option.label,
          sortOrder: index + 1,
          isActive: true,
        },
      });
    }
  }
}

async function seedCatalog() {
  const categoryDefinitions = [
    ['FACE', 'Face'],
    ['LIPS', 'Lips'],
    ['EYES', 'Eyes'],
    ['SKINCARE', 'Skincare'],
    ['ACCESSORIES', 'Accessories'],
  ] satisfies Array<[string, string]>;

  const categories = new Map<string, Awaited<ReturnType<typeof prisma.category.upsert>>>();

  for (const [index, [code, name]] of categoryDefinitions.entries()) {
    const category = await prisma.category.upsert({
      where: { code },
      update: {
        name,
        sortOrder: index + 1,
        isActive: true,
      },
      create: {
        code,
        name,
        sortOrder: index + 1,
        isActive: true,
      },
    });

    categories.set(code, category);
  }

  const brand = await prisma.brand.upsert({
    where: { name: 'Demo Beauty' },
    update: {
      description: 'Demo brand for recommendation testing.',
      isActive: true,
    },
    create: {
      name: 'Demo Beauty',
      description: 'Demo brand for recommendation testing.',
      isActive: true,
    },
  });

  const productDefinitions = [
    ['foundation-x', 'Foundation X', 'FACE', 'Demo foundation shades.', '129.00'],
    ['concealer-x', 'Concealer X', 'FACE', 'Demo concealer shades.', '89.00'],
    ['lipstick-y', 'Lipstick Y', 'LIPS', 'Demo lipstick shades.', '79.00'],
    ['mascara-z', 'Mascara Z', 'EYES', 'Demo black mascara.', '99.00'],
    ['blush-a', 'Blush A', 'FACE', 'Demo blush shades.', '85.00'],
    [
      'setting-powder-b',
      'Setting Powder B',
      'FACE',
      'Demo translucent setting powder.',
      '95.00',
    ],
  ] satisfies Array<[ProductCode, string, string, string, string]>;

  // Phase 4 demo enrichment (additive, nullable): product type, sale price,
  // and teaser copy on a couple of products to exercise the new fields.
  const productExtras: Partial<
    Record<
      string,
      {
        productType?: string;
        shortDescription?: string;
        compareAtPrice?: string;
        ingredients?: string;
        directions?: string;
      }
    >
  > = {
    'foundation-x': {
      productType: 'foundation',
      shortDescription: 'Buildable medium-coverage foundation.',
      compareAtPrice: '159.00',
    },
    'setting-powder-b': {
      productType: 'setting-powder',
      shortDescription: 'Translucent blurring finish.',
    },
  };

  const products = new Map<ProductCode, Awaited<ReturnType<typeof prisma.product.upsert>>>();

  for (const [slug, name, categoryCode, description, basePrice] of productDefinitions) {
    const category = categories.get(categoryCode);

    if (!category) {
      throw new Error(`Missing category ${categoryCode}`);
    }

    const extras = productExtras[slug] ?? {};

    const product = await prisma.product.upsert({
      where: { slug },
      update: {
        categoryId: category.id,
        brandId: brand.id,
        name,
        description,
        basePrice,
        currency: 'MAD',
        status: ProductStatus.ACTIVE,
        isActive: true,
        ...extras,
      },
      create: {
        categoryId: category.id,
        brandId: brand.id,
        name,
        slug,
        description,
        basePrice,
        currency: 'MAD',
        status: ProductStatus.ACTIVE,
        isActive: true,
        ...extras,
      },
    });

    products.set(slug, product);
  }

  return { categories, brand, products };
}

async function seedProductReferences(
  products: Map<ProductCode, Awaited<ReturnType<typeof prisma.product.upsert>>>,
) {
  const referenceDefinitions = [
    ['foundation-x', 'RF1', 'Light Cool', '129.00', true],
    ['foundation-x', 'RF2', 'Medium Warm', '129.00', false],
    ['foundation-x', 'RF3', 'Dark Warm', '129.00', false],
    ['concealer-x', 'RF1', 'Light', '89.00', true],
    ['concealer-x', 'RF2', 'Medium', '89.00', false],
    ['concealer-x', 'RF3', 'Dark', '89.00', false],
    ['lipstick-y', 'RF1', 'Nude', '79.00', true],
    ['lipstick-y', 'RF2', 'Pink', '79.00', false],
    ['lipstick-y', 'RF3', 'Red', '79.00', false],
    ['mascara-z', 'DEFAULT', 'Black', '99.00', true],
    ['blush-a', 'RF1', 'Peach', '85.00', true],
    ['blush-a', 'RF2', 'Rose', '85.00', false],
    ['setting-powder-b', 'DEFAULT', 'Translucent', '95.00', true],
  ] satisfies Array<[ProductCode, string, string, string, boolean]>;

  // Phase 4 demo enrichment: structured shade identity + swatch hex +
  // variation axis on foundation/lip shades; one foundation shade is left
  // out of stock to exercise the "Sold out" / derived availability path.
  const referenceExtras: Partial<
    Record<
      string,
      {
        shadeName?: string;
        shadeCode?: string;
        swatchHex?: string;
        variationType?: VariationType;
        measurement?: string;
        stockQuantity?: number;
      }
    >
  > = {
    'foundation-x.RF1': {
      shadeName: 'Light Cool',
      shadeCode: 'C10',
      swatchHex: '#F2D2B6',
      variationType: VariationType.SHADE,
    },
    'foundation-x.RF2': {
      shadeName: 'Medium Warm',
      shadeCode: 'W30',
      swatchHex: '#E8B98C',
      variationType: VariationType.SHADE,
    },
    'foundation-x.RF3': {
      shadeName: 'Dark Warm',
      shadeCode: 'W60',
      swatchHex: '#9C6B43',
      variationType: VariationType.SHADE,
      stockQuantity: 0,
    },
    'lipstick-y.RF1': {
      shadeName: 'Nude',
      swatchHex: '#C98B7A',
      variationType: VariationType.SHADE,
    },
    'setting-powder-b.DEFAULT': {
      measurement: '15g',
      variationType: VariationType.SIZE,
    },
  };

  const references = new Map<string, Awaited<ReturnType<typeof prisma.productReference.upsert>>>();

  for (const [productSlug, referenceCode, referenceName, priceOverride, isDefault] of referenceDefinitions) {
    const product = products.get(productSlug);

    if (!product) {
      throw new Error(`Missing product ${productSlug}`);
    }

    const extras = referenceExtras[`${productSlug}.${referenceCode}`] ?? {};

    const reference = await prisma.productReference.upsert({
      where: {
        productId_referenceCode: {
          productId: product.id,
          referenceCode,
        },
      },
      update: {
        referenceName,
        priceOverride,
        priceDelta: '0.00',
        stockQuantity: 25,
        reservedQuantity: 0,
        lowStockThreshold: 5,
        isDefault,
        isActive: true,
        ...extras,
      },
      create: {
        productId: product.id,
        referenceCode,
        referenceName,
        priceOverride,
        priceDelta: '0.00',
        stockQuantity: 25,
        reservedQuantity: 0,
        lowStockThreshold: 5,
        isDefault,
        isActive: true,
        ...extras,
      },
    });

    references.set(`${productSlug}.${referenceCode}`, reference);
  }

  return references;
}

async function seedProductReferenceAttributes(
  references: Map<string, Awaited<ReturnType<typeof prisma.productReference.upsert>>>,
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
  options: Map<string, Awaited<ReturnType<typeof prisma.attributeOption.upsert>>>,
) {
  const attributes = [
    ['foundation-x.RF1', 'SKIN_COLOR', 'LIGHT'],
    ['foundation-x.RF1', 'UNDERTONE', 'COOL'],
    ['foundation-x.RF2', 'SKIN_COLOR', 'MEDIUM'],
    ['foundation-x.RF2', 'UNDERTONE', 'WARM'],
    ['foundation-x.RF2', 'SKIN_TYPE', 'OILY'],
    ['foundation-x.RF3', 'SKIN_COLOR', 'DARK'],
    ['foundation-x.RF3', 'UNDERTONE', 'WARM'],
    ['concealer-x.RF1', 'SKIN_COLOR', 'LIGHT'],
    ['concealer-x.RF2', 'SKIN_COLOR', 'MEDIUM'],
    ['concealer-x.RF3', 'SKIN_COLOR', 'DARK'],
    ['lipstick-y.RF1', 'STYLE', 'NATURAL'],
    ['lipstick-y.RF1', 'STYLE', 'DAILY'],
    ['lipstick-y.RF2', 'STYLE', 'SOFT_GLAM'],
    ['lipstick-y.RF3', 'STYLE', 'GLAM'],
    ['mascara-z.DEFAULT', 'STYLE', 'NATURAL'],
    ['mascara-z.DEFAULT', 'STYLE', 'SOFT_GLAM'],
    ['mascara-z.DEFAULT', 'STYLE', 'GLAM'],
    ['blush-a.RF1', 'UNDERTONE', 'WARM'],
    ['blush-a.RF1', 'STYLE', 'NATURAL'],
    ['blush-a.RF2', 'UNDERTONE', 'COOL'],
    ['blush-a.RF2', 'STYLE', 'SOFT_GLAM'],
  ] satisfies Array<[string, AttributeGroupCode, string]>;

  for (const [referenceKey, groupCode, optionCode] of attributes) {
    const reference = references.get(referenceKey);
    const group = groups.get(groupCode);
    const option = options.get(`${groupCode}.${optionCode}`);

    if (!reference || !group || !option) {
      throw new Error(`Missing reference attribute fixture ${referenceKey}:${groupCode}.${optionCode}`);
    }

    await prisma.productReferenceAttribute.upsert({
      where: {
        productReferenceId_attributeGroupId_attributeOptionId: {
          productReferenceId: reference.id,
          attributeGroupId: group.id,
          attributeOptionId: option.id,
        },
      },
      update: {
        matchType: MatchType.COMPATIBLE,
        scoreValue: 0,
        isHardFilter: false,
      },
      create: {
        productReferenceId: reference.id,
        attributeGroupId: group.id,
        attributeOptionId: option.id,
        matchType: MatchType.COMPATIBLE,
        scoreValue: 0,
        isHardFilter: false,
      },
    });
  }
}

async function upsertPackAttribute(
  packId: string,
  groupCode: AttributeGroupCode,
  optionCode: string,
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
  options: Map<string, Awaited<ReturnType<typeof prisma.attributeOption.upsert>>>,
) {
  const group = groups.get(groupCode);
  const option = options.get(`${groupCode}.${optionCode}`);

  if (!group || !option) {
    throw new Error(`Missing pack attribute ${groupCode}.${optionCode}`);
  }

  await prisma.packAttribute.upsert({
    where: {
      packId_attributeGroupId_attributeOptionId: {
        packId,
        attributeGroupId: group.id,
        attributeOptionId: option.id,
      },
    },
    update: {
      matchType: MatchType.COMPATIBLE,
      scoreValue: 0,
      isHardFilter: false,
    },
    create: {
      packId,
      attributeGroupId: group.id,
      attributeOptionId: option.id,
      matchType: MatchType.COMPATIBLE,
      scoreValue: 0,
      isHardFilter: false,
    },
  });
}

async function upsertPackItem(input: {
  id: string;
  packId: string;
  productId: string;
  productReferenceId?: string;
  quantity?: number;
  selectionMode: SelectionMode;
  sortOrder: number;
}) {
  await prisma.packItem.upsert({
    where: { id: input.id },
    update: {
      packId: input.packId,
      productId: input.productId,
      productReferenceId: input.productReferenceId ?? null,
      quantity: input.quantity ?? 1,
      selectionMode: input.selectionMode,
      isRequired: true,
      sortOrder: input.sortOrder,
    },
    create: {
      id: input.id,
      packId: input.packId,
      productId: input.productId,
      productReferenceId: input.productReferenceId ?? null,
      quantity: input.quantity ?? 1,
      selectionMode: input.selectionMode,
      isRequired: true,
      sortOrder: input.sortOrder,
    },
  });
}

async function seedPacks(
  products: Map<ProductCode, Awaited<ReturnType<typeof prisma.product.upsert>>>,
  references: Map<string, Awaited<ReturnType<typeof prisma.productReference.upsert>>>,
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
  options: Map<string, Awaited<ReturnType<typeof prisma.attributeOption.upsert>>>,
) {
  const packs = [
    {
      name: 'Natural Glow Pack',
      slug: 'natural-glow-pack',
      description: 'Light everyday pack with natural finish.',
      fixedPrice: '299.00',
      minBudget: '200.00',
      maxBudget: '350.00',
      priority: 5,
      attributes: [
        ['STYLE', 'NATURAL'],
        ['BUDGET', 'MEDIUM'],
      ],
      items: [
        [ids.naturalFoundation, 'foundation-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.naturalMascara, 'mascara-z', 'mascara-z.DEFAULT', SelectionMode.FIXED_REFERENCE],
        [ids.naturalBlush, 'blush-a', undefined, SelectionMode.CUSTOMER_CHOICE],
      ],
    },
    {
      name: 'Soft Glam Pack',
      slug: 'soft-glam-pack',
      description: 'Balanced complexion and color pack for soft glam looks.',
      fixedPrice: '349.00',
      minBudget: '250.00',
      maxBudget: '450.00',
      priority: 3,
      attributes: [
        ['STYLE', 'SOFT_GLAM'],
        ['BUDGET', 'MEDIUM'],
      ],
      items: [
        [ids.softFoundation, 'foundation-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.softConcealer, 'concealer-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.softLipstick, 'lipstick-y', undefined, SelectionMode.CUSTOMER_CHOICE],
        [ids.softMascara, 'mascara-z', 'mascara-z.DEFAULT', SelectionMode.FIXED_REFERENCE],
      ],
    },
    {
      name: 'Full Glam Pack',
      slug: 'full-glam-pack',
      description: 'Full face glam pack with complexion, lips, eyes, and setting powder.',
      fixedPrice: '499.00',
      minBudget: '400.00',
      maxBudget: '700.00',
      priority: 2,
      attributes: [
        ['STYLE', 'GLAM'],
        ['BUDGET', 'HIGH'],
      ],
      items: [
        [ids.glamFoundation, 'foundation-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.glamConcealer, 'concealer-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.glamLipstick, 'lipstick-y', undefined, SelectionMode.CUSTOMER_CHOICE],
        [ids.glamMascara, 'mascara-z', 'mascara-z.DEFAULT', SelectionMode.FIXED_REFERENCE],
        [ids.glamBlush, 'blush-a', undefined, SelectionMode.CUSTOMER_CHOICE],
        [ids.glamPowder, 'setting-powder-b', 'setting-powder-b.DEFAULT', SelectionMode.FIXED_REFERENCE],
      ],
    },
    {
      name: 'Budget Daily Pack',
      slug: 'budget-daily-pack',
      description: 'Compact daily pack for simple budget-friendly routines.',
      fixedPrice: '199.00',
      minBudget: '100.00',
      maxBudget: '250.00',
      priority: 4,
      attributes: [
        ['STYLE', 'DAILY'],
        ['BUDGET', 'LOW'],
      ],
      items: [
        [ids.dailyMascara, 'mascara-z', 'mascara-z.DEFAULT', SelectionMode.FIXED_REFERENCE],
        [ids.dailyLipstick, 'lipstick-y', undefined, SelectionMode.CUSTOMER_CHOICE],
        [ids.dailyPowder, 'setting-powder-b', 'setting-powder-b.DEFAULT', SelectionMode.FIXED_REFERENCE],
      ],
    },
    {
      name: 'Automatic Recommendation Test Pack',
      slug: 'automatic-recommendation-test-pack',
      description: 'Manual testing pack with only automatic and fixed selections.',
      fixedPrice: '299.00',
      minBudget: '200.00',
      maxBudget: '350.00',
      priority: 6,
      attributes: [
        ['STYLE', 'NATURAL'],
        ['BUDGET', 'MEDIUM'],
      ],
      items: [
        [ids.autoTestFoundation, 'foundation-x', undefined, SelectionMode.AUTO_BEST_REFERENCE],
        [ids.autoTestMascara, 'mascara-z', 'mascara-z.DEFAULT', SelectionMode.FIXED_REFERENCE],
        [ids.autoTestPowder, 'setting-powder-b', 'setting-powder-b.DEFAULT', SelectionMode.FIXED_REFERENCE],
      ],
    },
  ] satisfies Array<{
    name: string;
    slug: string;
    description: string;
    fixedPrice: string;
    minBudget: string;
    maxBudget: string;
    priority: number;
    attributes: Array<[AttributeGroupCode, string]>;
    items: Array<[string, ProductCode, string | undefined, SelectionMode]>;
  }>;

  for (const packDefinition of packs) {
    const pack = await prisma.pack.upsert({
      where: { slug: packDefinition.slug },
      update: {
        name: packDefinition.name,
        description: packDefinition.description,
        priceMode: PriceMode.FIXED,
        fixedPrice: packDefinition.fixedPrice,
        minBudget: packDefinition.minBudget,
        maxBudget: packDefinition.maxBudget,
        priority: packDefinition.priority,
        status: PackStatus.ACTIVE,
        isActive: true,
      },
      create: {
        name: packDefinition.name,
        slug: packDefinition.slug,
        description: packDefinition.description,
        priceMode: PriceMode.FIXED,
        fixedPrice: packDefinition.fixedPrice,
        minBudget: packDefinition.minBudget,
        maxBudget: packDefinition.maxBudget,
        currency: 'MAD',
        priority: packDefinition.priority,
        status: PackStatus.ACTIVE,
        isActive: true,
      },
    });

    for (const [groupCode, optionCode] of packDefinition.attributes) {
      await upsertPackAttribute(pack.id, groupCode, optionCode, groups, options);
    }

    for (const [index, [id, productSlug, referenceKey, selectionMode]] of packDefinition.items.entries()) {
      const product = products.get(productSlug);
      const reference = referenceKey ? references.get(referenceKey) : undefined;

      if (!product) {
        throw new Error(`Missing pack product ${productSlug}`);
      }

      if (referenceKey && !reference) {
        throw new Error(`Missing fixed pack reference ${referenceKey}`);
      }

      await upsertPackItem({
        id,
        packId: pack.id,
        productId: product.id,
        productReferenceId: reference?.id,
        selectionMode,
        sortOrder: index + 1,
      });
    }
  }
}

async function seedRecommendationRules(
  groups: Map<AttributeGroupCode, Awaited<ReturnType<typeof prisma.attributeGroup.upsert>>>,
) {
  const rules = [
    ['SKIN_COLOR_MATCH', 'Skin Color Match', 'SKIN_COLOR', RecommendationTargetType.REFERENCE, 40],
    ['UNDERTONE_MATCH', 'Undertone Match', 'UNDERTONE', RecommendationTargetType.REFERENCE, 25],
    ['STYLE_MATCH', 'Style Match', 'STYLE', RecommendationTargetType.PACK, 20],
    ['SKIN_TYPE_MATCH', 'Skin Type Match', 'SKIN_TYPE', RecommendationTargetType.REFERENCE, 15],
    ['BUDGET_MATCH', 'Budget Match', 'BUDGET', RecommendationTargetType.PACK, 10],
  ] satisfies Array<
    [string, string, AttributeGroupCode, RecommendationTargetType, number]
  >;

  for (const [code, name, groupCode, targetType, scoreValue] of rules) {
    const group = groups.get(groupCode);

    if (!group) {
      throw new Error(`Missing recommendation rule group ${groupCode}`);
    }

    await prisma.recommendationRule.upsert({
      where: { code },
      update: {
        name,
        targetType,
        attributeGroupId: group.id,
        conditionType: RecommendationConditionType.SHOULD_MATCH,
        scoreValue,
        weight: '1.00',
        isActive: true,
      },
      create: {
        code,
        name,
        targetType,
        attributeGroupId: group.id,
        conditionType: RecommendationConditionType.SHOULD_MATCH,
        scoreValue,
        weight: '1.00',
        isActive: true,
      },
    });
  }
}

async function main() {
  const groups = await seedAttributeGroups();
  const options = await seedAttributeOptions(groups);

  await seedQuizQuestions(groups, options);

  const { products } = await seedCatalog();
  const references = await seedProductReferences(products);

  await seedProductReferenceAttributes(references, groups, options);
  await seedPacks(products, references, groups, options);
  await seedRecommendationRules(groups);

  console.log('Seed Mock Data V1 completed.');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
