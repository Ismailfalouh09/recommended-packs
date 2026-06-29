import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PackStatus,
  PaymentMethod,
  PaymentStatus,
  PriceMode,
  Prisma,
  ProductStatus,
} from '@prisma/client';
import { validate } from 'class-validator';
import {
  CartOrderItemDto,
  CreateCartOrderDto,
} from './dto/create-cart-order.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

const baseDto: CreateOrderDto = {
  recommendationResultId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Sara',
  phone: '0600000000',
  whatsappPhone: '0600000000',
  city: 'Casablanca',
  addressLine: 'Maarif',
  extraInfo: 'Near the pharmacy',
  notes: 'Call before delivery',
};

const cartDto: CreateCartOrderDto = {
  items: [
    {
      productId: 'product-1',
      referenceId: 'reference-1',
      quantity: 1,
    },
  ],
  fullName: 'Sara',
  phone: '0600000000',
  whatsappPhone: '0600000000',
  city: 'Casablanca',
  addressLine: 'Maarif',
  extraInfo: 'Near the pharmacy',
  notes: 'Call before delivery',
};

describe('OrdersService', () => {
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
      recommendationResult: tx.recommendationResult,
      order: {
        findUnique: jest.fn(),
      },
      product: tx.product,
      productReference: tx.productReference,
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new OrdersService(prisma, orderStockService);
  });

  it('creates an order from a valid recommendation result', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    const result = await service.create(baseDto);

    expect(result.orderId).toBe('order-1');
    expect(result.orderStatus).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(result.paymentMethod).toBe(PaymentMethod.CASH_ON_DELIVERY);
    expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(result.totalAmount).toBe(299);
    expect(result.pack.name).toBe('Natural Glow Pack');
    expect(result.items).toHaveLength(1);
    expect(tx.order.create).toHaveBeenCalled();
  });

  it('finds and updates an existing customer by phone', async () => {
    tx.customer.findUnique.mockResolvedValue({
      id: 'customer-existing',
      fullName: 'Old Name',
      phone: baseDto.phone,
      whatsappPhone: null,
    });
    tx.customer.update.mockResolvedValue({
      id: 'customer-existing',
      fullName: baseDto.fullName,
      phone: baseDto.phone,
      whatsappPhone: baseDto.whatsappPhone,
    });
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.customer.findUnique).toHaveBeenCalledWith({
      where: { phone: baseDto.phone },
    });
    expect(tx.customer.update).toHaveBeenCalledWith({
      where: { id: 'customer-existing' },
      data: {
        fullName: baseDto.fullName,
        whatsappPhone: baseDto.whatsappPhone,
      },
    });
    expect(tx.customer.create).not.toHaveBeenCalled();
  });

  it('creates a new customer when the phone does not exist', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.customer.create).toHaveBeenCalledWith({
      data: {
        fullName: baseDto.fullName,
        phone: baseDto.phone,
        whatsappPhone: baseDto.whatsappPhone,
      },
    });
  });

  it('creates a new default address after clearing previous defaults', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.customerAddress.updateMany).toHaveBeenCalledWith({
      where: {
        customerId: 'customer-1',
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
    expect(tx.customerAddress.create).toHaveBeenCalledWith({
      data: {
        customerId: 'customer-1',
        city: baseDto.city,
        addressLine: baseDto.addressLine,
        extraInfo: baseDto.extraInfo,
        isDefault: true,
      },
    });
  });

  it('calculates fixed pack price', () => {
    const price = (service as any).calculateOrderPrice(
      recommendationResultFixture({
        pack: {
          priceMode: PriceMode.FIXED,
          fixedPrice: decimal(299),
        },
      }),
    );

    expect(price.subtotalAmount.toNumber()).toBe(299);
    expect(price.discountAmount.toNumber()).toBe(0);
    expect(price.totalAmount.toNumber()).toBe(299);
  });

  it('calculates SUM_ITEMS price', () => {
    const price = (service as any).calculateOrderPrice(
      recommendationResultFixture({
        pack: {
          priceMode: PriceMode.SUM_ITEMS,
          fixedPrice: null,
        },
        item: {
          productBasePrice: decimal(100),
          referencePriceDelta: decimal(15),
          referencePriceOverride: null,
          quantity: 2,
        },
      }),
    );

    expect(price.subtotalAmount.toNumber()).toBe(230);
    expect(price.totalAmount.toNumber()).toBe(230);
  });

  it('creates order item snapshots', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'order-1',
          packId: 'pack-1',
          productId: 'product-1',
          productReferenceId: 'reference-1',
          productNameSnapshot: 'Foundation X',
          referenceNameSnapshot: 'RF2 Medium Warm',
          skuSnapshot: 'SKU-RF2',
          variationSnapshot: 'Medium Warm / 30ml',
          productImageUrlSnapshot: 'https://cdn.example/ref-medium.jpg',
          brandNameSnapshot: 'Glow Brand',
          unitPriceSnapshot: decimal(120),
          originalUnitPriceSnapshot: decimal(159),
          quantity: 1,
        }),
      ],
    });
  });

  it('saves fixed and automatic pack selected references as order items', async () => {
    const result: any = recommendationResultFixture();
    result.items = [
      {
        ...result.items[0],
        id: 'fixed-result-item',
        selectedProductReference: {
          ...result.items[0].selectedProductReference,
          id: 'fixed-reference',
          referenceCode: 'FIX',
          referenceName: 'Fixed Shade',
          sku: 'SKU-FIX',
        },
      },
      {
        ...result.items[0],
        id: 'auto-result-item',
        quantity: 2,
        selectedProductReference: {
          ...result.items[0].selectedProductReference,
          id: 'auto-reference',
          referenceCode: 'AUTO',
          referenceName: 'Auto Shade',
          sku: 'SKU-AUTO',
        },
      },
    ];
    prisma.recommendationResult.findUnique.mockResolvedValue(result);

    await service.create(baseDto);

    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          productReferenceId: 'fixed-reference',
          referenceNameSnapshot: 'FIX Fixed Shade',
          skuSnapshot: 'SKU-FIX',
          quantity: 1,
        }),
        expect.objectContaining({
          productReferenceId: 'auto-reference',
          referenceNameSnapshot: 'AUTO Auto Shade',
          skuSnapshot: 'SKU-AUTO',
          quantity: 2,
        }),
      ]),
    });
  });

  it('reserves selected recommendation stock inside order creation', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(orderStockService.reserveForNewOrder).toHaveBeenCalledWith(tx, [
      expect.objectContaining({
        productReferenceId: 'reference-1',
        referenceNameSnapshot: 'RF2 Medium Warm',
        quantity: 1,
      }),
    ]);
  });

  it('creates initial status history', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        oldStatus: null,
        newStatus: OrderStatus.PENDING_CONFIRMATION,
        comment: 'Order created',
      },
    });
  });

  it('marks the recommendation result as selected', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );

    await service.create(baseDto);

    expect(tx.recommendationResult.update).toHaveBeenCalledWith({
      where: { id: baseDto.recommendationResultId },
      data: { isSelected: true },
    });
  });

  it('rejects invalid recommendationResultId DTO validation', async () => {
    const dto = Object.assign(new CreateOrderDto(), {
      ...baseDto,
      recommendationResultId: 'not-a-uuid',
    });

    const errors = await validate(dto);

    expect(
      errors.some((error) => error.property === 'recommendationResultId'),
    ).toBe(true);
  });

  it('rejects cart DTO items without a selected reference', async () => {
    const item = Object.assign(new CartOrderItemDto(), {
      productId: '11111111-1111-4111-8111-111111111111',
      quantity: 1,
    });
    const dto = Object.assign(new CreateCartOrderDto(), {
      ...cartDto,
      items: [item],
    });

    const errors = await validate(dto);
    const itemErrors = errors.find((error) => error.property === 'items');

    expect(JSON.stringify(itemErrors)).toContain('referenceId');
  });

  it('throws NotFoundException when recommendation result is not found', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(null);

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects empty recommendation result items', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture({ items: [] }),
    );

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive selected products', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture({
        item: {
          productIsActive: false,
        },
      }),
    );

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive selected references', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture({
        item: {
          referenceIsActive: false,
        },
      }),
    );

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects out-of-stock required references', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture({
        item: {
          stockQuantity: 1,
          reservedQuantity: 1,
          isRequired: true,
        },
      }),
    );

    await expect(service.create(baseDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not mark the recommendation selected when transaction creation fails', async () => {
    prisma.recommendationResult.findUnique.mockResolvedValue(
      recommendationResultFixture(),
    );
    tx.order.create.mockRejectedValue(new Error('database failure'));

    await expect(service.create(baseDto)).rejects.toThrow('database failure');
    expect(tx.recommendationResult.update).not.toHaveBeenCalled();
  });

  it('creates a cart order with one product', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture(),
    );

    const result = await service.createFromCart(cartDto);

    expect(result.orderId).toBe('order-1');
    expect(result.orderStatus).toBe(OrderStatus.PENDING_CONFIRMATION);
    expect(result.paymentMethod).toBe(PaymentMethod.CASH_ON_DELIVERY);
    expect(result.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(result.subtotalAmount).toBe(125);
    expect(result.totalAmount).toBe(125);
    expect(result.pack).toBeNull();
    expect(result.items).toEqual([
      expect.objectContaining({
        productId: 'product-1',
        productName: 'Foundation X',
        referenceId: 'reference-1',
        referenceName: 'RF2 Medium Warm',
        quantity: 1,
        unitPrice: 125,
        totalPrice: 125,
      }),
    ]);
    expect(tx.order.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        customerProfileId: null,
        recommendationResultId: null,
        selectedPackId: null,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.UNPAID,
        orderStatus: OrderStatus.PENDING_CONFIRMATION,
        currency: 'MAD',
      }),
    });
    expect(tx.orderItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          orderId: 'order-1',
          packId: null,
          productId: 'product-1',
          productReferenceId: 'reference-1',
          skuSnapshot: 'SKU-RF2',
          variationSnapshot: 'Medium Warm / 30ml',
          productImageUrlSnapshot: 'https://cdn.example/ref-medium.jpg',
          brandNameSnapshot: 'Glow Brand',
          originalUnitPriceSnapshot: decimal(159),
          quantity: 1,
        }),
      ],
    });
    expect(orderStockService.reserveForNewOrder).toHaveBeenCalledWith(tx, [
      expect.objectContaining({
        productReferenceId: 'reference-1',
        quantity: 1,
      }),
    ]);
  });

  it('creates a cart order with multiple quantities', async () => {
    prisma.product.findUnique.mockResolvedValue(
      cartProductFixture({ basePrice: decimal(100) }),
    );
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture({
        priceOverride: null,
        priceDelta: decimal(20),
        stockQuantity: 10,
      }),
    );

    const result = await service.createFromCart({
      ...cartDto,
      items: [{ ...cartDto.items[0], quantity: 3 }],
    });

    expect(result.subtotalAmount).toBe(360);
    expect(result.totalAmount).toBe(360);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        quantity: 3,
        unitPrice: 120,
        totalPrice: 360,
      }),
    );
  });

  it('rejects an empty cart', async () => {
    await expect(
      service.createFromCart({ ...cartDto, items: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFoundException when cart product is not found', async () => {
    prisma.product.findUnique.mockResolvedValue(null);

    await expect(service.createFromCart(cartDto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects cart references that do not belong to the selected product', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture({ productId: 'other-product' }),
    );

    await expect(service.createFromCart(cartDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects out-of-stock cart references', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture({ stockQuantity: 1 }),
    );

    await expect(
      service.createFromCart({
        ...cartDto,
        items: [{ ...cartDto.items[0], quantity: 2 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects cart references with stock already reserved', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture({ stockQuantity: 2, reservedQuantity: 2 }),
    );

    await expect(service.createFromCart(cartDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive cart products', async () => {
    prisma.product.findUnique.mockResolvedValue(
      cartProductFixture({ isActive: false }),
    );

    await expect(service.createFromCart(cartDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects inactive cart references', async () => {
    prisma.product.findUnique.mockResolvedValue(cartProductFixture());
    prisma.productReference.findUnique.mockResolvedValue(
      cartReferenceFixture({ isActive: false }),
    );

    await expect(service.createFromCart(cartDto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

function createTransactionMock() {
  return {
    customer: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'customer-1',
        fullName: baseDto.fullName,
        phone: baseDto.phone,
        whatsappPhone: baseDto.whatsappPhone,
      }),
      update: jest.fn(),
    },
    customerAddress: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      create: jest.fn().mockResolvedValue({
        id: 'address-1',
        customerId: 'customer-1',
        city: baseDto.city,
        addressLine: baseDto.addressLine,
        extraInfo: baseDto.extraInfo,
      }),
    },
    product: {
      findUnique: jest.fn(),
    },
    productReference: {
      findUnique: jest.fn(),
    },
    order: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'order-1',
          orderNumber: 'ORD-20260612-ABC123',
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
    orderItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
    recommendationResult: {
      findUnique: jest.fn(),
      update: jest
        .fn()
        .mockResolvedValue({ id: baseDto.recommendationResultId }),
    },
  };
}

function recommendationResultFixture(
  overrides: {
    pack?: Partial<ReturnType<typeof packFixture>>;
    item?: Partial<{
      productIsActive: boolean;
      productStatus: ProductStatus;
      productBasePrice: Prisma.Decimal;
      referenceIsActive: boolean;
      referencePriceOverride: Prisma.Decimal | null;
      referencePriceDelta: Prisma.Decimal;
      stockQuantity: number;
      reservedQuantity: number;
      quantity: number;
      isRequired: boolean;
    }>;
    items?: unknown[];
  } = {},
) {
  const pack = {
    ...packFixture(),
    ...overrides.pack,
  };

  const item = overrides.items ?? [
    {
      id: 'result-item-1',
      quantity: overrides.item?.quantity ?? 1,
      product: {
        id: 'product-1',
        name: 'Foundation X',
        basePrice: overrides.item?.productBasePrice ?? decimal(120),
        compareAtPrice: decimal(159),
        mainImageUrl: 'https://cdn.example/product-main.jpg',
        isActive: overrides.item?.productIsActive ?? true,
        status: overrides.item?.productStatus ?? ProductStatus.ACTIVE,
        brand: {
          name: 'Glow Brand',
        },
        images: [
          {
            media: {
              secureUrl: 'https://cdn.example/product-cover.jpg',
              url: null,
            },
          },
        ],
      },
      selectedProductReference: {
        id: 'reference-1',
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
        shadeName: 'Medium Warm',
        measurement: '30ml',
        sku: 'SKU-RF2',
        priceOverride:
          overrides.item &&
          Object.prototype.hasOwnProperty.call(
            overrides.item,
            'referencePriceOverride',
          )
            ? overrides.item.referencePriceOverride
            : decimal(120),
        priceDelta: overrides.item?.referencePriceDelta ?? decimal(0),
        imageUrl: 'https://cdn.example/reference-legacy.jpg',
        image: {
          media: {
            secureUrl: 'https://cdn.example/ref-medium.jpg',
            url: null,
          },
        },
        stockQuantity: overrides.item?.stockQuantity ?? 10,
        reservedQuantity: overrides.item?.reservedQuantity ?? 0,
        isActive: overrides.item?.referenceIsActive ?? true,
      },
      packItem: {
        isRequired: overrides.item?.isRequired ?? true,
      },
    },
  ];

  return {
    id: baseDto.recommendationResultId,
    packId: pack.id,
    pack,
    recommendationSession: {
      customerProfile: {
        id: 'profile-1',
      },
    },
    items: item,
  };
}

function packFixture() {
  return {
    id: 'pack-1',
    name: 'Natural Glow Pack',
    status: PackStatus.ACTIVE,
    isActive: true,
    priceMode: PriceMode.FIXED,
    fixedPrice: decimal(299),
    discountAmount: null,
    discountPercentage: null,
    currency: 'MAD',
  };
}

function cartProductFixture(
  overrides: Partial<{
    id: string;
    name: string;
    basePrice: Prisma.Decimal;
    currency: string;
    isActive: boolean;
    status: ProductStatus;
  }> = {},
) {
  return {
    id: overrides.id ?? 'product-1',
    name: overrides.name ?? 'Foundation X',
    basePrice: overrides.basePrice ?? decimal(100),
    compareAtPrice: decimal(159),
    mainImageUrl: 'https://cdn.example/product-main.jpg',
    currency: overrides.currency ?? 'MAD',
    isActive: overrides.isActive ?? true,
    status: overrides.status ?? ProductStatus.ACTIVE,
    brand: {
      name: 'Glow Brand',
    },
    images: [
      {
        media: {
          secureUrl: 'https://cdn.example/product-cover.jpg',
          url: null,
        },
      },
    ],
  };
}

function cartReferenceFixture(
  overrides: Partial<{
    id: string;
    productId: string;
    referenceCode: string;
    referenceName: string;
    shadeName: string | null;
    measurement: string | null;
    sku: string | null;
    priceOverride: Prisma.Decimal | null;
    priceDelta: Prisma.Decimal;
    imageUrl: string | null;
    stockQuantity: number;
    reservedQuantity: number;
    isActive: boolean;
  }> = {},
) {
  return {
    id: overrides.id ?? 'reference-1',
    productId: overrides.productId ?? 'product-1',
    referenceCode: overrides.referenceCode ?? 'RF2',
    referenceName: overrides.referenceName ?? 'Medium Warm',
    shadeName: Object.prototype.hasOwnProperty.call(overrides, 'shadeName')
      ? (overrides.shadeName ?? null)
      : 'Medium Warm',
    measurement: Object.prototype.hasOwnProperty.call(overrides, 'measurement')
      ? (overrides.measurement ?? null)
      : '30ml',
    sku: Object.prototype.hasOwnProperty.call(overrides, 'sku')
      ? (overrides.sku ?? null)
      : 'SKU-RF2',
    priceOverride: Object.prototype.hasOwnProperty.call(
      overrides,
      'priceOverride',
    )
      ? (overrides.priceOverride ?? null)
      : decimal(125),
    priceDelta: overrides.priceDelta ?? decimal(0),
    imageUrl: Object.prototype.hasOwnProperty.call(overrides, 'imageUrl')
      ? (overrides.imageUrl ?? null)
      : 'https://cdn.example/reference-legacy.jpg',
    image: {
      media: {
        secureUrl: 'https://cdn.example/ref-medium.jpg',
        url: null,
      },
    },
    stockQuantity: overrides.stockQuantity ?? 10,
    reservedQuantity: overrides.reservedQuantity ?? 0,
    isActive: overrides.isActive ?? true,
  };
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
