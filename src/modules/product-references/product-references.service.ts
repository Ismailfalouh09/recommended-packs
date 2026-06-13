import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';
import { CreateProductReferenceDto } from './dto/create-product-reference.dto';
import { QueryProductReferencesDto } from './dto/query-product-references.dto';
import { ReferenceAttributeInputDto } from './dto/reference-attribute-input.dto';
import { UpdateProductReferenceDto } from './dto/update-product-reference.dto';
import { UpdateReferenceStockDto } from './dto/update-reference-stock.dto';

interface ResolvedReferenceAttribute {
  attributeGroupId: string;
  attributeOptionId: string;
  matchType: ReferenceAttributeInputDto['matchType'];
  scoreValue: number;
  isHardFilter: boolean;
}

@Injectable()
export class ProductReferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlService?: MediaUrlService,
  ) {}

  async findAllForProduct(productId: string, query: QueryProductReferencesDto) {
    await this.ensureProductExists(productId);

    const pagination = paginationParams(query);
    const where: Prisma.ProductReferenceWhereInput = {
      productId,
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? {
            OR: [
              {
                referenceCode: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              {
                referenceName: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.inStock !== undefined
        ? query.inStock
          ? { stockQuantity: { gt: 0 } }
          : { stockQuantity: { lte: 0 } }
        : {}),
    };

    const [references, totalItems] = await this.prisma.$transaction([
      this.prisma.productReference.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
        select: this.referenceSelect(false),
      }),
      this.prisma.productReference.count({ where }),
    ]);

    const data = references
      .map((reference) => this.toReferenceResponse(reference))
      .filter((reference) =>
        query.inStock === undefined
          ? true
          : query.inStock
            ? reference.availableStock > 0
            : reference.availableStock === 0,
      );

    return paginatedResponse(data, { ...pagination, totalItems });
  }

  async findOne(id: string) {
    const reference = await this.prisma.productReference.findUnique({
      where: { id },
      select: this.referenceSelect(true),
    });

    if (!reference) {
      throw new NotFoundException(`Product reference ${id} was not found.`);
    }

    return this.toReferenceResponse(reference);
  }

  async create(productId: string, dto: CreateProductReferenceDto) {
    await this.validateProductCanReceiveReference(
      productId,
      dto.isActive ?? true,
    );
    await this.ensureUniqueReferenceCode(productId, dto.referenceCode);
    await this.ensureUniqueSku(dto.sku);
    await this.ensureUniqueBarcode(dto.barcode);
    this.validateStockValues(
      dto.stockQuantity ?? 0,
      dto.reservedQuantity ?? 0,
      dto.lowStockThreshold ?? 5,
    );
    const attributes = await this.resolveAttributes(dto.attributes ?? []);

    const reference = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productReference.updateMany({
          where: { productId },
          data: { isDefault: false },
        });
      }

      return tx.productReference.create({
        data: {
          productId,
          referenceCode: dto.referenceCode,
          referenceName: dto.referenceName,
          barcode: dto.barcode ?? null,
          sku: dto.sku ?? null,
          priceOverride: dto.priceOverride ?? null,
          priceDelta: dto.priceDelta ?? 0,
          imageUrl: dto.imageUrl ?? null,
          stockQuantity: dto.stockQuantity ?? 0,
          reservedQuantity: dto.reservedQuantity ?? 0,
          lowStockThreshold: dto.lowStockThreshold ?? 5,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive ?? true,
          attributes: {
            createMany: {
              data: attributes,
            },
          },
        },
        select: this.referenceSelect(true),
      });
    });

    return this.toReferenceResponse(reference);
  }

  async update(id: string, dto: UpdateProductReferenceDto) {
    const existing = await this.prisma.productReference.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        referenceCode: true,
        sku: true,
        barcode: true,
        stockQuantity: true,
        reservedQuantity: true,
        lowStockThreshold: true,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Product reference ${id} was not found.`);
    }

    if (dto.referenceCode && dto.referenceCode !== existing.referenceCode) {
      await this.ensureUniqueReferenceCode(
        existing.productId,
        dto.referenceCode,
        id,
      );
    }
    await this.ensureUniqueSku(dto.sku, id);
    await this.ensureUniqueBarcode(dto.barcode, id);

    const stockQuantity = dto.stockQuantity ?? existing.stockQuantity;
    const reservedQuantity = dto.reservedQuantity ?? existing.reservedQuantity;
    const lowStockThreshold =
      dto.lowStockThreshold ?? existing.lowStockThreshold;
    this.validateStockValues(
      stockQuantity,
      reservedQuantity,
      lowStockThreshold,
    );

    const attributesIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'attributes',
    );
    const attributes = attributesIncluded
      ? await this.resolveAttributes(dto.attributes ?? [])
      : [];

    const reference = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.productReference.updateMany({
          where: {
            productId: existing.productId,
            id: { not: id },
          },
          data: { isDefault: false },
        });
      }

      if (attributesIncluded) {
        await tx.productReferenceAttribute.deleteMany({
          where: { productReferenceId: id },
        });
      }

      return tx.productReference.update({
        where: { id },
        data: {
          ...(dto.referenceCode !== undefined
            ? { referenceCode: dto.referenceCode }
            : {}),
          ...(dto.referenceName !== undefined
            ? { referenceName: dto.referenceName }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'barcode')
            ? { barcode: dto.barcode ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'sku')
            ? { sku: dto.sku ?? null }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'priceOverride')
            ? { priceOverride: dto.priceOverride ?? null }
            : {}),
          ...(dto.priceDelta !== undefined
            ? { priceDelta: dto.priceDelta }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'imageUrl')
            ? { imageUrl: dto.imageUrl ?? null }
            : {}),
          ...(dto.stockQuantity !== undefined
            ? { stockQuantity: dto.stockQuantity }
            : {}),
          ...(dto.reservedQuantity !== undefined
            ? { reservedQuantity: dto.reservedQuantity }
            : {}),
          ...(dto.lowStockThreshold !== undefined
            ? { lowStockThreshold: dto.lowStockThreshold }
            : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
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
        select: this.referenceSelect(true),
      });
    });

    return this.toReferenceResponse(reference);
  }

  async updateStock(id: string, dto: UpdateReferenceStockDto) {
    await this.ensureReferenceExists(id);
    this.validateStockValues(
      dto.stockQuantity,
      dto.reservedQuantity,
      dto.lowStockThreshold,
    );

    const reference = await this.prisma.productReference.update({
      where: { id },
      data: {
        stockQuantity: dto.stockQuantity,
        reservedQuantity: dto.reservedQuantity,
        lowStockThreshold: dto.lowStockThreshold,
      },
      select: {
        id: true,
        stockQuantity: true,
        reservedQuantity: true,
        lowStockThreshold: true,
      },
    });

    return this.toStockResponse(reference);
  }

  async deactivate(id: string) {
    await this.ensureReferenceExists(id);

    const reference = await this.prisma.productReference.update({
      where: { id },
      data: {
        isActive: false,
        isDefault: false,
      },
      select: this.referenceSelect(true),
    });

    return this.toReferenceResponse(reference);
  }

  private referenceSelect(includeProduct: boolean) {
    return {
      id: true,
      productId: true,
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
      ...(includeProduct
        ? {
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                isActive: true,
              },
            },
          }
        : {}),
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
    } satisfies Prisma.ProductReferenceSelect;
  }

  private toReferenceResponse(reference: any) {
    const availableStock = this.availableStock(reference);

    return {
      id: reference.id,
      productId: reference.productId,
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
      availableStock,
      lowStockThreshold: reference.lowStockThreshold,
      isLowStock: availableStock <= reference.lowStockThreshold,
      isDefault: reference.isDefault,
      isActive: reference.isActive,
      createdAt: reference.createdAt,
      updatedAt: reference.updatedAt,
      product: reference.product,
      attributes: reference.attributes,
    };
  }

  private toReferenceImageResponse(image: any) {
    if (!image) {
      return null;
    }

    return {
      id: image.id,
      mediaAssetId: image.mediaId,
      role: image.role,
      position: 0,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      bytes: image.media.bytes,
      urls: this.mediaUrlService?.buildUrls(image.media, {
        includeSwatch: true,
      }) ?? {
        original: image.media.secureUrl,
        thumbnail: image.media.secureUrl,
        card: image.media.secureUrl,
        detail: image.media.secureUrl,
        swatch: image.media.secureUrl,
      },
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private toStockResponse(reference: {
    id: string;
    stockQuantity: number;
    reservedQuantity: number;
    lowStockThreshold: number;
  }) {
    const availableStock = this.availableStock(reference);

    return {
      id: reference.id,
      stockQuantity: reference.stockQuantity,
      reservedQuantity: reference.reservedQuantity,
      availableStock,
      lowStockThreshold: reference.lowStockThreshold,
      isLowStock: availableStock <= reference.lowStockThreshold,
    };
  }

  private async ensureProductExists(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found.`);
    }
  }

  private async validateProductCanReceiveReference(
    productId: string,
    referenceWillBeActive: boolean,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, status: true },
    });

    if (!product) {
      throw new NotFoundException(`Product ${productId} was not found.`);
    }

    if (
      referenceWillBeActive &&
      (!product.isActive || product.status === ProductStatus.ARCHIVED)
    ) {
      throw new BadRequestException(
        'Inactive or archived product cannot receive a new active reference.',
      );
    }
  }

  private async ensureReferenceExists(id: string) {
    const reference = await this.prisma.productReference.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!reference) {
      throw new NotFoundException(`Product reference ${id} was not found.`);
    }
  }

  private async ensureUniqueReferenceCode(
    productId: string,
    referenceCode: string,
    currentId?: string,
  ) {
    const existing = await this.prisma.productReference.findUnique({
      where: {
        productId_referenceCode: {
          productId,
          referenceCode,
        },
      },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(
        `Reference code ${referenceCode} already exists for this product.`,
      );
    }
  }

  private async ensureUniqueSku(sku?: string | null, currentId?: string) {
    if (!sku) {
      return;
    }

    const existing = await this.prisma.productReference.findUnique({
      where: { sku },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`SKU ${sku} already exists.`);
    }
  }

  private async ensureUniqueBarcode(
    barcode?: string | null,
    currentId?: string,
  ) {
    if (!barcode) {
      return;
    }

    const existing = await this.prisma.productReference.findUnique({
      where: { barcode },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Barcode ${barcode} already exists.`);
    }
  }

  private validateStockValues(
    stockQuantity: number,
    reservedQuantity: number,
    lowStockThreshold: number,
  ) {
    if (stockQuantity < 0 || reservedQuantity < 0 || lowStockThreshold < 0) {
      throw new BadRequestException('Stock values cannot be negative.');
    }

    if (reservedQuantity > stockQuantity) {
      throw new BadRequestException(
        'Reserved quantity cannot exceed stock quantity.',
      );
    }
  }

  private async resolveAttributes(
    attributes: ReferenceAttributeInputDto[],
  ): Promise<ResolvedReferenceAttribute[]> {
    const seen = new Set<string>();
    const resolved: ResolvedReferenceAttribute[] = [];

    for (const input of attributes) {
      const group = await this.prisma.attributeGroup.findFirst({
        where: {
          code: input.attributeGroupCode,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
        },
      });

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${input.attributeGroupCode} was not found or is inactive.`,
        );
      }

      const option = await this.prisma.attributeOption.findFirst({
        where: {
          code: input.attributeOptionCode,
          attributeGroupId: group.id,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
        },
      });

      if (!option) {
        throw new BadRequestException(
          `Attribute option ${input.attributeOptionCode} was not found, inactive, or does not belong to ${input.attributeGroupCode}.`,
        );
      }

      const key = `${group.id}:${option.id}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          `Duplicate compatibility attribute ${input.attributeGroupCode}/${input.attributeOptionCode}.`,
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

  private availableStock(reference: {
    stockQuantity: number;
    reservedQuantity: number;
  }) {
    return Math.max(reference.stockQuantity - reference.reservedQuantity, 0);
  }
}
