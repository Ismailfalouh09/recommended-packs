import { PackItemRole, PriceMode, ProductStatus, SelectionMode } from '@prisma/client';
import {
  ValidatorAllowedAddOn,
  ValidatorItem,
  ValidatorPack,
  ValidatorReference,
  validatePackConfiguration,
} from './pack-configuration.validator';

function reference(
  overrides: Partial<ValidatorReference> = {},
): ValidatorReference {
  return {
    id: 'ref-a',
    isActive: true,
    stockQuantity: 10,
    reservedQuantity: 0,
    priceOverride: null,
    priceDelta: 0 as unknown as ValidatorReference['priceDelta'],
    ...overrides,
  };
}

function product(overrides: Record<string, any> = {}) {
  return {
    id: 'prod-1',
    name: 'Foundation X',
    basePrice: 100 as any,
    isActive: true,
    status: ProductStatus.ACTIVE,
    references: [reference()],
    ...overrides,
  };
}

function item(overrides: Partial<ValidatorItem> = {}): ValidatorItem {
  return {
    id: 'item-1',
    role: PackItemRole.FIXED,
    selectionMode: SelectionMode.FIXED_REFERENCE,
    quantity: 1,
    minQuantity: null,
    maxQuantity: null,
    quantityEditable: false,
    removalAllowed: false,
    replacementAllowed: false,
    productReferenceId: 'ref-a',
    product: product(),
    allowedReferenceIds: [],
    ...overrides,
  };
}

function pack(overrides: Partial<ValidatorPack> = {}): ValidatorPack {
  return {
    id: 'pack-1',
    priceMode: PriceMode.SUM_ITEMS,
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
    minAllowedPrice: null,
    minRequiredItems: null,
    maxItemCount: null,
    items: [item()],
    allowedAddOns: [],
    ...overrides,
  };
}

function codes(result: ReturnType<typeof validatePackConfiguration>) {
  return result.validationErrors.map((error) => error.code);
}

