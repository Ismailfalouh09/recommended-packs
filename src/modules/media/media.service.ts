import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MediaAsset,
  MediaAssetProvider,
  MediaAssetType,
  Prisma,
} from '@prisma/client';
import {
  paginationParams,
  paginatedResponse,
} from '../../common/utils/pagination.util';
import { PrismaService } from '../../prisma/prisma.service';
import type { CurrentAdmin } from '../auth/types/jwt-payload.type';
import { CloudinaryService } from './cloudinary.service';
import { QueryMediaAssetsDto } from './dto/query-media-assets.dto';
import { UpdateMediaAssetDto } from './dto/update-media-asset.dto';
import { UploadMediaDto } from './dto/upload-media.dto';

const allowedImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly configService: ConfigService,
  ) {}

  async uploadImage(
    file: Express.Multer.File | undefined,
    dto: UploadMediaDto,
    currentAdmin: CurrentAdmin,
  ) {
    this.validateImageFile(file);

    const folder =
      dto.folder ??
      this.configService.get<string>('CLOUDINARY_UPLOAD_FOLDER') ??
      'recommended-packs/dev';

    const uploaded = await this.cloudinaryService.uploadImage({
      buffer: file.buffer,
      folder,
      originalName: file.originalname,
    });

    const mediaAsset = await this.prisma.mediaAsset.create({
      data: {
        provider: MediaAssetProvider.CLOUDINARY,
        assetType: MediaAssetType.IMAGE,
        publicId: uploaded.public_id,
        secureUrl: uploaded.secure_url,
        url: uploaded.url,
        folder: uploaded.folder ?? folder,
        originalName: file.originalname,
        mimeType: file.mimetype,
        format: uploaded.format,
        width: uploaded.width,
        height: uploaded.height,
        bytes: uploaded.bytes,
        altText: dto.altText,
        usageContext: dto.usageContext,
        relatedEntity: dto.relatedEntity,
        relatedEntityId: dto.relatedEntityId,
        uploadedByAdminId: currentAdmin.id,
      },
      include: this.detailInclude(),
    });

    return this.toResponse(mediaAsset);
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
        include: this.summaryInclude(),
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);

    return paginatedResponse(
      mediaAssets.map((mediaAsset) => this.toResponse(mediaAsset)),
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

    return this.toResponse(mediaAsset);
  }

  async update(id: string, dto: UpdateMediaAssetDto) {
    await this.ensureActiveMediaAsset(id);

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

    return this.toResponse(mediaAsset);
  }

  async delete(id: string) {
    const mediaAsset = await this.ensureActiveMediaAsset(id);

    await this.cloudinaryService.deleteImage(mediaAsset.publicId);

    const deleted = await this.prisma.mediaAsset.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: this.detailInclude(),
    });

    return this.toResponse(deleted);
  }

  private validateImageFile(
    file: Express.Multer.File | undefined,
  ): asserts file is Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Image file is required.');
    }

    if (!allowedImageMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Only JPEG, PNG, WEBP, and AVIF images are allowed.',
      );
    }

    const maxFileSize =
      Number(this.configService.get<string>('MEDIA_MAX_FILE_SIZE_BYTES')) ||
      5 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new BadRequestException(
        `Image file must be ${maxFileSize} bytes or smaller.`,
      );
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

  private async ensureActiveMediaAsset(id: string) {
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

  private summaryInclude() {
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

  private detailInclude() {
    return this.summaryInclude();
  }

  private toResponse(
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
      publicId: mediaAsset.publicId,
      secureUrl: mediaAsset.secureUrl,
      url: mediaAsset.url,
      folder: mediaAsset.folder,
      originalName: mediaAsset.originalName,
      mimeType: mediaAsset.mimeType,
      format: mediaAsset.format,
      width: mediaAsset.width,
      height: mediaAsset.height,
      bytes: mediaAsset.bytes,
      altText: mediaAsset.altText,
      usageContext: mediaAsset.usageContext,
      relatedEntity: mediaAsset.relatedEntity,
      relatedEntityId: mediaAsset.relatedEntityId,
      uploadedByAdmin: mediaAsset.uploadedByAdmin,
      isDeleted: mediaAsset.isDeleted,
      deletedAt: mediaAsset.deletedAt,
      createdAt: mediaAsset.createdAt,
      updatedAt: mediaAsset.updatedAt,
    };
  }
}
