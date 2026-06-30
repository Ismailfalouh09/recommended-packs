import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MediaRole,
  MatchType,
  PackCompatibilityCriterion,
  PackCompatibilityMode,
  PackItemRole,
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
import { PackCompatibilityInputDto } from './dto/pack-compatibility-input.dto';
import { PackItemInputDto } from './dto/pack-item-input.dto';
import { QueryPacksDto } from './dto/query-packs.dto';
import { UpdatePackDto } from './dto/update-pack.dto';
import { PACK_COMPATIBILITY_GROUP_CODE } from './pack-compatibility.constants';

interface ResolvedPackItem {
  productId: string;
  productReferenceId: string | null;
  quantity: number;
  selectionMode: SelectionMode;
  isRequired: boolean;
  sortOrder: number;
  // Pack Core Evolution (Phase 2) — additive, foundation-only fields.
  role: PackItemRole;
  minQuantity: number | null;
  maxQuantity: number | null;
  quantityEditable: boolean;
  removalAllowed: boolean;
  replacementAllowed: boolean;
  allowedReferenceIds: string[];
}

interface ResolvedPackAttribute {
  attributeGroupId: string;
  attributeOptionId: string;
  matchType: MatchType;
  scoreValue: number;
  isHardFilter: boolean;
}

// Pack Core Evolution (Phase 2.5) — resolved compatibility profile entry for one
// criterion. `optionIds` are canonical AttributeOption ids; empty for UNIVERSAL.
interface ResolvedPackCompatibility {
  criterion: PackCompatibilityCriterion;
  mode: PackCompatibilityMode;
  optionIds: string[];
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
  // Pack Core Evolution (Phase 2) — additive, foundation-only fields.
  isCustomizable: boolean;
  minRequiredItems: number | null;
  maxItemCount: number | null;
  minAllowedPrice: number | null;
  allowedAddOnIds: string[];
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
    this.validatePackRules(state);
    const items = await this.resolveItems(
      dto.items ?? [],
      this.isActivating(state),
    );
    const attributes = await this.resolveAttributes(dto.attributes ?? []);
    const allowedAddOns = await this.resolveAllowedAddOns(state.allowedAddOnIds);
    const compatibility = await this.resolveCompatibility(dto.compatibility ?? []);

    this.validatePackConfiguration(state, items);

