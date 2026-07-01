import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ReviewTargetType } from '@prisma/client';
import { MediaService } from '../media/media.service';
import { MediaUrlService } from '../media/media-url.service';
import type { ValidatedImageFile } from '../media/pipes/image-file-validation.pipe';
import { ReviewsService } from './reviews.service';

/**
 * Reviews & Ratings (Phase R2.5) — customer review images.
 *
 * Exercises the real end-to-end wiring: `ReviewsService` proves ownership and
 * the PENDING-only rule, then delegates to the real `MediaService` image
 * pipeline (backed by an in-memory Prisma double and a fake storage provider).
 * This proves the 5-image cap, the ownership/lock gates, the public-visibility
 * rules, and that no private storage keys leak into responses.
 */

const uploadedPublicIds: string[] = [];
const deletedPublicIds: string[] = [];

function fakeStorage() {
  return {
    uploadImage: async (input: {
      buffer: Buffer;
      mimeType: string;
      folder: string;
      publicId: string;
    }) => {
      uploadedPublicIds.push(input.publicId);
      return {
        publicId: input.publicId,
        providerAssetId: `asset-${input.publicId}`,
        secureUrl: `https://cdn.test/${input.publicId}.jpg`,
        url: `http://cdn.test/${input.publicId}.jpg`,
        resourceType: 'image',
        format: 'jpg',
        mimeType: input.mimeType,
        width: 800,
        height: 600,
        bytes: 2048,
        version: 'v1',
      };
    },
    deleteImage: async (publicId: string) => {
      deletedPublicIds.push(publicId);
    },
    buildUrl: (publicId: string, transformation: string) =>
      `https://cdn.test/${transformation}/${publicId}.jpg`,
  };
}

function imageFile(): ValidatedImageFile {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    size: 16,
    originalname: 'unboxing.jpg',
    mimetype: 'image/jpeg',
    detectedMimeType: 'image/jpeg',
    detectedExtension: 'jpg',
  } as ValidatedImageFile;
}

