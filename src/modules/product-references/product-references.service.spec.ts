import { BadRequestException, ConflictException } from '@nestjs/common';
import { MatchType, Prisma, ProductStatus } from '@prisma/client';
import { ProductReferencesService } from './product-references.service';

describe('ProductReferencesService', () => {
  let prisma: any;
  let tx: any;
  let service: ProductReferencesService;

  beforeEach(() => {
    tx = {
      productReference: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue(referenceFixture()),
        update: jest
          .fn()
          .mockResolvedValue(referenceFixture({ referenceName: 'Updated' })),
      },
      productReferenceAttribute: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma = {
      $transaction: jest.fn((input: any) =>
        Array.isArray(input) ? Promise.all(input) : input(tx),
      ),
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'product-1',
          status: ProductStatus.ACTIVE,
          isActive: true,
        }),
      },
      productReference: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(referenceFixture()),
      },
      attributeGroup: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'group-1', code: 'SKIN_COLOR' }),
      },
      attributeOption: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'option-1', code: 'MEDIUM' }),
      },
    };
    service = new ProductReferencesService(prisma);
  });

  it('creates a reference with attributes', async () => {
    prisma.productReference.findUnique.mockResolvedValue(null);

    const result = await service.create('product-1', {
      referenceCode: 'RF2',
      referenceName: 'Medium Warm',
      sku: 'FOUNDATION-X-RF2',
      stockQuantity: 20,
      reservedQuantity: 0,
      lowStockThreshold: 5,
      attributes: [attributeInput()],
    });

    expect(result.referenceCode).toBe('RF2');
    expect(tx.productReference.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attributes: {
            createMany: {
              data: [
                expect.objectContaining({
                  attributeGroupId: 'group-1',
                  attributeOptionId: 'option-1',
                }),
              ],
            },
          },
        }),
      }),
    );
  });

  it('rejects attribute options from the wrong group', async () => {
    prisma.productReference.findUnique.mockResolvedValue(null);
    prisma.attributeOption.findFirst.mockResolvedValue(null);

    await expect(
      service.create('product-1', {
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
        attributes: [attributeInput()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate reference code inside a product', async () => {
    prisma.productReference.findUnique.mockResolvedValueOnce({
      id: 'reference-1',
    });

    await expect(
      service.create('product-1', {
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate SKU', async () => {
    prisma.productReference.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'reference-2' });

    await expect(
      service.create('product-1', {
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
        sku: 'FOUNDATION-X-RF2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reserved quantity greater than stock', async () => {
    prisma.productReference.findUnique.mockResolvedValue(null);

    await expect(
      service.create('product-1', {
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
        stockQuantity: 1,
        reservedQuantity: 2,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sets a default reference and unsets sibling defaults', async () => {
    prisma.productReference.findUnique.mockResolvedValue(null);

    await service.create('product-1', {
      referenceCode: 'RF2',
      referenceName: 'Medium Warm',
      isDefault: true,
    });

    expect(tx.productReference.updateMany).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
      data: { isDefault: false },
    });
  });

  it('replaces attributes during update', async () => {
    prisma.productReference.findUnique.mockResolvedValue({
      id: 'reference-1',
      productId: 'product-1',
      referenceCode: 'RF1',
      sku: null,
      barcode: null,
      stockQuantity: 10,
      reservedQuantity: 0,
      lowStockThreshold: 5,
    });

    await service.update('reference-1', { attributes: [attributeInput()] });

    expect(tx.productReferenceAttribute.deleteMany).toHaveBeenCalledWith({
      where: { productReferenceId: 'reference-1' },
    });
  });

  it('updates stock and calculates low-stock status', async () => {
    prisma.productReference.findUnique.mockResolvedValue({ id: 'reference-1' });
    prisma.productReference.update.mockResolvedValue({
      id: 'reference-1',
      stockQuantity: 5,
      reservedQuantity: 3,
      lowStockThreshold: 2,
    });

    const result = await service.updateStock('reference-1', {
      stockQuantity: 5,
      reservedQuantity: 3,
      lowStockThreshold: 2,
    });

    expect(result.availableStock).toBe(2);
    expect(result.isLowStock).toBe(true);
  });

  it('soft-deactivates a reference', async () => {
    prisma.productReference.findUnique.mockResolvedValue({ id: 'reference-1' });

    await service.deactivate('reference-1');

    expect(prisma.productReference.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false, isDefault: false },
      }),
    );
  });
});

function attributeInput() {
  return {
    attributeGroupCode: 'SKIN_COLOR',
    attributeOptionCode: 'MEDIUM',
    matchType: MatchType.COMPATIBLE,
    scoreValue: 40,
    isHardFilter: false,
  };
}

function referenceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reference-1',
    productId: 'product-1',
    referenceCode: 'RF2',
    referenceName: 'Medium Warm',
    barcode: null,
    sku: 'FOUNDATION-X-RF2',
    priceOverride: null,
    priceDelta: new Prisma.Decimal(0),
    imageUrl: null,
    stockQuantity: 20,
    reservedQuantity: 0,
    lowStockThreshold: 5,
    isDefault: false,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    product: {
      id: 'product-1',
      name: 'Foundation X',
      slug: 'foundation-x',
      status: ProductStatus.ACTIVE,
      isActive: true,
    },
    attributes: [],
    ...overrides,
  };
}
