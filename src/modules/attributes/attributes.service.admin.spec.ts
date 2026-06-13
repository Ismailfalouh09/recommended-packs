import { BadRequestException, ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AttributesService } from './attributes.service';
import { CreateAttributeGroupDto } from './dto/create-attribute-group.dto';
import { UpdateAttributeGroupDto } from './dto/update-attribute-group.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';

describe('AttributesService admin', () => {
  let prisma: any;
  let service: AttributesService;

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
      attributeGroup: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }) => groupFixture({ ...data })),
        update: jest
          .fn()
          .mockImplementation(({ data }) => groupFixture({ ...data })),
      },
      attributeOption: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn(),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            optionFixture({ ...data, attributeGroup: groupSummary() }),
          ),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            optionFixture({ ...data, attributeGroup: groupSummary() }),
          ),
      },
    };
    service = new AttributesService(prisma);
  });

  it('normalizes group code DTO input', () => {
    const dto = plainToInstance(CreateAttributeGroupDto, {
      code: 'coverage level',
      name: 'Coverage Level',
    });

    expect(dto.code).toBe('COVERAGE_LEVEL');
  });

  it('creates an attribute group', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue(null);

    const result = await service.adminCreateGroup({
      code: 'COVERAGE',
      name: 'Coverage',
      isCustomerAttribute: true,
      isProductAttribute: true,
    });

    expect(result.code).toBe('COVERAGE');
    expect(prisma.attributeGroup.create).toHaveBeenCalled();
  });

  it('rejects duplicate group code', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({ id: 'group-1' });

    await expect(
      service.adminCreateGroup({ code: 'COVERAGE', name: 'Coverage' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not allow group code updates through DTO validation whitelist', async () => {
    const dto = plainToInstance(UpdateAttributeGroupDto, {
      code: 'BROKEN',
      name: 'Updated',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.some((error) => error.property === 'code')).toBe(true);
  });

  it('updates group metadata', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({ id: 'group-1' });

    const result = await service.adminUpdateGroup('group-1', {
      name: 'Coverage Updated',
    });

    expect(result.name).toBe('Coverage Updated');
  });

  it('soft-deactivates groups and public endpoint excludes inactive groups', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({ id: 'group-1' });

    await service.adminDeactivateGroup('group-1');

    expect(prisma.attributeGroup.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );

    await service.findAll();
    expect(prisma.attributeGroup.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it('creates an attribute option', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      isActive: true,
    });
    prisma.attributeOption.findUnique.mockResolvedValue(null);

    const result = await service.adminCreateOption('group-1', {
      code: 'FULL',
      label: 'Full',
    });

    expect(result.code).toBe('FULL');
    expect(prisma.attributeOption.create).toHaveBeenCalled();
  });

  it('rejects duplicate option code inside group', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      isActive: true,
    });
    prisma.attributeOption.findUnique.mockResolvedValue({ id: 'option-1' });

    await expect(
      service.adminCreateOption('group-1', { code: 'FULL', label: 'Full' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows same option code in another group when schema permits it', async () => {
    prisma.attributeGroup.findUnique.mockResolvedValue({
      id: 'group-2',
      isActive: true,
    });
    prisma.attributeOption.findUnique.mockResolvedValue(null);

    await service.adminCreateOption('group-2', { code: 'FULL', label: 'Full' });

    expect(prisma.attributeOption.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          attributeGroupId_code: {
            attributeGroupId: 'group-2',
            code: 'FULL',
          },
        },
      }),
    );
  });

  it('does not allow option code or group updates through DTO validation whitelist', async () => {
    const dto = plainToInstance(UpdateAttributeOptionDto, {
      code: 'BROKEN',
      attributeGroupId: 'group-2',
      label: 'Updated',
    });

    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['code', 'attributeGroupId']),
    );
  });

  it('rejects activating an option under inactive group', async () => {
    prisma.attributeOption.findUnique.mockResolvedValue({
      id: 'option-1',
      attributeGroup: { isActive: false },
    });

    await expect(
      service.adminUpdateOption('option-1', { isActive: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('soft-deactivates options and public endpoint excludes inactive options', async () => {
    prisma.attributeOption.findUnique.mockResolvedValue({ id: 'option-1' });

    await service.adminDeactivateOption('option-1');

    expect(prisma.attributeOption.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    expect(prisma.attributeOption.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delete: expect.anything() }),
      }),
    );

    prisma.attributeGroup.findUnique.mockResolvedValue({
      id: 'group-1',
      code: 'COVERAGE',
      name: 'Coverage',
      isActive: true,
      options: [],
    });
    await service.findOptionsByCode('COVERAGE');
    expect(prisma.attributeGroup.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          options: expect.objectContaining({ where: { isActive: true } }),
        }),
      }),
    );
  });
});

function groupSummary() {
  return { id: 'group-1', code: 'COVERAGE', name: 'Coverage', isActive: true };
}

function groupFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    code: 'COVERAGE',
    name: 'Coverage',
    description: null,
    isCustomerAttribute: true,
    isProductAttribute: true,
    sortOrder: 1,
    isActive: true,
    createdAt: new Date('2026-06-12T00:00:00.000Z'),
    updatedAt: new Date('2026-06-12T00:00:00.000Z'),
    _count: {
      options: 0,
      quizQuestions: 0,
      productReferenceAttributes: 0,
      packAttributes: 0,
      recommendationRules: 0,
    },
    options: [],
    ...overrides,
  };
}

function optionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'option-1',
    attributeGroupId: 'group-1',
    code: 'FULL',
    label: 'Full',
    description: null,
    imageUrl: null,
    sortOrder: 1,
    isActive: true,
    attributeGroup: groupSummary(),
    _count: {
      quizQuestionOptions: 0,
      customerProfileAnswers: 1,
      productReferenceAttributes: 0,
      packAttributes: 0,
    },
    ...overrides,
  };
}
