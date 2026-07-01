import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaAsset,
  MediaAssetProvider,
  MediaAssetType,
  MediaRole,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  paginationParams,
  paginatedResponse,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import {
  allowedImageExtensions,
  allowedImageMimeTypes,
  maxReviewImages,
} from './constants/media.constants';
import { MediaUrlService } from './media-url.service';
import { QueryMediaAssetsDto } from './dto/query-media-assets.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { UpdateMediaAssetDto } from './dto/update-media-asset.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { UploadMediaDto, UploadSingleImageDto } from './dto/upload-media.dto';
import type { ValidatedImageFile } from './pipes/image-file-validation.pipe';
import { readCloudinaryMediaConfig } from './providers/cloudinary.config';
import {
  MediaStorageProvider,
  StoredMedia,
} from './providers/media-storage.provider';

type MediaEntityType =
  | 'products'
  | 'packs'
  | 'categories'
  | 'product-references'
  | 'reviews'
  | 'misc';

type Tx = Prisma.TransactionClient;

type ImageRelation = {
  id: string;
  mediaId: string;
  role?: MediaRole;
  position?: number;
  altText: string | null;
  createdAt: Date;
  updatedAt?: Date;
  media: MediaAsset;
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageProvider: MediaStorageProvider,
    private readonly configService: ConfigService,
    private readonly mediaUrlService: MediaUrlService,
  ) {}

  async uploadImage(
    file: ValidatedImageFile,
    dto: UploadMediaDto,
    currentAdmin: CurrentAdmin,
  ) {
    const uploaded = await this.uploadToProvider(file, 'misc', undefined);

    try {
      const mediaAsset = await this.prisma.mediaAsset.create({
        data: this.toMediaAssetData(uploaded, file, currentAdmin, {
          altText: dto.altText,
          usageContext: 'UNASSIGNED',
        }),
        include: this.detailInclude(),
      });

      this.logger.log({
        operation: 'media_upload_database_succeeded',
        mediaId: mediaAsset.id,
        publicId: mediaAsset.publicId,
      });

      return this.toAssetResponse(mediaAsset);
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'media_upload_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  async uploadProductImage(
    productId: string,
    file: ValidatedImageFile,
    dto: UploadMediaDto,
    currentAdmin: CurrentAdmin,
  ) {
    await this.ensureProductExists(productId);
    const role = this.normalizedGalleryRole(dto.role);
    const uploaded = await this.uploadToProvider(file, 'products', productId);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        const mediaAsset = await tx.mediaAsset.create({
          data: this.toMediaAssetData(uploaded, file, currentAdmin, {
            altText: dto.altText,
            usageContext:
              role === MediaRole.COVER
                ? 'PRODUCT_COVER_IMAGE'
                : 'PRODUCT_GALLERY_IMAGE',
            relatedEntity: 'PRODUCT',
            relatedEntityId: productId,
          }),
        });

        if (role === MediaRole.COVER) {
          await tx.productImage.updateMany({
            where: { productId, role: MediaRole.COVER },
            data: { role: MediaRole.GALLERY },
          });
        }

        return tx.productImage.create({
          data: {
            productId,
            mediaId: mediaAsset.id,
            role,
            position:
              dto.position ??
              (await this.nextProductImagePosition(tx, productId, role)),
            altText: dto.altText ?? null,
          },
          include: { media: true },
        });
      });

      this.logger.log({
        operation: 'product_image_attachment_succeeded',
        entityType: 'PRODUCT',
        entityId: productId,
        mediaId: image.mediaId,
        publicId: image.media.publicId,
      });

      return this.toImageResponse(image);
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'product_image_upload_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  async updateProductImage(
    productId: string,
    imageId: string,
    dto: UpdateMediaDto,
  ) {
    await this.ensureProductExists(productId);
    const role = dto.role ? this.normalizedGalleryRole(dto.role) : undefined;

    const image = await this.prisma.$transaction(async (tx) => {
      await this.ensureProductImageBelongsToProduct(tx, productId, imageId);

      if (role === MediaRole.COVER) {
        await tx.productImage.updateMany({
          where: { productId, role: MediaRole.COVER, id: { not: imageId } },
          data: { role: MediaRole.GALLERY },
        });
      }

      return tx.productImage.update({
        where: { id: imageId },
        data: {
          ...(role ? { role } : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'altText')
            ? { altText: dto.altText ?? null }
            : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        },
        include: { media: true },
      });
    });

    return this.toImageResponse(image);
  }

  async reorderProductImages(productId: string, dto: ReorderMediaDto) {
    await this.ensureProductExists(productId);
    this.validateReorderInput(dto);

    const images = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.productImage.findMany({
        where: { productId, id: { in: dto.items.map((item) => item.imageId) } },
        select: { id: true },
      });

      if (existing.length !== dto.items.length) {
        throw new BadRequestException(
          'All image IDs must belong to this product.',
        );
      }

      for (const item of dto.items) {
        await tx.productImage.update({
          where: { id: item.imageId },
          data: { position: item.position },
        });
      }

      return tx.productImage.findMany({
        where: { productId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { media: true },
      });
    });

    return images.map((image) => this.toImageResponse(image));
  }

  async deleteProductImage(productId: string, imageId: string) {
    await this.ensureProductExists(productId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const image = await this.ensureProductImageBelongsToProduct(
        tx,
        productId,
        imageId,
      );
      await tx.productImage.delete({ where: { id: imageId } });

      const deletedMedia = await this.deleteMediaAssetIfUnreferenced(
        tx,
        image.mediaId,
      );

      return {
        imageId,
        mediaAssetId: image.mediaId,
        publicId: deletedMedia?.publicId,
      };
    });

    await this.deleteProviderAfterDatabaseCleanup(
      deleted.publicId,
      'product_image_delete_provider_failed',
    );

    return { ...deleted, deleted: true };
  }

  async uploadPackImage(
    packId: string,
    file: ValidatedImageFile,
    dto: UploadMediaDto,
    currentAdmin: CurrentAdmin,
  ) {
    await this.ensurePackExists(packId);
    const role = this.normalizedGalleryRole(dto.role);
    const uploaded = await this.uploadToProvider(file, 'packs', packId);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        const mediaAsset = await tx.mediaAsset.create({
          data: this.toMediaAssetData(uploaded, file, currentAdmin, {
            altText: dto.altText,
            usageContext:
              role === MediaRole.COVER
                ? 'PACK_COVER_IMAGE'
                : 'PACK_GALLERY_IMAGE',
            relatedEntity: 'PACK',
            relatedEntityId: packId,
          }),
        });

        if (role === MediaRole.COVER) {
          await tx.packImage.updateMany({
            where: { packId, role: MediaRole.COVER },
            data: { role: MediaRole.GALLERY },
          });
        }

        return tx.packImage.create({
          data: {
            packId,
            mediaId: mediaAsset.id,
            role,
            position:
              dto.position ??
              (await this.nextPackImagePosition(tx, packId, role)),
            altText: dto.altText ?? null,
          },
          include: { media: true },
        });
      });

      this.logger.log({
        operation: 'pack_image_attachment_succeeded',
        entityType: 'PACK',
        entityId: packId,
        mediaId: image.mediaId,
        publicId: image.media.publicId,
      });

      return this.toImageResponse(image);
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'pack_image_upload_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  async updatePackImage(packId: string, imageId: string, dto: UpdateMediaDto) {
    await this.ensurePackExists(packId);
    const role = dto.role ? this.normalizedGalleryRole(dto.role) : undefined;

    const image = await this.prisma.$transaction(async (tx) => {
      await this.ensurePackImageBelongsToPack(tx, packId, imageId);

      if (role === MediaRole.COVER) {
        await tx.packImage.updateMany({
          where: { packId, role: MediaRole.COVER, id: { not: imageId } },
          data: { role: MediaRole.GALLERY },
        });
      }

      return tx.packImage.update({
        where: { id: imageId },
        data: {
          ...(role ? { role } : {}),
          ...(Object.prototype.hasOwnProperty.call(dto, 'altText')
            ? { altText: dto.altText ?? null }
            : {}),
          ...(dto.position !== undefined ? { position: dto.position } : {}),
        },
        include: { media: true },
      });
    });

    return this.toImageResponse(image);
  }

  async reorderPackImages(packId: string, dto: ReorderMediaDto) {
    await this.ensurePackExists(packId);
    this.validateReorderInput(dto);

    const images = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.packImage.findMany({
        where: { packId, id: { in: dto.items.map((item) => item.imageId) } },
        select: { id: true },
      });

      if (existing.length !== dto.items.length) {
        throw new BadRequestException(
          'All image IDs must belong to this pack.',
        );
      }

      for (const item of dto.items) {
        await tx.packImage.update({
          where: { id: item.imageId },
          data: { position: item.position },
        });
      }

      return tx.packImage.findMany({
        where: { packId },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: { media: true },
      });
    });

    return images.map((image) => this.toImageResponse(image));
  }

  async deletePackImage(packId: string, imageId: string) {
    await this.ensurePackExists(packId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const image = await this.ensurePackImageBelongsToPack(
        tx,
        packId,
        imageId,
      );
      await tx.packImage.delete({ where: { id: imageId } });

      const deletedMedia = await this.deleteMediaAssetIfUnreferenced(
        tx,
        image.mediaId,
      );

      return {
        imageId,
        mediaAssetId: image.mediaId,
        publicId: deletedMedia?.publicId,
      };
    });

    await this.deleteProviderAfterDatabaseCleanup(
      deleted.publicId,
      'pack_image_delete_provider_failed',
    );

    return { ...deleted, deleted: true };
  }

  /**
   * Reviews & Ratings (Phase R2.5) — attaches a customer image to a review.
   *
   * Ownership and the PENDING-only rule are enforced by the caller
   * (`ReviewsService`) before this runs; here we only reuse the shared media
   * pipeline: validate + upload to the storage provider, persist a `MediaAsset`
   * (no `uploadedByAdminId` — this is a customer upload) and a `ReviewImage`
   * link. The 5-image cap is checked up front and re-checked inside the write
   * transaction so concurrent uploads cannot exceed it.
   */
  async uploadReviewImage(reviewId: string, file: ValidatedImageFile) {
    await this.assertReviewImageCapacity(this.prisma, reviewId);
    const uploaded = await this.uploadToProvider(file, 'reviews', reviewId);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        await this.assertReviewImageCapacity(tx, reviewId);

        const mediaAsset = await tx.mediaAsset.create({
          data: this.toReviewMediaAssetData(uploaded, file, reviewId),
        });

        return tx.reviewImage.create({
          data: {
            reviewId,
            mediaId: mediaAsset.id,
            position: await this.nextReviewImagePosition(tx, reviewId),
          },
          include: { media: true },
        });
      });

      this.logger.log({
        operation: 'review_image_attachment_succeeded',
        entityType: 'REVIEW',
        entityId: reviewId,
        mediaId: image.mediaId,
        publicId: image.media.publicId,
      });

      return this.toReviewImageResponse(image);
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'review_image_upload_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  /**
   * Reviews & Ratings (Phase R2.5) — removes a customer image from a review.
   * Ownership / PENDING gating is the caller's responsibility. Returns only the
   * removed relationship id — internal storage keys are never surfaced.
   */
  async deleteReviewImage(reviewId: string, imageId: string) {
    const deleted = await this.prisma.$transaction(async (tx) => {
      const image = await this.ensureReviewImageBelongsToReview(
        tx,
        reviewId,
        imageId,
      );
      await tx.reviewImage.delete({ where: { id: imageId } });

      const deletedMedia = await this.deleteMediaAssetIfUnreferenced(
        tx,
        image.mediaId,
      );

      return { imageId, publicId: deletedMedia?.publicId };
    });

    await this.deleteProviderAfterDatabaseCleanup(
      deleted.publicId,
      'review_image_delete_provider_failed',
    );

    return { imageId, deleted: true };
  }

  async replaceCategoryImage(
    categoryId: string,
    file: ValidatedImageFile,
    dto: UploadSingleImageDto,
    currentAdmin: CurrentAdmin,
  ) {
    await this.ensureCategoryExists(categoryId);
    const uploaded = await this.uploadToProvider(
      file,
      'categories',
      categoryId,
    );

    try {
      const replacement = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.categoryImage.findUnique({
          where: { categoryId },
          include: { media: true },
        });
        const mediaAsset = await tx.mediaAsset.create({
          data: this.toMediaAssetData(uploaded, file, currentAdmin, {
            altText: dto.altText,
            usageContext: 'CATEGORY_IMAGE',
            relatedEntity: 'CATEGORY',
            relatedEntityId: categoryId,
          }),
        });

        const image = existing
          ? await tx.categoryImage.update({
              where: { categoryId },
              data: { mediaId: mediaAsset.id, altText: dto.altText ?? null },
              include: { media: true },
            })
          : await tx.categoryImage.create({
              data: {
                categoryId,
                mediaId: mediaAsset.id,
                altText: dto.altText ?? null,
              },
              include: { media: true },
            });

        const deletedOldMedia = existing
          ? await this.deleteMediaAssetIfUnreferenced(tx, existing.mediaId)
          : null;

        return { image, oldPublicId: deletedOldMedia?.publicId };
      });

      await this.deleteProviderAfterDatabaseCleanup(
        replacement.oldPublicId,
        'category_image_old_provider_cleanup_failed',
      );

      return this.toImageResponse(replacement.image, {
        roleOverride: MediaRole.ICON,
      });
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'category_image_replacement_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  async deleteCategoryImage(categoryId: string) {
    await this.ensureCategoryExists(categoryId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const image = await tx.categoryImage.findUnique({
        where: { categoryId },
        include: { media: true },
      });

      if (!image) {
        throw new NotFoundException('Category image was not found.');
      }

      await tx.categoryImage.delete({ where: { categoryId } });
      const deletedMedia = await this.deleteMediaAssetIfUnreferenced(
        tx,
        image.mediaId,
      );

      return {
        imageId: image.id,
        mediaAssetId: image.mediaId,
        publicId: deletedMedia?.publicId,
      };
    });

    await this.deleteProviderAfterDatabaseCleanup(
      deleted.publicId,
      'category_image_delete_provider_failed',
    );

    return { ...deleted, deleted: true };
  }

  async replaceProductReferenceImage(
    referenceId: string,
    file: ValidatedImageFile,
    dto: UploadSingleImageDto,
    currentAdmin: CurrentAdmin,
  ) {
    await this.ensureProductReferenceExists(referenceId);
    const uploaded = await this.uploadToProvider(
      file,
      'product-references',
      referenceId,
    );

    try {
      const replacement = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.productReferenceImage.findUnique({
          where: { productReferenceId: referenceId },
          include: { media: true },
        });
        const mediaAsset = await tx.mediaAsset.create({
          data: this.toMediaAssetData(uploaded, file, currentAdmin, {
            altText: dto.altText,
            usageContext: 'PRODUCT_REFERENCE_SWATCH',
            relatedEntity: 'PRODUCT_REFERENCE',
            relatedEntityId: referenceId,
          }),
        });

        const image = existing
          ? await tx.productReferenceImage.update({
              where: { productReferenceId: referenceId },
              data: {
                mediaId: mediaAsset.id,
                role: MediaRole.SWATCH,
                altText: dto.altText ?? null,
              },
              include: { media: true },
            })
          : await tx.productReferenceImage.create({
              data: {
                productReferenceId: referenceId,
                mediaId: mediaAsset.id,
                role: MediaRole.SWATCH,
                altText: dto.altText ?? null,
              },
              include: { media: true },
            });

        const deletedOldMedia = existing
          ? await this.deleteMediaAssetIfUnreferenced(tx, existing.mediaId)
          : null;

        return { image, oldPublicId: deletedOldMedia?.publicId };
      });

      await this.deleteProviderAfterDatabaseCleanup(
        replacement.oldPublicId,
        'product_reference_image_old_provider_cleanup_failed',
      );

      return this.toImageResponse(replacement.image, { includeSwatch: true });
    } catch (error) {
      await this.cleanupUploadedAsset(
        uploaded.publicId,
        'product_reference_image_replacement_rollback_cleanup_failed',
      );
      throw error;
    }
  }

  async deleteProductReferenceImage(referenceId: string) {
    await this.ensureProductReferenceExists(referenceId);

    const deleted = await this.prisma.$transaction(async (tx) => {
      const image = await tx.productReferenceImage.findUnique({
        where: { productReferenceId: referenceId },
        include: { media: true },
      });

      if (!image) {
        throw new NotFoundException('Product reference image was not found.');
      }

      await tx.productReferenceImage.delete({
        where: { productReferenceId: referenceId },
      });
      const deletedMedia = await this.deleteMediaAssetIfUnreferenced(
        tx,
        image.mediaId,
      );

      return {
        imageId: image.id,
        mediaAssetId: image.mediaId,
        publicId: deletedMedia?.publicId,
      };
    });

    await this.deleteProviderAfterDatabaseCleanup(
      deleted.publicId,
      'product_reference_image_delete_provider_failed',
    );

    return { ...deleted, deleted: true };
  }

  async findAll(query: QueryMediaAssetsDto) {
    this.validateDateRange(query);

    const { page, pageSize, skip, take } = paginationParams(query);
    const where = this.buildWhere(query);
    const orderBy = {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    } as Prisma.MediaAssetOrderByWithRelationInput;

    const [mediaAssets, totalItems] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        orderBy,
        skip,
        take,
        include: this.detailInclude(),
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return paginatedResponse(
      mediaAssets.map((mediaAsset) => this.toAssetResponse(mediaAsset)),
      { page, pageSize, totalItems },
    );
  }

  async findOne(id: string) {
    const mediaAsset = await this.prisma.mediaAsset.findFirst({
      where: { id, isDeleted: false },
      include: this.detailInclude(),
    });

    if (!mediaAsset) {
      throw new NotFoundException('Media asset not found.');
    }

    return this.toAssetResponse(mediaAsset);
  }

  async update(id: string, dto: UpdateMediaAssetDto) {
    await this.ensureUnattachedOrExistingMediaAsset(id);

    const mediaAsset = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        altText: dto.altText,
        usageContext: dto.usageContext,
        relatedEntity: dto.relatedEntity,
        relatedEntityId: dto.relatedEntityId,
      },
      include: this.detailInclude(),
    });

    return this.toAssetResponse(mediaAsset);
  }

  async delete(id: string) {
    const mediaAsset = await this.ensureUnattachedOrExistingMediaAsset(id);
    const referenceCount = await this.countMediaReferences(this.prisma, id);

    if (referenceCount > 0) {
      throw new ConflictException(
        'Media asset is attached to an entity and must be removed through that entity endpoint.',
      );
    }

    await this.storageProvider.deleteImage(mediaAsset.publicId);

    const deleted = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: this.detailInclude(),
    });

    return this.toAssetResponse(deleted);
  }

  private async uploadToProvider(
    file: ValidatedImageFile,
    entityType: MediaEntityType,
    entityId: string | undefined,
  ) {
    this.assertValidatedImageFile(file);

    const folder = this.folderFor(entityType, entityId);
    const publicId = randomUUID();

    this.logger.log({
      operation: 'media_upload_started',
      entityType,
      entityId,
    });

    return this.storageProvider.uploadImage({
      buffer: file.buffer,
      mimeType: file.detectedMimeType,
      folder,
      publicId,
    });
  }

  private assertValidatedImageFile(
    file: ValidatedImageFile | undefined,
  ): asserts file is ValidatedImageFile {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    if (!file.buffer || file.size === 0) {
      throw new BadRequestException('Image file cannot be empty.');
    }

    if (
      !allowedImageMimeTypes.includes(file.detectedMimeType) ||
      !allowedImageExtensions.includes(file.detectedExtension)
    ) {
      throw new BadRequestException(
        'Image file must be validated before upload.',
      );
    }
  }

  private toMediaAssetData(
    stored: StoredMedia,
    file: ValidatedImageFile,
    currentAdmin: CurrentAdmin,
    metadata: {
      altText?: string;
      usageContext?: string;
      relatedEntity?: string;
      relatedEntityId?: string;
    },
  ): Prisma.MediaAssetUncheckedCreateInput {
    return {
      provider: MediaAssetProvider.CLOUDINARY,
      assetType: MediaAssetType.IMAGE,
      providerAssetId: stored.providerAssetId ?? null,
      publicId: stored.publicId,
      secureUrl: stored.secureUrl,
      url: stored.url ?? null,
      resourceType: stored.resourceType,
      folder: this.folderFromPublicId(stored.publicId),
      originalName: file.originalname,
      mimeType: stored.mimeType ?? file.detectedMimeType,
      format: stored.format ?? file.detectedExtension,
      width: stored.width ?? null,
      height: stored.height ?? null,
      bytes: stored.bytes ?? file.size,
      version: stored.version ?? null,
      altText: metadata.altText ?? null,
      usageContext: metadata.usageContext ?? null,
      relatedEntity: metadata.relatedEntity ?? null,
      relatedEntityId: metadata.relatedEntityId ?? null,
      uploadedByAdminId: currentAdmin.id,
    };
  }

  private toReviewMediaAssetData(
    stored: StoredMedia,
    file: ValidatedImageFile,
    reviewId: string,
  ): Prisma.MediaAssetUncheckedCreateInput {
    // Customer-owned upload: there is no admin actor, so uploadedByAdminId stays
    // null. The asset is tagged to its review for auditing/moderation reuse.
    return {
      provider: MediaAssetProvider.CLOUDINARY,
      assetType: MediaAssetType.IMAGE,
      providerAssetId: stored.providerAssetId ?? null,
      publicId: stored.publicId,
      secureUrl: stored.secureUrl,
      url: stored.url ?? null,
      resourceType: stored.resourceType,
      folder: this.folderFromPublicId(stored.publicId),
      originalName: file.originalname,
      mimeType: stored.mimeType ?? file.detectedMimeType,
      format: stored.format ?? file.detectedExtension,
      width: stored.width ?? null,
      height: stored.height ?? null,
      bytes: stored.bytes ?? file.size,
      version: stored.version ?? null,
      altText: null,
      usageContext: 'REVIEW_IMAGE',
      relatedEntity: 'REVIEW',
      relatedEntityId: reviewId,
      uploadedByAdminId: null,
    };
  }

  private folderFor(entityType: MediaEntityType, entityId?: string) {
    const config = readCloudinaryMediaConfig(this.configService);
    const base = config.folderPrefix.replace(/^\/+|\/+$/g, '');

    return entityId
      ? `${base}/${entityType}/${entityId}`
      : `${base}/${entityType}`;
  }

  private folderFromPublicId(publicId: string) {
    const segments = publicId.split('/');
    segments.pop();
    return segments.length > 0 ? segments.join('/') : null;
  }

  private normalizedGalleryRole(role?: MediaRole) {
    const resolved = role ?? MediaRole.GALLERY;

    if (
      !([MediaRole.COVER, MediaRole.GALLERY] as MediaRole[]).includes(resolved)
    ) {
      throw new BadRequestException(
        'Only COVER and GALLERY roles are supported.',
      );
    }

    return resolved;
  }

  private validateReorderInput(dto: ReorderMediaDto) {
    const ids = new Set<string>();
    const positions = new Set<number>();

    for (const item of dto.items) {
      if (ids.has(item.imageId)) {
        throw new BadRequestException('Duplicate image IDs are not allowed.');
      }

      if (positions.has(item.position)) {
        throw new BadRequestException(
          'Duplicate image positions are not allowed.',
        );
      }

      ids.add(item.imageId);
      positions.add(item.position);
    }
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

  private async ensurePackExists(packId: string) {
    const pack = await this.prisma.pack.findUnique({
      where: { id: packId },
      select: { id: true },
    });

    if (!pack) {
      throw new NotFoundException(`Pack ${packId} was not found.`);
    }
  }

  private async ensureCategoryExists(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(`Category ${categoryId} was not found.`);
    }
  }

  private async ensureProductReferenceExists(referenceId: string) {
    const reference = await this.prisma.productReference.findUnique({
      where: { id: referenceId },
      select: { id: true },
    });

    if (!reference) {
      throw new NotFoundException(
        `Product reference ${referenceId} was not found.`,
      );
    }
  }

  private async ensureProductImageBelongsToProduct(
    tx: Tx,
    productId: string,
    imageId: string,
  ) {
    const image = await tx.productImage.findFirst({
      where: { id: imageId, productId },
      include: { media: true },
    });

    if (!image) {
      throw new NotFoundException('Product image was not found.');
    }

    return image;
  }

  private async ensurePackImageBelongsToPack(
    tx: Tx,
    packId: string,
    imageId: string,
  ) {
    const image = await tx.packImage.findFirst({
      where: { id: imageId, packId },
      include: { media: true },
    });

    if (!image) {
      throw new NotFoundException('Pack image was not found.');
    }

    return image;
  }

  private async nextProductImagePosition(
    tx: Tx,
    productId: string,
    role: MediaRole,
  ) {
    if (role === MediaRole.COVER) {
      return 0;
    }

    const aggregate = await tx.productImage.aggregate({
      where: { productId },
      _max: { position: true },
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private async nextPackImagePosition(tx: Tx, packId: string, role: MediaRole) {
    if (role === MediaRole.COVER) {
      return 0;
    }

    const aggregate = await tx.packImage.aggregate({
      where: { packId },
      _max: { position: true },
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private async nextReviewImagePosition(tx: Tx, reviewId: string) {
    const aggregate = await tx.reviewImage.aggregate({
      where: { reviewId },
      _max: { position: true },
    });

    return (aggregate._max.position ?? -1) + 1;
  }

  private async assertReviewImageCapacity(
    client: Pick<PrismaService | Tx, 'reviewImage'>,
    reviewId: string,
  ) {
    const count = await client.reviewImage.count({ where: { reviewId } });

    if (count >= maxReviewImages) {
      throw new ConflictException(
        `A review can have at most ${maxReviewImages} images.`,
      );
    }
  }

  private async ensureReviewImageBelongsToReview(
    tx: Tx,
    reviewId: string,
    imageId: string,
  ) {
    const image = await tx.reviewImage.findFirst({
      where: { id: imageId, reviewId },
      select: { id: true, mediaId: true },
    });

    if (!image) {
      throw new NotFoundException('Review image was not found.');
    }

    return image;
  }

  private async deleteMediaAssetIfUnreferenced(tx: Tx, mediaId: string) {
    const referenceCount = await this.countMediaReferences(tx, mediaId);

    if (referenceCount > 0) {
      return null;
    }

    return tx.mediaAsset.delete({
      where: { id: mediaId },
      select: {
        id: true,
        publicId: true,
      },
    });
  }

  private async countMediaReferences(
    client: Pick<
      PrismaService | Tx,
      | 'productImage'
      | 'packImage'
      | 'categoryImage'
      | 'productReferenceImage'
      | 'reviewImage'
    >,
    mediaId: string,
  ) {
    const [
      productImages,
      packImages,
      categoryImages,
      productReferenceImages,
      reviewImages,
    ] = await Promise.all([
      client.productImage.count({ where: { mediaId } }),
      client.packImage.count({ where: { mediaId } }),
      client.categoryImage.count({ where: { mediaId } }),
      client.productReferenceImage.count({ where: { mediaId } }),
      client.reviewImage.count({ where: { mediaId } }),
    ]);

    return (
      productImages +
      packImages +
      categoryImages +
      productReferenceImages +
      reviewImages
    );
  }

  private async cleanupUploadedAsset(publicId: string, operation: string) {
    try {
      await this.storageProvider.deleteImage(publicId);
    } catch {
      this.logger.warn({
        operation,
        publicId,
      });
    }
  }

  private async deleteProviderAfterDatabaseCleanup(
    publicId: string | undefined,
    operation: string,
  ) {
    if (!publicId) {
      return;
    }

    try {
      await this.storageProvider.deleteImage(publicId);
    } catch {
      this.logger.warn({
        operation,
        publicId,
      });
    }
  }

  private validateDateRange(query: QueryMediaAssetsDto) {
    if (
      query.createdFrom &&
      query.createdTo &&
      new Date(query.createdFrom) > new Date(query.createdTo)
    ) {
      throw new BadRequestException('createdFrom must be before createdTo.');
    }
  }

  private async ensureUnattachedOrExistingMediaAsset(id: string) {
    const mediaAsset = await this.prisma.mediaAsset.findFirst({
      where: { id, isDeleted: false },
    });

    if (!mediaAsset) {
      throw new NotFoundException('Media asset not found.');
    }

    return mediaAsset;
  }

  private buildWhere(query: QueryMediaAssetsDto): Prisma.MediaAssetWhereInput {
    return {
      ...(query.includeDeleted ? {} : { isDeleted: false }),
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.assetType ? { assetType: query.assetType } : {}),
      ...(query.folder ? { folder: query.folder } : {}),
      ...(query.usageContext ? { usageContext: query.usageContext } : {}),
      ...(query.relatedEntity ? { relatedEntity: query.relatedEntity } : {}),
      ...(query.relatedEntityId
        ? { relatedEntityId: query.relatedEntityId }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom
                ? { gte: new Date(query.createdFrom) }
                : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { publicId: { contains: query.search, mode: 'insensitive' } },
              { originalName: { contains: query.search, mode: 'insensitive' } },
              { altText: { contains: query.search, mode: 'insensitive' } },
              { usageContext: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private detailInclude() {
    return {
      uploadedByAdmin: {
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      },
    } satisfies Prisma.MediaAssetInclude;
  }

  private toAssetResponse(
    mediaAsset: MediaAsset & {
      uploadedByAdmin?: {
        id: string;
        fullName: string;
        email: string;
        role: string;
      } | null;
    },
  ) {
    return {
      id: mediaAsset.id,
      provider: mediaAsset.provider,
      assetType: mediaAsset.assetType,
      providerAssetId: mediaAsset.providerAssetId,
      publicId: mediaAsset.publicId,
      secureUrl: mediaAsset.secureUrl,
      url: mediaAsset.url,
      resourceType: mediaAsset.resourceType,
      folder: mediaAsset.folder,
      originalName: mediaAsset.originalName,
      mimeType: mediaAsset.mimeType,
      format: mediaAsset.format,
      width: mediaAsset.width,
      height: mediaAsset.height,
      bytes: mediaAsset.bytes,
      version: mediaAsset.version,
      altText: mediaAsset.altText,
      usageContext: mediaAsset.usageContext,
      relatedEntity: mediaAsset.relatedEntity,
      relatedEntityId: mediaAsset.relatedEntityId,
      urls: this.mediaUrlService.buildUrls(mediaAsset),
      uploadedByAdmin: mediaAsset.uploadedByAdmin,
      isDeleted: mediaAsset.isDeleted,
      deletedAt: mediaAsset.deletedAt,
      createdAt: mediaAsset.createdAt,
      updatedAt: mediaAsset.updatedAt,
    };
  }

  toImageResponse(
    image: ImageRelation,
    options?: { includeSwatch?: boolean; roleOverride?: MediaRole },
  ) {
    const role = options?.roleOverride ?? image.role ?? MediaRole.GALLERY;

    return {
      id: image.id,
      mediaAssetId: image.mediaId,
      role,
      position: image.position ?? 0,
      altText: image.altText,
      format: image.media.format,
      mimeType: image.media.mimeType,
      width: image.media.width,
      height: image.media.height,
      bytes: image.media.bytes,
      urls: this.mediaUrlService.buildUrls(image.media, {
        includeSwatch: options?.includeSwatch ?? role === MediaRole.SWATCH,
      }),
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  /**
   * Reviews & Ratings (Phase R2.5) — public-safe shape for a review image.
   * Only the display URLs and harmless image dimensions are exposed; the raw
   * publicId, folder, provider asset id, storage keys, and uploader are never
   * surfaced.
   */
  toReviewImageResponse(image: {
    id: string;
    position: number;
    createdAt: Date;
    media: Pick<
      MediaAsset,
      'publicId' | 'secureUrl' | 'mimeType' | 'format' | 'width' | 'height'
    >;
  }) {
    return {
      id: image.id,
      position: image.position,
      mimeType: image.media.mimeType,
      format: image.media.format,
      width: image.media.width,
      height: image.media.height,
      urls: this.mediaUrlService.buildUrls(image.media),
      createdAt: image.createdAt,
    };
  }
}
