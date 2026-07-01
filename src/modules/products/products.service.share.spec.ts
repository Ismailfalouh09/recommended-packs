import { NotFoundException } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';

function referenceFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'ref-1',
    referenceCode: 'RF1',
    referenceName: 'Shade 1',
    shadeName: 'Warm',
    shadeCode: 'W1',
    swatchHex: '#cc9966',
    measurement: null,
    variationType: 'SHADE',
    priceOverride: null,
    priceDelta: 0,
    imageUrl: null,
    image: null,
    stockQuantity: 10,
    reservedQuantity: 2,
    lowStockThreshold: 3,
    isDefault: true,
    attributes: [],
    ...overrides,
  };
}

function productFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'prod-1',
    slug: 'foundation-x',
    name: 'Foundation X',
    productType: 'foundation',
    shortDescription: 'Lightweight buildable foundation.',
    description: 'A demo foundation.',
    ingredients: 'Aqua, Glycerin.',
    directions: 'Apply as needed.',
    basePrice: 120,
    compareAtPrice: null,
    currency: 'MAD',
    metaTitle: 'Foundation X — meta',
    metaDescription: 'Meta description for sharing.',
    mainImageUrl: 'https://cdn.example.com/foundation-x.jpg',
    status: ProductStatus.ACTIVE,
    category: { id: 'cat-1', code: 'FACE', name: 'Face', image: null },
    brand: { id: 'brand-1', name: 'Acme' },
    references: [referenceFixture()],
    attributes: [],
    images: [],
    ...overrides,
  };
}

describe('ProductsService share metadata (Phase 8B)', () => {
  let prisma: any;
  let service: ProductsService;

  beforeEach(() => {
    prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(productFixture()),
      },
    };
    service = new ProductsService(prisma);
  });

  it('exposes safe share metadata for an active public product (by slug)', async () => {
    const result: any = await service.findBySlug('foundation-x');

    expect(result.share).toEqual({
      shareUrl: '/products/foundation-x',
      shareTitle: 'Foundation X — meta',
      shareDescription: 'Meta description for sharing.',
      shareImageUrl: 'https://cdn.example.com/foundation-x.jpg',
    });
  });

  it('falls back to name/shortDescription when meta fields are absent', async () => {
    prisma.product.findFirst.mockResolvedValue(
      productFixture({ metaTitle: null, metaDescription: null }),
    );

    const result: any = await service.findOne('prod-1');

    expect(result.share.shareTitle).toBe('Foundation X');
    expect(result.share.shareDescription).toBe(
      'Lightweight buildable foundation.',
    );
  });

  it('cannot be shared when the product is inactive/non-public', async () => {
    // findFirst is filtered by status ACTIVE; a non-active product resolves null.
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('foundation-x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: ProductStatus.ACTIVE }),
      }),
    );
  });

  it('never leaks private/internal fields in the public detail response', async () => {
    const result: any = await service.findOne('prod-1');
    const serialized = JSON.stringify(result);

    expect(result).not.toHaveProperty('costPrice');
    expect(serialized).not.toContain('costPrice');
    expect(serialized).not.toContain('reservedQuantity');
    expect(serialized).not.toContain('lowStockThreshold');
    expect(serialized).not.toContain('scoreValue');
    expect(serialized).not.toContain('isHardFilter');
  });
});
