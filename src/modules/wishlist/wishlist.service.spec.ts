import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WishlistTargetType } from '@prisma/client';
import { WishlistService } from './wishlist.service';

/**
 * Purpose-built in-memory Prisma double. It stores wishlist rows and resolves
 * the linked product/pack summaries the way the real relational select would,
 * and it scopes findMany/deleteMany by owner — so the ownership-isolation and
 * duplicate behaviours are exercised for real, not just asserted on query shape.
 */
function buildPrisma() {
  const profiles = [
    { id: 'profile-a', sessionToken: 'token-a' },
    { id: 'profile-b', sessionToken: 'token-b' },
  ];

  const products = [
    {
      id: 'prod-active',
      status: 'ACTIVE',
      slug: 'active-product',
      name: 'Active Product',
      productType: 'lipstick',
      mainImageUrl: null,
      basePrice: 120,
      compareAtPrice: 160,
      currency: 'MAD',
      brand: { id: 'brand-1', name: 'Brand' },
      category: { id: 'cat-1', code: 'FACE', name: 'Face' },
      references: [
        {
          priceOverride: null,
          priceDelta: 0,
          stockQuantity: 5,
          reservedQuantity: 1,
        },
      ],
    },
    {
      id: 'prod-inactive',
      status: 'DRAFT',
      slug: 'inactive-product',
      name: 'Inactive Product',
      productType: null,
      mainImageUrl: null,
      basePrice: 90,
      compareAtPrice: null,
      currency: 'MAD',
      brand: null,
      category: null,
      references: [],
    },
  ];

  const packs = [
    {
      id: 'pack-active',
      status: 'ACTIVE',
      isActive: true,
      slug: 'active-pack',
      name: 'Active Pack',
      mainImageUrl: null,
      priceMode: 'FIXED',
      fixedPrice: 299,
      currency: 'MAD',
      isCustomizable: false,
      tier: null,
      occasion: null,
      experienceLevel: null,
      isFeatured: true,
      isNew: false,
      isBestSeller: false,
    },
    {
      id: 'pack-inactive',
      status: 'ARCHIVED',
      isActive: false,
      slug: 'inactive-pack',
      name: 'Inactive Pack',
      mainImageUrl: null,
      priceMode: 'FIXED',
      fixedPrice: 199,
      currency: 'MAD',
      isCustomizable: false,
      tier: null,
      occasion: null,
      experienceLevel: null,
      isFeatured: false,
      isNew: false,
      isBestSeller: false,
    },
  ];

  const rows: any[] = [];
  let seq = 0;
  let clock = 0;

  const hydrate = (row: any) => ({
    id: row.id,
    targetType: row.targetType,
    createdAt: row.createdAt,
    product: row.productId
      ? products.find((p) => p.id === row.productId)
      : null,
    pack: row.packId ? packs.find((p) => p.id === row.packId) : null,
  });

  const matchWhere = (where: any) => {
    if ('customerProfileId_productId' in where) {
      const { customerProfileId, productId } = where.customerProfileId_productId;
      return rows.find(
        (r) =>
          r.customerProfileId === customerProfileId && r.productId === productId,
      );
    }
    const { customerProfileId, packId } = where.customerProfileId_packId;
    return rows.find(
      (r) => r.customerProfileId === customerProfileId && r.packId === packId,
    );
  };

  return {
    _rows: rows,
    customerProfile: {
      findUnique: jest.fn(async ({ where }: any) => {
        return profiles.find((p) => p.sessionToken === where.sessionToken) ?? null;
      }),
    },
    product: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          products.find(
            (p) => p.id === where.id && p.status === where.status,
          ) ?? null
        );
      }),
    },
    pack: {
      findFirst: jest.fn(async ({ where }: any) => {
        return (
          packs.find(
            (p) =>
              p.id === where.id &&
              p.status === where.status &&
              p.isActive === where.isActive,
          ) ?? null
        );
      }),
    },
    wishlistItem: {
      findUnique: jest.fn(async ({ where }: any) => {
        const row = matchWhere(where);
        return row ? hydrate(row) : null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const row = {
          id: `item-${seq++}`,
          customerProfileId: data.customerProfileId,
          targetType: data.targetType,
          productId: data.productId ?? null,
          packId: data.packId ?? null,
          createdAt: new Date(2026, 0, 1, 0, 0, 0, clock++),
        };
        rows.push(row);
        return hydrate(row);
      }),
      findMany: jest.fn(async ({ where }: any) => {
        return rows
          .filter((r) => r.customerProfileId === where.customerProfileId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((r) => hydrate(r));
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = rows.length;
        for (let i = rows.length - 1; i >= 0; i--) {
          if (
            rows[i].id === where.id &&
            rows[i].customerProfileId === where.customerProfileId
          ) {
            rows.splice(i, 1);
          }
        }
        return { count: before - rows.length };
      }),
    },
  };
}

