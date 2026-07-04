import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PackConfigurationSourceType,
  PackItemRole,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { CreatePackOrderDto } from './dto/create-pack-order.dto';
import { OrdersService } from './orders.service';

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
    image: {
      media: { secureUrl: 'https://cdn.example/ref.jpg', url: null },
    },
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
    images: [
      { media: { secureUrl: 'https://cdn.example/cover.jpg', url: null } },
    ],
    references: [referenceFixture()],
    ...overrides,
  };
}

function sourcePackFixture(overrides: Record<string, any> = {}) {
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

function configurationFixture(overrides: Record<string, any> = {}) {
  return {
    id: 'config-1',
    sourceType: PackConfigurationSourceType.CUSTOMIZED,
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
    sourcePack: sourcePackFixture(),
    ...overrides,
  };
}

describe('OrdersService — configured checkout (Phase 6)', () => {
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
      order: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new OrdersService(prisma, orderStockService);
  });

  it('creates a COD order from a valid configuration', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(configurationFixture());

    const result = await service.createFromConfiguration('config-1', dto);

    expect(result.orderId).toBe('order-1');
    expect(result.orderStatus).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(result.paymentMethod).toBe(PaymentMethod.CASH_ON_DELIVERY);
    expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(result.pack).toEqual({ id: 'pack-1', name: 'Natural Glow Pack' });
    expect(result.totalAmount).toBe(120);

    const createArg = tx.order.create.mock.calls[0][0];
    expect(createArg.data).toEqual(
      expect.objectContaining({
        selectedPackId: 'pack-1',
        packConfigurationId: 'config-1',
        customerProfileId: null,
        recommendationResultId: null,
        currency: 'MAD',
      }),
    );
    // Order items are normal OrderItems carrying the source packId.
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'order-1',
          packId: 'pack-1',
          productId: 'product-1',
          productReferenceId: 'reference-1',
          quantity: 1,
        }),
      ],
    });
    // Reuses the atomic stock reservation flow.
    expect(orderStockService.reserveForNewOrder).toHaveBeenCalledWith(tx, [
      expect.objectContaining({ productReferenceId: 'reference-1' }),
    ]);
  });

  it('writes an immutable pack configuration snapshot that survives later pack changes', async () => {
    const configuration = configurationFixture();
    tx.packConfiguration.findUnique.mockResolvedValue(configuration);

    await service.createFromConfiguration('config-1', dto);

    const snapshot =
      tx.order.create.mock.calls[0][0].data.packConfigurationSnapshot;
    expect(snapshot.sourcePackId).toBe('pack-1');
    expect(snapshot.sourceType).toBe('CUSTOMIZED');
    expect(snapshot.finalPrice).toBe(120);
    expect(snapshot.selectedItems).toEqual([
      expect.objectContaining({
        productId: 'product-1',
        productReferenceId: 'reference-1',
        productName: 'Foundation X',
        quantity: 1,
        unitPrice: 120,
      }),
    ]);

    // Simulate the source pack changing after the order was placed.
    configuration.sourcePack.name = 'Renamed Pack';
    configuration.sourcePack.items[0].product.name = 'Different Product';
    configuration.sourcePack.items[0].product.references[0].priceOverride =
      decimal(999);

    // The frozen snapshot on the order is unaffected.
    expect(snapshot.finalPrice).toBe(120);
    expect(snapshot.selectedItems[0].productName).toBe('Foundation X');
  });

  it('rejects a configuration whose reference is out of stock (stale)', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourcePack: sourcePackFixture({
          items: [
            {
              ...sourcePackFixture().items[0],
              product: productFixture({
                references: [
                  referenceFixture({ stockQuantity: 0, reservedQuantity: 0 }),
                ],
              }),
            },
          ],
        }),
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects a configuration priced below the pack floor', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourcePack: sourcePackFixture({ minAllowedPrice: decimal(200) }),
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects a configuration whose saved reference is no longer allowed', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourcePack: sourcePackFixture({
          items: [
            {
              ...sourcePackFixture().items[0],
              allowedReferences: [{ productReferenceId: 'other-reference' }],
            },
          ],
        }),
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('rejects a configuration whose source pack became inactive', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(
      configurationFixture({
        sourcePack: sourcePackFixture({ status: PackStatus.ARCHIVED }),
      }),
    );

    await expect(
      service.createFromConfiguration('config-1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the configuration does not exist', async () => {
    tx.packConfiguration.findUnique.mockResolvedValue(null);

    await expect(
      service.createFromConfiguration('missing', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
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
