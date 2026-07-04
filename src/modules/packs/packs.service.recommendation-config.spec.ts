import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PackConfigurationSourceType,
  PackItemRole,
  PackStatus,
  PriceMode,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { PacksService } from './packs.service';

/**
 * Pack Core Evolution (Phase 9) — configureFromRecommendation. Verifies that a
 * recommended Pack becomes a QUIZ_RECOMMENDED PackConfiguration, that fixed/auto
 * items are prefilled while required customer-choice slots stay pending, and that
 * disallowed / out-of-stock selections are rejected. No quiz answers or internal
 * recommendation scores may ever be copied into the persisted configuration.
 */

function loadedReference(overrides: Record<string, any> = {}) {
  return {
    id: 'ref-a',
    isActive: true,
    stockQuantity: 10,
    reservedQuantity: 0,
    priceOverride: null,
    priceDelta: 0,
    ...overrides,
  };
}

function loadedProduct(overrides: Record<string, any> = {}) {
  return {
    id: 'prod-1',
    name: 'Foundation X',
    basePrice: 100,
    isActive: true,
    status: ProductStatus.ACTIVE,
    references: [loadedReference()],
    ...overrides,
  };
}

/** A fixed (non-customizable) recommended pack: one FIXED item pinned to ref-a. */
function fixedPack(overrides: Record<string, any> = {}) {
  return {
    id: 'pack-1',
    status: PackStatus.ACTIVE,
    isActive: true,
    isCustomizable: false,
    priceMode: PriceMode.SUM_ITEMS,
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
    minAllowedPrice: null,
    minRequiredItems: null,
    maxItemCount: null,
    items: [
      {
        id: 'fixed-1',
        role: PackItemRole.FIXED,
        selectionMode: SelectionMode.FIXED_REFERENCE,
        quantity: 1,
        minQuantity: null,
        maxQuantity: null,
        quantityEditable: false,
        removalAllowed: false,
        replacementAllowed: false,
        productReferenceId: 'ref-a',
        product: loadedProduct(),
        allowedReferences: [],
      },
    ],
    allowedAddOns: [],
    ...overrides,
  };
}

/** A customizable recommended pack with one required customer-choice slot. */
function customizablePack(overrides: Record<string, any> = {}) {
  return {
    ...fixedPack(),
    isCustomizable: true,
    items: [
      {
        id: 'sel-1',
        role: PackItemRole.REQUIRED_SELECTABLE,
        selectionMode: SelectionMode.CUSTOMER_CHOICE,
        quantity: 1,
        minQuantity: null,
        maxQuantity: null,
        quantityEditable: false,
        removalAllowed: false,
        replacementAllowed: false,
        productReferenceId: null,
        product: loadedProduct(),
        allowedReferences: [{ productReferenceId: 'ref-a' }],
      },
    ],
    ...overrides,
  };
}

