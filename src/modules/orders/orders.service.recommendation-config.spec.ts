import { BadRequestException } from '@nestjs/common';
import {
  PackConfigurationSourceType,
  PackItemRole,
  PackStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { CreatePackOrderDto } from './dto/create-pack-order.dto';
import { OrdersService } from './orders.service';

/**
 * Pack Core Evolution (Phase 9) — configured checkout of a QUIZ_RECOMMENDED
 * configuration. The existing Phase 6 configured checkout is reused verbatim; it
 * must revalidate everything, block a pending required selection, allow a valid
 * one (including from a fixed recommended pack), and freeze sourceType
 * QUIZ_RECOMMENDED onto the immutable order snapshot — all without changing the
 * behavior of a CUSTOMIZED configuration.
 */

const dto: CreatePackOrderDto = {
  fullName: 'Sara',
  phone: '0600000000',
  whatsappPhone: '0600000000',
  city: 'Casablanca',
  addressLine: 'Maarif',
  extraInfo: 'Near the pharmacy',
  notes: 'Call before delivery',
};

function decimal(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value);
}

function referenceFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'reference-1',
    referenceCode: 'RF2',
    referenceName: 'Medium Warm',
    shadeName: 'Medium Warm',
    measurement: '30ml',
    sku: 'SKU-RF2',
    priceOverride: decimal(120),
    priceDelta: decimal(0),
    imageUrl: 'https://cdn.example/reference.jpg',
    image: { media: { secureUrl: 'https://cdn.example/ref.jpg', url: null } },
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
    ...overrides,
  };
}

function productFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'product-1',
    name: 'Foundation X',
    basePrice: decimal(120),
    compareAtPrice: decimal(159),
    mainImageUrl: 'https://cdn.example/product.jpg',
    isActive: true,
    status: ProductStatus.ACTIVE,
    brand: { name: 'Glow Brand' },
    images: [{ media: { secureUrl: 'https://cdn.example/cover.jpg', url: null } }],
    references: [referenceFixture()],
    ...overrides,
  };
}

/** Customizable recommended pack: one required customer-choice slot. */
function customizablePack(overrides: Record<string, any> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow Pack',
    status: PackStatus.ACTIVE,
    isActive: true,
    isCustomizable: true,
    priceMode: PriceMode.SUM_ITEMS,
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
    minAllowedPrice: null,
    minRequiredItems: null,
    maxItemCount: null,
    items: [
      {
        id: 'pack-item-1',
        role: PackItemRole.REQUIRED_SELECTABLE,
        selectionMode: SelectionMode.CUSTOMER_CHOICE,
        quantity: 1,
        minQuantity: null,
        maxQuantity: null,
        quantityEditable: false,
        removalAllowed: false,
        replacementAllowed: false,
        productReferenceId: null,
        product: productFixture(),
        allowedReferences: [{ productReferenceId: 'reference-1' }],
      },
    ],
    allowedAddOns: [],
    ...overrides,
  };
}

/** Fixed (non-customizable) recommended pack: one pinned FIXED item. */
function fixedPack(overrides: Record<string, any> = {}) {
  return {
    ...customizablePack(),
    isCustomizable: false,
    items: [
      {
        ...customizablePack().items[0],
        id: 'pack-item-1',
        role: PackItemRole.FIXED,
        selectionMode: SelectionMode.FIXED_REFERENCE,
        productReferenceId: 'reference-1',
        allowedReferences: [],
      },
    ],
    ...overrides,
  };
}

function configurationFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'config-1',
    sourceType: PackConfigurationSourceType.QUIZ_RECOMMENDED,
    items: [
      {
        packItemId: 'pack-item-1',
        productId: 'product-1',
        productReferenceId: 'reference-1',
        role: PackItemRole.REQUIRED_SELECTABLE,
        quantity: 1,
        isAddOn: false,
        removed: false,
      },
    ],
    sourcePack: customizablePack(),
    ...overrides,
  };
}

describe('OrdersService — QUIZ_RECOMMENDED configured checkout (Phase 9)', () => {
  let prisma: any;
  let tx: any;
  let orderStockService: any;
  let service: OrdersService;

  beforeEach(() => {
    tx = createTransactionMock();
    orderStockService = {
      reserveForNewOrder: jest.fn().mockResolvedValue(undefined),
    };
    prisma = {
      packConfiguration: tx.packConfiguration,
      $transaction: jest.fn((cb: (t: unknown) => unknown) => cb(tx)),
    };
    service = new OrdersService(prisma, orderStockService);
  });

  it('allows checkout of a valid selection and freezes sourceType QUIZ_RECOMMENDED', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(configurationFixture());

    const result = await service.createFromConfiguration('config-1', dto);

    expect(result.orderId).toBe('order-1');
    expect(result.totalAmount).toBe(120);
    const snapshot =
      tx.order.create.mock.calls[0][0].data.packConfigurationSnapshot;
    expect(snapshot.sourceType).toBe('QUIZ_RECOMMENDED');
    expect(snapshot.selectedItems).toEqual([
      expect.objectContaining({
        productId: 'product-1',
        productReferenceId: 'reference-1',
        quantity: 1,
      }),
    ]);
  });

  it('allows checkout of a recommended fixed (non-customizable) pack', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourcePack: fixedPack(),
        items: [
          {
            packItemId: 'pack-item-1',
            productId: 'product-1',
            productReferenceId: 'reference-1',
            role: PackItemRole.FIXED,
            quantity: 1,
            isAddOn: false,
            removed: false,
          },
        ],
      }),
    );

    const result = await service.createFromConfiguration('config-1', dto);

    expect(result.orderId).toBe('order-1');
    expect(
      tx.order.create.mock.calls[0][0].data.packConfigurationSnapshot.sourceType,
    ).toBe('QUIZ_RECOMMENDED');
  });

  it('blocks checkout while a required selection is still pending (null reference)', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        items: [
          {
            packItemId: 'pack-item-1',
            productId: 'product-1',
            productReferenceId: null,
            role: PackItemRole.REQUIRED_SELECTABLE,
            quantity: 1,
            isAddOn: false,
            removed: false,
          },
        ],
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('still requires a customizable source pack for a CUSTOMIZED configuration (unchanged)', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourceType: PackConfigurationSourceType.CUSTOMIZED,
        sourcePack: customizablePack({ isCustomizable: false }),
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});

function createTransactionMock() {
  return {
    packConfiguration: { findUnique: jest.fn() },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'customer-1',
        fullName: dto.fullName,
        phone: dto.phone,
        whatsappPhone: dto.whatsappPhone,
      }),
      update: jest.fn(),
    },
    customerAddress: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: 'address-1',
        customerId: 'customer-1',
        city: dto.city,
        addressLine: dto.addressLine,
        extraInfo: dto.extraInfo,
      }),
    },
    order: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'order-1',
          orderNumber: 'ORD-20260701-ABC123',
          orderStatus: data.orderStatus,
          paymentMethod: data.paymentMethod,
          paymentStatus: data.paymentStatus,
          subtotalAmount: data.subtotalAmount,
          discountAmount: data.discountAmount,
          deliveryFee: data.deliveryFee,
          totalAmount: data.totalAmount,
          currency: data.currency,
        }),
      ),
    },
    orderItem: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
  };
}
