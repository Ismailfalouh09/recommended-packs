import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  MatchType,
  PackStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { validateRoleAccess } from '../../test-utils/role-test.util';
import { PacksService } from './packs.service';

describe('PacksService admin CRUD', () => {
  let prisma: any;
  let tx: any;
  let service: PacksService;

  beforeEach(() => {
    tx = {
      pack: {
        create: jest.fn().mockResolvedValue(packFixture()),
        update: jest
          .fn()
          .mockResolvedValue(packFixture({ name: 'Updated Pack' })),
      },
      packItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
      packAttribute: {
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };
    prisma = {
      $transaction: jest.fn((input: any) =>
        Array.isArray(input) ? Promise.all(input) : input(tx),
      ),
      pack: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(packFixture()),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(
          packFixture({
            status: PackStatus.ARCHIVED,
            isActive: false,
          }),
        ),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue(productFixture()),
      },
      attributeGroup: {
        findFirst: jest.fn().mockResolvedValue({ id: 'group-style' }),
      },
      attributeOption: {
        findFirst: jest.fn().mockResolvedValue({ id: 'option-natural' }),
      },
    };
    service = new PacksService(prisma);
  });

  it('creates a valid fixed-price pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    const result = await service.adminCreate(baseCreateDto());

    expect(result.name).toBe('Natural Glow Pack');
    expect(tx.pack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceMode: PriceMode.FIXED,
          fixedPrice: 299,
          discountAmount: null,
          discountPercentage: null,
        }),
      }),
    );
  });

  it('creates a SUM_ITEMS pack with fixed price cleared', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await service.adminCreate({
      ...baseCreateDto(),
      priceMode: PriceMode.SUM_ITEMS,
      fixedPrice: null,
      discountAmount: 10,
      discountPercentage: 5,
    });

    expect(tx.pack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceMode: PriceMode.SUM_ITEMS,
          fixedPrice: null,
          discountAmount: null,
          discountPercentage: null,
        }),
      }),
    );
  });

  it('creates a discounted pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await service.adminCreate({
      ...baseCreateDto(),
      priceMode: PriceMode.SUM_ITEMS_WITH_DISCOUNT,
      fixedPrice: null,
      discountAmount: 20,
    });

    expect(tx.pack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          priceMode: PriceMode.SUM_ITEMS_WITH_DISCOUNT,
          fixedPrice: null,
          discountAmount: 20,
        }),
      }),
    );
  });

  it('rejects duplicate slugs', async () => {
    prisma.pack.findUnique.mockResolvedValue({ id: 'pack-existing' });

    await expect(service.adminCreate(baseCreateDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects invalid budget ranges', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        minBudget: 400,
        maxBudget: 200,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects fixed mode without fixedPrice', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({ ...baseCreateDto(), fixedPrice: null }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects both discountAmount and discountPercentage', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        priceMode: PriceMode.SUM_ITEMS_WITH_DISCOUNT,
        fixedPrice: null,
        discountAmount: 20,
        discountPercentage: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects active pack without items', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate products in items', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [autoItem(), autoItem({ sortOrder: 2 })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects duplicate attribute combinations', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        attributes: [attributeInput(), attributeInput()],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a valid FIXED_REFERENCE item', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await service.adminCreate({
      ...baseCreateDto(),
      items: [
        fixedItem({
          productReferenceId: 'reference-1',
        }),
      ],
    });

    expect(tx.pack.create).toHaveBeenCalled();
  });

  it('rejects an inactive fixed reference when activating a pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(
      productFixture({
        references: [
          {
            id: 'reference-1',
            productId: 'product-1',
            stockQuantity: 10,
            reservedQuantity: 0,
            isActive: false,
          },
        ],
      }),
    );

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [fixedItem({ productReferenceId: 'reference-1' })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an out-of-stock fixed reference when activating a pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(
      productFixture({
        references: [
          {
            id: 'reference-1',
            productId: 'product-1',
            stockQuantity: 5,
            reservedQuantity: 5,
            isActive: true,
          },
        ],
      }),
    );

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [fixedItem({ productReferenceId: 'reference-1' })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects FIXED_REFERENCE without reference ID', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [fixedItem({ productReferenceId: undefined })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a reference that does not belong to the product', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [fixedItem({ productReferenceId: 'other-reference' })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects AUTO_BEST_REFERENCE with productReferenceId', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [autoItem({ productReferenceId: 'reference-1' })],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects CUSTOMER_CHOICE with productReferenceId', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [
          autoItem({
            selectionMode: SelectionMode.CUSTOMER_CHOICE,
            productReferenceId: 'reference-1',
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects CUSTOMER_CHOICE while the mode is deferred', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.adminCreate({
        ...baseCreateDto(),
        items: [
          autoItem({
            selectionMode: SelectionMode.CUSTOMER_CHOICE,
          }),
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects product without references', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(
      productFixture({ references: [] }),
    );

    await expect(service.adminCreate(baseCreateDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive product when activating pack', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.product.findUnique.mockResolvedValue(
      productFixture({ isActive: false, status: ProductStatus.ARCHIVED }),
    );

    await expect(service.adminCreate(baseCreateDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a valid pack attribute', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await service.adminCreate(baseCreateDto());

    expect(tx.pack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attributes: {
            createMany: {
              data: [
                expect.objectContaining({
                  attributeGroupId: 'group-style',
                  attributeOptionId: 'option-natural',
                  isHardFilter: false,
                }),
              ],
            },
          },
        }),
      }),
    );
  });

  it('rejects invalid group code', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.attributeGroup.findFirst.mockResolvedValue(null);

    await expect(service.adminCreate(baseCreateDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid option code or wrong group', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);
    prisma.attributeOption.findFirst.mockResolvedValue(null);

    await expect(service.adminCreate(baseCreateDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('persists hard-filter attributes', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await service.adminCreate({
      ...baseCreateDto(),
      attributes: [attributeInput({ isHardFilter: true })],
    });

    expect(tx.pack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          attributes: {
            createMany: {
              data: [expect.objectContaining({ isHardFilter: true })],
            },
          },
        }),
      }),
    );
  });

  it('partial update preserves omitted items', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(existingPackFixture());

    await service.adminUpdate('pack-1', { name: 'Updated Pack' });

    expect(tx.packItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.pack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ items: expect.anything() }),
      }),
    );
  });

  it('supplied items replace previous items', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(existingPackFixture());

    await service.adminUpdate('pack-1', {
      items: [autoItem({ productId: 'product-2' })],
    });

    expect(tx.packItem.deleteMany).toHaveBeenCalledWith({
      where: { packId: 'pack-1' },
    });
  });

  it('supplied attributes replace previous attributes', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(existingPackFixture());

    await service.adminUpdate('pack-1', {
      attributes: [attributeInput({ attributeOptionCode: 'MEDIUM' })],
    });

    expect(tx.packAttribute.deleteMany).toHaveBeenCalledWith({
      where: { packId: 'pack-1' },
    });
  });

  it('invalid replacement does not enter transaction', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(existingPackFixture());
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.adminUpdate('pack-1', {
        items: [autoItem({ productId: 'missing-product' })],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('changing price mode validates final state', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(existingPackFixture());

    await expect(
      service.adminUpdate('pack-1', {
        priceMode: PriceMode.FIXED,
        fixedPrice: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('activating draft validates complete configuration', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(
      existingPackFixture({
        status: PackStatus.DRAFT,
        isActive: false,
        items: [],
      }),
    );

    await expect(
      service.adminUpdate('pack-1', {
        status: PackStatus.ACTIVE,
        isActive: true,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('archives a pack without deleting historical relations', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce({ id: 'pack-1' });

    const result = await service.adminArchive('pack-1');

    expect(result.status).toBe(PackStatus.ARCHIVED);
    expect(result.isActive).toBe(false);
    expect(prisma.pack.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: PackStatus.ARCHIVED, isActive: false },
      }),
    );
    expect(tx.packItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.packAttribute.deleteMany).not.toHaveBeenCalled();
  });

  it('archived pack remains visible in admin API', async () => {
    prisma.pack.findUnique.mockResolvedValueOnce(
      packFixture({ status: PackStatus.ARCHIVED, isActive: false }),
    );

    const result = await service.adminFindOne('pack-1');

    expect(result.status).toBe(PackStatus.ARCHIVED);
  });

  it('public endpoint excludes archived packs', async () => {
    prisma.pack.findFirst.mockResolvedValue(null);

    await expect(service.findOne('pack-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.pack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'pack-1',
          isActive: true,
          status: PackStatus.ACTIVE,
        },
      }),
    );
  });

  it('public pack endpoint returns active pack details by ID', async () => {
    prisma.pack.findFirst.mockResolvedValue(packFixture());

    const result = await service.findOne('pack-1');

    expect(result).toMatchObject({
      id: 'pack-1',
      slug: 'natural-glow-pack',
      items: [expect.objectContaining({ id: 'pack-item-1' })],
      images: [],
    });
    expect(prisma.pack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'pack-1',
          isActive: true,
          status: PackStatus.ACTIVE,
        },
      }),
    );
  });

  it('public pack slug endpoint returns active pack details', async () => {
    prisma.pack.findFirst.mockResolvedValue(packFixture());

    const result = await service.findBySlug('natural-glow-pack');

    expect(result).toMatchObject({
      id: 'pack-1',
      slug: 'natural-glow-pack',
      items: [expect.objectContaining({ id: 'pack-item-1' })],
      images: [],
    });
    expect(prisma.pack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'natural-glow-pack',
          isActive: true,
          status: PackStatus.ACTIVE,
        },
      }),
    );
  });

  it('public pack slug endpoint returns 404 for unknown slugs', async () => {
    prisma.pack.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('unknown-pack')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.pack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'unknown-pack',
          isActive: true,
          status: PackStatus.ACTIVE,
        },
      }),
    );
  });

  it('keeps STAFF read-only and allows ADMIN/OWNER writes by role policy', () => {
    const writeRoles = [AdminRole.OWNER, AdminRole.ADMIN];

    expect(validateRoleAccess(writeRoles, AdminRole.STAFF)).toBe(false);
    expect(validateRoleAccess(writeRoles, AdminRole.ADMIN)).toBe(true);
    expect(validateRoleAccess(writeRoles, AdminRole.OWNER)).toBe(true);
  });
});

