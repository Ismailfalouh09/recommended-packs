import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminRole,
  MediaAssetProvider,
  MediaAssetType,
  MediaRole,
} from '@prisma/client';
import { MediaService } from './media.service';
import type { ValidatedImageFile } from './pipes/image-file-validation.pipe';

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
    providerAssetId: 'asset-id',
    publicId: 'beauty-app/products/product-id/generated-id',
    secureUrl: 'https://example.com/sample.jpg',
    url: 'http://example.com/sample.jpg',
    resourceType: 'image',
    folder: 'beauty-app/products/product-id',
    originalName: 'sample.jpg',
    mimeType: 'image/jpeg',
    format: 'jpg',
    width: 800,
    height: 800,
    bytes: 1234,
    version: '1',
    altText: 'Sample image',
    usageContext: 'PRODUCT_COVER_IMAGE',
    relatedEntity: 'PRODUCT',
    relatedEntityId: 'product-id',
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

  const productImage = {
    id: 'product-image-id',
    productId: 'product-id',
    mediaId: mediaAsset.id,
    role: MediaRole.COVER,
    position: 0,
    altText: 'Sample image',
    createdAt: mediaAsset.createdAt,
    updatedAt: mediaAsset.updatedAt,
    media: mediaAsset,
  };

  const imageFile = {
    fieldname: 'file',
    originalname: 'sample.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    size: 1234,
    detectedMimeType: 'image/jpeg',
    detectedExtension: 'jpg',
  } as ValidatedImageFile;

  function createService(overrides?: {
    prisma?: Record<string, unknown>;
    storage?: Record<string, unknown>;
    mediaUrl?: Record<string, unknown>;
  }) {
    const prisma = {
      mediaAsset: {
        create: jest.fn().mockResolvedValue(mediaAsset),
        findFirst: jest.fn().mockResolvedValue(mediaAsset),
        findMany: jest.fn().mockResolvedValue([mediaAsset]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(mediaAsset),
        delete: jest.fn().mockResolvedValue({
          id: mediaAsset.id,
          publicId: mediaAsset.publicId,
        }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({ id: 'product-id' }),
      },
      pack: {
        findUnique: jest.fn().mockResolvedValue({ id: 'pack-id' }),
      },
      category: {
        findUnique: jest.fn().mockResolvedValue({ id: 'category-id' }),
      },
      productReference: {
        findUnique: jest.fn().mockResolvedValue({ id: 'reference-id' }),
      },
      productImage: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: null } }),
        create: jest.fn().mockResolvedValue(productImage),
        findFirst: jest.fn().mockResolvedValue(productImage),
        findMany: jest.fn().mockResolvedValue([productImage]),
        update: jest.fn().mockResolvedValue(productImage),
        delete: jest.fn().mockResolvedValue(productImage),
        count: jest.fn().mockResolvedValue(0),
      },
      packImage: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        aggregate: jest.fn().mockResolvedValue({ _max: { position: null } }),
        create: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'pack-image-id',
          packId: 'pack-id',
        }),
        findFirst: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'pack-image-id',
          packId: 'pack-id',
        }),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'pack-image-id',
          packId: 'pack-id',
        }),
        delete: jest.fn().mockResolvedValue(productImage),
        count: jest.fn().mockResolvedValue(0),
      },
      categoryImage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'category-image-id',
          categoryId: 'category-id',
        }),
        update: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'category-image-id',
          categoryId: 'category-id',
        }),
        delete: jest.fn().mockResolvedValue(productImage),
        count: jest.fn().mockResolvedValue(0),
      },
      productReferenceImage: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'reference-image-id',
          productReferenceId: 'reference-id',
          role: MediaRole.SWATCH,
        }),
        update: jest.fn().mockResolvedValue({
          ...productImage,
          id: 'reference-image-id',
          productReferenceId: 'reference-id',
          role: MediaRole.SWATCH,
        }),
        delete: jest.fn().mockResolvedValue(productImage),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((input: unknown) =>
        Array.isArray(input)
          ? Promise.all(input)
          : (input as (tx: unknown) => unknown)(prisma),
      ),
      ...overrides?.prisma,
    } as never;

    const storage = {
      uploadImage: jest.fn().mockResolvedValue({
        publicId: mediaAsset.publicId,
        providerAssetId: mediaAsset.providerAssetId,
        secureUrl: mediaAsset.secureUrl,
        url: mediaAsset.url,
        resourceType: mediaAsset.resourceType,
        format: mediaAsset.format,
        mimeType: mediaAsset.mimeType,
        width: mediaAsset.width,
        height: mediaAsset.height,
        bytes: mediaAsset.bytes,
        version: mediaAsset.version,
      }),
      deleteImage: jest.fn().mockResolvedValue(undefined),
      buildUrl: jest
        .fn()
        .mockReturnValue('https://example.com/transformed.jpg'),
      ...overrides?.storage,
    } as never;

    const config = {
      get: jest.fn((key: string) => {
        if (key === 'CLOUDINARY_FOLDER_PREFIX') {
          return 'beauty-app';
        }

        if (key === 'MEDIA_MAX_FILE_SIZE_MB') {
          return '5';
        }

        return undefined;
      }),
    } as unknown as ConfigService;

    const mediaUrl = {
      buildUrls: jest.fn().mockReturnValue({
        original: mediaAsset.secureUrl,
        thumbnail: 'https://example.com/thumb.jpg',
        card: 'https://example.com/card.jpg',
        detail: 'https://example.com/detail.jpg',
        swatch: 'https://example.com/swatch.jpg',
      }),
      ...overrides?.mediaUrl,
    } as never;

    return {
      service: new MediaService(prisma, storage, config, mediaUrl),
      prisma: prisma as any,
      storage: storage as {
        uploadImage: jest.Mock;
        deleteImage: jest.Mock;
      },
      mediaUrl: mediaUrl as { buildUrls: jest.Mock },
    };
  }

  it('uploads a product cover and demotes the previous cover', async () => {
    const { service, prisma, storage } = createService();

    const result = await service.uploadProductImage(
      'product-id',
      imageFile,
      { role: MediaRole.COVER, altText: 'Sample image' },
      currentAdmin,
    );

    expect(storage.uploadImage).toHaveBeenCalledWith(
      expect.objectContaining({
        folder: 'beauty-app/products/product-id',
        mimeType: 'image/jpeg',
        publicId: expect.any(String),
      }),
    );
    expect(prisma.productImage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 'product-id', role: MediaRole.COVER },
        data: { role: MediaRole.GALLERY },
      }),
    );
    expect(result.role).toBe(MediaRole.COVER);
    expect(result.urls.thumbnail).toContain('thumb');
  });

  it('deletes a newly uploaded provider asset when database attachment fails', async () => {
    const { service, prisma, storage } = createService();
    prisma.productImage.create.mockRejectedValueOnce(
      new Error('database failed'),
    );

    await expect(
      service.uploadProductImage(
        'product-id',
        imageFile,
        { role: MediaRole.GALLERY },
        currentAdmin,
      ),
    ).rejects.toThrow('database failed');

    expect(storage.deleteImage).toHaveBeenCalledWith(mediaAsset.publicId);
  });

  it('replaces a category image and deletes the old provider asset after commit', async () => {
    const oldMedia = {
      ...mediaAsset,
      id: 'old-media-id',
      publicId: 'beauty-app/categories/category-id/old-id',
    };
    const { service, prisma, storage } = createService();
    prisma.categoryImage.findUnique.mockResolvedValueOnce({
      id: 'old-category-image-id',
      categoryId: 'category-id',
      mediaId: oldMedia.id,
      altText: 'Old image',
      createdAt: oldMedia.createdAt,
      updatedAt: oldMedia.updatedAt,
      media: oldMedia,
    });
    prisma.mediaAsset.delete.mockResolvedValueOnce({
      id: oldMedia.id,
      publicId: oldMedia.publicId,
    });

    await service.replaceCategoryImage(
      'category-id',
      imageFile,
      { altText: 'New image' },
      currentAdmin,
    );

    expect(prisma.categoryImage.update).toHaveBeenCalled();
    expect(storage.deleteImage).toHaveBeenCalledWith(oldMedia.publicId);
  });

  it('rejects duplicate reorder image IDs', async () => {
    const { service } = createService();

    await expect(
      service.reorderProductImages('product-id', {
        items: [
          { imageId: 'image-id', position: 0 },
          { imageId: 'image-id', position: 1 },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes product image relation before provider cleanup', async () => {
    const { service, prisma, storage } = createService();

    const result = await service.deleteProductImage(
      'product-id',
      'product-image-id',
    );

    expect(prisma.productImage.delete).toHaveBeenCalledWith({
      where: { id: 'product-image-id' },
    });
    expect(prisma.mediaAsset.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: mediaAsset.id } }),
    );
    expect(storage.deleteImage).toHaveBeenCalledWith(mediaAsset.publicId);
    expect(result.deleted).toBe(true);
  });

  it('keeps attached assets from generic deletion', async () => {
    const { service, prisma } = createService();
    prisma.productImage.count.mockResolvedValueOnce(1);

    await expect(service.delete(mediaAsset.id)).rejects.toBeInstanceOf(
      ConflictException,
    );
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

  it('rejects direct service upload without validated file metadata', async () => {
    const { service } = createService();

    await expect(
      service.uploadImage(
        {
          ...imageFile,
          detectedMimeType: undefined,
        } as unknown as ValidatedImageFile,
        {},
        currentAdmin,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
