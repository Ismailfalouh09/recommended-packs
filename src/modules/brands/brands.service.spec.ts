import { ConflictException } from '@nestjs/common';
import { BrandsService } from './brands.service';

describe('BrandsService', () => {
  let prisma: any;
  let service: BrandsService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      brand: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          brandFixture({
            ...data,
            _count: { products: 0 },
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          brandFixture({
            ...data,
            _count: { products: 0 },
          }),
        ),
      },
    };
    service = new BrandsService(prisma);
  });

  it('creates a brand', async () => {
    prisma.brand.findFirst.mockResolvedValue(null);

    const result = await service.create({ name: 'Demo Beauty' });

    expect(result.name).toBe('Demo Beauty');
    expect(prisma.brand.create).toHaveBeenCalled();
  });

  it('rejects duplicate brand names case-insensitively', async () => {
    prisma.brand.findFirst.mockResolvedValue({ id: 'brand-1' });

    await expect(
      service.create({ name: 'demo beauty' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a brand', async () => {
    prisma.brand.findUnique.mockResolvedValue({ id: 'brand-1' });
    prisma.brand.findFirst.mockResolvedValue(null);

    const result = await service.update('brand-1', { name: 'Updated Beauty' });

    expect(result.name).toBe('Updated Beauty');
  });

  it('soft-deactivates a brand', async () => {
    prisma.brand.findUnique.mockResolvedValue({ id: 'brand-1' });

    await service.deactivate('brand-1');

    expect(prisma.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });
});

function brandFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'brand-1',
    name: 'Demo Beauty',
    description: null,
    logoUrl: null,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    _count: { products: 0 },
    ...overrides,
  };
}
