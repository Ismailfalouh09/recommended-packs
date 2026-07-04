import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Pack Core Evolution (Phase 3) — reusable, server-side price-floor guard.
 *
 * A configured/final Pack price must never drop below the Pack's
 * `minAllowedPrice`. This is the single safety helper both pricing and
 * configuration paths call before accepting a computed price.
 *
 * Rules:
 *   - A null floor means "no floor configured" → always allowed.
 *   - A price equal to or above the floor is allowed.
 *   - A price strictly below the floor is rejected.
 *
 * Comparison is done with `Prisma.Decimal` to stay consistent with the money
 * conventions used across orders/packs (no float drift).
 */
type DecimalLike = Prisma.Decimal | number | string;

function toDecimal(value: DecimalLike): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Returns true when `finalPrice` respects the (optional) `minAllowedPrice`
 * floor. A null/undefined floor is always respected.
 */
export function isAtOrAboveMinAllowedPrice(
  finalPrice: DecimalLike,
  minAllowedPrice: DecimalLike | null | undefined,
): boolean {
  if (minAllowedPrice === null || minAllowedPrice === undefined) {
    return true;
  }

  return toDecimal(finalPrice).greaterThanOrEqualTo(toDecimal(minAllowedPrice));
}

/**
 * Throws {@link BadRequestException} when `finalPrice` is below the Pack's
 * `minAllowedPrice`. No-op when the floor is null/undefined or the price is at
 * or above the floor.
 */
export function assertAtOrAboveMinAllowedPrice(
  finalPrice: DecimalLike,
  minAllowedPrice: DecimalLike | null | undefined,
): void {
  if (isAtOrAboveMinAllowedPrice(finalPrice, minAllowedPrice)) {
    return;
  }

  const price = toDecimal(finalPrice).toString();
  const floor = toDecimal(minAllowedPrice as DecimalLike).toString();

  throw new BadRequestException(
    `Configured price ${price} is below the minimum allowed price ${floor}.`,
  );
}
