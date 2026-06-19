import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaRole, Prisma, ProductStatus } from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryPublicProductsDto } from './dto/query-public-products.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlService?: MediaUrlService,
  ) {}

  private readonly productSelect = {
    id: true,
    name: true,
    slug: true,
    description: true,
    basePrice: true,
    currency: true,
    mainImageUrl: true,
    status: true,
    category: {
      select: {
        id: true,
        code: true,
        name: true,
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
      },
    },
    brand: {
      select: {
        id: true,
        name: true,
      },
    },
    references: {
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
      select: {
        id: true,
        referenceCode: true,
        referenceName: true,
        priceOverride: true,
        priceDelta: true,
        imageUrl: true,
        image: {
          select: {
            id: true,
            mediaId: true,
            role: true,
            altText: true,
            createdAt: true,
            updatedAt: true,
            media: true,
          },
        },
        stockQuantity: true,
        isDefault: true,
        attributes: {
          orderBy: [{ attributeGroup: { sortOrder: 'asc' } }],
          select: {
            id: true,
            matchType: true,
            scoreValue: true,
            isHardFilter: true,
            attributeGroup: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
            attributeOption: {
              select: {
                id: true,
                code: true,
                label: true,
              },
            },
          },
        },
      },
    },
    images: {
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        mediaId: true,
        role: true,
        position: true,
        altText: true,
        createdAt: true,
        updatedAt: true,
        media: true,
      },
    },
  } satisfies Prisma.ProductSelect;

  async findAll(query: QueryPublicProductsDto = {}) {
    const where = this.publicProductWhere(query);
    const orderBy = [
      { [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc' },
    ];

    if (!this.hasPublicPagination(query)) {
      const products = await this.prisma.product.findMany({
        where,
        orderBy,
        select: this.productSelect,
      });

      return products.map((product) => this.toPublicProductResponse(product));
    }

    const pagination = paginationParams({
      page: query.page,
      pageSize: query.size,
    });

    const [products, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy,
        select: this.productSelect,
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginatedResponse(
      products.map((product) => this.toPublicProductResponse(product)),
      { ...pagination, totalItems },
    );
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        status: 'ACTIVE',
      },
      select: this.productSelect,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }

    return this.toPublicProductResponse(product);
  }

  async adminFindAll(query: QueryProductsDto) {
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.brandId !== undefined ? { brandId: query.brandId } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [products, totalItems] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }],
        select: this.adminListSelect(),
      }),
      this.prisma.product.count({ where }),
    ]);

    return paginatedResponse(
      products.map((product) => this.toAdminListResponse(product)),
      { ...pagination, totalItems },
    );
  }

  async adminFindOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: this.adminDetailSelect(),
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }

    return this.toAdminDetailResponse(product);
  }

  async adminCreate(dto: CreateProductDto) {
    await this.ensureUniqueSlug(dto.slug);
    await this.validateCategoryForProduct(dto.categoryId, dto.isActive ?? true);
    await this.validateBrandForProduct(dto.brandId, dto.isActive ?? true);

    const product = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        basePrice: dto.basePrice,
        costPrice: dto.costPrice ?? null,
        currency: dto.currency,
        mainImageUrl: dto.mainImageUrl ?? null,
        status: dto.status ?? ProductStatus.DRAFT,
        isActive: dto.isActive ?? true,
      },
      select: this.adminDetailSelect(),
    });

    return this.toAdminDetailResponse(product);
  }

  async adminUpdate(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        brandId: true,
        isActive: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }

    if (dto.slug) {
      await this.ensureUniqueSlug(dto.slug, id);
    }

    const targetIsActive = dto.isActive ?? existing.isActive;
    await this.validateCategoryForProduct(
      dto.categoryId ?? existing.categoryId,
      targetIsActive,
    );
    await this.validateBrandForProduct(
      Object.prototype.hasOwnProperty.call(dto, 'brandId')
        ? dto.brandId
        : existing.brandId,
      targetIsActive,
    );

    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(Object.prototype.hasOwnProperty.call(dto, 'brandId')
          ? { brandId: dto.brandId ?? null }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description ?? null }
          : {}),
        ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
        ...(dto.costPrice !== undefined
          ? { costPrice: dto.costPrice ?? null }
          : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.mainImageUrl !== undefined
          ? { mainImageUrl: dto.mainImageUrl ?? null }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: this.adminDetailSelect(),
    });

    return this.toAdminDetailResponse(product);
  }

  async adminArchive(id: string) {
    await this.ensureProductExists(id);

    const product = await this.prisma.$transaction(async (tx) => {
      await tx.productReference.updateMany({
        where: { productId: id },
        data: {
          isActive: false,
          isDefault: false,
        },
      });

      return tx.product.update({
        where: { id },
        data: {
          status: ProductStatus.ARCHIVED,
          isActive: false,
        },
        select: this.adminDetailSelect(),
      });
    });

    return this.toAdminDetailResponse(product);
  }

  private publicProductWhere(query: QueryPublicProductsDto) {
    return {
      isActive: true,
      status: ProductStatus.ACTIVE,
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.categoryCode !== undefined
        ? { category: { code: query.categoryCode } }
        : {}),
      ...(query.brandId !== undefined ? { brandId: query.brandId } : {}),
      ...(query.inStock === true
        ? {
            references: {
              some: {
                isActive: true,
                stockQuantity: { gt: 0 },
              },
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
              {
                description: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                category: {
                  is: {
                    OR: [
                      {
                        code: {
                          contains: query.search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        name: {
                          contains: query.search,
                          mode: 'insensitive',
                        },
                      },
                    ],
                  },
                },
              },
              {
                brand: {
                  is: {
                    name: {
                      contains: query.search,
                      mode: 'insensitive',
                    },
                  },
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.ProductWhereInput;
  }

  private hasPublicPagination(query: QueryPublicProductsDto) {
    return query.page !== undefined || query.size !== undefined;
  }

  private adminListSelect() {
    return {
      id: true,
      categoryId: true,
      brandId: true,
      name: true,
      slug: true,
      description: true,
      basePrice: true,
      costPrice: true,
      currency: true,
      mainImageUrl: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      category: {
        select: {
          id: true,
          code: true,
          name: true,
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
        },
      },
      brand: {
        select: {
          id: true,
          name: true,
        },
      },
      references: {
        select: {
          id: true,
          stockQuantity: true,
          reservedQuantity: true,
          isActive: true,
          image: {
            select: {
              id: true,
              mediaId: true,
              role: true,
              altText: true,
              createdAt: true,
              updatedAt: true,
              media: true,
            },
          },
        },
      },
      images: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          mediaId: true,
          role: true,
          position: true,
          altText: true,
          createdAt: true,
          updatedAt: true,
          media: true,
        },
      },
    } satisfies Prisma.ProductSelect;
  }

  private adminDetailSelect() {
    return {
      ...this.adminListSelect(),
      references: {
        orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
        select: {
          id: true,
          referenceCode: true,
          referenceName: true,
          barcode: true,
          sku: true,
          priceOverride: true,
          priceDelta: true,
          imageUrl: true,
          image: {
            select: {
              id: true,
              mediaId: true,
              role: true,
              altText: true,
              createdAt: true,
              updatedAt: true,
              media: true,
            },
          },
          stockQuantity: true,
          reservedQuantity: true,
          lowStockThreshold: true,
          isDefault: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          attributes: {
            orderBy: [{ attributeGroup: { sortOrder: 'asc' } }],
            select: {
              id: true,
              matchType: true,
              scoreValue: true,
              isHardFilter: true,
              attributeGroup: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
              attributeOption: {
                select: {
                  id: true,
                  code: true,
                  label: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          packItems: true,
        },
      },
    } satisfies Prisma.ProductSelect;
  }

  private toAdminListResponse(product: any) {
    const stock = this.referenceStockSummary(product.references);

    return {
      id: product.id,
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      basePrice: toMoneyNumber(product.basePrice),
      costPrice: toMoneyNumber(product.costPrice),
      currency: product.currency,
      mainImageUrl: product.mainImageUrl,
      status: product.status,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      category: product.category,
      categoryImage: this.toSingleImageResponse(
        product.category?.image,
        MediaRole.ICON,
      ),
      brand: product.brand,
      coverImage: this.coverImage(product.images ?? []),
      images: (product.images ?? []).map((image: any) =>
        this.toImageResponse(image),
      ),
      referenceCount: product.references.length,
      activeReferenceCount: product.references.filter(
        (reference: { isActive: boolean }) => reference.isActive,
      ).length,
      totalStock: stock.totalStock,
      availableStock: stock.availableStock,
    };
  }

  private toAdminDetailResponse(product: any) {
    return {
      ...this.toAdminListResponse(product),
      packUsageCount: product._count?.packItems ?? 0,
      references: product.references.map((reference: any) => ({
        id: reference.id,
        referenceCode: reference.referenceCode,
        referenceName: reference.referenceName,
        barcode: reference.barcode,
        sku: reference.sku,
        priceOverride: toMoneyNumber(reference.priceOverride),
        priceDelta: toMoneyNumber(reference.priceDelta),
        imageUrl: reference.imageUrl,
        image: this.toReferenceImageResponse(reference.image),
        stockQuantity: reference.stockQuantity,
        reservedQuantity: reference.reservedQuantity,
        availableStock: this.availableStock(reference),
        lowStockThreshold: reference.lowStockThreshold,
        isLowStock:
          this.availableStock(reference) <= reference.lowStockThreshold,
        isDefault: reference.isDefault,
        isActive: reference.isActive,
        createdAt: reference.createdAt,
        updatedAt: reference.updatedAt,
        attributes: reference.attributes,
      })),
      coverImage: this.coverImage(product.images ?? []),
      images: (product.images ?? []).map((image: any) =>
        this.toImageResponse(image),
      ),
    };
  }

  private toPublicProductResponse(product: any) {
    return {
      ...product,
      category: product.category
        ? {
            ...product.category,
            image: this.toSingleImageResponse(
              product.category.image,
              MediaRole.ICON,
            ),
          }
        : null,
      references: product.references.map((reference: any) => ({
        ...reference,
        image: this.toReferenceImageResponse(reference.image),
      })),
      coverImage: this.coverImage(product.images),
      images: product.images.map((image: any) => this.toImageResponse(image)),
    };
  }

  private coverImage(images: any[] = []) {
    const cover = images.find((image) => image.role === MediaRole.COVER);
    return cover ? this.toImageResponse(cover) : null;
  }

  private toReferenceImageResponse(image: any) {
    return this.toSingleImageResponse(image, MediaRole.SWATCH, true);
  }

  private toSingleImageResponse(
    image: any,
    role: MediaRole,
    includeSwatch = false,
  ) {
    if (!image) {
      return null;
    }

    return this.toImageResponse(
      {
        ...image,
        role,
        position: 0,
      },
      includeSwatch,
    );
  }

  private toImageResponse(image: any, includeSwatch = false) {
    return {
      id: image.id,
      mediaAssetId: image.mediaId,
      role: image.role,
      position: image.position,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      bytes: image.media.bytes,
      urls: this.buildUrls(image.media, includeSwatch),
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private buildUrls(media: any, includeSwatch = false) {
    if (this.mediaUrlService) {
      return this.mediaUrlService.buildUrls(media, { includeSwatch });
    }

    return {
      original: media.secureUrl,
      thumbnail: media.secureUrl,
      card: media.secureUrl,
      detail: media.secureUrl,
      ...(includeSwatch ? { swatch: media.secureUrl } : {}),
    };
  }

  private referenceStockSummary(
    references: {
      stockQuantity: number;
      reservedQuantity: number;
    }[],
  ) {
    return references.reduce(
      (summary, reference) => ({
        totalStock: summary.totalStock + reference.stockQuantity,
        availableStock: summary.availableStock + this.availableStock(reference),
      }),
      { totalStock: 0, availableStock: 0 },
    );
  }

  private availableStock(reference: {
    stockQuantity: number;
    reservedQuantity: number;
  }) {
    return Math.max(reference.stockQuantity - reference.reservedQuantity, 0);
  }

  private async ensureProductExists(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }
  }

  private async ensureUniqueSlug(slug: string, currentId?: string) {
    const existing = await this.prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Product slug ${slug} already exists.`);
    }
  }

  private async validateCategoryForProduct(
    categoryId: string,
    targetProductIsActive: boolean,
  ) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isActive: true },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} was not found.`);
    }

    if (targetProductIsActive && !category.isActive) {
      throw new BadRequestException(
        'Inactive category cannot receive an active product.',
      );
    }
  }

  private async validateBrandForProduct(
    brandId: string | null | undefined,
    targetProductIsActive: boolean,
  ) {
    if (!brandId) {
      return;
    }

    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      select: { id: true, isActive: true },
    });

    if (!brand) {
      throw new NotFoundException(`Brand ${brandId} was not found.`);
    }

    if (targetProductIsActive && !brand.isActive) {
      throw new BadRequestException(
        'Inactive brand cannot receive an active product.',
      );
    }
  }
}
