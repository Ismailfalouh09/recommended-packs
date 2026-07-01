import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PackStatus,
  Prisma,
  ProductStatus,
  ReviewStatus,
  ReviewTargetType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import type { ValidatedImageFile } from '../media/pipes/image-file-validation.pipe';
import { buildMaskedDisplayName } from './author-display-name';
import { CreateReviewDto } from './dto/create-review.dto';
import { ModerateReviewDto } from './dto/moderate-review.dto';
import { QueryAdminReviewsDto } from './dto/query-admin-reviews.dto';
import { QueryPublicReviewsDto } from './dto/query-public-reviews.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { assertReviewEligibility } from './review-eligibility';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Reviews & Ratings (Phase R2) — customer review submission and public
 * approved-review reads.
 *
 * There is no customer login, so the delivered order is the ownership
 * credential. On create, customer identity is derived from the order (never
 * from the client) and re-verified with the Phase R1 `assertReviewEligibility`
 * gate. New reviews start PENDING and only APPROVED reviews are ever exposed
 * publicly. Rating summaries (`ratingAverage`, `reviewCount`) are computed from
 * APPROVED reviews on read — no cached aggregate columns yet.
 *
 * Public responses expose only safe review fields (rating, title, comment,
 * masked author display name, verified flag, createdAt). Phone, address,
 * customerId, orderId, quiz data, scores, costs, and margins are never returned.
 */
