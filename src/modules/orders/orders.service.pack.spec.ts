import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PackItemRole,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { CreateCartOrderDto } from './dto/create-cart-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreatePackOrderDto } from './dto/create-pack-order.dto';
import { OrdersService } from './orders.service';

const packOrderDto: CreatePackOrderDto = {
  fullName: 'Sara',
  phone: '0600000000',
  whatsappPhone: '0600000000',
  city: 'Casablanca',
  addressLine: 'Maarif',
  extraInfo: 'Near the pharmacy',
  notes: 'Call before delivery',
};

describe('OrdersService — fixed pack direct purchase (Phase 4B)', () => {
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
      pack: tx.pack,
      product: tx.product,
      productReference: tx.productReference,
      recommendationResult: tx.recommendationResult,
      order: { findUnique: jest.fn() },
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new OrdersService(prisma, orderStockService);
  });

  it('creates a fixed pack COD order as one unit', async () => {
    tx.pack.findUnique.mockResolvedValue(fixedPackFixture());

    const result = await service.createFromFixedPack('pack-1', packOrderDto);

    expect(result.orderId).toBe('order-1');
    expect(result.orderStatus).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(result.paymentMethod).toBe(PaymentMethod.CASH_ON_DELIVERY);
    expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(result.pack).toEqual({ id: 'pack-1', name: 'Natural Glow Pack' });
    expect(result.items).toHaveLength(1);
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        selectedPackId: 'pack-1',
        customerProfileId: null,
        recommendationResultId: null,
        currency: 'MAD',
      }),
    });
    // The fixed-pack path never touches the recommendation funnel.
    expect(tx.recommendationResult.update).not.toHaveBeenCalled();
  });

  it('expands pack items into order items carrying packId', async () => {
    tx.pack.findUnique.mockResolvedValue(fixedPackFixture());

    await service.createFromFixedPack('pack-1', packOrderDto);

    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'order-1',
          packId: 'pack-1',
          productId: 'product-1',
          productReferenceId: 'reference-1',
          referenceNameSnapshot: 'RF2 Medium Warm',
          quantity: 1,
        }),
      ],
    });
  });

  it('applies FIXED price mode from the pack (ignores item sum)', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({ priceMode: PriceMode.FIXED, fixedPrice: decimal(299) }),
    );

    const result = await service.createFromFixedPack('pack-1', packOrderDto);

    expect(result.subtotalAmount).toBe(299);
    expect(result.discountAmount).toBe(0);
    expect(result.totalAmount).toBe(299);
  });

  it('applies SUM_ITEMS price mode from resolved references', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({
        priceMode: PriceMode.SUM_ITEMS,
        fixedPrice: null,
        items: [
          packItemFixture({
            quantity: 2,
            reference: { priceOverride: decimal(120) },
          }),
        ],
      }),
    );

    const result = await service.createFromFixedPack('pack-1', packOrderDto);

    expect(result.subtotalAmount).toBe(240);
    expect(result.totalAmount).toBe(240);
  });

  it('reserves stock through the atomic reservation flow', async () => {
    tx.pack.findUnique.mockResolvedValue(fixedPackFixture());

    await service.createFromFixedPack('pack-1', packOrderDto);

    expect(orderStockService.reserveForNewOrder).toHaveBeenCalledWith(tx, [
      expect.objectContaining({
        productReferenceId: 'reference-1',
        referenceNameSnapshot: 'RF2 Medium Warm',
        quantity: 1,
      }),
    ]);
  });

  it('throws NotFoundException when the pack does not exist', async () => {
    tx.pack.findUnique.mockResolvedValue(null);

    await expect(
      service.createFromFixedPack('missing', packOrderDto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a pack with an unavailable required item', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({
        items: [
          packItemFixture({
            reference: { stockQuantity: 1, reservedQuantity: 1 },
          }),
        ],
      }),
    );

    await expect(
      service.createFromFixedPack('pack-1', packOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(orderStockService.reserveForNewOrder).not.toHaveBeenCalled();
  });

  it('rejects a customizable pack', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({ isCustomizable: true }),
    );

    await expect(
      service.createFromFixedPack('pack-1', packOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pack with a required-selectable item', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({
        items: [packItemFixture({ role: PackItemRole.REQUIRED_SELECTABLE })],
      }),
    );

    await expect(
      service.createFromFixedPack('pack-1', packOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a pack with a customer-choice item', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({
        items: [
          packItemFixture({
            selectionMode: SelectionMode.CUSTOMER_CHOICE,
            productReferenceId: null,
          }),
        ],
      }),
    );

    await expect(
      service.createFromFixedPack('pack-1', packOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an inactive/archived pack', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({ status: PackStatus.ARCHIVED }),
    );

    await expect(
      service.createFromFixedPack('pack-1', packOrderDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('auto-selects an in-stock reference for AUTO_BEST_REFERENCE items', async () => {
    tx.pack.findUnique.mockResolvedValue(
      fixedPackFixture({
        items: [
          packItemFixture({
            selectionMode: SelectionMode.AUTO_BEST_REFERENCE,
            productReferenceId: null,
            product: {
              references: [
                referenceFixture({
                  id: 'ref-out',
                  referenceCode: 'AAA',
                  stockQuantity: 0,
                  reservedQuantity: 0,
                }),
                referenceFixture({
                  id: 'ref-in',
                  referenceCode: 'BBB',
                  stockQuantity: 5,
                }),
              ],
            },
          }),
        ],
      }),
    );

    await service.createFromFixedPack('pack-1', packOrderDto);

    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ productReferenceId: 'ref-in' })],
    });
  });

  // ---- Existing order/checkout paths remain unchanged after the refactor ----

  it('leaves the recommendation funnel order path unchanged', async () => {
    tx.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    const dto: CreateOrderDto = {
      recommendationResultId: '11111111-1111-4111-8111-111111111111',
      ...packOrderDto,
    };
    const result = await service.create(dto);

    expect(result.pack).toEqual({ id: 'pack-1', name: 'Natural Glow Pack' });
    expect(result.totalAmount).toBe(299);
    const createArg = tx.order.create.mock.calls[0][0];
    expect(createArg.data).not.toHaveProperty('packConfigurationSnapshot');
    expect(tx.recommendationResult.update).toHaveBeenCalled();
  });

  it('leaves the cart checkout path unchanged', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(cartReferenceFixture());

    const dto: CreateCartOrderDto = {
      items: [{ productId: 'product-1', referenceId: 'reference-1', quantity: 1 }],
      ...packOrderDto,
    };
    const result = await service.createFromCart(dto);

    expect(result.pack).toBeNull();
    expect(result.totalAmount).toBe(120);
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        selectedPackId: null,
        recommendationResultId: null,
      }),
    });
  });
});