describe('WishlistService', () => {
  let prisma: ReturnType<typeof buildPrisma>;
  let service: WishlistService;

  beforeEach(() => {
    prisma = buildPrisma();
    service = new WishlistService(prisma as any);
  });

  it('adds a Product to the wishlist with a customer-safe summary', async () => {
    const result = await service.addItem('token-a', {
      targetType: WishlistTargetType.PRODUCT,
      targetId: 'prod-active',
    });

    expect(result.created).toBe(true);
    expect(result.item.targetType).toBe(WishlistTargetType.PRODUCT);
    expect(result.item.pack).toBeNull();
    expect(result.item.product).toMatchObject({
      id: 'prod-active',
      slug: 'active-product',
      priceFrom: 120,
      onSale: true,
      compareAtPrice: 160,
      inStock: true,
    });
    // No stock internals / costs leak into the summary.
    expect(JSON.stringify(result.item.product)).not.toMatch(
      /stockQuantity|reservedQuantity|costPrice|priceDelta|priceOverride/,
    );
  });

  it('adds a Pack to the wishlist with a customer-safe summary', async () => {
    const result = await service.addItem('token-a', {
      targetType: WishlistTargetType.PACK,
      targetId: 'pack-active',
    });

    expect(result.created).toBe(true);
    expect(result.item.targetType).toBe(WishlistTargetType.PACK);
    expect(result.item.product).toBeNull();
    expect(result.item.pack).toMatchObject({
      id: 'pack-active',
      slug: 'active-pack',
      price: 299,
      isFeatured: true,
    });
    expect(JSON.stringify(result.item.pack)).not.toMatch(
      /minAllowedPrice|costPrice|items|compatibilit/i,
    );
  });

  it('lists a mixed Product + Pack wishlist (newest first)', async () => {
    await service.addItem('token-a', {
      targetType: WishlistTargetType.PRODUCT,
      targetId: 'prod-active',
    });
    await service.addItem('token-a', {
      targetType: WishlistTargetType.PACK,
      targetId: 'pack-active',
    });

    const { items } = await service.list('token-a');

    expect(items).toHaveLength(2);
    expect(items[0].targetType).toBe(WishlistTargetType.PACK);
    expect(items[1].targetType).toBe(WishlistTargetType.PRODUCT);
  });

  it('removes an item', async () => {
    const added = await service.addItem('token-a', {
      targetType: WishlistTargetType.PRODUCT,
      targetId: 'prod-active',
    });

    const result = await service.removeItem('token-a', added.item.id);
    expect(result).toEqual({ id: added.item.id, deleted: true });

    const { items } = await service.list('token-a');
    expect(items).toHaveLength(0);
  });

  it('is idempotent on duplicate add (returns existing, created=false)', async () => {
    const first = await service.addItem('token-a', {
      targetType: WishlistTargetType.PRODUCT,
      targetId: 'prod-active',
    });
    const second = await service.addItem('token-a', {
      targetType: WishlistTargetType.PRODUCT,
      targetId: 'prod-active',
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.item.id).toBe(first.item.id);

    const { items } = await service.list('token-a');
    expect(items).toHaveLength(1);
  });

  it('rejects an inactive / non-public Product', async () => {
    await expect(
      service.addItem('token-a', {
        targetType: WishlistTargetType.PRODUCT,
        targetId: 'prod-inactive',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an inactive / non-public Pack', async () => {
    await expect(
      service.addItem('token-a', {
        targetType: WishlistTargetType.PACK,
        targetId: 'pack-inactive',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires a session token', async () => {
    await expect(
      service.list(undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.list('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an unknown session token', async () => {
    await expect(service.list('token-unknown')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  describe('cross-owner isolation', () => {
    it('does not list another owner’s items', async () => {
      await service.addItem('token-a', {
        targetType: WishlistTargetType.PRODUCT,
        targetId: 'prod-active',
      });

      const { items } = await service.list('token-b');
      expect(items).toHaveLength(0);
    });

    it('cannot remove another owner’s item', async () => {
      const added = await service.addItem('token-a', {
        targetType: WishlistTargetType.PRODUCT,
        targetId: 'prod-active',
      });

      await expect(
        service.removeItem('token-b', added.item.id),
      ).rejects.toBeInstanceOf(NotFoundException);

      // The item still belongs to owner A.
      const { items } = await service.list('token-a');
      expect(items).toHaveLength(1);
    });

    it('lets two owners each save the same target independently', async () => {
      const a = await service.addItem('token-a', {
        targetType: WishlistTargetType.PACK,
        targetId: 'pack-active',
      });
      const b = await service.addItem('token-b', {
        targetType: WishlistTargetType.PACK,
        targetId: 'pack-active',
      });

      expect(a.created).toBe(true);
      expect(b.created).toBe(true);
      expect(a.item.id).not.toBe(b.item.id);
    });
  });
});
