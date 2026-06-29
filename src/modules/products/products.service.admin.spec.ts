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
        findFirst: jest.fn().mockResolvedValue(productFixture()),
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
      basePrice: new Prisma.Decimal(120),
      costPrice: new Prisma.Decimal(70),
      compareAtPrice: null,
      currency: 'MAD',
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

  it('rejects a cost price above the base price', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        costPrice: 130,
        currency: 'MAD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an unsupported currency', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a compare-at price not above the base price', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        categoryId: 'category-1',
        name: 'Foundation X',
        slug: 'foundation-x',
        basePrice: 120,
        compareAtPrice: 100,
        currency: 'MAD',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('derives onSale and % saving from a valid compare-at price', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    prisma.product.create.mockResolvedValue(
      productFixture({
        basePrice: new Prisma.Decimal(120),
        compareAtPrice: new Prisma.Decimal(150),
      }),
    );

    const result = await service.adminCreate({
      categoryId: 'category-1',
      name: 'Foundation X',
      slug: 'foundation-x',
      basePrice: 120,
      compareAtPrice: 150,
      currency: 'MAD',
    });

    expect(result.onSale).toBe(true);
    expect(result.percentageSaving).toBe(20);
  });

  it('exposes a derived stock signal (not raw reserved/threshold) on public references', async () => {
    prisma.product.findFirst.mockResolvedValue(
      productFixture({
        references: [
          {
            id: 'ref-1',
            referenceCode: 'RF1',
            referenceName: 'Medium Warm',
            shadeName: 'Medium Warm',
            shadeCode: 'N20',
            swatchHex: '#E8B98C',
            measurement: null,
            variationType: 'SHADE',
            priceOverride: null,
            priceDelta: new Prisma.Decimal(10),
            imageUrl: null,
            image: null,
            stockQuantity: 3,
            reservedQuantity: 1,
            lowStockThreshold: 5,
            isDefault: true,
            attributes: [],
          },
        ],
      }),
    );

    const result: any = await service.findOne('product-1');
    const reference = result.references[0];

    expect(reference.inStock).toBe(true);
    expect(reference.lowStock).toBe(true);
    expect(reference.effectivePrice).toBe(130);
    expect(reference).not.toHaveProperty('reservedQuantity');
    expect(reference).not.toHaveProperty('lowStockThreshold');
    expect(result.priceFrom).toBe(130);
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

  it('public product endpoint excludes non-active products (status single source)', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findOne('product-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'product-1',
          status: ProductStatus.ACTIVE,
        },
      }),
    );
  });

  it('public product endpoint returns active product details by ID', async () => {
    prisma.product.findFirst.mockResolvedValue(productFixture());

    const result = await service.findOne('product-1');

    expect(result).toMatchObject({
      id: 'product-1',
      slug: 'foundation-x',
      references: [],
      images: [],
    });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'product-1',
          status: ProductStatus.ACTIVE,
        },
      }),
    );
  });

  it('public product slug endpoint returns active product details', async () => {
    prisma.product.findFirst.mockResolvedValue(productFixture());

    const result = await service.findBySlug('foundation-x');

    expect(result).toMatchObject({
      id: 'product-1',
      slug: 'foundation-x',
      references: [],
      images: [],
    });
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'foundation-x',
          status: ProductStatus.ACTIVE,
        },
      }),
    );
  });

  it('public product slug endpoint returns 404 for unknown slugs', async () => {
    prisma.product.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('unknown-product')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'unknown-product',
          status: ProductStatus.ACTIVE,
        },
      }),
    );
  });

  it('public product listing keeps the plain array response without params', async () => {
    prisma.product.findMany.mockResolvedValue([productFixture()]);

    const result = await service.findAll();

    expect(Array.isArray(result)).toBe(true);
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: ProductStatus.ACTIVE,
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    );
  });

  it('public product listing supports search', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll({ search: 'primer' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'primer', mode: 'insensitive' } },
            { slug: { contains: 'primer', mode: 'insensitive' } },
          ]),
        }),
      }),
    );
  });

  it('public product listing supports category code filters', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll({ categoryCode: 'FACE' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: { code: 'FACE' },
        }),
      }),
    );
  });

  it('public product listing supports price sorting', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll({ sortBy: 'basePrice', sortOrder: 'asc' });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ basePrice: 'asc' }],
      }),
    );
  });

  it('public product listing supports in-stock filtering', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await service.findAll({ inStock: true });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          references: {
            some: {
              isActive: true,
              stockQuantity: { gt: 0 },
            },
          },
        }),
      }),
    );
  });

  it('public product listing returns a paginated response when requested', async () => {
    prisma.product.findMany.mockResolvedValue([productFixture()]);
    prisma.product.count.mockResolvedValue(1);

    const result = await service.findAll({ page: 1, size: 1 });

    expect(result).toMatchObject({
      data: [expect.objectContaining({ id: 'product-1' })],
      pagination: {
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
      },
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 1,
      }),
    );
    expect(prisma.product.count).toHaveBeenCalled();
  });
});

function productFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    categoryId: 'category-1',
    brandId: 'brand-1',
    name: 'Foundation X',
    slug: 'foundation-x',
    productType: null,
    shortDescription: null,
    description: null,
    ingredients: null,
    directions: null,
    basePrice: new Prisma.Decimal(120),
    compareAtPrice: null,
    costPrice: new Prisma.Decimal(70),
    currency: 'MAD',
    metaTitle: null,
    metaDescription: null,
    mainImageUrl: null,
    status: ProductStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    category: { id: 'category-1', code: 'FOUNDATION', name: 'Foundation' },
    brand: { id: 'brand-1', name: 'Demo Beauty' },
    references: [],
    images: [],
    _count: { packItems: 0 },
    ...overrides,
  };
}