function createTransactionMock() {
  return {
    pack: { findUnique: jest.fn() },
    product: { findUnique: jest.fn() },
    productReference: { findUnique: jest.fn() },
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'customer-1',
        fullName: packOrderDto.fullName,
        phone: packOrderDto.phone,
        whatsappPhone: packOrderDto.whatsappPhone,
      }),
      update: jest.fn(),
    },
    customerAddress: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: 'address-1',
        customerId: 'customer-1',
        city: packOrderDto.city,
        addressLine: packOrderDto.addressLine,
        extraInfo: packOrderDto.extraInfo,
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
    recommendationResult: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({ id: 'result-1' }),
    },
  };
}

function referenceFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reference-1',
    referenceCode: 'RF2',
    referenceName: 'Medium Warm',
    shadeName: 'Medium Warm',
    measurement: '30ml',
    sku: 'SKU-RF2',
    priceOverride: decimal(120),
    priceDelta: decimal(0),
    imageUrl: 'https://cdn.example/reference-legacy.jpg',
    image: { media: { secureUrl: 'https://cdn.example/ref-medium.jpg', url: null } },
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
    ...overrides,
  };
}

function packItemFixture(
  overrides: {
    role?: PackItemRole;
    selectionMode?: SelectionMode;
    quantity?: number;
    productReferenceId?: string | null;
    reference?: Record<string, unknown>;
    product?: { references?: unknown[] };
  } = {},
) {
  const references = overrides.product?.references ?? [
    referenceFixture(overrides.reference),
  ];

  return {
    id: 'pack-item-1',
    role: overrides.role ?? PackItemRole.FIXED,
    selectionMode: overrides.selectionMode ?? SelectionMode.FIXED_REFERENCE,
    quantity: overrides.quantity ?? 1,
    productReferenceId:
      overrides.productReferenceId === undefined
        ? 'reference-1'
        : overrides.productReferenceId,
    product: {
      id: 'product-1',
      name: 'Foundation X',
      basePrice: decimal(120),
      compareAtPrice: decimal(159),
      mainImageUrl: 'https://cdn.example/product-main.jpg',
      isActive: true,
      status: ProductStatus.ACTIVE,
      brand: { name: 'Glow Brand' },
      images: [
        { media: { secureUrl: 'https://cdn.example/product-cover.jpg', url: null } },
      ],
      references,
    },
  };
}

function fixedPackFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pack-1',
    name: 'Natural Glow Pack',
    status: PackStatus.ACTIVE,
    isActive: true,
    isCustomizable: false,
    priceMode: PriceMode.FIXED,
    fixedPrice: decimal(299),
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
    items: [packItemFixture()],
    ...overrides,
  };
}

function recommendationResultFixture() {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    packId: 'pack-1',
    pack: {
      id: 'pack-1',
      name: 'Natural Glow Pack',
      status: PackStatus.ACTIVE,
      isActive: true,
      priceMode: PriceMode.FIXED,
      fixedPrice: decimal(299),
      discountAmount: null,
      discountPercentage: null,
      currency: 'MAD',
    },
    recommendationSession: { customerProfile: { id: 'profile-1' } },
    items: [
      {
        id: 'result-item-1',
        quantity: 1,
        product: {
          id: 'product-1',
          name: 'Foundation X',
          basePrice: decimal(120),
          compareAtPrice: decimal(159),
          mainImageUrl: 'https://cdn.example/product-main.jpg',
          isActive: true,
          status: ProductStatus.ACTIVE,
          brand: { name: 'Glow Brand' },
          images: [
            {
              media: {
                secureUrl: 'https://cdn.example/product-cover.jpg',
                url: null,
              },
            },
          ],
        },
        selectedProductReference: referenceFixture(),
        packItem: { isRequired: true },
      },
    ],
  };
}

function cartProductFixture() {
  return {
    id: 'product-1',
    name: 'Foundation X',
    basePrice: decimal(120),
    compareAtPrice: decimal(159),
    mainImageUrl: 'https://cdn.example/product-main.jpg',
    currency: 'MAD',
    isActive: true,
    status: ProductStatus.ACTIVE,
    brand: { name: 'Glow Brand' },
    images: [
      { media: { secureUrl: 'https://cdn.example/product-cover.jpg', url: null } },
    ],
  };
}

function cartReferenceFixture() {
  return {
    id: 'reference-1',
    productId: 'product-1',
    referenceCode: 'RF2',
    referenceName: 'Medium Warm',
    shadeName: 'Medium Warm',
    measurement: '30ml',
    sku: 'SKU-RF2',
    priceOverride: decimal(120),
    priceDelta: decimal(0),
    imageUrl: 'https://cdn.example/reference-legacy.jpg',
    image: { media: { secureUrl: 'https://cdn.example/ref-medium.jpg', url: null } },
    stockQuantity: 10,
    reservedQuantity: 0,
    isActive: true,
  };
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
