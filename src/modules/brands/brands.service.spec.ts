import { ConflictException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminRole } from '@prisma/client';
import { validateRoleAccess } from '../../test-utils/role-test.util';
import { AdminBrandsController } from './admin-brands.controller';
import { BrandsController } from './brands.controller';
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

  it('returns active public brands only', async () => {
    prisma.brand.findMany.mockResolvedValue([
      brandFixture({
        description: 'Clean beauty essentials',
        logoUrl: 'https://example.com/demo-beauty-logo.png',
        _count: { products: 3 },
      }),
    ]);

    const result = await service.publicFindAll();

    expect(result).toEqual([
      {
        id: 'brand-1',
        name: 'Demo Beauty',
        description: 'Clean beauty essentials',
        logoUrl: 'https://example.com/demo-beauty-logo.png',
        productCount: 3,
      },
    ]);
    expect(prisma.brand.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ name: 'asc' }],
      }),
    );
  });

  it('exposes only store-safe fields in public brand responses', async () => {
    prisma.brand.findMany.mockResolvedValue([
      brandFixture({
        description: 'Clean beauty essentials',
        logoUrl: null,
        _count: { products: 1 },
      }),
    ]);

    const [brand] = await service.publicFindAll();

    expect(brand).toEqual({
      id: 'brand-1',
      name: 'Demo Beauty',
      description: 'Clean beauty essentials',
      logoUrl: null,
      productCount: 1,
    });
    expect(brand).not.toHaveProperty('isActive');
    expect(brand).not.toHaveProperty('createdAt');
    expect(brand).not.toHaveProperty('updatedAt');
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

  it('keeps public brands route unguarded', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BrandsController);

    expect(guards).toBeUndefined();
  });

  it('keeps admin brands guarded', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminBrandsController);

    expect(guards).toEqual(expect.arrayContaining([expect.any(Function)]));
    expect(guards).toHaveLength(2);
  });

  it('keeps STAFF read-only through role policy', () => {
    expect(
      validateRoleAccess([AdminRole.OWNER, AdminRole.ADMIN], AdminRole.STAFF),
    ).toBe(false);
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
