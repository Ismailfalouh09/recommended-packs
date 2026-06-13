import { Prisma } from '@prisma/client';

export function toMoneyNumber(value: Prisma.Decimal | number | string | null) {
  if (value === null) {
    return null;
  }

  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }

  return Number(value);
}