function buildEnv() {
  const customers = [{ id: 'cust-1', fullName: 'Ismail Falouh' }];
  const orders = [
    {
      id: 'order-product',
      customerId: 'cust-1',
      orderStatus: 'DELIVERED',
      selectedPackId: null,
      items: [{ productId: 'prod-1' }],
    },
    {
      id: 'order-pack',
      customerId: 'cust-1',
      orderStatus: 'DELIVERED',
      selectedPackId: 'pack-1',
      items: [],
    },
  ];
  const products = [{ id: 'prod-1', slug: 'product-one', status: 'ACTIVE' }];
  const packs = [
    { id: 'pack-1', slug: 'pack-one', status: 'ACTIVE', isActive: true },
  ];

  const reviews: any[] = [];
  const reviewImages: any[] = [];
  const mediaAssets: any[] = [];
  let seq = 0;
  let mediaSeq = 0;
  let imageSeq = 0;

  const zeroCount = { count: async () => 0 };

  const imagesFor = (reviewId: string) =>
    reviewImages
      .filter((ri) => ri.reviewId === reviewId)
      .sort((a, b) => a.position - b.position)
      .map((ri) => ({
        id: ri.id,
        position: ri.position,
        createdAt: ri.createdAt,
        media: mediaAssets.find((m) => m.id === ri.mediaId),
      }));

  const prisma: any = {
    _reviews: reviews,
    _reviewImages: reviewImages,
    _mediaAssets: mediaAssets,
    order: {
      findUnique: async ({ where }: any) => {
        const order = orders.find((o) => o.id === where.id);
        if (!order) return null;
        const customer = customers.find((c) => c.id === order.customerId)!;
        return { ...order, customer: { fullName: customer.fullName } };
      },
    },
    product: {
      findFirst: async ({ where }: any) =>
        products.find(
          (p) => p.slug === where.slug && p.status === where.status,
        ) ?? null,
    },
    pack: {
      findFirst: async ({ where }: any) =>
        packs.find(
          (p) =>
            p.slug === where.slug &&
            p.status === where.status &&
            p.isActive === where.isActive,
        ) ?? null,
    },
    review: {
      create: async ({ data }: any) => {
        const row = {
          id: `review-${++seq}`,
          productId: data.productId ?? null,
          packId: data.packId ?? null,
          createdAt: new Date(2026, 0, seq),
          updatedAt: new Date(2026, 0, seq),
          images: [],
          ...data,
        };
        reviews.push(row);
        return row;
      },
      findUnique: async ({ where }: any) =>
        reviews.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where, skip = 0, take = 20 }: any) =>
        reviews
          .filter((r) => matchesWhere(r, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take)
          .map((r) => ({ ...r, images: imagesFor(r.id) })),
      aggregate: async ({ where }: any) => {
        const matched = reviews.filter((r) => matchesWhere(r, where));
        const sum = matched.reduce((acc, r) => acc + r.rating, 0);
        return {
          _avg: { rating: matched.length ? sum / matched.length : null },
          _count: { _all: matched.length },
        };
      },
    },
    mediaAsset: {
      create: async ({ data }: any) => {
        const row = { id: `media-${++mediaSeq}`, ...data };
        mediaAssets.push(row);
        return row;
      },
      delete: async ({ where, select }: any) => {
        const index = mediaAssets.findIndex((m) => m.id === where.id);
        const [removed] = mediaAssets.splice(index, 1);
        return select ? { id: removed.id, publicId: removed.publicId } : removed;
      },
    },
    reviewImage: {
      count: async ({ where }: any) =>
        reviewImages.filter(
          (ri) =>
            (where.reviewId ? ri.reviewId === where.reviewId : true) &&
            (where.mediaId ? ri.mediaId === where.mediaId : true),
        ).length,
      aggregate: async ({ where }: any) => {
        const rows = reviewImages.filter((ri) => ri.reviewId === where.reviewId);
        return {
          _max: {
            position: rows.length
              ? Math.max(...rows.map((r) => r.position))
              : null,
          },
        };
      },
      create: async ({ data, include }: any) => {
        const row = {
          id: `review-image-${++imageSeq}`,
          position: data.position ?? 0,
          createdAt: new Date(2026, 0, seq, 0, imageSeq),
          updatedAt: new Date(2026, 0, seq, 0, imageSeq),
          ...data,
        };
        reviewImages.push(row);
        if (include?.media) {
          return { ...row, media: mediaAssets.find((m) => m.id === row.mediaId) };
        }
        return row;
      },
      findFirst: async ({ where, select }: any) => {
        const row = reviewImages.find(
          (ri) => ri.id === where.id && ri.reviewId === where.reviewId,
        );
        if (!row) return null;
        return select ? { id: row.id, mediaId: row.mediaId } : row;
      },
      delete: async ({ where }: any) => {
        const index = reviewImages.findIndex((ri) => ri.id === where.id);
        const [removed] = reviewImages.splice(index, 1);
        return removed;
      },
    },
    // Other media relations never reference review media in these tests.
    productImage: zeroCount,
    packImage: zeroCount,
    categoryImage: zeroCount,
    productReferenceImage: zeroCount,
    $transaction: async (fn: any) => fn(prisma),
  };

  function matchesWhere(row: any, where: any) {
    if (where.status && row.status !== where.status) return false;
    if (where.productId !== undefined && row.productId !== where.productId) {
      return false;
    }
    if (where.packId !== undefined && row.packId !== where.packId) return false;
    return true;
  }

  const storage = fakeStorage();
  const mediaUrlService = new MediaUrlService(storage as any);
  const configService = { get: () => undefined } as any;
  const mediaService = new MediaService(
    prisma,
    storage as any,
    configService,
    mediaUrlService,
  );
  const service = new ReviewsService(prisma as any, mediaService as any);

  return { service, prisma };
}

async function seedPendingProductReview(env: ReturnType<typeof buildEnv>) {
  const review = await env.service.create({
    orderId: 'order-product',
    targetType: ReviewTargetType.PRODUCT,
    targetId: 'prod-1',
    rating: 5,
  });
  return review.id;
}

async function seedPendingPackReview(env: ReturnType<typeof buildEnv>) {
  const review = await env.service.create({
    orderId: 'order-pack',
    targetType: ReviewTargetType.PACK,
    targetId: 'pack-1',
    rating: 4,
  });
  return review.id;
}

beforeEach(() => {
  uploadedPublicIds.length = 0;
  deletedPublicIds.length = 0;
});

