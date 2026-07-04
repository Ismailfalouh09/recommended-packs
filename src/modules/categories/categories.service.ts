import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { QueryCategoriesDto } from './dto/query-categories.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlService?: MediaUrlService,
  ) {}

  async publicFindAll() {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: this.publicListSelect(),
    });

    return categories.map((category) =>
      this.toPublicCategoryResponse(category),
    );
  }

  async findAll(query: QueryCategoriesDto) {
    const pagination = paginationParams(query);
    const where: Prisma.CategoryWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.parentId !== undefined ? { parentId: query.parentId } : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search, mode: 'insensitive' } },
              { name: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [categories, totalItems] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: this.listSelect(),
      }),
      this.prisma.category.count({ where }),
    ]);

    return paginatedResponse(
      categories.map((category) => this.toListResponse(category)),
      { ...pagination, totalItems },
    );
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: {
        ...this.listSelect(),
        children: {
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            sortOrder: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} was not found.`);
    }

    return this.toDetailResponse(category);
  }

  async create(dto: CreateCategoryDto) {
    await this.ensureUniqueCode(dto.code);
    await this.ensureValidParent(dto.parentId);

    const category = await this.prisma.category.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        parentId: dto.parentId ?? null,
        imageUrl: dto.imageUrl ?? null,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
      },
      select: this.listSelect(),
    });

    return this.toListResponse(category);
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.ensureExists(id);

    if (dto.code) {
      await this.ensureUniqueCode(dto.code, id);
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'parentId')) {
      if (dto.parentId === id) {
        throw new ConflictException('Category cannot be its own parent.');
      }

      await this.ensureValidParent(dto.parentId);

      if (dto.parentId && (await this.isDescendant(dto.parentId, id))) {
        throw new ConflictException(
          'Category cannot use one of its descendants as parent.',
        );
      }
    }

    const category = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ?? null }
          : {}),
        ...(Object.prototype.hasOwnProperty.call(dto, 'parentId')
          ? { parentId: dto.parentId ?? null }
          : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl ?? null }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.listSelect(),
    });

    return this.toListResponse(category);
  }

  async deactivate(id: string) {
    await this.ensureExists(id);

    const category = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
      select: this.listSelect(),
    });

    return this.toListResponse(category);
  }

  private listSelect() {
    return {
      id: true,
      parentId: true,
      code: true,
      name: true,
      description: true,
      imageUrl: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      parent: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      _count: {
        select: {
          products: true,
          children: true,
        },
      },
      image: {
        select: {
          id: true,
          mediaId: true,
          altText: true,
          createdAt: true,
          updatedAt: true,
          media: true,
        },
      },
    } satisfies Prisma.CategorySelect;
  }

  private publicListSelect() {
    return {
      id: true,
      code: true,
      name: true,
      description: true,
      sortOrder: true,
      _count: {
        select: {
          products: {
            where: {
              isActive: true,
              status: ProductStatus.ACTIVE,
            },
          },
          children: {
            where: {
              isActive: true,
            },
          },
        },
      },
      image: {
        select: {
          id: true,
          mediaId: true,
          altText: true,
          createdAt: true,
          updatedAt: true,
          media: true,
        },
      },
    } satisfies Prisma.CategorySelect;
  }

  private toListResponse(category: any) {
    return {
      id: category.id,
      parentId: category.parentId,
      code: category.code,
      name: category.name,
      description: category.description,
      imageUrl: category.imageUrl,
      sortOrder: category.sortOrder,
      isActive: category.isActive,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      parent: category.parent,
      image: this.toCategoryImageResponse(category.image),
      productCount: category._count.products,
      childCategoryCount: category._count.children,
    };
  }

  private toDetailResponse(category: any) {
    return {
      ...this.toListResponse(category),
      children: category.children,
    };
  }

  private toPublicCategoryResponse(category: any) {
    return {
      id: category.id,
      code: category.code,
      name: category.name,
      description: category.description,
      image: this.toPublicCategoryImageResponse(category.image),
      sortOrder: category.sortOrder,
      productCount: category._count.products,
      childCategoryCount: category._count.children,
    };
  }

  private toPublicCategoryImageResponse(image: any) {
    if (!image) {
      return null;
    }

    return {
      urls: this.mediaUrlService?.buildUrls(image.media) ?? {
        original: image.media.secureUrl,
        thumbnail: image.media.secureUrl,
        card: image.media.secureUrl,
        detail: image.media.secureUrl,
      },
      altText: image.altText,
    };
  }

  private toCategoryImageResponse(image: any) {
    if (!image) {
      return null;
    }

    return {
      id: image.id,
      mediaAssetId: image.mediaId,
      role: 'ICON',
      position: 0,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      bytes: image.media.bytes,
      urls: this.mediaUrlService?.buildUrls(image.media) ?? {
        original: image.media.secureUrl,
        thumbnail: image.media.secureUrl,
        card: image.media.secureUrl,
        detail: image.media.secureUrl,
      },
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private async ensureExists(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} was not found.`);
    }
  }

  private async ensureUniqueCode(code: string, currentId?: string) {
    const existing = await this.prisma.category.findUnique({
      where: { code },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Category code ${code} already exists.`);
    }
  }

  private async ensureValidParent(parentId?: string | null) {
    if (!parentId) {
      return;
    }

    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true },
    });

    if (!parent) {
      throw new NotFoundException(`Parent category ${parentId} was not found.`);
    }
  }

  private async isDescendant(candidateParentId: string, categoryId: string) {
    let currentId: string | null = candidateParentId;

    while (currentId) {
      if (currentId === categoryId) {
        return true;
      }

      const current = await this.prisma.category.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });

      currentId = current?.parentId ?? null;
    }

    return false;
  }
}
