import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  PackItemRole,
  PackStatus,
  PriceMode,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { PacksService } from './packs.service';

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

function loadedPack(overrides: Record<string, any> = {}) {
  return {
    id: 'pack-1',
    status: PackStatus.ACTIVE,
    isActive: true,
    isCustomizable: true,
    priceMode: PriceMode.SUM_ITEMS,
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
    minAllowedPrice: null,
    minRequiredItems: null,
    maxItemCount: null,
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
    allowedAddOns: [],
    ...overrides,
  };
}

function persistedConfiguration(overrides: Record<string, any> = {}) {
  return {
    id: 'config-1',
    sourcePackId: 'pack-1',
    sourceType: 'CUSTOMIZED',
    finalPrice: 100,
    currency: 'MAD',
    minAllowedPrice: null,
    isValid: true,
    stockStatus: 'IN_STOCK',
    validationResult: { isValid: true },
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-01T10:00:00.000Z'),
    items: [
      {
        id: 'ci-1',
        packItemId: 'sel-1',
        productId: 'prod-1',
        productReferenceId: 'ref-a',
        role: PackItemRole.REQUIRED_SELECTABLE,
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
        isAddOn: false,
        removed: false,
      },
    ],
    ...overrides,
  };
}

describe('PacksService — configuration persistence (Phase 6)', () => {
  let prisma: any;
  let service: PacksService;

  beforeEach(() => {
    prisma = {
      pack: {
        findUnique: jest.fn().mockResolvedValue(loadedPack()),
      },
      packConfiguration: {
        create: jest.fn().mockResolvedValue(persistedConfiguration()),
        findUnique: jest.fn().mockResolvedValue(persistedConfiguration()),
      },
    };
    service = new PacksService(prisma);
  });

  it('persists a valid configuration and returns it', async () => {
    const result = await service.createConfiguration('pack-1', {
      items: [{ packItemId: 'sel-1', productReferenceId: 'ref-a' }],
    });

    expect(prisma.packConfiguration.create).toHaveBeenCalledTimes(1);
    const createArg = prisma.packConfiguration.create.mock.calls[0][0];
    // Only server-calculated data is persisted (price recomputed to 100).
    expect(createArg.data.sourcePackId).toBe('pack-1');
    expect(createArg.data.sourceType).toBe('CUSTOMIZED');
    expect(createArg.data.isValid).toBe(true);
    expect(createArg.data.finalPrice.toString()).toBe('100');
    expect(createArg.data.items.create).toHaveLength(1);
    expect(createArg.data.items.create[0]).toEqual(
      expect.objectContaining({
        packItemId: 'sel-1',
        productReferenceId: 'ref-a',
        isAddOn: false,
        removed: false,
      }),
    );

    expect(result.id).toBe('config-1');
    expect(result.finalPrice).toBe(100);
    expect(result.items).toHaveLength(1);
  });

  it('does not persist an invalid configuration', async () => {
    // Missing required selection → invalid.
    await expect(
      service.createConfiguration('pack-1', { items: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.packConfiguration.create).not.toHaveBeenCalled();
  });

  it('rejects persistence for a non-customizable pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(
      loadedPack({ isCustomizable: false }),
    );

    await expect(
      service.createConfiguration('pack-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.packConfiguration.create).not.toHaveBeenCalled();
  });

  it('reads a persisted configuration by id', async () => {
    const result = await service.findConfiguration('config-1');

    expect(prisma.packConfiguration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'config-1' } }),
    );
    expect(result.id).toBe('config-1');
    expect(result.finalPrice).toBe(100);
    expect(result.items[0].productReferenceId).toBe('ref-a');
  });

  it('throws when the configuration does not exist', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue(null);

    await expect(
      service.findConfiguration('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
