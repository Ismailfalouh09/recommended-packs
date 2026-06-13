import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';

describe('ProductsService admin catalog', () => {
  let prisma: any;
  let tx: any;
  let service: ProductsService;

  beforeEach(() => {
    tx = {
      productReference: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      product: {
        update: jest
          .fn()
          .mockResolvedValue(
            productFixture({ status: ProductStatus.ARCHIVED, isActive: false }),
          ),
      },
    };
    prisma = {
      $transaction: jest.fn((input: any) =>
        Array.isArray(input) ? Promise.all(input) : input(tx),
      ),
      product: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue(productFixture()),
        update: jest
          .fn()
          .mockResolvedValue(productFixture({ name: 'Updated' })),
      },
      category: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'category-1', isActive: true }),
      },
      brand: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'brand-1', isActive: true }),
      },
    };
    service = new ProductsService(prisma);
  });

  it('creates a product', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    const result = await service.adminCreate({
      categoryId: 'category-1',
      brandId: 'brand-1',
      name: 'Foundation X',
      slug: 'foundation-x',
      basePrice: 120,
      currency: 'MAD',
      status: ProductStatus.ACTIVE,
      isActive: true,
    });

    expect(result.slug).toBe('foundation-x');
    expect(prisma.product.create).toHaveBeenCalled();
  });

  it('rejects an invalid category', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        categoryId: 'missing-category',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        currency: 'MAD',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid brand', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.brand.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        brandId: 'missing-brand',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        currency: 'MAD',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects duplicate slugs', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'product-existing' });

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        currency: 'MAD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      categoryId: 'category-1',
      brandId: 'brand-1',
      isActive: true,
    });

    const result = await service.adminUpdate('product-1', { name: 'Updated' });

    expect(result.name).toBe('Updated');
    expect(prisma.product.update).toHaveBeenCalled();
  });

  it('rejects active products on inactive categories', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.category.findUnique.mockResolvedValue({
      id: 'category-1',
      isActive: false,
    });

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        currency: 'MAD',
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archives a product and deactivates its references', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'product-1' });

    const result = await service.adminArchive('product-1');

    expect(result.status).toBe(ProductStatus.ARCHIVED);
    expect(result.isActive).toBe(false);
    expect(tx.productReference.updateMany).toHaveBeenCalledWith({
      where: { productId: 'product-1' },
      data: { isActive: false, isDefault: false },
    });
  });

  it('public product endpoint excludes archived or inactive products', async () => {
    prisma.product.findFirst = jest.fn().mockResolvedValue(null);

    await expect(service.findOne('product-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'product-1',
          isActive: true,
          status: ProductStatus.ACTIVE,
        },
      }),
    );
  });
});

function productFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    categoryId: 'category-1',
    brandId: 'brand-1',
    name: 'Foundation X',
    slug: 'foundation-x',
    description: null,
    basePrice: new Prisma.Decimal(120),
    costPrice: new Prisma.Decimal(70),
    currency: 'MAD',
    mainImageUrl: null,
    status: ProductStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    category: { id: 'category-1', code: 'FOUNDATION', name: 'Foundation' },
    brand: { id: 'brand-1', name: 'Demo Beauty' },
    references: [],
    _count: { packItems: 0 },
    ...overrides,
  };
}
