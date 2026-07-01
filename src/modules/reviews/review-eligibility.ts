import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, ReviewTargetType } from '@prisma/client';

/**
 * Reviews & Ratings (Phase R1) — server-authoritative verified-purchase gate.
 *
 * A customer may only review a target they actually, verifiably bought. This is
 * the single source of truth for that decision and is intended to be reused by
 * the future customer review-create API (Phase R2). It never trusts anything the
 * client could forge: the caller supplies the server-resolved `customerId`, and
 * ownership + delivery + containment are re-derived from the real Order row.
 *
 * Eligibility requires all of:
 *   1. the order is DELIVERED,
 *   2. the order belongs to `customerId`,
 *   3. the target (product or pack) is actually part of that order.
 *
 * Pack-in-order evidence is `Order.selectedPackId` — the authoritative field set
 * by every pack checkout path (recommendation funnel, fixed pack, and configured
 * pack). Product-in-order evidence is an `OrderItem` row for the product. Neither
 * rule is invented here; both mirror how orders are actually persisted.
 */

/** The minimal Prisma surface this helper needs (real client or a tx client). */
export interface ReviewEligibilityClient {
  order: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        customerId: true;
        orderStatus: true;
        selectedPackId: true;
        items: { select: { productId: true } };
      };
    }): Promise<{
      id: string;
      customerId: string;
      orderStatus: OrderStatus;
      selectedPackId: string | null;
      items: { productId: string }[];
    } | null>;
  };
}

export interface ReviewEligibilityInput {
  /** Server-resolved buyer identity. Never taken from the client request body. */
  customerId: string;
  /** The order offered as proof of purchase. */
  orderId: string;
  /** Which kind of catalog entity is being reviewed. */
  targetType: ReviewTargetType;
  /** The product id (PRODUCT) or pack id (PACK) being reviewed. */
  targetId: string;
}

/**
 * Asserts that `customerId` is allowed to review `targetId` on the strength of
 * `orderId`. Resolves silently when eligible; throws a Nest HTTP exception
 * (Not Found / Forbidden / Bad Request) describing the first failed rule.
 */
export async function assertReviewEligibility(
  client: ReviewEligibilityClient,
  { customerId, orderId, targetType, targetId }: ReviewEligibilityInput,
): Promise<void> {
  const order = await client.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerId: true,
      orderStatus: true,
      selectedPackId: true,
      items: { select: { productId: true } },
    },
  });

  if (!order) {
    throw new NotFoundException(`Order ${orderId} was not found.`);
  }

  // Ownership: the order must belong to the reviewing customer.
  if (order.customerId !== customerId) {
    throw new ForbiddenException('This order does not belong to you.');
  }

  // Delivery: only a delivered COD order proves the customer received the goods.
  if (order.orderStatus !== OrderStatus.DELIVERED) {
    throw new ForbiddenException(
      'You can only review an order once it has been delivered.',
    );
  }

  // Containment: the target must actually be part of this order.
  const isContained =
    targetType === ReviewTargetType.PACK
      ? order.selectedPackId === targetId
      : order.items.some((item) => item.productId === targetId);

  if (!isContained) {
    throw new BadRequestException(
      targetType === ReviewTargetType.PACK
        ? 'This pack is not part of the given order.'
        : 'This product is not part of the given order.',
    );
  }
}
