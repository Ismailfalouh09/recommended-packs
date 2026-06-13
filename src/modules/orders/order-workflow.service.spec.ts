import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { OrderWorkflowService } from './order-workflow.service';

const admin = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'OWNER' as any,
};

describe('OrderWorkflowService', () => {
  let prisma: any;
  let tx: any;
  let service: OrderWorkflowService;

  beforeEach(() => {
    tx = {
      order: {
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({ id: 'history-1' }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback: (transaction: unknown) => unknown) =>
        callback(tx),
      ),
    };
    service = new OrderWorkflowService(prisma);
  });

  it.each([
    [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CONFIRMED],
    [OrderStatus.PENDING_CONFIRMATION, OrderStatus.CANCELED],
    [OrderStatus.CONFIRMED, OrderStatus.PREPARING],
    [OrderStatus.PREPARING, OrderStatus.SHIPPED],
    [OrderStatus.SHIPPED, OrderStatus.DELIVERED],
    [OrderStatus.SHIPPED, OrderStatus.RETURNED],
    [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  ])('allows %s to %s', async (from, to) => {
    mockOrder(from, PaymentStatus.UNPAID);

    await service.updateStatus('order-1', { status: to }, admin);

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1', orderStatus: from },
        data: expect.objectContaining({ orderStatus: to }),
      }),
    );
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          oldStatus: from,
          newStatus: to,
          changedByAdminId: admin.id,
        }),
      }),
    );
  });

  it.each([
    [OrderStatus.PENDING_CONFIRMATION, OrderStatus.SHIPPED],
    [OrderStatus.CONFIRMED, OrderStatus.PENDING_CONFIRMATION],
    [OrderStatus.DELIVERED, OrderStatus.PREPARING],
    [OrderStatus.CANCELED, OrderStatus.CONFIRMED],
    [OrderStatus.RETURNED, OrderStatus.CONFIRMED],
    [OrderStatus.CONFIRMED, OrderStatus.CONFIRMED],
  ])('rejects invalid transition %s to %s', async (from, to) => {
    mockOrder(from, PaymentStatus.UNPAID);

    await expect(
      service.updateStatus('order-1', { status: to }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('marks delivered COD orders as paid', async () => {
    mockOrder(OrderStatus.SHIPPED, PaymentStatus.UNPAID);

    await service.updateStatus(
      'order-1',
      { status: OrderStatus.DELIVERED },
      admin,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
      }),
    );
  });

  it('keeps canceled unpaid orders unpaid', async () => {
    mockOrder(OrderStatus.CONFIRMED, PaymentStatus.UNPAID);

    await service.updateStatus(
      'order-1',
      { status: OrderStatus.CANCELED },
      admin,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: PaymentStatus.UNPAID }),
      }),
    );
  });

  it('does not allow paid orders to be canceled', async () => {
    mockOrder(OrderStatus.CONFIRMED, PaymentStatus.PAID);

    await expect(
      service.updateStatus('order-1', { status: OrderStatus.CANCELED }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('marks returned paid orders as refunded', async () => {
    mockOrder(OrderStatus.DELIVERED, PaymentStatus.PAID);

    await service.updateStatus(
      'order-1',
      { status: OrderStatus.RETURNED },
      admin,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: PaymentStatus.REFUNDED,
        }),
      }),
    );
  });

  it('keeps returned unpaid orders unpaid', async () => {
    mockOrder(OrderStatus.SHIPPED, PaymentStatus.UNPAID);

    await service.updateStatus(
      'order-1',
      { status: OrderStatus.RETURNED },
      admin,
    );

    expect(tx.order.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentStatus: PaymentStatus.UNPAID }),
      }),
    );
  });

  it('stores custom comments and payment automation notes', async () => {
    mockOrder(OrderStatus.SHIPPED, PaymentStatus.UNPAID);

    await service.updateStatus(
      'order-1',
      { status: OrderStatus.DELIVERED, comment: 'Delivered by courier' },
      admin,
    );

    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          comment:
            'Delivered by courier Order delivered. COD payment marked as PAID.',
        }),
      }),
    );
  });

  it('throws conflict on stale current status without history write', async () => {
    mockOrder(OrderStatus.CONFIRMED, PaymentStatus.UNPAID);
    tx.order.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.updateStatus('order-1', { status: OrderStatus.PREPARING }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.orderStatusHistory.create).not.toHaveBeenCalled();
  });

  it('throws NotFound for missing order', async () => {
    tx.order.findUnique.mockResolvedValue(null);

    await expect(
      service.updateStatus('missing', { status: OrderStatus.CONFIRMED }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  function mockOrder(orderStatus: OrderStatus, paymentStatus: PaymentStatus) {
    tx.order.findUnique
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNumber: 'ORD-20260612-ABC123',
        orderStatus,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus,
        totalAmount: decimal(299),
        currency: 'MAD',
      })
      .mockResolvedValueOnce({
        id: 'order-1',
        orderNumber: 'ORD-20260612-ABC123',
        orderStatus,
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus,
        totalAmount: decimal(299),
        currency: 'MAD',
        updatedAt: new Date('2026-06-12T00:00:00.000Z'),
      });
  }
});

function decimal(value: Prisma.Decimal.Value): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
