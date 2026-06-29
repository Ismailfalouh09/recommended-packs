import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { OrdersService } from './orders.service';

describe('OrdersService admin reads and public safety', () => {
  let prisma: any;
  let orderStockService: any;
  let service: OrdersService;

  beforeEach(() => {
    orderStockService = {
      reserveForNewOrder: jest.fn(),
    };
    prisma = {
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      recommendationResult: { findUnique: jest.fn() },
      order: {
        findMany: jest.fn().mockResolvedValue([orderListFixture()]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn(),
      },
    };
    service = new OrdersService(prisma, orderStockService);
  });

  it('returns paginated admin order list with decimal serialization', async () => {
    const result = await service.adminFindAll({ page: 1, pageSize: 20 });

    expect(result.pagination.totalItems).toBe(1);
    expect(result.data[0].totalAmount).toBe(299);
  });

  it('searches by order number, customer name, or phone', async () => {
    await service.adminFindAll({ search: 'Sara' });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ orderNumber: expect.any(Object) }),
            expect.objectContaining({ customer: expect.any(Object) }),
          ]),
        }),
      }),
    );
  });

  it('filters by status, payment status, date range, and amount', async () => {
    await service.adminFindAll({
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      createdFrom: '2026-06-01T00:00:00.000Z',
      createdTo: '2026-06-30T00:00:00.000Z',
      minTotal: 100,
      maxTotal: 400,
    });

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          orderStatus: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          createdAt: expect.objectContaining({
            gte: new Date('2026-06-01T00:00:00.000Z'),
            lte: new Date('2026-06-30T00:00:00.000Z'),
          }),
          totalAmount: { gte: 100, lte: 400 },
        }),
      }),
    );
  });

  it('rejects invalid date range', async () => {
    await expect(
      service.adminFindAll({
        createdFrom: '2026-06-30T00:00:00.000Z',
        createdTo: '2026-06-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invalid amount range', async () => {
    await expect(
      service.adminFindAll({ minTotal: 500, maxTotal: 100 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns complete admin order details with chronological history', async () => {
    prisma.order.findUnique.mockResolvedValue(orderDetailFixture());

    const result = await service.adminFindOne('order-1');

    expect(result.customer.phone).toBe('0600000000');
    expect(result.address.addressLine).toBe('Maarif');
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        productName: 'Foundation X',
        referenceName: 'RF2 Medium Warm',
        sku: 'SKU-RF2',
        variation: 'Medium Warm / 30ml',
        imageUrl: 'https://cdn.example/ref-medium.jpg',
        brandName: 'Glow Brand',
        originalUnitPrice: 159,
      }),
    );
    expect(result.statusHistory).toHaveLength(2);
    expect(result.statusHistory[1].changedByAdmin).toEqual({
      id: 'admin-1',
      fullName: 'Store Owner',
    });
  });

  it('does not expose passwordHash in admin details', async () => {
    prisma.order.findUnique.mockResolvedValue(orderDetailFixture());

    const result = await service.adminFindOne('order-1');

    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('throws NotFound for missing admin order details', async () => {
    prisma.order.findUnique.mockResolvedValue(null);

    await expect(service.adminFindOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('public GET /orders/:id returns limited safe summary', async () => {
    prisma.order.findUnique.mockResolvedValue(publicOrderFixture());

    const result = await service.findOne('order-1');

    expect(result).toEqual({
      orderId: 'order-1',
      orderNumber: 'ORD-20260612-ABC123',
      orderStatus: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      totalAmount: 299,
      currency: 'MAD',
      packName: 'Natural Glow Pack',
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(JSON.stringify(result)).not.toContain('0600000000');
    expect(JSON.stringify(result)).not.toContain('Maarif');
    expect(JSON.stringify(result)).not.toContain('private note');
  });
});

function orderListFixture() {
  return {
    id: 'order-1',
    orderNumber: 'ORD-20260612-ABC123',
    orderStatus: OrderStatus.PENDING_CONFIRMATION,
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    paymentStatus: PaymentStatus.UNPAID,
    totalAmount: decimal(299),
    currency: 'MAD',
    customer: { id: 'customer-1', fullName: 'Sara', phone: '0600000000' },
    customerAddress: { city: 'Casablanca' },
    selectedPack: { id: 'pack-1', name: 'Natural Glow Pack' },
    _count: { items: 3 },
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
  };
}

function publicOrderFixture() {
  return {
    id: 'order-1',
    orderNumber: 'ORD-20260612-ABC123',
    orderStatus: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.UNPAID,
    totalAmount: decimal(299),
    currency: 'MAD',
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    selectedPack: { name: 'Natural Glow Pack' },
  };
}

function orderDetailFixture() {
  return {
    ...publicOrderFixture(),
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    subtotalAmount: decimal(299),
    discountAmount: decimal(0),
    deliveryFee: decimal(0),
    notes: 'private note',
    customer: {
      id: 'customer-1',
      fullName: 'Sara',
      phone: '0600000000',
      whatsappPhone: '0600000000',
      email: null,
    },
    customerAddress: {
      id: 'address-1',
      city: 'Casablanca',
      addressLine: 'Maarif',
      extraInfo: 'Near pharmacy',
      isDefault: true,
    },
    customerProfile: {
      id: 'profile-1',
      sourceChannel: 'INSTAGRAM',
    },
    selectedPack: {
      id: 'pack-1',
      name: 'Natural Glow Pack',
      slug: 'natural-glow-pack',
    },
    recommendationResult: {
      id: 'result-1',
      rank: 1,
      totalScore: 90,
      matchPercentage: decimal(95),
    },
    items: [
      {
        id: 'item-1',
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
        totalPrice: decimal(120),
      },
    ],
    statusHistory: [
      {
        id: 'history-1',
        oldStatus: null,
        newStatus: OrderStatus.PENDING_CONFIRMATION,
        comment: 'Order created',
        changedByAdmin: null,
        createdAt: new Date('2026-06-12T00:00:00.000Z'),
      },
      {
        id: 'history-2',
        oldStatus: OrderStatus.PENDING_CONFIRMATION,
        newStatus: OrderStatus.CONFIRMED,
        comment: 'Confirmed',
        changedByAdmin: { id: 'admin-1', fullName: 'Store Owner' },
        createdAt: new Date('2026-06-12T01:00:00.000Z'),
      },
    ],
  };
}

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