function baseCreateDto(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Natural Glow Pack',
    slug: 'natural-glow-pack',
    description: 'Natural makeup pack',
    priceMode: PriceMode.FIXED,
    fixedPrice: 299,
    minBudget: 200,
    maxBudget: 350,
    currency: 'MAD',
    priority: 5,
    status: PackStatus.ACTIVE,
    isActive: true,
    items: [autoItem()],
    attributes: [attributeInput()],
    ...overrides,
  } as any;
}

function autoItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'product-1',
    selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
    quantity: 1,
    isRequired: true,
    sortOrder: 1,
    ...overrides,
  } as any;
}

function fixedItem(overrides: Record<string, unknown> = {}) {
  return {
    productId: 'product-1',
    productReferenceId: 'reference-1',
    selectionMode: SelectionMode.FIXED_REFERENCE,
    quantity: 1,
    isRequired: true,
    sortOrder: 1,
    ...overrides,
  } as any;
}

function attributeInput(overrides: Record<string, unknown> = {}) {
  return {
    attributeGroupCode: 'STYLE',
    attributeOptionCode: 'NATURAL',
    matchType: MatchType.COMPATIBLE,
    scoreValue: 20,
    isHardFilter: false,
    ...overrides,
  } as any;
}

function productFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    name: 'Foundation X',
    status: ProductStatus.ACTIVE,
    isActive: true,
    references: [
      {
        id: 'reference-1',
        productId: 'product-1',
        stockQuantity: 10,
        reservedQuantity: 0,
        isActive: true,
      },
    ],
    ...overrides,
  };
}

function existingPackFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow Pack',
    slug: 'natural-glow-pack',
    description: 'Natural makeup pack',
    mainImageUrl: null,
    priceMode: PriceMode.FIXED,
    fixedPrice: decimal(299),
    discountAmount: null,
    discountPercentage: null,
    minBudget: decimal(200),
    maxBudget: decimal(350),
    currency: 'MAD',
    priority: 5,
    status: PackStatus.ACTIVE,
    isActive: true,
    items: [
      {
        productId: 'product-1',
        productReferenceId: null,
        quantity: 1,
        selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
        isRequired: true,
        sortOrder: 1,
      },
    ],
    attributes: [
      {
        matchType: MatchType.COMPATIBLE,
        scoreValue: 20,
        isHardFilter: false,
        attributeGroup: { code: 'STYLE' },
        attributeOption: { code: 'NATURAL' },
      },
    ],
    ...overrides,
  };
}

function packFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow Pack',
    slug: 'natural-glow-pack',
    description: 'Natural makeup pack',
    mainImageUrl: null,
    priceMode: PriceMode.FIXED,
    fixedPrice: decimal(299),
    discountAmount: null,
    discountPercentage: null,
    minBudget: decimal(200),
    maxBudget: decimal(350),
    currency: 'MAD',
    priority: 5,
    status: PackStatus.ACTIVE,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    images: [],
    attributes: [
      {
        id: 'pack-attribute-1',
        matchType: MatchType.COMPATIBLE,
        scoreValue: 20,
        isHardFilter: false,
        attributeGroup: { id: 'group-style', code: 'STYLE', name: 'Style' },
        attributeOption: {
          id: 'option-natural',
          code: 'NATURAL',
          label: 'Natural',
        },
      },
    ],
    items: [
      {
        id: 'pack-item-1',
        productId: 'product-1',
        productReferenceId: null,
        quantity: 1,
        selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
        isRequired: true,
        sortOrder: 1,
        product: {
          id: 'product-1',
          name: 'Foundation X',
          slug: 'foundation-x',
          basePrice: decimal(120),
          currency: 'MAD',
          mainImageUrl: null,
          status: ProductStatus.ACTIVE,
          isActive: true,
          category: {
            id: 'category-1',
            code: 'FOUNDATION',
            name: 'Foundation',
          },
          brand: { id: 'brand-1', name: 'Demo Beauty' },
          references: [
            {
              id: 'reference-1',
              referenceCode: 'RF2',
              referenceName: 'Medium Warm',
              priceOverride: null,
              priceDelta: decimal(0),
              imageUrl: null,
              stockQuantity: 20,
              reservedQuantity: 0,
              isDefault: true,
              isActive: true,
            },
          ],
        },
        productReference: null,
      },
    ],
    _count: {
      recommendationResults: 0,
      orders: 0,
    },
    ...overrides,
  };
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
