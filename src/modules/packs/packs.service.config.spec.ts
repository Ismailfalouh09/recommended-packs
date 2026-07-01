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

describe('PacksService.validateConfiguration', () => {
  let prisma: any;
  let service: PacksService;

  beforeEach(() => {
    prisma = {
      pack: {
        findUnique: jest.fn().mockResolvedValue(loadedPack()),
      },
    };
    service = new PacksService(prisma);
  });

  it('validates a customizable pack and returns a normalized result', async () => {
    const result = await service.validateConfiguration('pack-1', {
      items: [{ packItemId: 'sel-1', productReferenceId: 'ref-a' }],
    });

    expect(result.isValid).toBe(true);
    expect(result.computedPrice).toBe(100);
    expect(result.stockStatus).toBe('IN_STOCK');
    expect(result.normalizedItems).toHaveLength(1);
  });

  it('rejects a non-customizable pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(
      loadedPack({ isCustomizable: false }),
    );

    await expect(
      service.validateConfiguration('pack-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(
      loadedPack({ status: PackStatus.ARCHIVED }),
    );

    await expect(
      service.validateConfiguration('pack-1', {}),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the pack does not exist', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.validateConfiguration('missing', {}),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
