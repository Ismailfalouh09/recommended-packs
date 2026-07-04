import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackStatus,
  Prisma,
  ProductStatus,
  WishlistTargetType,
} from '@prisma/client';
import { toMoneyNumber } from '../../common/utils/decimal.util';
import { PrismaService } from '../../prisma/prisma.service';
import { AddWishlistItemDto } from './dto/add-wishlist-item.dto';

/**
 * Pack Core Evolution (Phase 8A) — Universal Wishlist.
 *
 * Ownership uses the existing anonymous-session model: the `CustomerProfile`
 * created by the quiz, identified by its `sessionToken` (passed as the
 * `X-Session-Token` header). Every read and write is scoped to the resolved
 * profile, so a session can only ever see or mutate its own wishlist.
 *
 * Only active, public Products and active, public Packs can be saved, and the
 * list response returns customer-safe summaries only — never stock counts,
 * costs, margins, admin/customization rules, quiz answers, or recommendation
 * data. PackConfiguration wishlisting and sharing are intentionally out of scope.
 */
@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly productSummarySelect = {
    id: true,
    slug: true,
    name: true,
    productType: true,
    mainImageUrl: true,
    basePrice: true,
    compareAtPrice: true,
    currency: true,
    status: true,
    brand: { select: { id: true, name: true } },
    category: { select: { id: true, code: true, name: true } },
    references: {
      where: { isActive: true },
      select: {
        priceOverride: true,
        priceDelta: true,
        stockQuantity: true,
        reservedQuantity: true,
      },
    },
  } satisfies Prisma.ProductSelect;

  private readonly packSummarySelect = {
    id: true,
    slug: true,
    name: true,
    mainImageUrl: true,
    priceMode: true,
    fixedPrice: true,
    currency: true,
    isCustomizable: true,
    tier: true,
    occasion: true,
    experienceLevel: true,
    isFeatured: true,
    isNew: true,
    isBestSeller: true,
    status: true,
    isActive: true,
  } satisfies Prisma.PackSelect;

  private readonly itemSelect = {
    id: true,
    targetType: true,
    createdAt: true,
    product: { select: this.productSummarySelect },
    pack: { select: this.packSummarySelect },
  } satisfies Prisma.WishlistItemSelect;

  async addItem(sessionToken: string | undefined, dto: AddWishlistItemDto) {
    const owner = await this.resolveOwner(sessionToken);

    const link =
      dto.targetType === WishlistTargetType.PRODUCT
        ? { productId: await this.assertSavableProduct(dto.targetId) }
        : { packId: await this.assertSavablePack(dto.targetId) };

    const uniqueWhere =
      dto.targetType === WishlistTargetType.PRODUCT
        ? {
            customerProfileId_productId: {
              customerProfileId: owner.id,
              productId: dto.targetId,
            },
          }
        : {
            customerProfileId_packId: {
              customerProfileId: owner.id,
              packId: dto.targetId,
            },
          };

    // Idempotent add: a repeat of the same target for the same owner returns the
    // existing entry with `created: false` instead of erroring.
    const existing = await this.prisma.wishlistItem.findUnique({
      where: uniqueWhere,
      select: this.itemSelect,
    });
    if (existing) {
      return { created: false, item: this.toItemResponse(existing) };
    }

    try {
      const item = await this.prisma.wishlistItem.create({
        data: {
          customerProfileId: owner.id,
          targetType: dto.targetType,
          ...link,
        },
        select: this.itemSelect,
      });
      return { created: true, item: this.toItemResponse(item) };
    } catch (error) {
      // Concurrent duplicate add — fold into the idempotent path.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const item = await this.prisma.wishlistItem.findUnique({
          where: uniqueWhere,
          select: this.itemSelect,
        });
        if (item) {
          return { created: false, item: this.toItemResponse(item) };
        }
      }
      throw error;
    }
  }

  async list(sessionToken: string | undefined) {
    const owner = await this.resolveOwner(sessionToken);

    const items = await this.prisma.wishlistItem.findMany({
      where: { customerProfileId: owner.id },
      orderBy: [{ createdAt: 'desc' }],
      select: this.itemSelect,
    });

    return { items: items.map((item) => this.toItemResponse(item)) };
  }

  async removeItem(sessionToken: string | undefined, itemId: string) {
    const owner = await this.resolveOwner(sessionToken);

    // Scope the delete to the owner so a session can never remove another
    // owner's item — a foreign id simply matches nothing.
    const result = await this.prisma.wishlistItem.deleteMany({
      where: { id: itemId, customerProfileId: owner.id },
    });

    if (result.count === 0) {
      throw new NotFoundException('Wishlist item was not found.');
    }

    return { id: itemId, deleted: true };
  }

  /**
   * Resolves the owning session (`CustomerProfile`) from the session token. A
   * missing token is a bad request; an unknown token is treated as a missing
   * session so no cross-session data can ever be reached.
   */
  private async resolveOwner(sessionToken: string | undefined) {
    const token = sessionToken?.trim();
    if (!token) {
      throw new BadRequestException(
        'The X-Session-Token header is required to access a wishlist.',
      );
    }

    const owner = await this.prisma.customerProfile.findUnique({
      where: { sessionToken: token },
      select: { id: true },
    });

    if (!owner) {
      throw new NotFoundException('Session was not found.');
    }

    return owner;
  }

  private async assertSavableProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: ProductStatus.ACTIVE },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundException(
        'Product was not found or is not available to be saved.',
      );
    }

    return product.id;
  }

  private async assertSavablePack(packId: string) {
    const pack = await this.prisma.pack.findFirst({
      where: { id: packId, status: PackStatus.ACTIVE, isActive: true },
      select: { id: true },
    });

    if (!pack) {
      throw new NotFoundException(
        'Pack was not found or is not available to be saved.',
      );
    }

    return pack.id;
  }

  private toItemResponse(item: {
    id: string;
    targetType: WishlistTargetType;
    createdAt: Date;
    product: any | null;
    pack: any | null;
  }) {
    return {
      id: item.id,
      targetType: item.targetType,
      createdAt: item.createdAt,
      product:
        item.targetType === WishlistTargetType.PRODUCT && item.product
          ? this.toProductSummary(item.product)
          : null,
      pack:
        item.targetType === WishlistTargetType.PACK && item.pack
          ? this.toPackSummary(item.pack)
          : null,
    };
  }

  private toProductSummary(product: any) {
    const basePrice = toMoneyNumber(product.basePrice) ?? 0;
    const compareAtPrice = toMoneyNumber(product.compareAtPrice);

    const effectivePrices = (product.references ?? []).map((reference: any) => {
      const override = toMoneyNumber(reference.priceOverride);
      if (override != null) {
        return override;
      }
      return basePrice + (toMoneyNumber(reference.priceDelta) ?? 0);
    });
    const priceFrom = effectivePrices.length
      ? Math.min(...effectivePrices)
      : basePrice;

    const inStock = (product.references ?? []).some(
      (reference: any) =>
        Math.max(reference.stockQuantity - reference.reservedQuantity, 0) > 0,
    );

    const onSale = compareAtPrice != null && compareAtPrice > priceFrom;

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      productType: product.productType,
      mainImageUrl: product.mainImageUrl,
      priceFrom,
      compareAtPrice: onSale ? compareAtPrice : null,
      onSale,
      currency: product.currency,
      brand: product.brand,
      category: product.category,
      inStock,
    };
  }

  private toPackSummary(pack: any) {
    return {
      id: pack.id,
      slug: pack.slug,
      name: pack.name,
      mainImageUrl: pack.mainImageUrl,
      price: toMoneyNumber(pack.fixedPrice),
      priceMode: pack.priceMode,
      currency: pack.currency,
      isCustomizable: pack.isCustomizable,
      tier: pack.tier,
      occasion: pack.occasion,
      experienceLevel: pack.experienceLevel,
      isFeatured: pack.isFeatured,
      isNew: pack.isNew,
      isBestSeller: pack.isBestSeller,
    };
  }
}
