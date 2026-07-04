import { readFileSync } from 'fs';
import { join } from 'path';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ReviewTargetType } from '@prisma/client';
import {
  ReviewEligibilityClient,
  assertReviewEligibility,
} from './review-eligibility';

const CUSTOMER_ID = 'customer-1';
const OTHER_CUSTOMER_ID = 'customer-2';
const ORDER_ID = 'order-1';
const PRODUCT_ID = 'product-1';
const PACK_ID = 'pack-1';

type OrderRow = {
  id: string;
  customerId: string;
  orderStatus: OrderStatus;
  selectedPackId: string | null;
  items: { productId: string }[];
};

function makeClient(order: OrderRow | null): {
  client: ReviewEligibilityClient;
  findUnique: jest.Mock;
} {
  const findUnique = jest.fn().mockResolvedValue(order);
  return { client: { order: { findUnique } } as any, findUnique };
}

describe('assertReviewEligibility', () => {
  it('accepts a delivered order that contains the reviewed product', async () => {
    const { client } = makeClient({
      id: ORDER_ID,
      customerId: CUSTOMER_ID,
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: null,
      items: [{ productId: 'other-product' }, { productId: PRODUCT_ID }],
    });

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PRODUCT,
        targetId: PRODUCT_ID,
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts a delivered order whose selectedPackId is the reviewed pack', async () => {
    const { client } = makeClient({
      id: ORDER_ID,
      customerId: CUSTOMER_ID,
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: PACK_ID,
      items: [{ productId: PRODUCT_ID }],
    });

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PACK,
        targetId: PACK_ID,
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects when the order exists but is not delivered', async () => {
    for (const status of [
      OrderStatus.PENDING_CONFIRMATION,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.SHIPPED,
      OrderStatus.CANCELED,
      OrderStatus.RETURNED,
    ]) {
      const { client } = makeClient({
        id: ORDER_ID,
        customerId: CUSTOMER_ID,
        orderStatus: status,
        selectedPackId: null,
        items: [{ productId: PRODUCT_ID }],
      });

      await expect(
        assertReviewEligibility(client, {
          customerId: CUSTOMER_ID,
          orderId: ORDER_ID,
          targetType: ReviewTargetType.PRODUCT,
          targetId: PRODUCT_ID,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("rejects when the order belongs to a different customer", async () => {
    const { client } = makeClient({
      id: ORDER_ID,
      customerId: OTHER_CUSTOMER_ID,
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: null,
      items: [{ productId: PRODUCT_ID }],
    });

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PRODUCT,
        targetId: PRODUCT_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects when the reviewed product is not part of the order', async () => {
    const { client } = makeClient({
      id: ORDER_ID,
      customerId: CUSTOMER_ID,
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: null,
      items: [{ productId: 'a-different-product' }],
    });

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PRODUCT,
        targetId: PRODUCT_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the reviewed pack is not the order selectedPack', async () => {
    const { client } = makeClient({
      id: ORDER_ID,
      customerId: CUSTOMER_ID,
      orderStatus: OrderStatus.DELIVERED,
      selectedPackId: 'a-different-pack',
      items: [{ productId: PRODUCT_ID }],
    });

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PACK,
        targetId: PACK_ID,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when the order does not exist', async () => {
    const { client } = makeClient(null);

    await expect(
      assertReviewEligibility(client, {
        customerId: CUSTOMER_ID,
        orderId: ORDER_ID,
        targetType: ReviewTargetType.PRODUCT,
        targetId: PRODUCT_ID,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

/**
 * Duplicate prevention and rating bounds are enforced at the database layer (they
 * are not application logic), so their guarantee lives in the migration. These
 * tests assert the schema/validation *design* is present rather than exercising a
 * live database.
 */
describe('reviews migration constraints', () => {
  const migrationSql = readFileSync(
    join(
      __dirname,
      '..',
      '..',
      '..',
      'prisma',
      'migrations',
      '20260701170000_reviews_and_ratings_foundation',
      'migration.sql',
    ),
    'utf8',
  );

  it('prevents duplicate (customer, order, target) reviews via unique indexes', () => {
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "reviews_customer_id_order_id_product_id_key" ON "reviews"("customer_id", "order_id", "product_id")',
    );
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "reviews_customer_id_order_id_pack_id_key" ON "reviews"("customer_id", "order_id", "pack_id")',
    );
  });

  it('bounds rating to 1..5 with a check constraint', () => {
    expect(migrationSql).toMatch(
      /CHECK\s*\(\s*"rating"\s*>=\s*1\s*AND\s*"rating"\s*<=\s*5\s*\)/,
    );
  });

  it('enforces PRODUCT/PACK XOR target validity with a check constraint', () => {
    expect(migrationSql).toContain('reviews_target_xor_check');
    expect(migrationSql).toContain(
      "\"target_type\" = 'PRODUCT' AND \"product_id\" IS NOT NULL AND \"pack_id\" IS NULL",
    );
    expect(migrationSql).toContain(
      "\"target_type\" = 'PACK' AND \"pack_id\" IS NOT NULL AND \"product_id\" IS NULL",
    );
  });
});
