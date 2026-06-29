import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  MatchType,
  PackStatus,
  PriceMode,
  Prisma,
  ProductStatus,
  SelectionMode,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import {
  paginatedResponse,
  paginationParams,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaUrlService } from '../media/media-url.service';
import { CreatePackDto } from './dto/create-pack.dto';
import { PackAttributeInputDto } from './dto/pack-attribute-input.dto';
import { PackItemInputDto } from './dto/pack-item-input.dto';
import { QueryPacksDto } from './dto/query-packs.dto';
import { UpdatePackDto } from './dto/update-pack.dto';

interface ResolvedPackItem {
  productId: string;
  productReferenceId: string | null;
  quantity: number;
  selectionMode: SelectionMode;
  isRequired: boolean;
  sortOrder: number;
}

interface ResolvedPackAttribute {
  attributeGroupId: string;
  attributeOptionId: string;
  matchType: MatchType;
  scoreValue: number;
  isHardFilter: boolean;
}

interface PackScalarState {
  name: string;
  slug: string;
  description: string | null;
  mainImageUrl: string | null;
  priceMode: PriceMode;
  fixedPrice: number | null;
  discountAmount: number | null;
  discountPercentage: number | null;
  minBudget: number | null;
  maxBudget: number | null;
  currency: string;
  priority: number;
  status: PackStatus;
  isActive: boolean;
}

