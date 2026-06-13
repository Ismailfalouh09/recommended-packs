import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchType,
  PackStatus,
  Prisma,
  ProductStatus,
  RecommendationConditionType,
  RecommendationTargetType,
  SelectionMode,
} from '@prisma/client';
import { RecommendationEngineService } from './recommendation-engine.service';
import { RecommendationsService } from './recommendations.service';

describe('RecommendationsService admin rules and preview', () => {
  let prisma: any;
  let service: RecommendationsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((input: any) =>
        Array.isArray(input) ? Promise.all(input) : input({}),
      ),
      recommendationRule: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(ruleFixture()),
        update: jest.fn().mockResolvedValue(ruleFixture({ isActive: false })),
      },
      attributeGroup: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'group-1', isActive: true }),
      },
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue(profileFixture()),
      },
      pack: {
        findMany: jest.fn().mockResolvedValue([enginePackFixture()]),
      },
      recommendationSession: {
        create: jest.fn(),
      },
    };
    service = new RecommendationsService(
      prisma,
      new RecommendationEngineService(),
    );
  });

  it('creates a recommendation rule', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue(null);

    const result = await service.adminCreateRule({
      code: 'COVERAGE_MATCH',
      name: 'Coverage match',
      targetType: RecommendationTargetType.REFERENCE,
      attributeGroupId: 'group-1',
      conditionType: RecommendationConditionType.SHOULD_MATCH,
      scoreValue: 15,
      weight: 1,
    });

    expect(result.code).toBe('COVERAGE_MATCH');
    expect(prisma.recommendationRule.create).toHaveBeenCalled();
  });

  it('rejects duplicate rule code', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue({ id: 'rule-1' });

    await expect(
      service.adminCreateRule({
        code: 'COVERAGE_MATCH',
        name: 'Coverage match',
        targetType: RecommendationTargetType.REFERENCE,
        conditionType: RecommendationConditionType.SHOULD_MATCH,
        scoreValue: 15,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid attribute group', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue(null);
    prisma.attributeGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreateRule({
        code: 'COVERAGE_MATCH',
        name: 'Coverage match',
        targetType: RecommendationTargetType.REFERENCE,
        attributeGroupId: 'missing-group',
        conditionType: RecommendationConditionType.SHOULD_MATCH,
        scoreValue: 15,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects active rule with inactive group', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue(null);
    prisma.attributeGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      isActive: false,
    });

    await expect(
      service.adminCreateRule({
        code: 'COVERAGE_MATCH',
        name: 'Coverage match',
        targetType: RecommendationTargetType.REFERENCE,
        attributeGroupId: 'group-1',
        conditionType: RecommendationConditionType.SHOULD_MATCH,
        scoreValue: 15,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates score and weight', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      attributeGroupId: null,
      isActive: true,
    });
    prisma.recommendationRule.update.mockResolvedValue(
      ruleFixture({ scoreValue: 20, weight: decimal(1.5) }),
    );

    const result = await service.adminUpdateRule('rule-1', {
      scoreValue: 20,
      weight: 1.5,
    });

    expect(result.effectiveScore).toBe(30);
  });

  it('soft-deactivates a rule', async () => {
    prisma.recommendationRule.findUnique.mockResolvedValue({ id: 'rule-1' });

    await service.adminDeactivateRule('rule-1');

    expect(prisma.recommendationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it('engine uses active configured weighted score', async () => {
    prisma.recommendationRule.findMany.mockResolvedValue([
      { code: 'SKIN_COLOR_MATCH', scoreValue: 100, weight: decimal(1) },
    ]);

    const result = await service.preview({ customerProfileId: 'profile-1' });

    expect(result.recommendedPacks[0].totalScore).toBe(100);
  });

  it('engine uses fallback when rule is missing or inactive', async () => {
    prisma.recommendationRule.findMany.mockResolvedValue([]);

    const result = await service.preview({ customerProfileId: 'profile-1' });

    expect(result.recommendedPacks[0].totalScore).toBe(40);
  });

  it('preview does not persist recommendation session or results', async () => {
    await service.preview({ customerProfileId: 'profile-1' });

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.recommendationSession.create).not.toHaveBeenCalled();
  });
});

function ruleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    code: 'COVERAGE_MATCH',
    name: 'Coverage match',
    targetType: RecommendationTargetType.REFERENCE,
    attributeGroupId: 'group-1',
    conditionType: RecommendationConditionType.SHOULD_MATCH,
    scoreValue: 15,
    weight: decimal(1),
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    attributeGroup: {
      id: 'group-1',
      code: 'COVERAGE',
      name: 'Coverage',
      isActive: true,
    },
    ...overrides,
  };
}

function profileFixture() {
  return {
    id: 'profile-1',
    answers: [
      {
        attributeGroup: { code: 'SKIN_COLOR' },
        attributeOption: { code: 'MEDIUM' },
      },
    ],
  };
}

function enginePackFixture() {
  return {
    id: 'pack-1',
    name: 'Foundation Pack',
    priority: 0,
    status: PackStatus.ACTIVE,
    isActive: true,
    attributes: [],
    items: [
      {
        id: 'pack-item-1',
        productReferenceId: null,
        quantity: 1,
        selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
        isRequired: true,
        product: {
          id: 'product-1',
          name: 'Foundation X',
          isActive: true,
          status: ProductStatus.ACTIVE,
          references: [
            {
              id: 'reference-1',
              referenceCode: 'RF2',
              referenceName: 'Medium Warm',
              stockQuantity: 10,
              reservedQuantity: 0,
              isActive: true,
              attributes: [
                {
                  matchType: MatchType.COMPATIBLE,
                  scoreValue: 0,
                  isHardFilter: false,
                  attributeGroup: { code: 'SKIN_COLOR' },
                  attributeOption: { code: 'MEDIUM' },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
