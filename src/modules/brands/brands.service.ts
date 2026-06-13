import {
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
import { CreateBrandDto } from './dto/create-brand.dto';
import { QueryBrandsDto } from './dto/query-brands.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryBrandsDto) {
    const pagination = paginationParams(query);
    const where: Prisma.BrandWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const [brands, totalItems] = await this.prisma.$transaction([
      this.prisma.brand.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ name: 'asc' }],
        select: this.brandSelect(),
      }),
      this.prisma.brand.count({ where }),
    ]);

    return paginatedResponse(
      brands.map((brand) => this.toResponse(brand)),
      { ...pagination, totalItems },
    );
  }

  async findOne(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: this.brandSelect(),
    });

    if (!brand) {
      throw new NotFoundException(`Brand ${id} was not found.`);
    }

    return this.toResponse(brand);
  }

  async create(dto: CreateBrandDto) {
    await this.ensureUniqueName(dto.name);

    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        logoUrl: dto.logoUrl ?? null,
        isActive: dto.isActive ?? true,
      },
      select: this.brandSelect(),
    });

    return this.toResponse(brand);
  }

  async update(id: string, dto: UpdateBrandDto) {
    await this.ensureExists(id);

    if (dto.name) {
      await this.ensureUniqueName(dto.name, id);
    }

    const brand = await this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ?? null }
          : {}),
        ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl ?? null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.brandSelect(),
    });

    return this.toResponse(brand);
  }

  async deactivate(id: string) {
    await this.ensureExists(id);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isActive: false },
      select: this.brandSelect(),
    });

    return this.toResponse(brand);
  }

  private brandSelect() {
    return {
      id: true,
      name: true,
      description: true,
      logoUrl: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          products: true,
        },
      },
    } satisfies Prisma.BrandSelect;
  }

  private toResponse(brand: any) {
    return {
      id: brand.id,
      name: brand.name,
      description: brand.description,
      logoUrl: brand.logoUrl,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
      productCount: brand._count.products,
    };
  }

  private async ensureExists(id: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!brand) {
      throw new NotFoundException(`Brand ${id} was not found.`);
    }
  }

  private async ensureUniqueName(name: string, currentId?: string) {
    const existing = await this.prisma.brand.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Brand name ${name} already exists.`);
    }
  }
}
