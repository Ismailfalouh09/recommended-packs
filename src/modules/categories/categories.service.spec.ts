import { ConflictException, NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminRole } from '@prisma/client';
import { validateRoleAccess } from '../../test-utils/role-test.util';
import { AdminCategoriesController } from './admin-categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let prisma: any;
  let service: CategoriesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      category: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest.fn().mockImplementation(({ data }) =>
          categoryFixture({
            ...data,
            _count: { products: 0, children: 0 },
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          categoryFixture({
            ...data,
            _count: { products: 0, children: 0 },
          }),
        ),
      },
    };
    service = new CategoriesService(prisma);
  });

  it('creates a valid category', async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    const result = await service.create({
      code: 'FOUNDATION',
      name: 'Foundation',
      sortOrder: 1,
    });

    expect(result.code).toBe('FOUNDATION');
    expect(prisma.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'FOUNDATION',
          name: 'Foundation',
          isActive: true,
        }),
      }),
    );
  });

  it('returns active public categories only', async () => {
    prisma.category.findMany.mockResolvedValue([
      categoryFixture({
        description: 'Complexion basics',
        sortOrder: 1,
        image: null,
        _count: { products: 2, children: 1 },
      }),
    ]);

    const result = await service.publicFindAll();

    expect(result).toEqual([
      {
        id: 'category-1',
        code: 'FOUNDATION',
        name: 'Foundation',
        description: 'Complexion basics',
        image: null,
        sortOrder: 1,
        productCount: 2,
        childCategoryCount: 1,
      },
    ]);
    expect(prisma.category.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    );
  });

  it('rejects duplicate category code', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'existing-category' });

    await expect(
      service.create({ code: 'FOUNDATION', name: 'Foundation' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects an invalid parent', async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    await expect(
      service.create({
        code: 'FACE',
        name: 'Face',
        parentId: 'missing-parent',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects circular parent updates', async () => {
    prisma.category.findUnique
      .mockResolvedValueOnce({ id: 'category-1' })
      .mockResolvedValueOnce({ id: 'child-1' })
      .mockResolvedValueOnce({ parentId: 'category-1' });

    await expect(
      service.update('category-1', { parentId: 'child-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates a category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'category-1' });

    const result = await service.update('category-1', { name: 'Face Makeup' });

    expect(result.name).toBe('Face Makeup');
    expect(prisma.category.update).toHaveBeenCalled();
  });

  it('soft-deactivates a category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'category-1' });

    await service.deactivate('category-1');

    expect(prisma.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { isActive: false },
      }),
    );
  });

  it('keeps STAFF read-only through role policy', () => {
    expect(
      validateRoleAccess([AdminRole.OWNER, AdminRole.ADMIN], AdminRole.STAFF),
    ).toBe(false);
  });

  it('keeps admin categories guarded', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AdminCategoriesController,
    );

    expect(guards).toEqual(expect.arrayContaining([expect.any(Function)]));
    expect(guards).toHaveLength(2);
  });
});

function categoryFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'category-1',
    parentId: null,
    code: 'FOUNDATION',
    name: 'Foundation',
    description: null,
    imageUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    parent: null,
    _count: { products: 0, children: 0 },
    ...overrides,
  };
}
