import {
  PackExperienceLevel,
  PackItemRole,
  PackOccasion,
  PackStatus,
  PackTier,
  PriceMode,
  SelectionMode,
} from '@prisma/client';
import { PacksService } from './packs.service';

function referenceFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'ref-1',
    referenceCode: 'RF1',
    referenceName: 'Shade 1',
    priceOverride: null,
    priceDelta: 0,
    imageUrl: null,
    image: null,
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
    isDefault: true,
    ...overrides,
  };
}

function itemFixture(overrides: Record<string, any> = {}) {
  const { product, ...rest } = overrides;
  return {
    id: 'item-1',
    quantity: 1,
    selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
    isRequired: true,
    sortOrder: 0,
    role: PackItemRole.FIXED,
    product: {
      id: 'prod-1',
      name: 'Product',
      slug: 'product',
      basePrice: 100,
      currency: 'MAD',
      mainImageUrl: null,
      images: [],
      category: null,
      brand: null,
      references: [referenceFixture()],
      ...(product ?? {}),
    },
    productReference: null,
    ...rest,
  };
}

function packFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow',
    slug: 'natural-glow',
    description: 'A natural pack',
    mainImageUrl: null,
    priceMode: PriceMode.FIXED,
    fixedPrice: 299,
    discountAmount: null,
    discountPercentage: null,
    minBudget: null,
    maxBudget: null,
    currency: 'MAD',
    priority: 0,
    status: PackStatus.ACTIVE,
    isActive: true,
    isCustomizable: false,
    tier: null,
    occasion: null,
    experienceLevel: null,
    isFeatured: false,
    isNew: false,
    isBestSeller: false,
    tags: [],
    searchKeywords: null,
    category: null,
    images: [],
    attributes: [],
    items: [itemFixture()],
    ...overrides,
  };
}

