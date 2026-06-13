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

describe('OrdersService', () => {
  let prisma: any;
  let tx: any;
  let service: OrdersService;

  beforeEach(() => {
    tx = createTransactionMock();
    prisma = {
      recommendationResult: {
        findUnique: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new OrdersService(prisma);
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
          quantity: 1,
        }),
      ],
    });
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
    order: {
      create: jest.fn().mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-20260612-ABC123',
        orderStatus: OrderStatus.PENDING_CONFIRMATION,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.UNPAID,
        subtotalAmount: decimal(299),
        discountAmount: decimal(0),
        deliveryFee: decimal(0),
        totalAmount: decimal(299),
        currency: 'MAD',
      }),
    },
    orderItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    orderStatusHistory: {
      create: jest.fn().mockResolvedValue({ id: 'history-1' }),
    },
    recommendationResult: {
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
        isActive: overrides.item?.productIsActive ?? true,
        status: overrides.item?.productStatus ?? ProductStatus.ACTIVE,
      },
      selectedProductReference: {
        id: 'reference-1',
        referenceCode: 'RF2',
        referenceName: 'Medium Warm',
        priceOverride:
          overrides.item &&
          Object.prototype.hasOwnProperty.call(
            overrides.item,
            'referencePriceOverride',
          )
            ? overrides.item.referencePriceOverride
            : decimal(120),
        priceDelta: overrides.item?.referencePriceDelta ?? decimal(0),
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

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
