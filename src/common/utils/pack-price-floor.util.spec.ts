import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertAtOrAboveMinAllowedPrice,
  isAtOrAboveMinAllowedPrice,
} from './pack-price-floor.util';

describe('pack-price-floor helper', () => {
  describe('isAtOrAboveMinAllowedPrice', () => {
    it('allows any price when the floor is null', () => {
      expect(isAtOrAboveMinAllowedPrice(0, null)).toBe(true);
      expect(isAtOrAboveMinAllowedPrice(1, null)).toBe(true);
    });

    it('allows any price when the floor is undefined', () => {
      expect(isAtOrAboveMinAllowedPrice(5, undefined)).toBe(true);
    });

    it('allows a price equal to the floor', () => {
      expect(isAtOrAboveMinAllowedPrice(150, 150)).toBe(true);
    });

    it('allows a price above the floor', () => {
      expect(isAtOrAboveMinAllowedPrice(199.99, 150)).toBe(true);
    });

    it('rejects a price below the floor', () => {
      expect(isAtOrAboveMinAllowedPrice(149.99, 150)).toBe(false);
    });

    it('compares Decimal values without float drift', () => {
      expect(
        isAtOrAboveMinAllowedPrice(
          new Prisma.Decimal('150.00'),
          new Prisma.Decimal('150.00'),
        ),
      ).toBe(true);
      expect(
        isAtOrAboveMinAllowedPrice(
          new Prisma.Decimal('149.999'),
          new Prisma.Decimal('150'),
        ),
      ).toBe(false);
    });
  });

  describe('assertAtOrAboveMinAllowedPrice', () => {
    it('does not throw when the floor is null', () => {
      expect(() => assertAtOrAboveMinAllowedPrice(0, null)).not.toThrow();
    });

    it('does not throw when the price is at the floor', () => {
      expect(() => assertAtOrAboveMinAllowedPrice(150, 150)).not.toThrow();
    });

    it('does not throw when the price is above the floor', () => {
      expect(() => assertAtOrAboveMinAllowedPrice(200, 150)).not.toThrow();
    });

    it('throws BadRequestException when below the floor', () => {
      expect(() => assertAtOrAboveMinAllowedPrice(149, 150)).toThrow(
        BadRequestException,
      );
    });

    it('includes both the price and the floor in the message', () => {
      expect(() => assertAtOrAboveMinAllowedPrice(100, 150)).toThrow(
        /100.*150/,
      );
    });
  });
});