@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  // Ordered, public-safe projection of a review's attached images. Only the
  // fields needed to build display URLs are selected — never the raw storage
  // keys the response mapper is careful to omit.
  private readonly reviewImageSelect = {
    id: true,
    position: true,
    createdAt: true,
    media: {
      select: {
        publicId: true,
        secureUrl: true,
        mimeType: true,
        format: true,
        width: true,
        height: true,
      },
    },
  } satisfies Prisma.ReviewImageSelect;

  private get reviewImagesInclude() {
    return {
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: this.reviewImageSelect,
    } satisfies Prisma.Review$imagesArgs;
  }

  private readonly publicReviewSelect = {
    rating: true,
    title: true,
    comment: true,
    authorDisplayName: true,
    isVerifiedPurchase: true,
    createdAt: true,
    images: this.reviewImagesInclude,
  } satisfies Prisma.ReviewSelect;

  private readonly adminReviewSelect = {
    id: true,
    targetType: true,
    productId: true,
    packId: true,
    rating: true,
    title: true,
    comment: true,
    status: true,
    moderationNote: true,
    isVerifiedPurchase: true,
    authorDisplayName: true,
    createdAt: true,
    updatedAt: true,
    product: {
      select: {
        id: true,
        slug: true,
        name: true,
      },
    },
    pack: {
      select: {
        id: true,
        slug: true,
        name: true,
      },
    },
    images: this.reviewImagesInclude,
  } satisfies Prisma.ReviewSelect;

  async create(dto: CreateReviewDto) {
    // Ownership is derived from the order, never accepted from the client.
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      select: {
        id: true,
        customerId: true,
        customer: { select: { fullName: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order ${dto.orderId} was not found.`);
    }

    // Re-derive delivery + ownership + containment from the real order row.
    await assertReviewEligibility(this.prisma, {
      customerId: order.customerId,
      orderId: dto.orderId,
      targetType: dto.targetType,
      targetId: dto.targetId,
    });

    const targetLink =
      dto.targetType === ReviewTargetType.PRODUCT
        ? { productId: dto.targetId }
        : { packId: dto.targetId };

    try {
      const review = await this.prisma.review.create({
        data: {
          targetType: dto.targetType,
          ...targetLink,
          customerId: order.customerId,
          orderId: dto.orderId,
          rating: dto.rating,
          title: dto.title ?? null,
          comment: dto.comment ?? null,
          status: ReviewStatus.PENDING,
          isVerifiedPurchase: true,
          authorDisplayName: buildMaskedDisplayName(order.customer.fullName),
        },
        select: this.ownerReviewSelect,
      });

      return this.toOwnerResponse(review);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'You have already reviewed this item for this order.',
        );
      }
      throw error;
    }
  }

  async update(reviewId: string, dto: UpdateReviewDto) {
    const review = await this.loadEditableReview(reviewId, dto.orderId);

    // Only content changes are allowed; target/order/customer are immutable.
    // An edit sends the review back to PENDING for re-moderation.
    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        rating: dto.rating ?? undefined,
        title: dto.title === undefined ? undefined : dto.title,
        comment: dto.comment === undefined ? undefined : dto.comment,
        status: ReviewStatus.PENDING,
      },
      select: this.ownerReviewSelect,
    });

    return this.toOwnerResponse(updated);
  }

  async remove(reviewId: string, orderId: string) {
    const review = await this.loadEditableReview(reviewId, orderId);

    await this.prisma.review.delete({ where: { id: review.id } });

    return { id: review.id, deleted: true };
  }

  /**
   * Reviews & Ratings (Phase R2.5) — attaches a customer image to a review.
   *
   * Ownership is proven with the same `orderId` credential used for review
   * edit/delete, and only PENDING reviews accept images (APPROVED/REJECTED are
   * locked). Storage, the 5-image cap, and validation are handled by the shared
   * media pipeline. The response exposes only display-safe image fields.
   */
  async addImage(reviewId: string, orderId: string, file: ValidatedImageFile) {
    await this.loadEditableReview(reviewId, orderId);

    return this.mediaService.uploadReviewImage(reviewId, file);
  }

  /**
   * Reviews & Ratings (Phase R2.5) — removes a customer image from a PENDING
   * review. The original `orderId` is required as ownership proof; moderated
   * reviews are locked.
   */
  async removeImage(reviewId: string, imageId: string, orderId: string) {
    await this.loadEditableReview(reviewId, orderId);

    return this.mediaService.deleteReviewImage(reviewId, imageId);
  }

  async listProductReviews(slug: string, query: QueryPublicReviewsDto) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      select: { id: true, slug: true, name: true },
    });

    if (!product) {
      throw new NotFoundException('Product was not found.');
    }

    return this.buildPublicReviewPage(
      { productId: product.id },
      { id: product.id, slug: product.slug, name: product.name },
      query,
    );
  }

  async listPackReviews(slug: string, query: QueryPublicReviewsDto) {
    const pack = await this.prisma.pack.findFirst({
      where: { slug, status: PackStatus.ACTIVE, isActive: true },
      select: { id: true, slug: true, name: true },
    });

    if (!pack) {
      throw new NotFoundException('Pack was not found.');
    }

    return this.buildPublicReviewPage(
      { packId: pack.id },
      { id: pack.id, slug: pack.slug, name: pack.name },
      query,
    );
  }

  async adminFindAll(query: QueryAdminReviewsDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const where = this.buildAdminReviewWhere(query);

    const [reviews, totalItems] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.adminReviewSelect,
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      data: reviews.map((review) => this.toAdminResponse(review)),
      pagination: {
        page,
        limit,
        totalItems,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async adminModerate(reviewId: string, dto: ModerateReviewDto) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, status: true },
    });

    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    if (review.status !== ReviewStatus.PENDING) {
      throw new ConflictException('Only PENDING reviews can be moderated.');
    }

    const updated = await this.prisma.review.update({
      where: { id: review.id },
      data: {
        status: dto.status,
        moderationNote:
          dto.status === ReviewStatus.REJECTED
            ? (dto.moderationNote ?? null)
            : null,
      },
      select: this.adminReviewSelect,
    });

    return this.toAdminResponse(updated);
  }

  private readonly ownerReviewSelect = {
    id: true,
    targetType: true,
    rating: true,
    title: true,
    comment: true,
    status: true,
    isVerifiedPurchase: true,
    authorDisplayName: true,
    createdAt: true,
    updatedAt: true,
    // The owner proved ownership via the order credential, so their own
    // (possibly still-pending) image previews are safe to return here.
    images: this.reviewImagesInclude,
  } satisfies Prisma.ReviewSelect;

  /**
   * Loads a review the customer is allowed to mutate, or throws. Editing and
   * deletion require the original order as proof and are restricted to PENDING
   * reviews — APPROVED/REJECTED reviews are locked for the customer.
   */
  private async loadEditableReview(reviewId: string, orderId: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      select: { id: true, orderId: true, status: true },
    });

    if (!review) {
      throw new NotFoundException('Review was not found.');
    }

    // Ownership proof: the caller must present the review's own order id.
    if (review.orderId !== orderId) {
      throw new ForbiddenException(
        'The provided order does not match this review.',
      );
    }

    if (review.status !== ReviewStatus.PENDING) {
      throw new ForbiddenException(
        'This review has been moderated and can no longer be changed.',
      );
    }

    return review;
  }

  private async buildPublicReviewPage(
    targetWhere: Prisma.ReviewWhereInput,
    target: { id: string; slug: string; name: string },
    query: QueryPublicReviewsDto,
  ) {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const approvedWhere: Prisma.ReviewWhereInput = {
      ...targetWhere,
      status: ReviewStatus.APPROVED,
    };

    const [reviews, aggregate] = await Promise.all([
      this.prisma.review.findMany({
        where: approvedWhere,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: this.publicReviewSelect,
      }),
      // Averages/counts are computed from APPROVED reviews on read.
      this.prisma.review.aggregate({
        where: approvedWhere,
        _avg: { rating: true },
        _count: { _all: true },
      }),
    ]);

    const reviewCount = aggregate._count._all;
    const ratingAverage =
      aggregate._avg.rating == null
        ? null
        : Math.round(aggregate._avg.rating * 10) / 10;

    return {
      target,
      ratingAverage,
      reviewCount,
      reviews: reviews.map((review) => this.toPublicResponse(review)),
      pagination: {
        page,
        limit,
        total: reviewCount,
        totalPages: Math.ceil(reviewCount / limit),
      },
    };
  }

  private buildAdminReviewWhere(
    query: QueryAdminReviewsDto,
  ): Prisma.ReviewWhereInput {
    return {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.packId ? { packId: query.packId } : {}),
    };
  }

  private toPublicResponse(review: {
    rating: number;
    title: string | null;
    comment: string | null;
    authorDisplayName: string;
    isVerifiedPurchase: boolean;
    createdAt: Date;
    images: ReviewImageRow[];
  }) {
    return {
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      authorDisplayName: review.authorDisplayName,
      isVerifiedPurchase: review.isVerifiedPurchase,
      createdAt: review.createdAt,
      // The public read layer only ever returns APPROVED reviews, so these
      // images are inherently public-visible; pending reviews never reach here.
      images: this.toImageResponses(review.images),
    };
  }

  private toOwnerResponse(review: {
    id: string;
    targetType: ReviewTargetType;
    rating: number;
    title: string | null;
    comment: string | null;
    status: ReviewStatus;
    isVerifiedPurchase: boolean;
    authorDisplayName: string;
    createdAt: Date;
    updatedAt: Date;
    images: ReviewImageRow[];
  }) {
    // Deliberately omits customerId, orderId, and the target foreign keys — the
    // owner sees their own review's public-safe content plus its moderation
    // status, nothing private about themselves or the order.
    return {
      id: review.id,
      targetType: review.targetType,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      isVerifiedPurchase: review.isVerifiedPurchase,
      authorDisplayName: review.authorDisplayName,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      images: this.toImageResponses(review.images),
    };
  }

  private toAdminResponse(review: AdminReviewRow) {
    return {
      id: review.id,
      targetType: review.targetType,
      target: review.product ?? review.pack,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      status: review.status,
      moderationNote: review.moderationNote,
      isVerifiedPurchase: review.isVerifiedPurchase,
      authorDisplayName: review.authorDisplayName,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      images: this.toImageResponses(review.images),
    };
  }

  private toImageResponses(images: ReviewImageRow[]) {
    return images.map((image) =>
      this.mediaService.toReviewImageResponse(image),
    );
  }
}

type ReviewImageRow = {
  id: string;
  position: number;
  createdAt: Date;
  media: {
    publicId: string;
    secureUrl: string;
    mimeType: string;
    format: string | null;
    width: number | null;
    height: number | null;
  };
};

type AdminReviewRow = {
  id: string;
  targetType: ReviewTargetType;
  productId: string | null;
  packId: string | null;
  rating: number;
  title: string | null;
  comment: string | null;
  status: ReviewStatus;
  moderationNote: string | null;
  isVerifiedPurchase: boolean;
  authorDisplayName: string;
  createdAt: Date;
  updatedAt: Date;
  product: {
    id: string;
    slug: string;
    name: string;
  } | null;
  pack: {
    id: string;
    slug: string;
    name: string;
  } | null;
  images: ReviewImageRow[];
};
