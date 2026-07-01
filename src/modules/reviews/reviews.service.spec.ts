import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma, ReviewTargetType } from '@prisma/client';
import { ReviewsService } from './reviews.service';

/**
 * Reviews & Ratings (Phase R2) — in-memory Prisma double.
 *
 * Stores review rows and enforces the real invariants the service relies on:
 * the per-(customer, order, target) duplicate unique (as a P2002), APPROVED-only
 * public reads, and APPROVED-only rating aggregation. Orders/products/packs are
 * fixed fixtures so eligibility (delivered + owned + contained) is exercised for
 * real rather than mocked away.
 */
function buildPrisma() {
  const customers = [{ id: 'cust-1', fullName: 'Ismail Falouh' }];

  const orders = [
    {
      id: 'order-delivered-product',
      customerId: 'cust-1',
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: null,
      items: [{ productId: 'prod-1' }],
    },
    {
      id: 'order-delivered-pack',
      customerId: 'cust-1',
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: 'pack-1',
      items: [],
    },
    {
      id: 'order-shipped',
      customerId: 'cust-1',
      orderStatus: OrderStatus.SHIPPED,
      selectedPackId: null,
      items: [{ productId: 'prod-1' }],
    },
  ];

  const products = [{ id: 'prod-1', slug: 'product-one', status: 'ACTIVE' }];
  const packs = [
    { id: 'pack-1', slug: 'pack-one', status: 'ACTIVE', isActive: true },
  ];

  const reviews: any[] = [];
  let seq = 0;

  const p2002 = () =>
    new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: 'test',
    });

  const prisma = {
    _reviews: reviews,
    order: {
      findUnique: async ({ where }: any) => {
        const order = orders.find((o) => o.id === where.id);
        if (!order) return null;
        const customer = customers.find((c) => c.id === order.customerId)!;
        return { ...order, customer: { fullName: customer.fullName } };
      },
    },
    product: {
      findFirst: async ({ where }: any) => {
        const product = products.find(
          (pr) => pr.slug === where.slug && pr.status === where.status,
        );
        return product ?? null;
      },
    },
    pack: {
      findFirst: async ({ where }: any) => {
        const pack = packs.find(
          (pk) =>
            pk.slug === where.slug &&
            pk.status === where.status &&
            pk.isActive === where.isActive,
        );
        return pack ?? null;
      },
    },
    review: {
      create: async ({ data }: any) => {
        const duplicate = reviews.some(
          (r) =>
            r.customerId === data.customerId &&
            r.orderId === data.orderId &&
            (r.productId ?? null) === (data.productId ?? null) &&
            (r.packId ?? null) === (data.packId ?? null),
        );
        if (duplicate) throw p2002();

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
      update: async ({ where, data }: any) => {
        const row = reviews.find((r) => r.id === where.id)!;
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) row[key] = value;
        }
        row.updatedAt = new Date();
        return row;
      },
      delete: async ({ where }: any) => {
        const index = reviews.findIndex((r) => r.id === where.id);
        const [removed] = reviews.splice(index, 1);
        return removed;
      },
      findMany: async ({ where, skip = 0, take = 20 }: any) => {
        return reviews
          .filter((r) => matchesWhere(r, where))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(skip, skip + take);
      },
      aggregate: async ({ where }: any) => {
        const matched = reviews.filter((r) => matchesWhere(r, where));
        const sum = matched.reduce((acc, r) => acc + r.rating, 0);
        return {
          _avg: { rating: matched.length ? sum / matched.length : null },
          _count: { _all: matched.length },
        };
      },
    },
  };

  function matchesWhere(row: any, where: any) {
    if (where.status && row.status !== where.status) return false;
    if (where.productId !== undefined && row.productId !== where.productId) {
      return false;
    }
    if (where.packId !== undefined && row.packId !== where.packId) return false;
    return true;
  }

  return prisma;
}

function makeService() {
  const prisma = buildPrisma();
  // Image mapping is exercised in review-images.spec.ts; here reviews carry no
  // images, so a pass-through mapper is enough.
  const mediaService = {
    toReviewImageResponse: (image: any) => image,
  };
  return {
    service: new ReviewsService(prisma as any, mediaService as any),
    prisma,
  };
}

