import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminRole, MediaAssetProvider, MediaAssetType } from '@prisma/client';
import { MediaService } from './media.service';

describe('MediaService', () => {
  const currentAdmin = {
    id: 'admin-id',
    email: 'admin@example.com',
    role: AdminRole.ADMIN,
  };

  const mediaAsset = {
    id: 'media-id',
    provider: MediaAssetProvider.CLOUDINARY,
    assetType: MediaAssetType.IMAGE,
    publicId: 'recommended-packs/products/sample',
    secureUrl: 'https://example.com/sample.jpg',
    url: 'http://example.com/sample.jpg',
    folder: 'recommended-packs/products',
    originalName: 'sample.jpg',
    mimeType: 'image/jpeg',
    format: 'jpg',
    width: 800,
    height: 800,
    bytes: 1234,
    altText: 'Sample image',
    usageContext: 'PRODUCT_MAIN_IMAGE',
    relatedEntity: 'PRODUCT',
    relatedEntityId: '00000000-0000-4000-8000-000000000001',
    uploadedByAdminId: currentAdmin.id,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date('2026-06-13T10:00:00.000Z'),
    updatedAt: new Date('2026-06-13T10:00:00.000Z'),
    uploadedByAdmin: {
      id: currentAdmin.id,
      fullName: 'Admin User',
      email: currentAdmin.email,
      role: AdminRole.ADMIN,
    },
  };

  function createService(overrides?: {
    prisma?: Record<string, unknown>;
    cloudinary?: Record<string, unknown>;
    config?: Record<string, unknown>;
  }) {
    const prisma = {
      mediaAsset: {
        create: jest.fn().mockResolvedValue(mediaAsset),
        findFirst: jest.fn().mockResolvedValue(mediaAsset),
        findMany: jest.fn().mockResolvedValue([mediaAsset]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(mediaAsset),
      },
      $transaction: jest
        .fn()
        .mockImplementation((queries: Array<Promise<unknown>>) =>
          Promise.all(queries),
        ),
      ...overrides?.prisma,
    } as never;

    const cloudinary = {
      uploadImage: jest.fn().mockResolvedValue({
        public_id: mediaAsset.publicId,
        secure_url: mediaAsset.secureUrl,
        url: mediaAsset.url,
        folder: mediaAsset.folder,
        format: mediaAsset.format,
        width: mediaAsset.width,
        height: mediaAsset.height,
        bytes: mediaAsset.bytes,
      }),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      ...overrides?.cloudinary,
    } as never;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'CLOUDINARY_UPLOAD_FOLDER') {
          return 'recommended-packs/products';
        }

        if (key === 'MEDIA_MAX_FILE_SIZE_BYTES') {
          return '5242880';
        }

        return undefined;
      }),
      ...overrides?.config,
    } as never;

    return {
      service: new MediaService(prisma, cloudinary, config as ConfigService),
      prisma: prisma as {
        mediaAsset: {
          create: jest.Mock;
          findFirst: jest.Mock;
          findMany: jest.Mock;
          count: jest.Mock;
          update: jest.Mock;
        };
        $transaction: jest.Mock;
      },
      cloudinary: cloudinary as {
        uploadImage: jest.Mock;
        deleteImage: jest.Mock;
      },
    };
  }

  const imageFile = {
    fieldname: 'file',
    originalname: 'sample.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('fake-image'),
    size: 1234,
  } as Express.Multer.File;

  it('uploads a valid image and stores metadata', async () => {
    const { service, prisma, cloudinary } = createService();

    const result = await service.uploadImage(
      imageFile,
      {
        altText: 'Sample image',
        usageContext: 'PRODUCT_MAIN_IMAGE',
        relatedEntity: 'PRODUCT',
        relatedEntityId: '00000000-0000-4000-8000-000000000001',
      },
      currentAdmin,
    );

    expect(cloudinary.uploadImage).toHaveBeenCalledWith({
      buffer: imageFile.buffer,
      folder: 'recommended-packs/products',
      originalName: imageFile.originalname,
    });
    expect(prisma.mediaAsset.create).toHaveBeenCalled();
    expect(result.publicId).toBe(mediaAsset.publicId);
    expect(result.uploadedByAdmin?.email).toBe(currentAdmin.email);
  });

  it('rejects missing files', async () => {
    const { service } = createService();

    await expect(
      service.uploadImage(undefined, {}, currentAdmin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported mime types', async () => {
    const { service } = createService();

    await expect(
      service.uploadImage(
        { ...imageFile, mimetype: 'application/pdf' },
        {},
        currentAdmin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists active media assets by default', async () => {
    const { service, prisma } = createService();

    const result = await service.findAll({ page: 1, pageSize: 20 });

    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isDeleted: false },
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.pagination.totalItems).toBe(1);
  });

  it('throws not found for missing details', async () => {
    const { service } = createService({
      prisma: {
        mediaAsset: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    });

    await expect(service.findOne('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates local metadata only', async () => {
    const { service, prisma } = createService();

    await service.update('media-id', { altText: 'Updated alt' });

    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'media-id' },
        data: expect.objectContaining({ altText: 'Updated alt' }),
      }),
    );
  });

  it('deletes the Cloudinary asset and soft-deletes locally', async () => {
    const { service, prisma, cloudinary } = createService();

    const result = await service.delete('media-id');

    expect(cloudinary.deleteImage).toHaveBeenCalledWith(mediaAsset.publicId);
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'media-id' },
        data: expect.objectContaining({ isDeleted: true }),
      }),
    );
    expect(result.id).toBe(mediaAsset.id);
  });

  it('propagates missing Cloudinary configuration errors', async () => {
    const { service } = createService({
      cloudinary: {
        uploadImage: jest
          .fn()
          .mockRejectedValue(
            new ServiceUnavailableException(
              'Cloudinary credentials are not configured.',
            ),
          ),
      },
    });

    await expect(
      service.uploadImage(imageFile, {}, currentAdmin),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