    const pack = await this.prisma.$transaction(async (tx) =>
      tx.pack.create({
        data: {
          ...this.toPackWriteData(state),
          items: {
            create: this.toItemCreateInput(items),
          },
          attributes: {
            createMany: {
              data: attributes,
            },
          },
          ...(allowedAddOns.length
            ? { allowedAddOns: { create: allowedAddOns } }
            : {}),
          ...(compatibility.length
            ? {
                compatibilityProfiles: {
                  create: this.toCompatibilityCreateInput(compatibility),
                },
              }
            : {}),
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
    this.validatePackRules(state);

    const itemsIncluded = Object.prototype.hasOwnProperty.call(dto, 'items');
    const attributesIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'attributes',
    );
    const allowedAddOnsIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'allowedAddOnIds',
    );
    const compatibilityIncluded = Object.prototype.hasOwnProperty.call(
      dto,
      'compatibility',
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
          role: item.role,
          minQuantity: item.minQuantity,
          maxQuantity: item.maxQuantity,
          quantityEditable: item.quantityEditable,
          removalAllowed: item.removalAllowed,
          replacementAllowed: item.replacementAllowed,
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

    const requestedCompatibility: PackCompatibilityInputDto[] =
      compatibilityIncluded
        ? (dto.compatibility ?? [])
        : existing.compatibilityProfiles.map((profile: any) => ({
            criterion: profile.criterion,
            mode: profile.mode,
            optionCodes: profile.values.map(
              (value: any) => value.attributeOption.code,
            ),
          }));

    const items = await this.resolveItems(
      requestedItems,
      this.isActivating(state),
    );
    const attributes = await this.resolveAttributes(requestedAttributes);
    const allowedAddOns = allowedAddOnsIncluded
      ? await this.resolveAllowedAddOns(state.allowedAddOnIds)
      : [];
    const compatibility = await this.resolveCompatibility(requestedCompatibility);
    this.validatePackConfiguration(state, items);

    const pack = await this.prisma.$transaction(async (tx) => {
      if (itemsIncluded) {
        await tx.packItem.deleteMany({ where: { packId: id } });
      }

      if (attributesIncluded) {
        await tx.packAttribute.deleteMany({ where: { packId: id } });
      }

      if (allowedAddOnsIncluded) {
        await tx.packAllowedAddOn.deleteMany({ where: { packId: id } });
      }

      if (compatibilityIncluded) {
        await tx.packCompatibilityProfile.deleteMany({ where: { packId: id } });
      }

      return tx.pack.update({
        where: { id },
        data: {
          ...this.toPackWriteData(state),
          ...(itemsIncluded
            ? {
                items: {
                  create: this.toItemCreateInput(items),
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
          ...(allowedAddOnsIncluded && allowedAddOns.length
            ? {
                allowedAddOns: {
                  create: allowedAddOns,
                },
              }
            : {}),
          ...(compatibilityIncluded && compatibility.length
            ? {
                compatibilityProfiles: {
                  create: this.toCompatibilityCreateInput(compatibility),
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
      isCustomizable: true,
      minRequiredItems: true,
      maxItemCount: true,
      minAllowedPrice: true,
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
      isCustomizable: true,
      minRequiredItems: true,
      maxItemCount: true,
      minAllowedPrice: true,
      createdAt: true,
      updatedAt: true,
      attributes: {
        orderBy: [{ attributeGroup: { sortOrder: 'asc' } }],
        select: this.packAttributeSelect,
      },
      allowedAddOns: {
        select: {
          id: true,
          productId: true,
          productReferenceId: true,
        },
      },
      compatibilityProfiles: {
        orderBy: [{ criterion: 'asc' }],
        select: {
          id: true,
          criterion: true,
          mode: true,
          values: {
            orderBy: [{ createdAt: 'asc' }],
            select: {
              id: true,
              attributeOption: {
                select: {
                  id: true,
                  code: true,
                  label: true,
                  attributeGroup: {
                    select: {
                      code: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
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
          role: true,
          minQuantity: true,
          maxQuantity: true,
          quantityEditable: true,
          removalAllowed: true,
          replacementAllowed: true,
          allowedReferences: {
            select: {
              id: true,
              productReferenceId: true,
            },
          },
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
      isCustomizable: true,
      minRequiredItems: true,
      maxItemCount: true,
      minAllowedPrice: true,
      items: {
        select: {
          productId: true,
          productReferenceId: true,
          quantity: true,
          selectionMode: true,
          isRequired: true,
          sortOrder: true,
          role: true,
          minQuantity: true,
          maxQuantity: true,
          quantityEditable: true,
          removalAllowed: true,
          replacementAllowed: true,
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
      compatibilityProfiles: {
        select: {
          criterion: true,
          mode: true,
          values: {
            select: {
              attributeOption: {
                select: {
                  code: true,
                },
              },
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
      isCustomizable: pack.isCustomizable,
      minRequiredItems: pack.minRequiredItems ?? null,
      maxItemCount: pack.maxItemCount ?? null,
      minAllowedPrice: toMoneyNumber(pack.minAllowedPrice),
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
      allowedAddOnIds: (pack.allowedAddOns ?? []).map(
        (addOn: any) => addOn.productId,
      ),
      compatibility: (pack.compatibilityProfiles ?? []).map((profile: any) => ({
        criterion: profile.criterion,
        mode: profile.mode,
        values: (profile.values ?? []).map((value: any) => ({
          attributeOptionId: value.attributeOption.id,
          optionCode: value.attributeOption.code,
          optionLabel: value.attributeOption.label,
          attributeGroupCode: value.attributeOption.attributeGroup.code,
        })),
      })),
      items: pack.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productReferenceId: item.productReferenceId,
        quantity: item.quantity,
        selectionMode: item.selectionMode,
        isRequired: item.isRequired,
        sortOrder: item.sortOrder,
        role: item.role,
        minQuantity: item.minQuantity ?? null,
        maxQuantity: item.maxQuantity ?? null,
        quantityEditable: item.quantityEditable,
        removalAllowed: item.removalAllowed,
        replacementAllowed: item.replacementAllowed,
        allowedReferenceIds: (item.allowedReferences ?? []).map(
          (allowed: any) => allowed.productReferenceId,
        ),
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
      isCustomizable: dto.isCustomizable ?? false,
      minRequiredItems: dto.minRequiredItems ?? null,
      maxItemCount: dto.maxItemCount ?? null,
      minAllowedPrice: dto.minAllowedPrice ?? null,
      allowedAddOnIds: dto.allowedAddOnIds ?? [],
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
      isCustomizable: dto.isCustomizable ?? existing.isCustomizable,
      minRequiredItems: Object.prototype.hasOwnProperty.call(
        dto,
        'minRequiredItems',
      )
        ? (dto.minRequiredItems ?? null)
        : existing.minRequiredItems,
      maxItemCount: Object.prototype.hasOwnProperty.call(dto, 'maxItemCount')
        ? (dto.maxItemCount ?? null)
        : existing.maxItemCount,
      minAllowedPrice: Object.prototype.hasOwnProperty.call(
        dto,
        'minAllowedPrice',
      )
        ? (dto.minAllowedPrice ?? null)
        : toMoneyNumber(existing.minAllowedPrice),
      allowedAddOnIds: dto.allowedAddOnIds ?? [],
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

  /**
   * Pack Core Evolution (Phase 2) — structural validation of the additive,
   * foundation-only Pack-level rule fields. These are persisted/returned but
   * do NOT drive runtime behavior, pricing, or availability in this phase.
   */
  private validatePackRules(state: PackScalarState) {
    if (state.minRequiredItems != null && state.minRequiredItems < 0) {
      throw new BadRequestException('minRequiredItems cannot be negative.');
    }

    if (state.maxItemCount != null && state.maxItemCount < 0) {
      throw new BadRequestException('maxItemCount cannot be negative.');
    }

    if (
      state.minRequiredItems != null &&
      state.maxItemCount != null &&
      state.minRequiredItems > state.maxItemCount
    ) {
      throw new BadRequestException(
        'minRequiredItems cannot be greater than maxItemCount.',
      );
    }

    if (state.minAllowedPrice != null && state.minAllowedPrice < 0) {
      throw new BadRequestException('minAllowedPrice cannot be negative.');
    }
  }

  /**
   * Pack Core Evolution (Phase 2) — resolve the additive, foundation-only
   * allowed add-on product set. Validates referential integrity only; the
   * relation is not consumed by any runtime business logic in this phase.
   */
  private async resolveAllowedAddOns(
    productIds: string[],
  ): Promise<Prisma.PackAllowedAddOnCreateWithoutPackInput[]> {
    const seen = new Set<string>();
    const resolved: Prisma.PackAllowedAddOnCreateWithoutPackInput[] = [];

    for (const productId of productIds) {
      if (seen.has(productId)) {
        continue;
      }
      seen.add(productId);

      const product = await this.prisma.product.findUnique({
        where: { id: productId },
        select: { id: true },
      });

      if (!product) {
        throw new NotFoundException(
          `Add-on product ${productId} was not found.`,
        );
      }

      resolved.push({ product: { connect: { id: productId } } });
    }

    return resolved;
  }

  private toItemCreateInput(
    items: ResolvedPackItem[],
  ): Prisma.PackItemCreateWithoutPackInput[] {
    return items.map((item) => ({
      product: { connect: { id: item.productId } },
      ...(item.productReferenceId
        ? { productReference: { connect: { id: item.productReferenceId } } }
        : {}),
      quantity: item.quantity,
      selectionMode: item.selectionMode,
      isRequired: item.isRequired,
      sortOrder: item.sortOrder,
      role: item.role,
      minQuantity: item.minQuantity,
      maxQuantity: item.maxQuantity,
      quantityEditable: item.quantityEditable,
      removalAllowed: item.removalAllowed,
      replacementAllowed: item.replacementAllowed,
      ...(item.allowedReferenceIds.length
        ? {
            allowedReferences: {
              create: item.allowedReferenceIds.map((referenceId) => ({
                productReference: { connect: { id: referenceId } },
              })),
            },
          }
        : {}),
    }));
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

      const allowedReferenceIds = this.resolveAllowedReferenceIds(
        item,
        product,
      );

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
        role: item.role ?? PackItemRole.FIXED,
        minQuantity: item.minQuantity ?? null,
        maxQuantity: item.maxQuantity ?? null,
        quantityEditable: item.quantityEditable ?? false,
        removalAllowed: item.removalAllowed ?? false,
        replacementAllowed: item.replacementAllowed ?? false,
        allowedReferenceIds,
      });
    }

    return resolved;
  }

  /**
   * Pack Core Evolution (Phase 2) — structural validation of the additive,
   * foundation-only item quantity rules + allowed-reference set. These rules
   * are persisted/returned but do NOT drive runtime behavior in this phase.
   */
  private resolveAllowedReferenceIds(
    item: PackItemInputDto,
    product: { name: string; references: { id: string }[] },
  ): string[] {
    if (item.minQuantity != null && item.minQuantity < 0) {
      throw new BadRequestException('minQuantity cannot be negative.');
    }

    if (item.maxQuantity != null && item.maxQuantity < 0) {
      throw new BadRequestException('maxQuantity cannot be negative.');
    }

    if (
      item.minQuantity != null &&
      item.maxQuantity != null &&
      item.minQuantity > item.maxQuantity
    ) {
      throw new BadRequestException(
        'minQuantity cannot be greater than maxQuantity.',
      );
    }

    const allowedReferenceIds = Array.from(
      new Set(item.allowedReferenceIds ?? []),
    );

    for (const referenceId of allowedReferenceIds) {
      if (
        !product.references.some((reference) => reference.id === referenceId)
      ) {
        throw new BadRequestException(
          `Allowed reference ${referenceId} must belong to product ${product.name}.`,
        );
      }
    }

    return allowedReferenceIds;
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

  /**
   * Pack Core Evolution (Phase 2.5) — resolve the additive, foundation-only Pack
   * Compatibility Profile. Every value is normalized to a canonical
   * AttributeOption (single source of truth shared with the quiz); this method
   * performs structural/data-integrity validation only and the resulting data is
   * NOT consumed by recommendation, pricing, cart, checkout, or stock logic in
   * this phase.
   *
   * Validation:
   * - each criterion may appear at most once;
   * - UNIVERSAL criteria must NOT carry option codes;
   * - RESTRICTED criteria must carry >= 1 option code;
   * - every option code must resolve to an active AttributeOption belonging to
   *   the criterion's canonical group (cross-dimension links are rejected);
   * - duplicate option codes within a criterion are de-duplicated.
   */
  private async resolveCompatibility(
    inputs: PackCompatibilityInputDto[],
  ): Promise<ResolvedPackCompatibility[]> {
    const seenCriteria = new Set<PackCompatibilityCriterion>();
    const resolved: ResolvedPackCompatibility[] = [];

    for (const input of inputs) {
      if (seenCriteria.has(input.criterion)) {
        throw new BadRequestException(
          `Duplicate compatibility criterion ${input.criterion}.`,
        );
      }
      seenCriteria.add(input.criterion);

      const mode = input.mode ?? PackCompatibilityMode.RESTRICTED;
      const optionCodes = Array.from(new Set(input.optionCodes ?? []));

      if (mode === PackCompatibilityMode.UNIVERSAL) {
        if (optionCodes.length > 0) {
          throw new BadRequestException(
            `UNIVERSAL criterion ${input.criterion} must not include option codes.`,
          );
        }

        resolved.push({ criterion: input.criterion, mode, optionIds: [] });
        continue;
      }

      if (optionCodes.length === 0) {
        throw new BadRequestException(
          `RESTRICTED criterion ${input.criterion} must include at least one option code.`,
        );
      }

      const groupCode = PACK_COMPATIBILITY_GROUP_CODE[input.criterion];
      const group = await this.prisma.attributeGroup.findFirst({
        where: { code: groupCode, isActive: true },
        select: { id: true },
      });

      if (!group) {
        throw new BadRequestException(
          `Attribute group ${groupCode} for criterion ${input.criterion} was not found or is inactive.`,
        );
      }

      const optionIds: string[] = [];
      for (const code of optionCodes) {
        const option = await this.prisma.attributeOption.findFirst({
          where: {
            attributeGroupId: group.id,
            code,
            isActive: true,
          },
          select: { id: true },
        });

        if (!option) {
          throw new BadRequestException(
            `Compatibility option ${code} was not found, inactive, or does not belong to ${groupCode} (criterion ${input.criterion}).`,
          );
        }

        optionIds.push(option.id);
      }

      resolved.push({ criterion: input.criterion, mode, optionIds });
    }

    return resolved;
  }

  private toCompatibilityCreateInput(
    compatibility: ResolvedPackCompatibility[],
  ): Prisma.PackCompatibilityProfileCreateWithoutPackInput[] {
    return compatibility.map((profile) => ({
      criterion: profile.criterion,
      mode: profile.mode,
      ...(profile.optionIds.length
        ? {
            values: {
              create: profile.optionIds.map((attributeOptionId) => ({
                attributeOption: { connect: { id: attributeOptionId } },
              })),
            },
          }
        : {}),
    }));
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
      isCustomizable: state.isCustomizable,
      minRequiredItems: state.minRequiredItems,
      maxItemCount: state.maxItemCount,
      minAllowedPrice: state.minAllowedPrice,
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