describe('ReviewsService — customer create', () => {
  it('lets a delivered buyer create a PENDING product review with a masked author name', async () => {
    const { service } = makeService();

    const review = await service.create({
      orderId: 'order-delivered-product',
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'prod-1',
      rating: 5,
      title: 'Great',
      comment: 'Loved it',
    });

    expect(review.status).toBe('PENDING');
    expect(review.isVerifiedPurchase).toBe(true);
    expect(review.authorDisplayName).toBe('Ismail F.');
    // No private customer/order identifiers leak into the response.
    expect(review).not.toHaveProperty('customerId');
    expect(review).not.toHaveProperty('orderId');
    expect(review).not.toHaveProperty('productId');
  });

  it('lets a delivered buyer create a PENDING pack review', async () => {
    const { service } = makeService();

    const review = await service.create({
      orderId: 'order-delivered-pack',
      targetType: ReviewTargetType.PACK,
      targetId: 'pack-1',
      rating: 4,
    });

    expect(review.status).toBe('PENDING');
    expect(review.targetType).toBe('PACK');
  });

  it('rejects a review when the order is not delivered', async () => {
    const { service } = makeService();

    await expect(
      service.create({
        orderId: 'order-shipped',
        targetType: ReviewTargetType.PRODUCT,
        targetId: 'prod-1',
        rating: 5,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a duplicate review for the same order and target', async () => {
    const { service } = makeService();
    const input = {
      orderId: 'order-delivered-product',
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'prod-1',
      rating: 5,
    };

    await service.create(input);
    await expect(service.create(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('never accepts a client-supplied customerId (derives it from the order)', async () => {
    const { service, prisma } = makeService();

    await service.create({
      orderId: 'order-delivered-product',
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'prod-1',
      rating: 5,
      // A forged customerId is not part of the DTO and must be ignored.
      ...({ customerId: 'attacker' } as any),
    });

    expect(prisma._reviews[0].customerId).toBe('cust-1');
  });
});

describe('ReviewsService — edit/delete', () => {
  async function seedPending() {
    const { service, prisma } = makeService();
    const review = await service.create({
      orderId: 'order-delivered-product',
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'prod-1',
      rating: 3,
    });
    return { service, prisma, reviewId: review.id };
  }

  it('edits a PENDING review with the correct orderId and keeps it PENDING', async () => {
    const { service, reviewId } = await seedPending();

    const updated = await service.update(reviewId, {
      orderId: 'order-delivered-product',
      rating: 5,
      title: 'Updated',
    });

    expect(updated.rating).toBe(5);
    expect(updated.title).toBe('Updated');
    expect(updated.status).toBe('PENDING');
  });

  it('deletes a PENDING review with the correct orderId', async () => {
    const { service, prisma, reviewId } = await seedPending();

    const result = await service.remove(reviewId, 'order-delivered-product');

    expect(result).toEqual({ id: reviewId, deleted: true });
    expect(prisma._reviews).toHaveLength(0);
  });

  it('rejects edit/delete when the orderId does not match', async () => {
    const { service, reviewId } = await seedPending();

    await expect(
      service.update(reviewId, { orderId: 'order-delivered-pack', rating: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.remove(reviewId, 'order-delivered-pack'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('locks APPROVED and REJECTED reviews against customer edit/delete', async () => {
    for (const status of ['APPROVED', 'REJECTED']) {
      const { service, prisma, reviewId } = await seedPending();
      prisma._reviews[0].status = status;

      await expect(
        service.update(reviewId, {
          orderId: 'order-delivered-product',
          rating: 1,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.remove(reviewId, 'order-delivered-product'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('returns 404 for an unknown review', async () => {
    const { service } = makeService();

    await expect(
      service.update('missing', { orderId: 'order-delivered-product' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ReviewsService — public reads', () => {
  async function seedMixed() {
    const { service, prisma } = makeService();
    // Two approved (ratings 5 and 3) + one pending for the same product.
    await service.create({
      orderId: 'order-delivered-product',
      targetType: ReviewTargetType.PRODUCT,
      targetId: 'prod-1',
      rating: 5,
    });
    prisma._reviews.push(
      {
        id: 'approved-a',
        productId: 'prod-1',
        packId: null,
        customerId: 'cust-1',
        orderId: 'order-x',
        rating: 5,
        title: 'A',
        comment: 'c',
        status: 'APPROVED',
        isVerifiedPurchase: true,
        authorDisplayName: 'Sara B.',
        images: [],
        createdAt: new Date(2026, 1, 1),
        updatedAt: new Date(2026, 1, 1),
      },
      {
        id: 'approved-b',
        productId: 'prod-1',
        packId: null,
        customerId: 'cust-1',
        orderId: 'order-y',
        rating: 3,
        title: 'B',
        comment: 'c',
        status: 'APPROVED',
        isVerifiedPurchase: true,
        authorDisplayName: 'Nora K.',
        images: [],
        createdAt: new Date(2026, 1, 2),
        updatedAt: new Date(2026, 1, 2),
      },
    );
    return { service, prisma };
  }

  it('returns APPROVED reviews only', async () => {
    const { service } = await seedMixed();

    const page = await service.listProductReviews('product-one', {});

    expect(page.reviews).toHaveLength(2);
    expect(page.reviews.map((r) => r.title).sort()).toEqual(['A', 'B']);
  });

  it('computes ratingAverage and reviewCount from APPROVED reviews only', async () => {
    const { service } = await seedMixed();

    const page = await service.listProductReviews('product-one', {});

    // (5 + 3) / 2 = 4.0; the PENDING 5-star review is excluded.
    expect(page.ratingAverage).toBe(4);
    expect(page.reviewCount).toBe(2);
  });

  it('exposes only public review fields (no private data)', async () => {
    const { service } = await seedMixed();

    const page = await service.listProductReviews('product-one', {});
    const review = page.reviews[0];

    expect(Object.keys(review).sort()).toEqual(
      [
        'authorDisplayName',
        'comment',
        'createdAt',
        'images',
        'isVerifiedPurchase',
        'rating',
        'title',
      ].sort(),
    );
    for (const forbidden of [
      'customerId',
      'orderId',
      'productId',
      'packId',
      'status',
      'moderationNote',
    ]) {
      expect(review).not.toHaveProperty(forbidden);
    }
  });

  it('returns a zero summary and empty list when there are no approved reviews', async () => {
    const { service } = makeService();

    const page = await service.listProductReviews('product-one', {});

    expect(page.reviews).toHaveLength(0);
    expect(page.ratingAverage).toBeNull();
    expect(page.reviewCount).toBe(0);
  });

  it('404s for an unknown product/pack slug', async () => {
    const { service } = makeService();

    await expect(service.listProductReviews('nope', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listPackReviews('nope', {})).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