describe('validatePackConfiguration', () => {
  it('accepts a valid required-selectable reference', () => {
    const selectable = item({
      id: 'sel-1',
      role: PackItemRole.REQUIRED_SELECTABLE,
      selectionMode: SelectionMode.CUSTOMER_CHOICE,
      productReferenceId: null,
      allowedReferenceIds: ['ref-a', 'ref-b'],
      product: product({
        references: [reference({ id: 'ref-a', priceDelta: 20 as any })],
      }),
    });

    const result = validatePackConfiguration(pack({ items: [selectable] }), {
      items: [{ packItemId: 'sel-1', productReferenceId: 'ref-a' }],
    });

    expect(result.isValid).toBe(true);
    expect(result.validationErrors).toHaveLength(0);
    expect(result.computedPrice).toBe(120);
    expect(result.stockStatus).toBe('IN_STOCK');
    expect(result.normalizedItems).toHaveLength(1);
    expect(result.normalizedItems[0]).toMatchObject({
      packItemId: 'sel-1',
      productReferenceId: 'ref-a',
      quantity: 1,
      unitPrice: 120,
      lineTotal: 120,
      isAddOn: false,
      removed: false,
    });
  });

  it('rejects a missing required-selectable selection', () => {
    const selectable = item({
      id: 'sel-1',
      role: PackItemRole.REQUIRED_SELECTABLE,
      selectionMode: SelectionMode.CUSTOMER_CHOICE,
      productReferenceId: null,
      allowedReferenceIds: ['ref-a'],
    });

    const result = validatePackConfiguration(pack({ items: [selectable] }), {
      items: [{ packItemId: 'sel-1' }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('MISSING_REQUIRED_SELECTION');
  });

  it('rejects a disallowed selectable reference', () => {
    const selectable = item({
      id: 'sel-1',
      role: PackItemRole.REQUIRED_SELECTABLE,
      selectionMode: SelectionMode.CUSTOMER_CHOICE,
      productReferenceId: null,
      allowedReferenceIds: ['ref-a'],
      product: product({
        references: [
          reference({ id: 'ref-a' }),
          reference({ id: 'ref-x' }),
        ],
      }),
    });

    const result = validatePackConfiguration(pack({ items: [selectable] }), {
      items: [{ packItemId: 'sel-1', productReferenceId: 'ref-x' }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('REFERENCE_NOT_ALLOWED');
  });

  it('rejects a disallowed replacement on an optional item', () => {
    const optional = item({
      id: 'opt-1',
      role: PackItemRole.OPTIONAL_INCLUDED,
      selectionMode: SelectionMode.FIXED_REFERENCE,
      replacementAllowed: false,
      productReferenceId: 'ref-a',
      product: product({
        references: [
          reference({ id: 'ref-a' }),
          reference({ id: 'ref-b' }),
        ],
      }),
    });

    const result = validatePackConfiguration(pack({ items: [optional] }), {
      items: [{ packItemId: 'opt-1', productReferenceId: 'ref-b' }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('REPLACEMENT_NOT_ALLOWED');
  });

  it('rejects a disallowed add-on', () => {
    const result = validatePackConfiguration(
      pack({
        allowedAddOns: [
          {
            productId: 'addon-ok',
            productReferenceId: null,
            product: product({ id: 'addon-ok' }),
          } as ValidatorAllowedAddOn,
        ],
      }),
      { addOns: [{ productId: 'addon-bad' }] },
    );

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('ADDON_NOT_ALLOWED');
  });

  it('accepts an allowed add-on and prices it server-side', () => {
    const result = validatePackConfiguration(
      pack({
        items: [],
        allowedAddOns: [
          {
            productId: 'addon-ok',
            productReferenceId: 'addon-ref',
            product: product({
              id: 'addon-ok',
              basePrice: 50 as any,
              references: [reference({ id: 'addon-ref', priceDelta: 0 as any })],
            }),
          } as ValidatorAllowedAddOn,
        ],
      }),
      { addOns: [{ productId: 'addon-ok', productReferenceId: 'addon-ref', quantity: 2 }] },
    );

    expect(result.isValid).toBe(true);
    expect(result.computedPrice).toBe(100);
    expect(result.normalizedItems[0]).toMatchObject({
      packItemId: null,
      isAddOn: true,
      quantity: 2,
      lineTotal: 100,
    });
  });

  it('rejects a quantity change on a non-editable item', () => {
    const result = validatePackConfiguration(pack(), {
      items: [{ packItemId: 'item-1', quantity: 3 }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('QUANTITY_NOT_EDITABLE');
  });

  it('rejects a quantity above the allowed maximum', () => {
    const editable = item({
      quantityEditable: true,
      minQuantity: 1,
      maxQuantity: 2,
    });

    const result = validatePackConfiguration(pack({ items: [editable] }), {
      items: [{ packItemId: 'item-1', quantity: 3 }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('QUANTITY_ABOVE_MAX');
  });

  it('accepts an in-range quantity change on an editable item', () => {
    const editable = item({
      quantityEditable: true,
      minQuantity: 1,
      maxQuantity: 3,
    });

    const result = validatePackConfiguration(pack({ items: [editable] }), {
      items: [{ packItemId: 'item-1', quantity: 2 }],
    });

    expect(result.isValid).toBe(true);
    expect(result.computedPrice).toBe(200);
    expect(result.normalizedItems[0].quantity).toBe(2);
  });

  it('rejects an unauthorized optional removal', () => {
    const optional = item({
      id: 'opt-1',
      role: PackItemRole.OPTIONAL_INCLUDED,
      removalAllowed: false,
    });

    const result = validatePackConfiguration(pack({ items: [optional] }), {
      items: [{ packItemId: 'opt-1', removed: true }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('REMOVAL_NOT_ALLOWED');
  });

  it('rejects removing a required fixed item', () => {
    const result = validatePackConfiguration(pack(), {
      items: [{ packItemId: 'item-1', removed: true }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('REQUIRED_ITEM_REMOVAL');
  });

  it('allows a permitted optional removal and drops it from price and count', () => {
    const kept = item({ id: 'fixed-1' });
    const optional = item({
      id: 'opt-1',
      role: PackItemRole.OPTIONAL_INCLUDED,
      removalAllowed: true,
    });

    const result = validatePackConfiguration(
      pack({ items: [kept, optional] }),
      { items: [{ packItemId: 'opt-1', removed: true }] },
    );

    expect(result.isValid).toBe(true);
    expect(result.computedPrice).toBe(100);
    const removedEntry = result.normalizedItems.find(
      (entry) => entry.packItemId === 'opt-1',
    );
    expect(removedEntry?.removed).toBe(true);
    expect(removedEntry?.lineTotal).toBe(0);
  });

  it('rejects exceeding the maximum item count', () => {
    const result = validatePackConfiguration(
      pack({ items: [item({ id: 'a' }), item({ id: 'b' })], maxItemCount: 1 }),
      {},
    );

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('MAX_ITEMS_EXCEEDED');
  });

  it('rejects falling below the minimum required item count', () => {
    const result = validatePackConfiguration(
      pack({ items: [item({ id: 'a' })], minRequiredItems: 2 }),
      {},
    );

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('MIN_ITEMS_NOT_MET');
  });

  it('flags unavailable stock and reports OUT_OF_STOCK', () => {
    const outOfStock = item({
      product: product({
        references: [reference({ id: 'ref-a', stockQuantity: 0 })],
      }),
    });

    const result = validatePackConfiguration(pack({ items: [outOfStock] }), {});

    expect(result.isValid).toBe(false);
    expect(result.stockStatus).toBe('OUT_OF_STOCK');
    expect(codes(result)).toContain('INSUFFICIENT_STOCK');
  });

  it('rejects a computed price below the pack price floor', () => {
    const result = validatePackConfiguration(
      pack({ minAllowedPrice: 200 as any }),
      {},
    );

    expect(result.isValid).toBe(false);
    expect(result.computedPrice).toBe(100);
    expect(result.minAllowedPrice).toBe(200);
    expect(codes(result)).toContain('BELOW_MIN_PRICE');
  });

  it('applies the configured discount for SUM_ITEMS_WITH_DISCOUNT packs', () => {
    const result = validatePackConfiguration(
      pack({
        priceMode: PriceMode.SUM_ITEMS_WITH_DISCOUNT,
        discountPercentage: 10 as any,
      }),
      {},
    );

    expect(result.isValid).toBe(true);
    expect(result.computedPrice).toBe(90);
  });

  it('rejects a selection that targets an unknown slot', () => {
    const result = validatePackConfiguration(pack(), {
      items: [{ packItemId: 'does-not-exist', productReferenceId: 'ref-a' }],
    });

    expect(result.isValid).toBe(false);
    expect(codes(result)).toContain('UNKNOWN_ITEM');
  });
});