describe('Review images — upload', () => {
  it('lets a pending PRODUCT review receive an image upload', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);

    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );

    expect(env.prisma._reviewImages).toHaveLength(1);
    expect(image.position).toBe(0);
    expect(image.urls.original).toContain('https://cdn.test/');
  });

  it('lets a pending PACK review receive an image upload', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingPackReview(env);

    const image = await env.service.addImage(
      reviewId,
      'order-pack',
      imageFile(),
    );

    expect(env.prisma._reviewImages).toHaveLength(1);
    expect(image.urls.thumbnail).toBeTruthy();
  });

  it('enforces a maximum of 5 images per review', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);

    for (let i = 0; i < 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await env.service.addImage(reviewId, 'order-product', imageFile());
    }

    await expect(
      env.service.addImage(reviewId, 'order-product', imageFile()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(env.prisma._reviewImages).toHaveLength(5);
    // The 6th upload is rolled back from storage — no orphaned asset remains.
    expect(env.prisma._mediaAssets).toHaveLength(5);
  });

  it('assigns increasing positions to preserve ordering', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);

    const first = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );
    const second = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );

    expect(first.position).toBe(0);
    expect(second.position).toBe(1);
  });

  it('never leaks private storage/internal media details in the response', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);

    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );

    for (const forbidden of [
      'publicId',
      'folder',
      'providerAssetId',
      'secureUrl',
      'url',
      'resourceType',
      'uploadedByAdminId',
      'relatedEntity',
      'relatedEntityId',
      'mediaId',
      'mediaAssetId',
      'usageContext',
    ]) {
      expect(image).not.toHaveProperty(forbidden);
    }
    expect(Object.keys(image).sort()).toEqual(
      ['createdAt', 'format', 'height', 'id', 'mimeType', 'position', 'urls', 'width'].sort(),
    );
  });
});

describe('Review images — ownership and locking', () => {
  it('rejects upload with the wrong orderId', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);

    await expect(
      env.service.addImage(reviewId, 'order-pack', imageFile()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(env.prisma._reviewImages).toHaveLength(0);
  });

  it('rejects removal with the wrong orderId', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );

    await expect(
      env.service.removeImage(reviewId, image.id, 'order-pack'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(env.prisma._reviewImages).toHaveLength(1);
  });

  it('removes a pending image with the correct orderId', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );

    const result = await env.service.removeImage(
      reviewId,
      image.id,
      'order-product',
    );

    expect(result).toEqual({ imageId: image.id, deleted: true });
    expect(env.prisma._reviewImages).toHaveLength(0);
    expect(env.prisma._mediaAssets).toHaveLength(0);
    // No internal storage keys are surfaced on delete either.
    expect(result).not.toHaveProperty('publicId');
    expect(result).not.toHaveProperty('mediaAssetId');
  });

  it('locks APPROVED reviews against customer image changes', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );
    env.prisma._reviews[0].status = 'APPROVED';

    await expect(
      env.service.addImage(reviewId, 'order-product', imageFile()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      env.service.removeImage(reviewId, image.id, 'order-product'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('locks REJECTED reviews against customer image changes', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    const image = await env.service.addImage(
      reviewId,
      'order-product',
      imageFile(),
    );
    env.prisma._reviews[0].status = 'REJECTED';

    await expect(
      env.service.addImage(reviewId, 'order-product', imageFile()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      env.service.removeImage(reviewId, image.id, 'order-product'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Review images — public visibility', () => {
  it('does not expose images of a PENDING review publicly', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    await env.service.addImage(reviewId, 'order-product', imageFile());

    const page = await env.service.listProductReviews('product-one', {});

    // The pending review is not returned at all, so its images cannot leak.
    expect(page.reviews).toHaveLength(0);
  });

  it('exposes images of an APPROVED review publicly, with URLs but no storage keys', async () => {
    const env = buildEnv();
    const reviewId = await seedPendingProductReview(env);
    await env.service.addImage(reviewId, 'order-product', imageFile());
    env.prisma._reviews[0].status = 'APPROVED';

    const page = await env.service.listProductReviews('product-one', {});

    expect(page.reviews).toHaveLength(1);
    const [review] = page.reviews;
    expect(review.images).toHaveLength(1);
    const [image] = review.images;
    expect(image.urls.original).toContain('https://cdn.test/');
    expect(image).not.toHaveProperty('publicId');
    expect(image).not.toHaveProperty('mediaId');
    expect(image).not.toHaveProperty('secureUrl');
  });
});
