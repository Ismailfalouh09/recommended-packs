import { ProductStatus } from '@prisma/client';
import { ProductsService } from './products.service';

/**
 * Media Management (Task 14) — public product-detail reference galleries.
 *
 * Proves the additive `reference.galleryImages` / `reference.primaryImageUrl`
 * projection, that the existing `swatch` shade selector still works, and that
 * one reference never exposes another reference's gallery images.
 */

function mediaFixture(id: string) {
  return {
    id,
    publicId: `beauty-app/product-references/${id}`,
    secureUrl: `https://cdn.example.com/${id}.jpg`,
    format: 'jpg',
    mimeType: 'image/jpeg',
    width: 800,
    height: 800,
    bytes: 1234,
  };
}

function galleryImageFixture(
  id: string,
  position: number,
  isPrimary: boolean,
) {
  return {
    id,
    position,
    isPrimary,
    altText: `${id} alt`,
    media: mediaFixture(`media-${id}`),
  };
}

function swatchFixture(referenceId: string) {
  return {
    id: `swatch-${referenceId}`,
    mediaId: `media-swatch-${referenceId}`,
    role: 'SWATCH',
    altText: 'Swatch',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    media: mediaFixture(`swatch-${referenceId}`),
  };
}

function referenceFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'ref-1',
    referenceCode: 'RF1',
    referenceName: 'Cherry Red',
    shadeName: 'Cherry Red',
    shadeCode: 'CR1',
    swatchHex: '#cc0033',
    measurement: null,
    variationType: 'SHADE',
    priceOverride: null,
    priceDelta: 0,
    imageUrl: null,
    image: swatchFixture('ref-1'),
    galleryImages: [
      galleryImageFixture('g1', 0, true),
      galleryImageFixture('g2', 1, false),
    ],
    stockQuantity: 10,
    reservedQuantity: 0,
    lowStockThreshold: 3,
    isDefault: true,
    attributes: [],
    ...overrides,
  };
}

function productFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'prod-1',
    slug: 'lipstick-x',
    name: 'Lipstick X',
    productType: 'lipstick',
    shortDescription: 'Bold matte lipstick.',
    description: 'A demo lipstick.',
    ingredients: null,
    directions: null,
    basePrice: 120,
    compareAtPrice: null,
    currency: 'MAD',
    metaTitle: null,
    metaDescription: null,
    mainImageUrl: null,
    status: ProductStatus.ACTIVE,
    category: { id: 'cat-1', code: 'LIPS', name: 'Lips', image: null },
    brand: { id: 'brand-1', name: 'Acme' },
    references: [
      referenceFixture(),
      referenceFixture({
        id: 'ref-2',
        referenceCode: 'RF2',
        referenceName: 'Nude Beige',
        shadeName: 'Nude Beige',
        shadeCode: 'NB1',
        swatchHex: '#e8b98c',
        image: swatchFixture('ref-2'),
        galleryImages: [galleryImageFixture('g9', 0, true)],
        isDefault: false,
      }),
    ],
    // Product-level shared gallery — distinct from reference galleries.
    images: [],
    attributes: [],
    ...overrides,
  };
}

describe('ProductsService public reference gallery (Task 14)', () => {
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

  it('returns the reference gallery images ordered, with a primary flag', async () => {
    const result: any = await service.findOne('prod-1');
    const reference = result.references.find((r: any) => r.id === 'ref-1');

    expect(reference.galleryImages).toHaveLength(2);
    expect(reference.galleryImages.map((image: any) => image.position)).toEqual([
      0, 1,
    ]);
    const primaries = reference.galleryImages.filter(
      (image: any) => image.isPrimary,
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe('g1');
    expect(reference.galleryImages[0]).toEqual({
      id: 'g1',
      position: 0,
      isPrimary: true,
      altText: 'g1 alt',
      urls: expect.objectContaining({ detail: expect.any(String) }),
    });
  });

  it('exposes primaryImageUrl from the primary gallery image', async () => {
    const result: any = await service.findOne('prod-1');
    const reference = result.references.find((r: any) => r.id === 'ref-1');

    expect(reference.primaryImageUrl).toBe(
      'https://cdn.example.com/media-g1.jpg',
    );
  });

  it('keeps the existing swatch (shade selector) behavior working', async () => {
    const result: any = await service.findOne('prod-1');
    const reference = result.references.find((r: any) => r.id === 'ref-1');

    // Swatch shade selector stays intact and separate from the gallery.
    expect(reference.swatch.hex).toBe('#cc0033');
    expect(reference.swatch.image).not.toBeNull();
    expect(reference.swatch.image.urls.swatch).toBeDefined();
    expect(reference.image).not.toBeNull();
    expect(reference.imageUrl).toBeTruthy();
  });

  it('never exposes another reference’s gallery images', async () => {
    const result: any = await service.findOne('prod-1');
    const ref1 = result.references.find((r: any) => r.id === 'ref-1');
    const ref2 = result.references.find((r: any) => r.id === 'ref-2');

    const ref1Ids = ref1.galleryImages.map((image: any) => image.id);
    const ref2Ids = ref2.galleryImages.map((image: any) => image.id);

    expect(ref1Ids).toEqual(['g1', 'g2']);
    expect(ref2Ids).toEqual(['g9']);
    expect(ref1Ids).not.toContain('g9');
    expect(ref2.primaryImageUrl).toBe('https://cdn.example.com/media-g9.jpg');
  });

  it('falls back to null primaryImageUrl when a reference has no gallery images', async () => {
    prisma.product.findFirst.mockResolvedValue(
      productFixture({
        references: [referenceFixture({ galleryImages: [] })],
      }),
    );

    const result: any = await service.findOne('prod-1');
    const reference = result.references[0];

    expect(reference.galleryImages).toEqual([]);
    expect(reference.primaryImageUrl).toBeNull();
    // Swatch is still present even with an empty gallery.
    expect(reference.swatch.image).not.toBeNull();
  });
});
