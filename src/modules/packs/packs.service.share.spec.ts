import { NotFoundException } from '@nestjs/common';
import { PackStatus, PriceMode } from '@prisma/client';
import { PacksService } from './packs.service';

function packFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow',
    slug: 'natural-glow',
    description: 'A natural glow pack.',
    mainImageUrl: 'https://cdn.example.com/glow.jpg',
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
    items: [],
    ...overrides,
  };
}

describe('PacksService public pack share metadata (Phase 8B)', () => {
  let prisma: any;
  let service: PacksService;

  beforeEach(() => {
    prisma = {
      pack: {
        findFirst: jest.fn().mockResolvedValue(packFixture()),
      },
    };
    service = new PacksService(prisma);
  });

  it('exposes safe share metadata for an active public pack (by slug)', async () => {
    const result: any = await service.findBySlug('natural-glow');

    expect(result.share).toEqual({
      shareUrl: '/packs/natural-glow',
      shareTitle: 'Natural Glow',
      shareDescription: 'A natural glow pack.',
      shareImageUrl: 'https://cdn.example.com/glow.jpg',
    });
  });

  it('cannot be shared when the pack is inactive/non-public', async () => {
    prisma.pack.findFirst.mockResolvedValue(null);

    await expect(service.findBySlug('natural-glow')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.pack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: PackStatus.ACTIVE,
          isActive: true,
        }),
      }),
    );
  });
});

describe('PacksService configured-pack sharing (Phase 8B)', () => {
  let prisma: any;
  let service: PacksService;

  const configRow = {
    id: 'cfg-1',
    shareToken: null as string | null,
  };

  beforeEach(() => {
    prisma = {
      packConfiguration: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'prod-1', name: 'Foundation X', slug: 'foundation-x', mainImageUrl: null },
        ]),
      },
      productReference: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ref-1',
            referenceName: 'RF2 Medium',
            shadeName: 'Medium',
            shadeCode: 'RF2',
            imageUrl: null,
          },
        ]),
      },
    };
    service = new PacksService(prisma);
  });

  it('mints an opaque share token and returns a share link', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue({
      id: 'cfg-1',
      shareToken: null,
    });
    prisma.packConfiguration.update.mockResolvedValue({
      shareToken: 'a'.repeat(64),
    });

    const result = await service.shareConfiguration('cfg-1');

    expect(result.shareToken).toBe('a'.repeat(64));
    expect(result.shareUrl).toBe(`/shared/configurations/${'a'.repeat(64)}`);
    expect(prisma.packConfiguration.update).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — returns the existing token without re-minting', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue({
      id: 'cfg-1',
      shareToken: 'existing-token',
    });

    const result = await service.shareConfiguration('cfg-1');

    expect(result.shareToken).toBe('existing-token');
    expect(prisma.packConfiguration.update).not.toHaveBeenCalled();
  });

  it('404s when sharing a configuration that does not exist', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue(null);

    await expect(service.shareConfiguration('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('404s when resolving an unknown or blank share token', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue(null);

    await expect(service.findSharedConfiguration('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findSharedConfiguration('  ')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns a customer-safe shared view with no private/internal data', async () => {
    prisma.packConfiguration.findUnique.mockResolvedValue({
      id: 'cfg-1',
      shareToken: 'tok-1',
      finalPrice: 349,
      currency: 'MAD',
      createdAt: new Date('2026-07-01T10:00:00.000Z'),
      sourcePack: {
        name: 'Natural Glow',
        slug: 'natural-glow',
        mainImageUrl: 'https://cdn.example.com/glow.jpg',
        images: [],
      },
      items: [
        {
          productId: 'prod-1',
          productReferenceId: 'ref-1',
          role: 'REQUIRED_SELECTABLE',
          quantity: 1,
          lineTotal: 120,
          isAddOn: false,
          removed: false,
        },
        {
          productId: 'prod-1',
          productReferenceId: 'ref-1',
          role: 'REMOVED_OPTIONAL',
          quantity: 1,
          lineTotal: 0,
          isAddOn: false,
          removed: true,
        },
      ],
    });

    const result: any = await service.findSharedConfiguration('tok-1');

    expect(result.sourcePack).toEqual({
      name: 'Natural Glow',
      slug: 'natural-glow',
      imageUrl: 'https://cdn.example.com/glow.jpg',
    });
    expect(result.finalPrice).toBe(349);
    expect(result.currency).toBe('MAD');
    // Removed optional line is dropped from the shared composition.
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      productId: 'prod-1',
      productName: 'Foundation X',
      referenceName: 'RF2 Medium',
      quantity: 1,
      lineTotal: 120,
      isAddOn: false,
    });

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'customer',
      'phone',
      'address',
      'sessionToken',
      'quiz',
      'score',
      'validationResult',
      'validationErrors',
      'minAllowedPrice',
      'stockStatus',
      'isValid',
      'costPrice',
      'reservedQuantity',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
