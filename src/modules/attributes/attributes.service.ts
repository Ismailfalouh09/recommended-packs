import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttributeGroupDto } from './dto/create-attribute-group.dto';
import { CreateAttributeOptionDto } from './dto/create-attribute-option.dto';
import { QueryAttributeGroupsDto } from './dto/query-attribute-groups.dto';
import { QueryAttributeOptionsDto } from './dto/query-attribute-options.dto';
import { UpdateAttributeGroupDto } from './dto/update-attribute-group.dto';
import { UpdateAttributeOptionDto } from './dto/update-attribute-option.dto';

@Injectable()
export class AttributesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const groups = await this.prisma.attributeGroup.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        options: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    return groups;
  }

  async findOptionsByCode(code: string) {
    const group = await this.prisma.attributeGroup.findUnique({
      where: { code: code.toUpperCase() },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
        options: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    if (!group || !group.isActive) {
      throw new NotFoundException(`Attribute group ${code} was not found.`);
    }

    return group.options;
  }

  async adminFindGroups(query: QueryAttributeGroupsDto) {
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'sortOrder';
    const sortOrder = query.sortOrder ?? 'asc';
    const where: Prisma.AttributeGroupWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.isCustomerAttribute !== undefined
        ? { isCustomerAttribute: query.isCustomerAttribute }
        : {}),
      ...(query.isProductAttribute !== undefined
        ? { isProductAttribute: query.isProductAttribute }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [groups, totalItems] = await this.prisma.$transaction([
      this.prisma.attributeGroup.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }, { name: 'asc' }],
        select: this.adminGroupListSelect(),
      }),
      this.prisma.attributeGroup.count({ where }),
    ]);

    return paginatedResponse(
      groups.map((group) => this.toAdminGroupListResponse(group)),
      { ...pagination, totalItems },
    );
  }

  async adminFindGroup(id: string) {
    const group = await this.prisma.attributeGroup.findUnique({
      where: { id },
      select: {
        ...this.adminGroupListSelect(),
        options: {
          orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
          select: {
            id: true,
            code: true,
            label: true,
            description: true,
            imageUrl: true,
            sortOrder: true,
            isActive: true,
          },
        },
        quizQuestions: {
          orderBy: [{ stepOrder: 'asc' }],
          select: {
            id: true,
            questionText: true,
            isActive: true,
            stepOrder: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException(`Attribute group ${id} was not found.`);
    }

    return {
      ...this.toAdminGroupListResponse(group),
      options: group.options,
      quizQuestions: group.quizQuestions,
      productReferenceAttributeUsageCount:
        group._count.productReferenceAttributes,
      packAttributeUsageCount: group._count.packAttributes,
      recommendationRuleUsageCount: group._count.recommendationRules,
    };
  }

  async adminCreateGroup(dto: CreateAttributeGroupDto) {
    await this.ensureUniqueGroupCode(dto.code);

    const group = await this.prisma.attributeGroup.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isCustomerAttribute: dto.isCustomerAttribute ?? false,
        isProductAttribute: dto.isProductAttribute ?? false,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: this.adminGroupListSelect(),
    });

    return this.toAdminGroupListResponse(group);
  }

  async adminUpdateGroup(id: string, dto: UpdateAttributeGroupDto) {
    await this.ensureGroupExists(id);

    const group = await this.prisma.attributeGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ?? null }
          : {}),
        ...(dto.isCustomerAttribute !== undefined
          ? { isCustomerAttribute: dto.isCustomerAttribute }
          : {}),
        ...(dto.isProductAttribute !== undefined
          ? { isProductAttribute: dto.isProductAttribute }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.adminGroupListSelect(),
    });

    return this.toAdminGroupListResponse(group);
  }

  async adminDeactivateGroup(id: string) {
    await this.ensureGroupExists(id);

    const group = await this.prisma.attributeGroup.update({
      where: { id },
      data: { isActive: false },
      select: this.adminGroupListSelect(),
    });

    return this.toAdminGroupListResponse(group);
  }

  async adminFindOptions(
    attributeGroupId: string,
    query: QueryAttributeOptionsDto,
  ) {
    await this.ensureGroupExists(attributeGroupId);

    const pagination = paginationParams(query);
    const where: Prisma.AttributeOptionWhereInput = {
      attributeGroupId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { label: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [options, totalItems] = await this.prisma.$transaction([
      this.prisma.attributeOption.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: this.adminOptionSelect(false),
      }),
      this.prisma.attributeOption.count({ where }),
    ]);

    return paginatedResponse(
      options.map((option) => this.toAdminOptionResponse(option)),
      { ...pagination, totalItems },
    );
  }

  async adminFindOption(id: string) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id },
      select: this.adminOptionSelect(true),
    });

    if (!option) {
      throw new NotFoundException(`Attribute option ${id} was not found.`);
    }

    return this.toAdminOptionResponse(option);
  }

  async adminCreateOption(
    attributeGroupId: string,
    dto: CreateAttributeOptionDto,
  ) {
    const group = await this.prisma.attributeGroup.findUnique({
      where: { id: attributeGroupId },
      select: { id: true, isActive: true },
    });

    if (!group) {
      throw new NotFoundException(
        `Attribute group ${attributeGroupId} was not found.`,
      );
    }

    if ((dto.isActive ?? true) && !group.isActive) {
      throw new BadRequestException(
        'Active option cannot be created under an inactive group.',
      );
    }

    await this.ensureUniqueOptionCode(attributeGroupId, dto.code);

    const option = await this.prisma.attributeOption.create({
      data: {
        attributeGroupId,
        code: dto.code,
        label: dto.label,
        description: dto.description ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: this.adminOptionSelect(true),
    });

    return this.toAdminOptionResponse(option);
  }

  async adminUpdateOption(id: string, dto: UpdateAttributeOptionDto) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id },
      select: {
        id: true,
        attributeGroup: {
          select: {
            isActive: true,
          },
        },
      },
    });

    if (!option) {
      throw new NotFoundException(`Attribute option ${id} was not found.`);
    }

    if (dto.isActive === true && !option.attributeGroup.isActive) {
      throw new BadRequestException(
        'Option cannot be activated while its attribute group is inactive.',
      );
    }

    const updated = await this.prisma.attributeOption.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ?? null }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl ?? null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.adminOptionSelect(true),
    });

    return this.toAdminOptionResponse(updated);
  }

  async adminDeactivateOption(id: string) {
    await this.ensureOptionExists(id);

    const option = await this.prisma.attributeOption.update({
      where: { id },
      data: { isActive: false },
      select: this.adminOptionSelect(true),
    });

    return this.toAdminOptionResponse(option);
  }

  private adminGroupListSelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      isCustomerAttribute: true,
      isProductAttribute: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          options: true,
          quizQuestions: true,
          productReferenceAttributes: true,
          packAttributes: true,
          recommendationRules: true,
        },
      },
      options: {
        where: { isActive: true },
        select: { id: true },
      },
    } satisfies Prisma.AttributeGroupSelect;
  }

  private adminOptionSelect(includeGroup: boolean) {
    return {
      id: true,
      attributeGroupId: true,
      code: true,
      label: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      ...(includeGroup
        ? {
            attributeGroup: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
              },
            },
          }
        : {}),
      _count: {
        select: {
          quizQuestionOptions: true,
          customerProfileAnswers: true,
          productReferenceAttributes: true,
          packAttributes: true,
        },
      },
    } satisfies Prisma.AttributeOptionSelect;
  }

  private toAdminGroupListResponse(group: any) {
    return {
      id: group.id,
      code: group.code,
      name: group.name,
      description: group.description,
      isCustomerAttribute: group.isCustomerAttribute,
      isProductAttribute: group.isProductAttribute,
      sortOrder: group.sortOrder,
      isActive: group.isActive,
      optionCount: group._count.options,
      activeOptionCount: group.options.length,
      quizQuestionCount: group._count.quizQuestions,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private toAdminOptionResponse(option: any) {
    return {
      id: option.id,
      attributeGroupId: option.attributeGroupId,
      code: option.code,
      label: option.label,
      description: option.description,
      imageUrl: option.imageUrl,
      sortOrder: option.sortOrder,
      isActive: option.isActive,
      attributeGroup: option.attributeGroup,
      quizQuestionUsageCount: option._count.quizQuestionOptions,
      profileAnswerUsageCount: option._count.customerProfileAnswers,
      productReferenceUsageCount: option._count.productReferenceAttributes,
      packUsageCount: option._count.packAttributes,
    };
  }

  private async ensureGroupExists(id: string) {
    const group = await this.prisma.attributeGroup.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!group) {
      throw new NotFoundException(`Attribute group ${id} was not found.`);
    }
  }

  private async ensureOptionExists(id: string) {
    const option = await this.prisma.attributeOption.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!option) {
      throw new NotFoundException(`Attribute option ${id} was not found.`);
    }
  }

  private async ensureUniqueGroupCode(code: string) {
    const existing = await this.prisma.attributeGroup.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Attribute group code ${code} already exists.`,
      );
    }
  }

  private async ensureUniqueOptionCode(attributeGroupId: string, code: string) {
    const existing = await this.prisma.attributeOption.findUnique({
      where: {
        attributeGroupId_code: {
          attributeGroupId,
          code,
        },
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(
        `Attribute option code ${code} already exists in this group.`,
      );
    }
  }
}
