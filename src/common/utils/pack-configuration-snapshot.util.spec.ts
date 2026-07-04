import { PackItemRole, Prisma } from '@prisma/client';
import {
  PACK_CONFIGURATION_SNAPSHOT_VERSION,
  buildPackConfigurationSnapshot,
} from './pack-configuration-snapshot.util';

describe('buildPackConfigurationSnapshot', () => {
  const baseItem = {
    productId: 'product-1',
    productReferenceId: 'reference-1',
    productName: 'Foundation X',
    referenceName: 'RF2 Medium Warm',
    role: PackItemRole.FIXED,
    quantity: 1,
    unitPrice: new Prisma.Decimal('120.00'),
  };

  it('captures source, currency, prices and normalizes Decimals to numbers', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourcePackId: 'pack-1',
      sourcePackName: 'Natural Glow Pack',
      sourceType: 'FIXED',
      currency: 'MAD',
      finalPrice: new Prisma.Decimal('299.00'),
      minAllowedPrice: new Prisma.Decimal('150.00'),
      selectedItems: [baseItem],
    });

    expect(snapshot.version).toBe(PACK_CONFIGURATION_SNAPSHOT_VERSION);
    expect(snapshot.sourcePackId).toBe('pack-1');
    expect(snapshot.sourcePackName).toBe('Natural Glow Pack');
    expect(snapshot.sourceType).toBe('FIXED');
    expect(snapshot.currency).toBe('MAD');
    expect(snapshot.finalPrice).toBe(299);
    expect(snapshot.minAllowedPrice).toBe(150);
    expect(snapshot.selectedItems[0]).toEqual({
      productId: 'product-1',
      productReferenceId: 'reference-1',
      productName: 'Foundation X',
      referenceName: 'RF2 Medium Warm',
      role: PackItemRole.FIXED,
      quantity: 1,
      unitPrice: 120,
    });
  });

  it('marks validation VALID and floor respected when price >= floor', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourceType: 'CUSTOMIZED',
      currency: 'MAD',
      finalPrice: 150,
      minAllowedPrice: 150,
    });

    expect(snapshot.validation.status).toBe('VALID');
    expect(snapshot.validation.priceFloorRespected).toBe(true);
    expect(snapshot.validation.messages).toEqual([]);
  });

  it('marks validation INVALID and floor not respected when price < floor', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourceType: 'CUSTOMIZED',
      currency: 'MAD',
      finalPrice: 100,
      minAllowedPrice: 150,
    });

    expect(snapshot.validation.status).toBe('INVALID');
    expect(snapshot.validation.priceFloorRespected).toBe(false);
  });

  it('treats a null floor as respected', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourceType: 'FIXED',
      currency: 'MAD',
      finalPrice: 10,
      minAllowedPrice: null,
    });

    expect(snapshot.minAllowedPrice).toBeNull();
    expect(snapshot.validation.priceFloorRespected).toBe(true);
    expect(snapshot.validation.status).toBe('VALID');
  });

  it('marks validation INVALID when validation messages are present', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourceType: 'CUSTOMIZED',
      currency: 'MAD',
      finalPrice: 300,
      minAllowedPrice: 150,
      validationMessages: ['Reference out of stock'],
    });

    expect(snapshot.validation.status).toBe('INVALID');
    expect(snapshot.validation.priceFloorRespected).toBe(true);
    expect(snapshot.validation.messages).toEqual(['Reference out of stock']);
  });

  it('supports a null source pack (generated) and defaults collections to empty', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourcePackId: null,
      sourceType: 'QUIZ_GENERATED',
      currency: 'MAD',
      finalPrice: 250,
    });

    expect(snapshot.sourcePackId).toBeNull();
    expect(snapshot.sourcePackName).toBeNull();
    expect(snapshot.selectedItems).toEqual([]);
    expect(snapshot.removedItems).toEqual([]);
    expect(snapshot.addedItems).toEqual([]);
  });

  it('records selected, removed, and added item groups', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourcePackId: 'pack-1',
      sourceType: 'CUSTOMIZED',
      currency: 'MAD',
      finalPrice: 320,
      minAllowedPrice: 150,
      selectedItems: [baseItem],
      removedItems: [
        { ...baseItem, productId: 'product-2', role: PackItemRole.OPTIONAL_INCLUDED },
      ],
      addedItems: [
        { ...baseItem, productId: 'product-3', role: PackItemRole.OPTIONAL_ADDON },
      ],
    });

    expect(snapshot.selectedItems).toHaveLength(1);
    expect(snapshot.removedItems[0].productId).toBe('product-2');
    expect(snapshot.addedItems[0].role).toBe(PackItemRole.OPTIONAL_ADDON);
  });

  it('never leaks quiz answers, scores, costs, or margins', () => {
    const snapshot = buildPackConfigurationSnapshot({
      sourcePackId: 'pack-1',
      sourceType: 'QUIZ_RECOMMENDED',
      currency: 'MAD',
      finalPrice: 299,
      minAllowedPrice: 150,
      selectedItems: [baseItem],
    });

    const serialized = JSON.stringify(snapshot).toLowerCase();
    expect(serialized).not.toContain('answer');
    expect(serialized).not.toContain('score');
    expect(serialized).not.toContain('cost');
    expect(serialized).not.toContain('margin');
  });
});