describe('PacksService.configureFromRecommendation (Phase 9)', () => {
  let prisma: any;
  let service: PacksService;

  beforeEach(() => {
    prisma = {
      recommendationResult: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'result-1', packId: 'pack-1' }),
      },
      pack: { findUnique: jest.fn().mockResolvedValue(fixedPack()) },
      packConfiguration: {
        // Echo the persisted row back so toConfigurationResponse can map it.
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'cfg-1',
            sourcePackId: data.sourcePackId,
            sourceType: data.sourceType,
            recommendationResultId: data.recommendationResultId,
            finalPrice: data.finalPrice,
            currency: data.currency,
            minAllowedPrice: data.minAllowedPrice,
            isValid: data.isValid,
            stockStatus: data.stockStatus,
            validationResult: data.validationResult,
            createdAt: new Date('2026-07-01T10:00:00.000Z'),
            updatedAt: new Date('2026-07-01T10:00:00.000Z'),
            items: data.items.create.map((item: any, index: number) => ({
              id: `cfg-item-${index}`,
              ...item,
            })),
          }),
        ),
      },
    };
    service = new PacksService(prisma);
  });

  it('creates a valid QUIZ_RECOMMENDED configuration from a recommended fixed pack', async () => {
    const result: any = await service.configureFromRecommendation('result-1', {});

    const createArg = prisma.packConfiguration.create.mock.calls[0][0];
    expect(createArg.data.sourceType).toBe(
      PackConfigurationSourceType.QUIZ_RECOMMENDED,
    );
    expect(createArg.data.recommendationResultId).toBe('result-1');
    expect(createArg.data.isValid).toBe(true);
    // The fixed item is prefilled server-side from the recommended pack.
    expect(createArg.data.items.create).toEqual([
      expect.objectContaining({
        packItemId: 'fixed-1',
        productReferenceId: 'ref-a',
        removed: false,
      }),
    ]);
    expect(result.sourceType).toBe(
      PackConfigurationSourceType.QUIZ_RECOMMENDED,
    );
    expect(result.recommendationResultId).toBe('result-1');
    expect(result.pendingSelections).toEqual([]);
  });

  it('creates a pending configuration when a required customer-choice slot is unselected', async () => {
    prisma.pack.findUnique.mockResolvedValue(customizablePack());

    const result: any = await service.configureFromRecommendation('result-1', {});

    const createArg = prisma.packConfiguration.create.mock.calls[0][0];
    expect(createArg.data.isValid).toBe(false);
    // The pending required slot persists with a null reference (never the
    // validator's fallback pick) so checkout keeps rejecting it.
    expect(createArg.data.items.create).toEqual([
      expect.objectContaining({ packItemId: 'sel-1', productReferenceId: null }),
    ]);
    expect(result.pendingSelections).toEqual(['sel-1']);
  });

  it('creates a valid configuration once the customer selects an allowed option', async () => {
    prisma.pack.findUnique.mockResolvedValue(customizablePack());

    const result: any = await service.configureFromRecommendation('result-1', {
      selections: [{ packItemId: 'sel-1', productReferenceId: 'ref-a' }],
    });

    const createArg = prisma.packConfiguration.create.mock.calls[0][0];
    expect(createArg.data.isValid).toBe(true);
    expect(createArg.data.items.create).toEqual([
      expect.objectContaining({ packItemId: 'sel-1', productReferenceId: 'ref-a' }),
    ]);
    expect(result.pendingSelections).toEqual([]);
  });

  it('rejects a disallowed selection and persists nothing', async () => {
    prisma.pack.findUnique.mockResolvedValue(customizablePack());

    await expect(
      service.configureFromRecommendation('result-1', {
        selections: [{ packItemId: 'sel-1', productReferenceId: 'not-allowed' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects an out-of-stock selection and persists nothing', async () => {
    prisma.pack.findUnique.mockResolvedValue(
      customizablePack({
        items: [
          {
            ...customizablePack().items[0],
            product: loadedProduct({
              references: [loadedReference({ stockQuantity: 0 })],
            }),
          },
        ],
      }),
    );

    await expect(
      service.configureFromRecommendation('result-1', {
        selections: [{ packItemId: 'sel-1', productReferenceId: 'ref-a' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packConfiguration.create).not.toHaveBeenCalled();
  });

  it('never copies quiz answers or internal recommendation scores into the configuration', async () => {
    await service.configureFromRecommendation('result-1', {});

    const createArg = prisma.packConfiguration.create.mock.calls[0][0];
    const serialized = JSON.stringify(createArg.data);
    for (const forbidden of [
      'itemScore',
      'totalScore',
      'matchPercentage',
      'reasonJson',
      'customerReasons',
      'answer',
      'quiz',
      'attributeOption',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('rejects an inactive recommended pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(
      fixedPack({ status: PackStatus.ARCHIVED }),
    );

    await expect(
      service.configureFromRecommendation('result-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packConfiguration.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the recommendation result does not exist', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(null);

    await expect(
      service.configureFromRecommendation('missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.pack.findUnique).not.toHaveBeenCalled();
  });
});
