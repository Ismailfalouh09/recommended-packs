import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchType, MediaRole, Prisma, ProductStatus } from '@prisma/client';
import { buildShareMetadata } from '../../common/share/share-metadata.util';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryPublicProductDetailDto } from './dto/query-public-product-detail.dto';
import { ProductAttributeInputDto } from './dto/product-attribute-input.dto';
import { QueryPublicProductsDto } from './dto/query-public-products.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

interface ResolvedProductAttribute {
  attributeGroupId: string;
  attributeOptionId: string;
  matchType: MatchType;
  scoreValue: number;
  isHardFilter: boolean;
}

/**
 * Allowed pricing currencies (single-currency MVP — MAD). Centralised so a
 * future multi-currency change is a config edit, not a schema/code hunt.
 */
const ALLOWED_CURRENCIES = new Set(['MAD']);

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
    productType: true,
    shortDescription: true,
    description: true,
    ingredients: true,
    directions: true,
    basePrice: true,
    compareAtPrice: true,
    currency: true,
    metaTitle: true,
    metaDescription: true,
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
        shadeName: true,
        shadeCode: true,
        swatchHex: true,
        measurement: true,
        variationType: true,
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

      return products.map((product) => this.toPublicProductCard(product));
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
      products.map((product) => this.toPublicProductCard(product)),
      { ...pagination, totalItems },
    );
  }

  async findOne(id: string, query: QueryPublicProductDetailDto = {}) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        status: ProductStatus.ACTIVE,
      },
      select: this.productSelect,
    });

    if (!product) {
      throw new NotFoundException(`Product ${id} was not found.`);
    }

    return this.toPublicProductDetailResponse(
      product,
      query.selectedReferenceId,
    );
  }

  async findBySlug(slug: string, query: QueryPublicProductDetailDto = {}) {
    const product = await this.prisma.product.findFirst({
      where: {
        slug,
        status: ProductStatus.ACTIVE,
      },
      select: this.productSelect,
    });

    if (!product) {
      throw new NotFoundException(`Product ${slug} was not found.`);
    }

    return this.toPublicProductDetailResponse(
      product,
      query.selectedReferenceId,
    );
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
    this.validatePricing({
      basePrice: dto.basePrice,
      costPrice: dto.costPrice ?? null,
      compareAtPrice: dto.compareAtPrice ?? null,
      currency: dto.currency,
    });
    const attributes = await this.resolveProductAttributes(
      dto.attributes ?? [],
    );

    const product = await this.prisma.product.create({
      data: {
        categoryId: dto.categoryId,
        brandId: dto.brandId ?? null,
        name: dto.name,
        slug: dto.slug,
        productType: dto.productType ?? null,
        shortDescription: dto.shortDescription ?? null,
        description: dto.description ?? null,
        ingredients: dto.ingredients ?? null,
        directions: dto.directions ?? null,
        basePrice: dto.basePrice,
        compareAtPrice: dto.compareAtPrice ?? null,
        costPrice: dto.costPrice ?? null,
        currency: dto.currency,
        metaTitle: dto.metaTitle ?? null,
        metaDescription: dto.metaDescription ?? null,
        mainImageUrl: dto.mainImageUrl ?? null,
        status: dto.status ?? ProductStatus.DRAFT,
        isActive: dto.isActive ?? true,
        attributes: {
          createMany: {
            data: attributes,
          },
        },
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
        basePrice: true,
        costPrice: true,
        compareAtPrice: true,
        currency: true,
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

    this.validatePricing({
      basePrice: dto.basePrice ?? toMoneyNumber(existing.basePrice)!,
      costPrice: Object.prototype.hasOwnProperty.call(dto, 'costPrice')
        ? (dto.costPrice ?? null)
        : toMoneyNumber(existing.costPrice),
      compareAtPrice: Object.prototype.hasOwnProperty.call(
        dto,
        'compareAtPrice',
      )
        ? (dto.compareAtPrice ?? null)
        : toMoneyNumber(existing.compareAtPrice),
      currency: dto.currency ?? existing.currency,
    });

    const attributesIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'attributes',
    );
    const attributes = attributesIncluded
      ? await this.resolveProductAttributes(dto.attributes ?? [])
      : [];

    const product = await this.prisma.$transaction(async (tx) => {
      if (attributesIncluded) {
        await tx.productAttribute.deleteMany({ where: { productId: id } });
      }

      return tx.product.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined
            ? { categoryId: dto.categoryId }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'brandId')
            ? { brandId: dto.brandId ?? null }
            : {}),
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'productType')
            ? { productType: dto.productType ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'shortDescription')
            ? { shortDescription: dto.shortDescription ?? null }
            : {}),
          ...(dto.description !== undefined
            ? { description: dto.description ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'ingredients')
            ? { ingredients: dto.ingredients ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'directions')
            ? { directions: dto.directions ?? null }
            : {}),
          ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'compareAtPrice')
            ? { compareAtPrice: dto.compareAtPrice ?? null }
            : {}),
          ...(dto.costPrice !== undefined
            ? { costPrice: dto.costPrice ?? null }
            : {}),
          ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'metaTitle')
            ? { metaTitle: dto.metaTitle ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'metaDescription')
            ? { metaDescription: dto.metaDescription ?? null }
            : {}),
          ...(dto.mainImageUrl !== undefined
            ? { mainImageUrl: dto.mainImageUrl ?? null }
            : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
          ...(attributesIncluded
            ? {
                attributes: {
                  createMany: {
                    data: attributes,
                  },
                },
              }
            : {}),
        },
        select: this.adminDetailSelect(),
      });
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
    // Visibility is driven by `status` as the single source of truth
    // (Phase 2 §3 / 4.5). `isActive` is retained physically during the compat
    // window but is no longer a public-read input.
    return {
      status: ProductStatus.ACTIVE,
      ...(query.categoryId !== undefined
        ? { categoryId: query.categoryId }
        : {}),
      ...(query.categoryCode !== undefined
        ? { category: { code: query.categoryCode } }
        : {}),
      ...(query.productType !== undefined
        ? { productType: query.productType }
        : {}),
      ...(query.brandId !== undefined ? { brandId: query.brandId } : {}),
      ...(this.priceRangeWhere(query.minPrice, query.maxPrice)
        ? { basePrice: this.priceRangeWhere(query.minPrice, query.maxPrice) }
        : {}),
      ...(this.facetWhere(query.attributeOptions)
        ? { AND: this.facetWhere(query.attributeOptions) }
        : {}),
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
      ...(query.onSale === true ? { compareAtPrice: { not: null } } : {}),
      ...(query.onSale === false ? { compareAtPrice: null } : {}),
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

  private priceRangeWhere(minPrice?: number, maxPrice?: number) {
    if (minPrice === undefined && maxPrice === undefined) {
      return undefined;
    }

    return {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    } satisfies Prisma.DecimalFilter;
  }

  private facetWhere(attributeOptions?: string) {
    const optionCodes = attributeOptions
      ?.split(',')
      .map((code) => code.trim())
      .filter(Boolean);

    if (!optionCodes?.length) {
      return undefined;
    }

    return optionCodes.map(
      (code) =>
        ({
          OR: [
            {
              attributes: {
                some: {
                  attributeOption: {
                    code,
                  },
                },
              },
            },
            {
              references: {
                some: {
                  attributes: {
                    some: {
                      attributeOption: {
                        code,
                      },
                    },
                  },
                },
              },
            },
          ],
        }) satisfies Prisma.ProductWhereInput,
    );
  }

  private adminListSelect() {
    return {
      id: true,
      categoryId: true,
      brandId: true,
      name: true,
      slug: true,
      productType: true,
      shortDescription: true,
      description: true,
      ingredients: true,
      directions: true,
      basePrice: true,
      compareAtPrice: true,
      costPrice: true,
      currency: true,
      metaTitle: true,
      metaDescription: true,
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
      references: {
        orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
        select: {
          id: true,
          referenceCode: true,
          referenceName: true,
          shadeName: true,
          shadeCode: true,
          swatchHex: true,
          measurement: true,
          variationType: true,
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

    const basePrice = toMoneyNumber(product.basePrice) ?? 0;
    const compareAtPrice = toMoneyNumber(product.compareAtPrice);
    const onSale = compareAtPrice != null && compareAtPrice > basePrice;

    return {
      id: product.id,
      categoryId: product.categoryId,
      brandId: product.brandId,
      name: product.name,
      slug: product.slug,
      productType: product.productType,
      shortDescription: product.shortDescription,
      description: product.description,
      ingredients: product.ingredients,
      directions: product.directions,
      basePrice,
      compareAtPrice,
      onSale,
      percentageSaving:
        onSale && compareAtPrice
          ? Math.round(((compareAtPrice - basePrice) / compareAtPrice) * 100)
          : 0,
      costPrice: toMoneyNumber(product.costPrice),
      currency: product.currency,
      metaTitle: product.metaTitle,
      metaDescription: product.metaDescription,
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
      attributes: product.attributes ?? [],
      references: product.references.map((reference: any) => ({
        id: reference.id,
        referenceCode: reference.referenceCode,
        referenceName: reference.referenceName,
        shadeName: reference.shadeName,
        shadeCode: reference.shadeCode,
        swatchHex: reference.swatchHex,
        measurement: reference.measurement,
        variationType: reference.variationType,
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

  private toPublicProductCard(product: any) {
    const pricing = this.derivePublicPricing(product);
    const coverImage = this.publicCoverImage(product.images);
    const inStock = this.productInStock(product);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      category: product.category
        ? {
            id: product.category.id,
            code: product.category.code,
            name: product.category.name,
          }
        : null,
      productType: product.productType,
      coverImage,
      coverImageUrl: coverImage?.urls?.detail ?? product.mainImageUrl ?? null,
      priceFrom: pricing.priceFrom,
      currentPrice: pricing.priceFrom,
      originalPrice: pricing.onSale ? pricing.compareAtPrice : null,
      compareAtPrice: pricing.onSale ? pricing.compareAtPrice : null,
      onSale: pricing.onSale,
      percentageSaving: pricing.percentageSaving,
      currency: product.currency,
      inStock,
      availability: {
        inStock,
        label: inStock ? 'IN_STOCK' : 'OUT_OF_STOCK',
      },
    };
  }

  private toPublicProductDetailResponse(
    product: any,
    selectedReferenceId?: string,
  ) {
    const basePrice = toMoneyNumber(product.basePrice) ?? 0;
    const pricing = this.derivePublicPricing(product);
    const selectedReference = this.resolveSelectedReference(
      product.references,
      selectedReferenceId,
    );
    const selectableReferences = product.references.map((reference: any) =>
      this.toPublicVariantReference(
        reference,
        basePrice,
        pricing.compareAtPrice,
        product.currency,
      ),
    );
    const selectedPublicReference = selectedReference
      ? this.toPublicVariantReference(
          selectedReference,
          basePrice,
          pricing.compareAtPrice,
          product.currency,
        )
      : null;
    const coverImage = this.publicCoverImage(product.images);
    const images = product.images.map((image: any) =>
      this.toPublicImageResponse(image),
    );
    const coverImageUrl =
      coverImage?.urls?.detail ?? product.mainImageUrl ?? null;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      productType: product.productType,
      shortDescription: product.shortDescription,
      description: product.description,
      ingredients: product.ingredients,
      directions: product.directions,
      basePrice,
      compareAtPrice: pricing.compareAtPrice,
      priceFrom: pricing.priceFrom,
      currentPrice: selectedPublicReference?.price.current ?? pricing.priceFrom,
      originalPrice: selectedPublicReference?.price.original ?? null,
      onSale: selectedPublicReference?.price.onSale ?? pricing.onSale,
      percentageSaving: pricing.percentageSaving,
      currency: product.currency,
      category: product.category
        ? {
            id: product.category.id,
            code: product.category.code,
            name: product.category.name,
            image: this.toPublicSingleImageResponse(
              product.category.image,
              MediaRole.ICON,
            ),
          }
        : null,
      brand: product.brand,
      selectedReference: selectedPublicReference,
      selectedProductReference: selectedPublicReference,
      selectableReferences,
      references: selectableReferences,
      suitability: {
        general: this.curateSuitability(product.attributes),
      },
      addToCart: this.addToCartConstraints(selectedPublicReference),
      coverImage,
      coverImageUrl,
      mediaGallery: images,
      images,
      // Phase 8B — storefront-safe share metadata. Only reachable for ACTIVE
      // public products (findOne/findBySlug filter on status), so no inactive or
      // private product is ever shareable. Reuses the canonical public slug path.
      share: buildShareMetadata({
        path: `/products/${product.slug}`,
        title: product.metaTitle ?? product.name,
        description:
          product.metaDescription ??
          product.shortDescription ??
          product.description,
        imageUrl: coverImageUrl,
      }),
    };
  }

  private publicCoverImage(images: any[] = []) {
    const cover = images.find((image) => image.role === MediaRole.COVER);
    return cover ? this.toPublicImageResponse(cover) : null;
  }

  private toPublicReferenceImageResponse(image: any) {
    return this.toPublicSingleImageResponse(image, MediaRole.SWATCH, true);
  }

  private toPublicSingleImageResponse(
    image: any,
    role: MediaRole,
    includeSwatch = false,
  ) {
    if (!image) {
      return null;
    }

    return this.toPublicImageResponse(
      {
        ...image,
        role,
        position: 0,
      },
      includeSwatch,
    );
  }

  private toPublicImageResponse(image: any, includeSwatch = false) {
    return {
      role: image.role,
      position: image.position,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      urls: this.buildUrls(image.media, includeSwatch),
    };
  }

  private resolveSelectedReference(
    references: any[] = [],
    selectedReferenceId?: string,
  ) {
    if (selectedReferenceId) {
      const selected = references.find(
        (reference) => reference.id === selectedReferenceId,
      );

      if (!selected) {
        throw new BadRequestException(
          'Selected reference is not active or does not belong to this product.',
        );
      }

      return selected;
    }

    return (
      references.find(
        (reference) =>
          reference.isDefault && this.deriveStockSignal(reference).inStock,
      ) ??
      references.find(
        (reference) => this.deriveStockSignal(reference).inStock,
      ) ??
      references.find((reference) => reference.isDefault) ??
      references[0] ??
      null
    );
  }

  private toPublicVariantReference(
    reference: any,
    basePrice: number,
    productCompareAtPrice: number | null,
    currency: string,
  ) {
    const currentPrice = this.effectiveReferencePrice(reference, basePrice);
    const originalPrice =
      productCompareAtPrice != null && productCompareAtPrice > currentPrice
        ? productCompareAtPrice
        : null;
    const stock = this.deriveStockSignal(reference);
    const image = this.toPublicReferenceImageResponse(reference.image);
    const label =
      reference.shadeName ?? reference.measurement ?? reference.referenceName;

    return {
      id: reference.id,
      label,
      name: reference.referenceName,
      referenceCode: reference.referenceCode,
      sku: reference.sku,
      shade: reference.shadeName
        ? {
            name: reference.shadeName,
            code: reference.shadeCode,
          }
        : null,
      shadeName: reference.shadeName,
      shadeCode: reference.shadeCode,
      measurement: reference.measurement,
      variationType: reference.variationType,
      swatch: {
        hex: reference.swatchHex,
        image,
      },
      swatchHex: reference.swatchHex,
      image,
      imageUrl: image?.urls?.detail ?? reference.imageUrl ?? null,
      price: {
        current: currentPrice,
        original: originalPrice,
        onSale: originalPrice != null,
        currency,
      },
      currentPrice,
      originalPrice,
      availability: {
        inStock: stock.inStock,
        lowStock: stock.lowStock,
        disabledReason: stock.inStock ? null : 'OUT_OF_STOCK',
      },
      inStock: stock.inStock,
      lowStock: stock.lowStock,
      disabledReason: stock.inStock ? null : 'OUT_OF_STOCK',
      suitability: this.curateSuitability(reference.attributes),
    };
  }

  private addToCartConstraints(selectedReference: any) {
    if (!selectedReference) {
      return {
        requiresReference: true,
        canAdd: false,
        disabledReason: 'REFERENCE_REQUIRED',
      };
    }

    return {
      requiresReference: true,
      selectedReferenceId: selectedReference.id,
      canAdd: selectedReference.availability.inStock,
      disabledReason: selectedReference.availability.disabledReason,
    };
  }

  private toPublicProductResponse(product: any) {
    const basePrice = toMoneyNumber(product.basePrice) ?? 0;
    const pricing = this.derivePublicPricing(product);
    // Product-level raw suitability never reaches the public payload; it is
    // curated into labels-only facets below (Phase 2 §7 / 5.7).
    const { attributes: productAttributes, ...publicProduct } = product;
    const coverImage = this.coverImage(product.images);

    return {
      ...publicProduct,
      basePrice,
      compareAtPrice: pricing.compareAtPrice,
      priceFrom: pricing.priceFrom,
      onSale: pricing.onSale,
      percentageSaving: pricing.percentageSaving,
      category: product.category
        ? {
            ...product.category,
            image: this.toSingleImageResponse(
              product.category.image,
              MediaRole.ICON,
            ),
          }
        : null,
      references: product.references.map((reference: any) => {
        // Strip raw derivation inputs and raw scoring from the public
        // projection (R9); expose only the derived stock signal + curated
        // shade suitability labels.
        const {
          reservedQuantity: _reservedQuantity,
          lowStockThreshold: _lowStockThreshold,
          attributes: referenceAttributes,
          priceOverride,
          priceDelta,
          ...publicReference
        } = reference;
        const stock = this.deriveStockSignal(reference);

        return {
          ...publicReference,
          priceOverride: toMoneyNumber(priceOverride),
          priceDelta: toMoneyNumber(priceDelta),
          effectivePrice: this.effectiveReferencePrice(reference, basePrice),
          inStock: stock.inStock,
          lowStock: stock.lowStock,
          suitability: this.curateSuitability(referenceAttributes),
          image: this.toReferenceImageResponse(reference.image),
        };
      }),
      // General (product-level) suitability facets; shade facets ride on each
      // reference above (Phase 2 §6.2).
      suitability: {
        general: this.curateSuitability(productAttributes),
      },
      coverImage,
      coverImageUrl: coverImage?.urls?.detail ?? product.mainImageUrl ?? null,
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

  /**
   * Financial-integrity guards (Phase 1 Q8, R10): currency must be in the
   * allowed set, cost may not exceed base price, and a compare-at price (when
   * set) must exceed base price to be a meaningful "was" price.
   */
  private validatePricing(input: {
    basePrice: number;
    costPrice: number | null;
    compareAtPrice: number | null;
    currency: string;
  }) {
    if (!ALLOWED_CURRENCIES.has(input.currency)) {
      throw new BadRequestException(
        `Currency ${input.currency} is not supported. Allowed: ${[...ALLOWED_CURRENCIES].join(', ')}.`,
      );
    }

    if (input.costPrice != null && input.costPrice > input.basePrice) {
      throw new BadRequestException('Cost price cannot exceed base price.');
    }

    if (
      input.compareAtPrice != null &&
      input.compareAtPrice <= input.basePrice
    ) {
      throw new BadRequestException(
        'Compare-at price must be greater than base price.',
      );
    }
  }

  /**
   * Effective unit price of a reference (Phase 0 §1.1; orders.service parity):
   * `priceOverride` when set, else `basePrice + priceDelta`.
   */
  private effectiveReferencePrice(
    reference: { priceOverride: unknown; priceDelta: unknown },
    basePrice: number,
  ): number {
    const override = toMoneyNumber(reference.priceOverride as never);
    if (override != null) {
      return override;
    }

    const delta = toMoneyNumber(reference.priceDelta as never) ?? 0;
    return basePrice + delta;
  }

  /**
   * Public derived pricing: lowest effective reference price ("from"), plus
   * onSale / % saving derived from the product compare-at price.
   */
  private derivePublicPricing(product: any) {
    const basePrice = toMoneyNumber(product.basePrice) ?? 0;
    const compareAtPrice = toMoneyNumber(product.compareAtPrice);

    const effectivePrices = (product.references ?? []).map((reference: any) =>
      this.effectiveReferencePrice(reference, basePrice),
    );
    const priceFrom = effectivePrices.length
      ? Math.min(...effectivePrices)
      : basePrice;

    const onSale = compareAtPrice != null && compareAtPrice > priceFrom;
    const percentageSaving = onSale
      ? Math.round(((compareAtPrice! - priceFrom) / compareAtPrice!) * 100)
      : 0;

    return { priceFrom, compareAtPrice, onSale, percentageSaving };
  }

  /** Derived public stock signal — boolean + low-stock badge, no exact count. */
  private deriveStockSignal(reference: {
    stockQuantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
  }) {
    const available = this.availableStock(reference);
    return {
      inStock: available > 0,
      lowStock: available > 0 && available <= reference.lowStockThreshold,
    };
  }

  private productInStock(product: any) {
    return (product.references ?? []).some(
      (reference: any) => this.deriveStockSignal(reference).inStock,
    );
  }

  /**
   * Resolve product-level suitability assignments (Phase 5.3/5.5). Mirrors the
   * reference-level resolver but enforces the ownership split: only attribute
   * groups flagged `isProductAttribute = true` (general suitability — skin
   * type / concern / finish) may be assigned at the product layer. The split is
   * a service policy guard, not a DB constraint (Phase 2 §1.3).
   */
  private async resolveProductAttributes(
    attributes: ProductAttributeInputDto[],
  ): Promise<ResolvedProductAttribute[]> {
    const seen = new Set<string>();
    const resolved: ResolvedProductAttribute[] = [];

    for (const input of attributes) {
      const group = await this.prisma.attributeGroup.findFirst({
        where: { code: input.attributeGroupCode, isActive: true },
        select: { id: true, code: true, isProductAttribute: true },
      });

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${input.attributeGroupCode} was not found or is inactive.`,
        );
      }

      if (!group.isProductAttribute) {
        throw new BadRequestException(
          `Attribute group ${input.attributeGroupCode} is a reference-level group and cannot be assigned at the product level.`,
        );
      }

      const option = await this.prisma.attributeOption.findFirst({
        where: {
          code: input.attributeOptionCode,
          attributeGroupId: group.id,
          isActive: true,
        },
        select: { id: true, code: true },
      });

      if (!option) {
        throw new BadRequestException(
          `Attribute option ${input.attributeOptionCode} was not found, inactive, or does not belong to ${input.attributeGroupCode}.`,
        );
      }

      const key = `${group.id}:${option.id}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate suitability attribute ${input.attributeGroupCode}/${input.attributeOptionCode}.`,
        );
      }

      seen.add(key);
      resolved.push({
        attributeGroupId: group.id,
        attributeOptionId: option.id,
        matchType: input.matchType,
        scoreValue: input.scoreValue,
        isHardFilter: input.isHardFilter ?? false,
      });
    }

    return resolved;
  }

  /**
   * Curate raw suitability rows into public, labels-only facets (Phase 2 §7 /
   * 5.7): group + option labels with no scoreValue / isHardFilter / matchType.
   * NOT_COMPATIBLE rows are excluded so the list reads as "suitable for".
   */
  private curateSuitability(attributes: any[] = []) {
    return attributes
      .filter((attribute) => attribute.matchType !== MatchType.NOT_COMPATIBLE)
      .map((attribute) => ({
        group: {
          code: attribute.attributeGroup.code,
          name: attribute.attributeGroup.name,
        },
        option: {
          code: attribute.attributeOption.code,
          label: attribute.attributeOption.label,
        },
      }));
  }
}
