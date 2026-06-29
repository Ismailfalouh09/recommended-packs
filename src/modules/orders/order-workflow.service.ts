import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStockService } from './order-stock.service';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_CONFIRMATION]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELED,
  ],
  [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.RETURNED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURNED],
  [OrderStatus.CANCELED]: [],
  [OrderStatus.RETURNED]: [],
};

@Injectable()
export class OrderWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderStockService: OrderStockService,
  ) {}

  async updateStatus(
    orderId: string,
    dto: UpdateOrderStatusDto,
    currentAdmin: CurrentAdmin,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentMethod: true,
          paymentStatus: true,
          totalAmount: true,
          currency: true,
          items: {
            select: {
              productReferenceId: true,
              referenceNameSnapshot: true,
              quantity: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order ${orderId} was not found.`);
      }

      this.validateTransition(order.orderStatus, dto.status);
      const paymentStatus = this.nextPaymentStatus(
        order.paymentMethod,
        order.paymentStatus,
        dto.status,
      );
      const comment = this.historyComment(dto.comment, dto.status, {
        before: order.paymentStatus,
        after: paymentStatus,
      });

      const updateResult = await tx.order.updateMany({
        where: {
          id: order.id,
          orderStatus: order.orderStatus,
        },
        data: {
          orderStatus: dto.status,
          paymentStatus,
        },
      });

      if (updateResult.count !== 1) {
        throw new ConflictException(
          'Order status changed before this update could be applied.',
        );
      }

      await this.applyStockTransition(
        tx,
        order.orderStatus,
        dto.status,
        order.items,
      );

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          oldStatus: order.orderStatus,
          newStatus: dto.status,
          changedByAdminId: currentAdmin.id,
          comment,
        },
      });

      const updated = await tx.order.findUnique({
        where: { id: order.id },
        select: {
          id: true,
          orderNumber: true,
          orderStatus: true,
          paymentMethod: true,
          paymentStatus: true,
          totalAmount: true,
          currency: true,
          updatedAt: true,
        },
      });

      if (!updated) {
        throw new NotFoundException(`Order ${orderId} was not found.`);
      }

      return {
        id: updated.id,
        orderNumber: updated.orderNumber,
        orderStatus: updated.orderStatus,
        paymentMethod: updated.paymentMethod,
        paymentStatus: updated.paymentStatus,
        totalAmount: toMoneyNumber(updated.totalAmount),
        currency: updated.currency,
        updatedAt: updated.updatedAt,
      };
    });
  }

  private validateTransition(current: OrderStatus, next: OrderStatus) {
    if (current === next) {
      throw new BadRequestException(
        'Order is already in the requested status.',
      );
    }

    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new BadRequestException(
        `Cannot transition order from ${current} to ${next}.`,
      );
    }
  }

  private nextPaymentStatus(
    paymentMethod: PaymentMethod,
    currentPaymentStatus: PaymentStatus,
    nextOrderStatus: OrderStatus,
  ): PaymentStatus {
    if (
      nextOrderStatus === OrderStatus.CANCELED &&
      currentPaymentStatus === PaymentStatus.PAID
    ) {
      throw new BadRequestException(
        'Paid orders cannot be canceled through the normal status workflow.',
      );
    }

    if (
      nextOrderStatus === OrderStatus.DELIVERED &&
      paymentMethod === PaymentMethod.CASH_ON_DELIVERY
    ) {
      return PaymentStatus.PAID;
    }

    if (
      nextOrderStatus === OrderStatus.RETURNED &&
      currentPaymentStatus === PaymentStatus.PAID
    ) {
      return PaymentStatus.REFUNDED;
    }

    return currentPaymentStatus;
  }

  private async applyStockTransition(
    tx: Prisma.TransactionClient,
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
    items: {
      productReferenceId: string;
      referenceNameSnapshot: string;
      quantity: number;
    }[],
  ) {
    if (nextStatus === OrderStatus.CANCELED) {
      await this.orderStockService.releaseReserved(tx, items);
      return;
    }

    if (nextStatus === OrderStatus.DELIVERED) {
      await this.orderStockService.finalizeReservedAsDelivered(tx, items);
      return;
    }

    if (nextStatus === OrderStatus.RETURNED) {
      if (currentStatus === OrderStatus.DELIVERED) {
        await this.orderStockService.restoreDelivered(tx, items);
      } else {
        await this.orderStockService.releaseReserved(tx, items);
      }
    }
  }

  private historyComment(
    comment: string | undefined,
    nextOrderStatus: OrderStatus,
    paymentChange: { before: PaymentStatus; after: PaymentStatus },
  ) {
    const parts = [comment?.trim()].filter(Boolean) as string[];

    if (paymentChange.before !== paymentChange.after) {
      if (nextOrderStatus === OrderStatus.DELIVERED) {
        parts.push('Order delivered. COD payment marked as PAID.');
      } else if (nextOrderStatus === OrderStatus.RETURNED) {
        parts.push('Order returned. Payment status marked as REFUNDED.');
      }
    }

    return parts.length > 0 ? parts.join(' ') : null;
  }
}

export { ALLOWED_TRANSITIONS };