@Injectable()
export class PacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaUrlService?: MediaUrlService,
  ) {}

  private readonly packAttributeSelect = {
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
  } satisfies Prisma.PackAttributeSelect;

  private readonly fixedReferenceSelect = {
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
  } satisfies Prisma.ProductReferenceSelect;

  private readonly productSummarySelect = {
    id: true,
    name: true,
    slug: true,
    basePrice: true,
    currency: true,
    mainImageUrl: true,
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
    category: {
      select: {
        id: true,
        code: true,
        name: true,
      },
    },
    brand: {
      select: {
        id: true,
        name: true,
      },
    },
  } satisfies Prisma.ProductSelect;

  private packSelect(includeProductReferences: boolean) {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      mainImageUrl: true,
      priceMode: true,
      fixedPrice: true,
      discountAmount: true,
      discountPercentage: true,
      minBudget: true,
      maxBudget: true,
      currency: true,
      priority: true,
      status: true,
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
      attributes: {
        orderBy: [{ attributeGroup: { sortOrder: 'asc' } }],
        select: this.packAttributeSelect,
      },
      items: {
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          id: true,
          quantity: true,
          selectionMode: true,
          isRequired: true,
          sortOrder: true,
          product: {
            select: includeProductReferences
              ? {
                  ...this.productSummarySelect,
                  references: {
                    where: { isActive: true },
                    orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
                    select: this.fixedReferenceSelect,
                  },
                }
              : this.productSummarySelect,
          },
          productReference: {
            select: this.fixedReferenceSelect,
          },
        },
      },
    } satisfies Prisma.PackSelect;
  }

  async findAll() {
    const packs = await this.prisma.pack.findMany({
      where: {
        isActive: true,
        status: 'ACTIVE',
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: this.packSelect(false),
    });

    return packs.map((pack) => this.toPublicPackResponse(pack));
  }

  async findOne(id: string) {
    const pack = await this.prisma.pack.findFirst({
      where: {
        id,
        isActive: true,
        status: 'ACTIVE',
      },
      select: this.packSelect(true),
    });

    if (!pack) {
      throw new NotFoundException(`Pack ${id} was not found.`);
    }

    return this.toPublicPackResponse(pack);
  }

  async findBySlug(slug: string) {
    const pack = await this.prisma.pack.findFirst({
      where: {
        slug,
        isActive: true,
        status: PackStatus.ACTIVE,
      },
      select: this.packSelect(true),
    });

    if (!pack) {
      throw new NotFoundException(`Pack ${slug} was not found.`);
    }

    return this.toPublicPackResponse(pack);
  }

  async adminFindAll(query: QueryPacksDto) {
    const pagination = paginationParams(query);
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';
    const where: Prisma.PackWhereInput = {
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.priceMode !== undefined ? { priceMode: query.priceMode } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            fixedPrice: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [packs, totalItems] = await this.prisma.$transaction([
      this.prisma.pack.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ [sortBy]: sortOrder }],
        select: this.adminListSelect(),
      }),
      this.prisma.pack.count({ where }),
    ]);

    return paginatedResponse(
      packs.map((pack) => this.toAdminListResponse(pack)),
      { ...pagination, totalItems },
    );
  }

  async adminFindOne(id: string) {
    const pack = await this.prisma.pack.findUnique({
      where: { id },
      select: this.adminDetailSelect(),
    });

    if (!pack) {
      throw new NotFoundException(`Pack ${id} was not found.`);
    }

    return this.toAdminDetailResponse(pack);
  }

  async adminCreate(dto: CreatePackDto) {
    await this.ensureUniqueSlug(dto.slug);

    const state = this.normalizedCreateState(dto);
    this.validatePricing(state);
    const items = await this.resolveItems(
      dto.items ?? [],
      this.isActivating(state),
    );
    const attributes = await this.resolveAttributes(dto.attributes ?? []);

    this.validatePackConfiguration(state, items);

    const pack = await this.prisma.$transaction(async (tx) =>
      tx.pack.create({
        data: {
          ...this.toPackWriteData(state),
          items: {
            createMany: {
              data: items,
            },
          },
          attributes: {
            createMany: {
              data: attributes,
            },
          },
        },
        select: this.adminDetailSelect(),
      }),
    );

    return this.toAdminDetailResponse(pack);
  }

  async adminUpdate(id: string, dto: UpdatePackDto) {
    const existing = await this.prisma.pack.findUnique({
      where: { id },
      select: this.adminUpdateSelect(),
    });

    if (!existing) {
      throw new NotFoundException(`Pack ${id} was not found.`);
    }

    if (dto.slug) {
      await this.ensureUniqueSlug(dto.slug, id);
    }

    if (
      existing.status === PackStatus.ARCHIVED &&
      dto.status === undefined &&
      dto.isActive === true
    ) {
      throw new BadRequestException(
        'Archived pack cannot become active unless status is explicitly changed.',
      );
    }

    const state = this.normalizedUpdateState(existing, dto);
    this.validatePricing(state);

    const itemsIncluded = Object.prototype.hasOwnProperty.call(dto, 'items');
    const attributesIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'attributes',
    );
    const requestedItems = itemsIncluded
      ? (dto.items ?? [])
      : existing.items.map((item) => ({
          productId: item.productId,
          productReferenceId: item.productReferenceId,
          quantity: item.quantity,
          selectionMode: item.selectionMode,
          isRequired: item.isRequired,
          sortOrder: item.sortOrder,
        }));
    const requestedAttributes = attributesIncluded
      ? (dto.attributes ?? [])
      : existing.attributes.map((attribute) => ({
          attributeGroupCode: attribute.attributeGroup.code,
          attributeOptionCode: attribute.attributeOption.code,
          matchType: attribute.matchType,
          scoreValue: attribute.scoreValue,
          isHardFilter: attribute.isHardFilter,
        }));

    const items = await this.resolveItems(
      requestedItems,
      this.isActivating(state),
    );
    const attributes = await this.resolveAttributes(requestedAttributes);
    this.validatePackConfiguration(state, items);

    const pack = await this.prisma.$transaction(async (tx) => {
      if (itemsIncluded) {
        await tx.packItem.deleteMany({ where: { packId: id } });
      }

      if (attributesIncluded) {
        await tx.packAttribute.deleteMany({ where: { packId: id } });
      }

      return tx.pack.update({
        where: { id },
        data: {
          ...this.toPackWriteData(state),
          ...(itemsIncluded
            ? {
                items: {
                  createMany: {
                    data: items,
                  },
                },
              }
            : {}),
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

    return this.toAdminDetailResponse(pack);
  }

  async adminArchive(id: string) {
    const existing = await this.prisma.pack.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`Pack ${id} was not found.`);
    }

    const pack = await this.prisma.pack.update({
      where: { id },
      data: {
        status: PackStatus.ARCHIVED,
        isActive: false,
      },
      select: this.adminDetailSelect(),
    });

    return this.toAdminDetailResponse(pack);
  }

  private adminListSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      mainImageUrl: true,
      priceMode: true,
      fixedPrice: true,
      discountAmount: true,
      discountPercentage: true,
      minBudget: true,
      maxBudget: true,
      currency: true,
      priority: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
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
      _count: {
        select: {
          items: true,
          attributes: true,
        },
      },
    } satisfies Prisma.PackSelect;
  }

  private adminDetailSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      mainImageUrl: true,
      priceMode: true,
      fixedPrice: true,
      discountAmount: true,
      discountPercentage: true,
      minBudget: true,
      maxBudget: true,
      currency: true,
      priority: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      attributes: {
        orderBy: [{ attributeGroup: { sortOrder: 'asc' } }],
        select: this.packAttributeSelect,
      },
      items: {
        orderBy: [{ sortOrder: 'asc' }],
        select: {
          id: true,
          productId: true,
          productReferenceId: true,
          quantity: true,
          selectionMode: true,
          isRequired: true,
          sortOrder: true,
          product: {
            select: {
              ...this.productSummarySelect,
              status: true,
              isActive: true,
              references: {
                orderBy: [{ isDefault: 'desc' }, { referenceCode: 'asc' }],
                select: {
                  ...this.fixedReferenceSelect,
                  reservedQuantity: true,
                  isActive: true,
                },
              },
            },
          },
          productReference: {
            select: {
              ...this.fixedReferenceSelect,
              reservedQuantity: true,
              isActive: true,
            },
          },
        },
      },
      _count: {
        select: {
          recommendationResults: true,
          orders: true,
        },
      },
    } satisfies Prisma.PackSelect;
  }

  private adminUpdateSelect() {
    return {
      id: true,
      name: true,
      slug: true,
      description: true,
      mainImageUrl: true,
      priceMode: true,
      fixedPrice: true,
      discountAmount: true,
      discountPercentage: true,
      minBudget: true,
      maxBudget: true,
      currency: true,
      priority: true,
      status: true,
      isActive: true,
      items: {
        select: {
          productId: true,
          productReferenceId: true,
          quantity: true,
          selectionMode: true,
          isRequired: true,
          sortOrder: true,
        },
      },
      attributes: {
        select: {
          matchType: true,
          scoreValue: true,
          isHardFilter: true,
          attributeGroup: {
            select: {
              code: true,
            },
          },
          attributeOption: {
            select: {
              code: true,
            },
          },
        },
      },
    } satisfies Prisma.PackSelect;
  }

  private toAdminListResponse(pack: any) {
    return {
      id: pack.id,
      name: pack.name,
      slug: pack.slug,
      description: pack.description,
      mainImageUrl: pack.mainImageUrl,
      priceMode: pack.priceMode,
      fixedPrice: toMoneyNumber(pack.fixedPrice),
      discountAmount: toMoneyNumber(pack.discountAmount),
      discountPercentage: toMoneyNumber(pack.discountPercentage),
      minBudget: toMoneyNumber(pack.minBudget),
      maxBudget: toMoneyNumber(pack.maxBudget),
      currency: pack.currency,
      priority: pack.priority,
      status: pack.status,
      isActive: pack.isActive,
      itemCount: pack._count.items,
      attributeCount: pack._count.attributes,
      createdAt: pack.createdAt,
      updatedAt: pack.updatedAt,
      coverImage: this.coverImage(pack.images ?? []),
      images: (pack.images ?? []).map((image: any) =>
        this.toImageResponse(image),
      ),
    };
  }

  private toAdminDetailResponse(pack: any) {
    const structural = this.structuralValidation(pack);

    return {
      ...this.toAdminListResponse({
        ...pack,
        _count: {
          items: pack.items.length,
          attributes: pack.attributes.length,
        },
      }),
      recommendationUsageCount: pack._count.recommendationResults,
      orderUsageCount: pack._count.orders,
      requiredItemCount: pack.items.filter((item: any) => item.isRequired)
        .length,
      hasValidConfiguration: structural.validationIssues.length === 0,
      validationIssues: structural.validationIssues,
      attributes: pack.attributes,
      items: pack.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productReferenceId: item.productReferenceId,
        quantity: item.quantity,
        selectionMode: item.selectionMode,
        isRequired: item.isRequired,
        sortOrder: item.sortOrder,
        product: {
          ...item.product,
          basePrice: toMoneyNumber(item.product.basePrice),
          coverImage: this.coverImage(item.product.images ?? []),
          images: (item.product.images ?? []).map((image: any) =>
            this.toImageResponse(image),
          ),
          references: item.product.references.map((reference: any) => ({
            ...reference,
            priceOverride: toMoneyNumber(reference.priceOverride),
            priceDelta: toMoneyNumber(reference.priceDelta),
            availableStock: Math.max(
              reference.stockQuantity - reference.reservedQuantity,
              0,
            ),
            image: this.toReferenceImageResponse(reference.image),
          })),
        },
        productReference: item.productReference
          ? {
              ...item.productReference,
              priceOverride: toMoneyNumber(item.productReference.priceOverride),
              priceDelta: toMoneyNumber(item.productReference.priceDelta),
              availableStock: Math.max(
                item.productReference.stockQuantity -
                  item.productReference.reservedQuantity,
                0,
              ),
              image: this.toReferenceImageResponse(item.productReference.image),
            }
          : null,
      })),
    };
  }

  private toPublicPackResponse(pack: any) {
    return {
      ...pack,
      fixedPrice: toMoneyNumber(pack.fixedPrice),
      discountAmount: toMoneyNumber(pack.discountAmount),
      discountPercentage: toMoneyNumber(pack.discountPercentage),
      minBudget: toMoneyNumber(pack.minBudget),
      maxBudget: toMoneyNumber(pack.maxBudget),
      coverImage: this.coverImage(pack.images),
      images: pack.images.map((image: any) => this.toImageResponse(image)),
      items: pack.items.map((item: any) => ({
        ...item,
        product: {
          ...item.product,
          basePrice: toMoneyNumber(item.product.basePrice),
          coverImage: this.coverImage(item.product.images ?? []),
          images: (item.product.images ?? []).map((image: any) =>
            this.toImageResponse(image),
          ),
          references: (item.product.references ?? []).map((reference: any) => ({
            ...reference,
            priceOverride: toMoneyNumber(reference.priceOverride),
            priceDelta: toMoneyNumber(reference.priceDelta),
            image: this.toReferenceImageResponse(reference.image),
          })),
        },
        productReference: item.productReference
          ? {
              ...item.productReference,
              priceOverride: toMoneyNumber(item.productReference.priceOverride),
              priceDelta: toMoneyNumber(item.productReference.priceDelta),
              image: this.toReferenceImageResponse(item.productReference.image),
            }
          : null,
      })),
    };
  }

  private coverImage(images: any[] = []) {
    const cover = images.find((image) => image.role === MediaRole.COVER);
    return cover ? this.toImageResponse(cover) : null;
  }

  private toReferenceImageResponse(image: any) {
    if (!image) {
      return null;
    }

    return this.toImageResponse(
      {
        ...image,
        role: image.role ?? MediaRole.SWATCH,
        position: 0,
      },
      true,
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

  private normalizedCreateState(dto: CreatePackDto): PackScalarState {
    const status = dto.status ?? PackStatus.DRAFT;

    return {
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      mainImageUrl: dto.mainImageUrl ?? null,
      priceMode: dto.priceMode,
      fixedPrice: dto.fixedPrice ?? null,
      discountAmount: dto.discountAmount ?? null,
      discountPercentage: dto.discountPercentage ?? null,
      minBudget: dto.minBudget ?? null,
      maxBudget: dto.maxBudget ?? null,
      currency: dto.currency ?? 'MAD',
      priority: dto.priority ?? 0,
      status,
      isActive: status === PackStatus.ARCHIVED ? false : (dto.isActive ?? true),
    };
  }

  private normalizedUpdateState(
    existing: any,
    dto: UpdatePackDto,
  ): PackScalarState {
    const status = dto.status ?? existing.status;

    return {
      name: dto.name ?? existing.name,
      slug: dto.slug ?? existing.slug,
      description: Object.prototype.hasOwnProperty.call(dto, 'description')
        ? (dto.description ?? null)
        : existing.description,
      mainImageUrl: Object.prototype.hasOwnProperty.call(dto, 'mainImageUrl')
        ? (dto.mainImageUrl ?? null)
        : existing.mainImageUrl,
      priceMode: dto.priceMode ?? existing.priceMode,
      fixedPrice: Object.prototype.hasOwnProperty.call(dto, 'fixedPrice')
        ? (dto.fixedPrice ?? null)
        : toMoneyNumber(existing.fixedPrice),
      discountAmount: Object.prototype.hasOwnProperty.call(
        dto,
        'discountAmount',
      )
        ? (dto.discountAmount ?? null)
        : toMoneyNumber(existing.discountAmount),
      discountPercentage: Object.prototype.hasOwnProperty.call(
        dto,
        'discountPercentage',
      )
        ? (dto.discountPercentage ?? null)
        : toMoneyNumber(existing.discountPercentage),
      minBudget: Object.prototype.hasOwnProperty.call(dto, 'minBudget')
        ? (dto.minBudget ?? null)
        : toMoneyNumber(existing.minBudget),
      maxBudget: Object.prototype.hasOwnProperty.call(dto, 'maxBudget')
        ? (dto.maxBudget ?? null)
        : toMoneyNumber(existing.maxBudget),
      currency: dto.currency ?? existing.currency,
      priority: dto.priority ?? existing.priority,
      status,
      isActive:
        status === PackStatus.ARCHIVED
          ? false
          : (dto.isActive ?? existing.isActive),
    };
  }

  private validatePricing(state: PackScalarState) {
    if (
      state.minBudget !== null &&
      state.maxBudget !== null &&
      state.minBudget > state.maxBudget
    ) {
      throw new BadRequestException(
        'minBudget cannot be greater than maxBudget.',
      );
    }

    if (state.priceMode === PriceMode.FIXED) {
      if (state.fixedPrice === null) {
        throw new BadRequestException(
          'fixedPrice is required for FIXED packs.',
        );
      }

      state.discountAmount = null;
      state.discountPercentage = null;
      return;
    }

    state.fixedPrice = null;

    if (state.priceMode === PriceMode.SUM_ITEMS) {
      state.discountAmount = null;
      state.discountPercentage = null;
      return;
    }

    if (state.discountAmount !== null && state.discountPercentage !== null) {
      throw new BadRequestException(
        'Use either discountAmount or discountPercentage, not both.',
      );
    }
  }

  private validatePackConfiguration(
    state: PackScalarState,
    items: ResolvedPackItem[],
  ) {
    if (this.isActivating(state) && items.length === 0) {
      throw new BadRequestException(
        'Active pack must contain at least one item.',
      );
    }
  }

  private async resolveItems(
    items: PackItemInputDto[],
    activating: boolean,
  ): Promise<ResolvedPackItem[]> {
    const seenProducts = new Set<string>();
    const resolved: ResolvedPackItem[] = [];

    for (const item of items) {
      if (seenProducts.has(item.productId)) {
        throw new BadRequestException(
          'The same product cannot appear more than once inside a pack.',
        );
      }
      seenProducts.add(item.productId);

      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        select: {
          id: true,
          name: true,
          status: true,
          isActive: true,
          references: {
            select: {
              id: true,
              productId: true,
              stockQuantity: true,
              reservedQuantity: true,
              isActive: true,
            },
          },
        },
      });

      if (!product) {
        throw new NotFoundException(`Product ${item.productId} was not found.`);
      }

      const isRequired = item.isRequired ?? true;
      if (
        activating &&
        isRequired &&
        (!product.isActive || product.status !== ProductStatus.ACTIVE)
      ) {
        throw new BadRequestException(
          `Required product ${product.name} must be active before activating the pack.`,
        );
      }

      if (item.selectionMode === SelectionMode.CUSTOMER_CHOICE) {
        throw new BadRequestException(
          'CUSTOMER_CHOICE pack items are not supported yet. Use FIXED_REFERENCE or AUTO_BEST_REFERENCE.',
        );
      }

      if (item.selectionMode === SelectionMode.FIXED_REFERENCE) {
        if (!item.productReferenceId) {
          throw new BadRequestException(
            'FIXED_REFERENCE items require productReferenceId.',
          );
        }

        const reference = product.references.find(
          (productReference) => productReference.id === item.productReferenceId,
        );

        if (!reference) {
          throw new BadRequestException(
            'Fixed product reference must belong to the selected product.',
          );
        }

        if (
          activating &&
          (!product.isActive ||
            !reference.isActive ||
            this.availableReferenceStock(reference) <= 0)
        ) {
          throw new BadRequestException(
            `Fixed reference for product ${product.name} must be active and in stock before activating the pack.`,
          );
        }
      } else {
        if (item.productReferenceId) {
          throw new BadRequestException(
            `${item.selectionMode} items must not include productReferenceId.`,
          );
        }

        if (product.references.length === 0) {
          throw new BadRequestException(
            `Product ${product.name} must have at least one reference.`,
          );
        }

        if (
          activating &&
          product.references.every(
            (reference) =>
              !reference.isActive ||
              this.availableReferenceStock(reference) <= 0,
          )
        ) {
          throw new BadRequestException(
            `Product ${product.name} must have at least one active in-stock reference before activating the pack.`,
          );
        }
      }

      resolved.push({
        productId: item.productId,
        productReferenceId:
          item.selectionMode === SelectionMode.FIXED_REFERENCE
            ? (item.productReferenceId ?? null)
            : null,
        quantity: item.quantity ?? 1,
        selectionMode: item.selectionMode,
        isRequired,
        sortOrder: item.sortOrder ?? 0,
      });
    }

    return resolved;
  }

  private async resolveAttributes(
    attributes: PackAttributeInputDto[],
  ): Promise<ResolvedPackAttribute[]> {
    const seen = new Set<string>();
    const resolved: ResolvedPackAttribute[] = [];

    for (const input of attributes) {
      const group = await this.prisma.attributeGroup.findFirst({
        where: {
          code: input.attributeGroupCode,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${input.attributeGroupCode} was not found or is inactive.`,
        );
      }

      const option = await this.prisma.attributeOption.findFirst({
        where: {
          attributeGroupId: group.id,
          code: input.attributeOptionCode,
          isActive: true,
        },
        select: {
          id: true,
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
          `Duplicate pack attribute ${input.attributeGroupCode}/${input.attributeOptionCode}.`,
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

  private async ensureUniqueSlug(slug: string, currentId?: string) {
    const existing = await this.prisma.pack.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing && existing.id !== currentId) {
      throw new ConflictException(`Pack slug ${slug} already exists.`);
    }
  }

  private toPackWriteData(state: PackScalarState) {
    return {
      name: state.name,
      slug: state.slug,
      description: state.description,
      mainImageUrl: state.mainImageUrl,
      priceMode: state.priceMode,
      fixedPrice: state.fixedPrice,
      discountAmount: state.discountAmount,
      discountPercentage: state.discountPercentage,
      minBudget: state.minBudget,
      maxBudget: state.maxBudget,
      currency: state.currency,
      priority: state.priority,
      status: state.status,
      isActive: state.isActive,
    };
  }

  private isActivating(state: PackScalarState) {
    return state.status === PackStatus.ACTIVE && state.isActive;
  }

  private structuralValidation(pack: any) {
    const validationIssues: string[] = [];

    if (
      pack.status === PackStatus.ACTIVE &&
      pack.isActive &&
      pack.items.length === 0
    ) {
      validationIssues.push('Active pack has no items.');
    }

    for (const item of pack.items) {
      if (
        item.isRequired &&
        (!item.product.isActive || item.product.status !== ProductStatus.ACTIVE)
      ) {
        validationIssues.push(`Product ${item.product.name} is not active.`);
      }

      if (
        item.selectionMode === SelectionMode.FIXED_REFERENCE &&
        (!item.productReference?.isActive ||
          this.availableReferenceStock(item.productReference) <= 0)
      ) {
        validationIssues.push(
          `Fixed reference for product ${item.product.name} is not active or in stock.`,
        );
      }

      if (
        item.selectionMode !== SelectionMode.FIXED_REFERENCE &&
        item.product.references.every(
          (reference: any) =>
            !reference.isActive || this.availableReferenceStock(reference) <= 0,
        )
      ) {
        validationIssues.push(
          `Product ${item.product.name} has no active in-stock reference.`,
        );
      }
    }

    return { validationIssues };
  }

  private availableReferenceStock(reference: {
    stockQuantity: number;
    reservedQuantity?: number | null;
  }) {
    return Math.max(
      reference.stockQuantity - (reference.reservedQuantity ?? 0),
      0,
    );
  }
}
