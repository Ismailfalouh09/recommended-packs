import { PackItemRole, PackStatus } from '@prisma/client';
import {
  AvailabilityItem,
  AvailabilityPack,
  availableReferenceStock,
  isPackAvailableNow,
} from './pack-availability.util';

function ref(overrides: Partial<{
  isActive: boolean;
  stockQuantity: number;
  reservedQuantity: number | null;
}> = {}) {
  return {
    isActive: true,
    stockQuantity: 10,
    reservedQuantity: 0,
    ...overrides,
  };
}

function item(overrides: Partial<AvailabilityItem> = {}): AvailabilityItem {
  return {
    role: PackItemRole.FIXED,
    quantity: 1,
    fixedReference: null,
    candidateReferences: [ref()],
    ...overrides,
  };
}

function pack(overrides: Partial<AvailabilityPack> = {}): AvailabilityPack {
  return {
    status: PackStatus.ACTIVE,
    isActive: true,
    items: [item()],
    ...overrides,
  };
}

describe('availableReferenceStock', () => {
  it('subtracts reserved from stock', () => {
    expect(availableReferenceStock(ref({ stockQuantity: 10, reservedQuantity: 4 }))).toBe(6);
  });

  it('never returns a negative value', () => {
    expect(availableReferenceStock(ref({ stockQuantity: 2, reservedQuantity: 5 }))).toBe(0);
  });

  it('treats missing reserved as zero', () => {
    expect(availableReferenceStock(ref({ stockQuantity: 3, reservedQuantity: null }))).toBe(3);
  });
});

describe('isPackAvailableNow', () => {
  it('is available when a fixed pack has all items in stock', () => {
    expect(isPackAvailableNow(pack())).toBe(true);
  });

  it('is unavailable when the pack is not ACTIVE', () => {
    expect(isPackAvailableNow(pack({ status: PackStatus.DRAFT }))).toBe(false);
  });

  it('is unavailable when the pack is not active', () => {
    expect(isPackAvailableNow(pack({ isActive: false }))).toBe(false);
  });

  it('uses a pinned fixed reference as the sole candidate', () => {
    const available = pack({
      items: [
        item({
          fixedReference: ref({ stockQuantity: 5, reservedQuantity: 0 }),
          candidateReferences: [],
        }),
      ],
    });
    expect(isPackAvailableNow(available)).toBe(true);

    const soldOut = pack({
      items: [
        item({
          fixedReference: ref({ stockQuantity: 3, reservedQuantity: 3 }),
          candidateReferences: [ref({ stockQuantity: 99 })],
        }),
      ],
    });
    // candidateReferences must be ignored when a fixed reference is pinned.
    expect(isPackAvailableNow(soldOut)).toBe(false);
  });

  it('requires enough stock to cover the item quantity', () => {
    const notEnough = pack({
      items: [item({ quantity: 5, candidateReferences: [ref({ stockQuantity: 4 })] })],
    });
    expect(isPackAvailableNow(notEnough)).toBe(false);

    const enough = pack({
      items: [item({ quantity: 5, candidateReferences: [ref({ stockQuantity: 5 })] })],
    });
    expect(isPackAvailableNow(enough)).toBe(true);
  });

  it('is available if any candidate reference is usable', () => {
    const anyUsable = pack({
      items: [
        item({
          candidateReferences: [
            ref({ isActive: false, stockQuantity: 100 }),
            ref({ stockQuantity: 0 }),
            ref({ stockQuantity: 2 }),
          ],
        }),
      ],
    });
    expect(isPackAvailableNow(anyUsable)).toBe(true);
  });

  it('optional items do NOT make a pack unavailable', () => {
    const withDeadOptional = pack({
      items: [
        item({ role: PackItemRole.FIXED, candidateReferences: [ref({ stockQuantity: 5 })] }),
        item({
          role: PackItemRole.OPTIONAL_INCLUDED,
          candidateReferences: [ref({ isActive: false, stockQuantity: 0 })],
        }),
        item({
          role: PackItemRole.OPTIONAL_ADDON,
          candidateReferences: [ref({ stockQuantity: 0 })],
        }),
      ],
    });
    expect(isPackAvailableNow(withDeadOptional)).toBe(true);
  });

  it('required unavailable items make a pack unavailable', () => {
    const requiredOut = pack({
      items: [
        item({ role: PackItemRole.FIXED, candidateReferences: [ref({ stockQuantity: 5 })] }),
        item({
          role: PackItemRole.REQUIRED_SELECTABLE,
          candidateReferences: [
            ref({ isActive: false, stockQuantity: 50 }),
            ref({ stockQuantity: 0 }),
          ],
        }),
      ],
    });
    expect(isPackAvailableNow(requiredOut)).toBe(false);
  });
});
