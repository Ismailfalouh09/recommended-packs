import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface OrderStockLine {
  productReferenceId: string;
  referenceNameSnapshot: string;
  quantity: number;
}

@Injectable()
export class OrderStockService {
  async reserveForNewOrder(
    tx: Prisma.TransactionClient,
    lines: OrderStockLine[],
  ) {
    for (const line of this.groupLines(lines)) {
      const updated = await tx.$executeRaw`
        UPDATE "product_references" pr
        SET "reserved_quantity" = pr."reserved_quantity" + ${line.quantity},
            "updated_at" = NOW()
        WHERE pr."id" = ${line.productReferenceId}::uuid
          AND pr."is_active" = true
          AND (pr."stock_quantity" - pr."reserved_quantity") >= ${line.quantity}
          AND EXISTS (
            SELECT 1
            FROM "products" p
            WHERE p."id" = pr."product_id"
              AND p."is_active" = true
              AND p."status" = 'ACTIVE'::"ProductStatus"
          )
      `;

      if (updated !== 1) {
        throw new BadRequestException(
          `Selected reference ${line.referenceNameSnapshot} is inactive or does not have enough available stock.`,
        );
      }
    }
  }

  async releaseReserved(tx: Prisma.TransactionClient, lines: OrderStockLine[]) {
    for (const line of this.groupLines(lines)) {
      const updated = await tx.$executeRaw`
        UPDATE "product_references" pr
        SET "reserved_quantity" = pr."reserved_quantity" - ${line.quantity},
            "updated_at" = NOW()
        WHERE pr."id" = ${line.productReferenceId}::uuid
          AND pr."reserved_quantity" >= ${line.quantity}
      `;

      if (updated !== 1) {
        throw new ConflictException(
          `Reserved stock for ${line.referenceNameSnapshot} could not be released safely.`,
        );
      }
    }
  }

  async finalizeReservedAsDelivered(
    tx: Prisma.TransactionClient,
    lines: OrderStockLine[],
  ) {
    for (const line of this.groupLines(lines)) {
      const updated = await tx.$executeRaw`
        UPDATE "product_references" pr
        SET "stock_quantity" = pr."stock_quantity" - ${line.quantity},
            "reserved_quantity" = pr."reserved_quantity" - ${line.quantity},
            "updated_at" = NOW()
        WHERE pr."id" = ${line.productReferenceId}::uuid
          AND pr."stock_quantity" >= ${line.quantity}
          AND pr."reserved_quantity" >= ${line.quantity}
      `;

      if (updated !== 1) {
        throw new ConflictException(
          `Reserved stock for ${line.referenceNameSnapshot} could not be finalized safely.`,
        );
      }
    }
  }

  async restoreDelivered(
    tx: Prisma.TransactionClient,
    lines: OrderStockLine[],
  ) {
    for (const line of this.groupLines(lines)) {
      const updated = await tx.$executeRaw`
        UPDATE "product_references" pr
        SET "stock_quantity" = pr."stock_quantity" + ${line.quantity},
            "updated_at" = NOW()
        WHERE pr."id" = ${line.productReferenceId}::uuid
      `;

      if (updated !== 1) {
        throw new ConflictException(
          `Delivered stock for ${line.referenceNameSnapshot} could not be restored safely.`,
        );
      }
    }
  }

  private groupLines(lines: OrderStockLine[]): OrderStockLine[] {
    const grouped = new Map<string, OrderStockLine>();

    for (const line of lines) {
      const existing = grouped.get(line.productReferenceId);

      if (existing) {
        existing.quantity += line.quantity;
      } else {
        grouped.set(line.productReferenceId, { ...line });
      }
    }

    return [...grouped.values()];
  }
}