describe('PacksService public discovery (findAllPublic)', () => {
  let prisma: any;
  let service: PacksService;

  beforeEach(() => {
    prisma = {
      pack: {
        findMany: jest.fn().mockResolvedValue([packFixture()]),
      },
    };
    service = new PacksService(prisma);
  });

  function lastWhere() {
    return prisma.pack.findMany.mock.calls.at(-1)[0].where;
  }

  function lastOrderBy() {
    return prisma.pack.findMany.mock.calls.at(-1)[0].orderBy;
  }

  describe('backward compatibility', () => {
    it('returns a plain array (no pagination envelope) when no filters are supplied', async () => {
      const result = await service.findAllPublic({});

      expect(Array.isArray(result)).toBe(true);
      expect((result as any).pagination).toBeUndefined();
      expect((result as any[])[0].availableNow).toBeUndefined();
      expect(lastWhere()).toEqual({ isActive: true, status: 'ACTIVE' });
    });
  });

  describe('base scoping', () => {
    it('only ever returns active/public packs', async () => {
      await service.findAllPublic({ featured: true });
      expect(lastWhere()).toMatchObject({
        isActive: true,
        status: PackStatus.ACTIVE,
      });
    });

    it('returns a paginated envelope with availableNow once a filter is supplied', async () => {
      const result: any = await service.findAllPublic({ tier: PackTier.PREMIUM });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].availableNow).toBe(true);
      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        totalItems: 1,
        totalPages: 1,
      });
    });
  });

  describe('individual filters', () => {
    it('filters by category code (case-insensitive, reusing Category)', async () => {
      await service.findAllPublic({ category: 'FACE' });
      expect(lastWhere().category).toEqual({
        is: { code: { equals: 'FACE', mode: 'insensitive' } },
      });
    });

    it('filters by tier', async () => {
      await service.findAllPublic({ tier: PackTier.LUXE });
      expect(lastWhere().tier).toBe(PackTier.LUXE);
    });

    it('filters by occasion', async () => {
      await service.findAllPublic({ occasion: PackOccasion.WEDDING });
      expect(lastWhere().occasion).toBe(PackOccasion.WEDDING);
    });

    it('filters by experience level', async () => {
      await service.findAllPublic({
        experienceLevel: PackExperienceLevel.BEGINNER,
      });
      expect(lastWhere().experienceLevel).toBe(PackExperienceLevel.BEGINNER);
    });

    it('filters by customizable', async () => {
      await service.findAllPublic({ customizable: true });
      expect(lastWhere().isCustomizable).toBe(true);
    });

    it('filters by featured', async () => {
      await service.findAllPublic({ featured: true });
      expect(lastWhere().isFeatured).toBe(true);
    });

    it('filters by tags (hasSome)', async () => {
      await service.findAllPublic({ tags: ['bridal', 'glam'] });
      expect(lastWhere().tags).toEqual({ hasSome: ['bridal', 'glam'] });
    });

    it('searches name, slug, keywords, and description', async () => {
      await service.findAllPublic({ search: 'natural' });
      expect(lastWhere().OR).toEqual([
        { name: { contains: 'natural', mode: 'insensitive' } },
        { slug: { contains: 'natural', mode: 'insensitive' } },
        { searchKeywords: { contains: 'natural', mode: 'insensitive' } },
        { description: { contains: 'natural', mode: 'insensitive' } },
      ]);
    });
  });

  describe('combined filters', () => {
    it('combines multiple filters additively', async () => {
      await service.findAllPublic({
        category: 'FACE',
        tier: PackTier.PREMIUM,
        occasion: PackOccasion.PARTY,
        customizable: false,
        featured: true,
        tags: ['glam'],
        search: 'glow',
      });

      expect(lastWhere()).toMatchObject({
        isActive: true,
        status: PackStatus.ACTIVE,
        category: { is: { code: { equals: 'FACE', mode: 'insensitive' } } },
        tier: PackTier.PREMIUM,
        occasion: PackOccasion.PARTY,
        isCustomizable: false,
        isFeatured: true,
        tags: { hasSome: ['glam'] },
      });
      expect(lastWhere().OR).toHaveLength(4);
    });
  });

  describe('sort', () => {
    it('defaults to priority desc then createdAt desc', async () => {
      await service.findAllPublic({ page: 1 });
      expect(lastOrderBy()).toEqual([
        { priority: 'desc' },
        { createdAt: 'desc' },
      ]);
    });

    it('sorts by newest', async () => {
      await service.findAllPublic({ sort: 'newest' });
      expect(lastOrderBy()).toEqual([{ createdAt: 'desc' }]);
    });

    it('sorts by price ascending', async () => {
      await service.findAllPublic({ sort: 'price_asc' });
      expect(lastOrderBy()).toEqual([
        { fixedPrice: 'asc' },
        { createdAt: 'desc' },
      ]);
    });

    it('sorts featured first', async () => {
      await service.findAllPublic({ sort: 'featured' });
      expect(lastOrderBy()).toEqual([
        { isFeatured: 'desc' },
        { priority: 'desc' },
        { createdAt: 'desc' },
      ]);
    });

    it('sorts by name', async () => {
      await service.findAllPublic({ sort: 'name' });
      expect(lastOrderBy()).toEqual([{ name: 'asc' }]);
    });
  });

  describe('availableNow filter', () => {
    const availablePack = packFixture({ id: 'available' });
    const unavailablePack = packFixture({
      id: 'unavailable',
      items: [
        itemFixture({
          product: { references: [referenceFixture({ stockQuantity: 0 })] },
        }),
      ],
    });

    beforeEach(() => {
      prisma.pack.findMany.mockResolvedValue([availablePack, unavailablePack]);
    });

    it('availableNow=true returns only packs available now', async () => {
      const result: any = await service.findAllPublic({ availableNow: true });
      expect(result.data.map((p: any) => p.id)).toEqual(['available']);
      expect(result.data[0].availableNow).toBe(true);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('availableNow=false returns only packs not available now', async () => {
      const result: any = await service.findAllPublic({ availableNow: false });
      expect(result.data.map((p: any) => p.id)).toEqual(['unavailable']);
      expect(result.data[0].availableNow).toBe(false);
      expect(result.pagination.totalItems).toBe(1);
    });

    it('does not leak reserved stock into public references', async () => {
      const result: any = await service.findAllPublic({ availableNow: true });
      const reference = result.data[0].items[0].product.references[0];
      expect(reference.reservedQuantity).toBeUndefined();
      expect(reference.isActive).toBeUndefined();
    });
  });

  describe('pagination', () => {
    it('applies page and limit over the candidate set', async () => {
      const packs = Array.from({ length: 5 }, (_, i) =>
        packFixture({ id: `pack-${i}`, slug: `pack-${i}` }),
      );
      prisma.pack.findMany.mockResolvedValue(packs);

      const result: any = await service.findAllPublic({ page: 2, limit: 2 });
      expect(result.data.map((p: any) => p.id)).toEqual(['pack-2', 'pack-3']);
      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 2,
        totalItems: 5,
        totalPages: 3,
      });
    });
  });
});
