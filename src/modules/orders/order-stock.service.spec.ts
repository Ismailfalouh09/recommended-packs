import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStockService } from './order-stock.service';

describe('OrderStockService', () => {
  let tx: any;
  let service: OrderStockService;

  beforeEach(() => {
    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    service = new OrderStockService();
  });

  it('reserves grouped reference stock with one guarded write per reference', async () => {
    await service.reserveForNewOrder(tx, [
      stockLine({ quantity: 1 }),
      stockLine({ quantity: 2 }),
    ]);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a concurrent oversell when the guarded reserve updates no row', async () => {
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      service.reserveForNewOrder(tx, [stockLine({ quantity: 2 })]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('releases reserved stock for canceled orders', async () => {
    await service.releaseReserved(tx, [stockLine({ quantity: 1 })]);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('fails release safely when reserved stock has already changed', async () => {
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      service.releaseReserved(tx, [stockLine({ quantity: 1 })]),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('finalizes reserved stock on delivery', async () => {
    await service.finalizeReservedAsDelivered(tx, [stockLine({ quantity: 1 })]);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('restores delivered stock on returned delivered orders', async () => {
    await service.restoreDelivered(tx, [stockLine({ quantity: 1 })]);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});

function stockLine(overrides: Partial<{ quantity: number }> = {}) {
  return {
    productReferenceId: 'reference-1',
    referenceNameSnapshot: 'RF2 Medium Warm',
    quantity: overrides.quantity ?? 1,
  };
}
