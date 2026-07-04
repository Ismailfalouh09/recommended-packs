import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaUrlService } from './media-url.service';
import type { ValidatedImageFile } from './pipes/image-file-validation.pipe';

/**
 * Media Management (Task 14) — per-reference (per-shade) gallery images.
 *
 * Exercises the real MediaService gallery pipeline against an in-memory Prisma
 * double and a fake storage provider. Proves: multiple images per reference,
 * first-image-becomes-primary, switching primary, delete-primary promotes the
 * next image by position, and that one reference never sees another reference's
 * images.
 */

const uploadedPublicIds: string[] = [];
const deletedPublicIds: string[] = [];

function fakeStorage() {
  return {
    uploadImage: async (input: {
      buffer: Buffer;
      mimeType: string;
      folder: string;
      publicId: string;
    }) => {
      uploadedPublicIds.push(input.publicId);
      return {
        publicId: input.publicId,
        providerAssetId: `asset-${input.publicId}`,
        secureUrl: `https://cdn.test/${input.publicId}.jpg`,
        url: `http://cdn.test/${input.publicId}.jpg`,
        resourceType: 'image',
        format: 'jpg',
        mimeType: input.mimeType,
        width: 800,
        height: 600,
        bytes: 2048,
        version: 'v1',
      };
    },
    deleteImage: async (publicId: string) => {
      deletedPublicIds.push(publicId);
    },
    buildUrl: (publicId: string, transformation: string) =>
      `https://cdn.test/${transformation}/${publicId}.jpg`,
  };
}

const currentAdmin = {
  id: 'admin-1',
  email: 'admin@example.com',
  role: 'ADMIN',
} as const;

function imageFile(): ValidatedImageFile {
  return {
    buffer: Buffer.from('fake-image-bytes'),
    size: 16,
    originalname: 'shade.jpg',
    mimetype: 'image/jpeg',
    detectedMimeType: 'image/jpeg',
    detectedExtension: 'jpg',
  } as ValidatedImageFile;
}

function buildEnv(referenceIds: string[] = ['ref-1', 'ref-2']) {
  const galleryImages: any[] = [];
  const mediaAssets: any[] = [];
  let mediaSeq = 0;
  let imageSeq = 0;

  const withMedia = (row: any, include: any) =>
    include?.media
      ? { ...row, media: mediaAssets.find((m) => m.id === row.mediaId) }
      : row;

  const zeroCount = { count: async () => 0 };

  const prisma: any = {
    _galleryImages: galleryImages,
    _mediaAssets: mediaAssets,
    productReference: {
      findUnique: async ({ where }: any) =>
        referenceIds.includes(where.id) ? { id: where.id } : null,
    },
    mediaAsset: {
      create: async ({ data }: any) => {
        const row = { id: `media-${++mediaSeq}`, ...data };
        mediaAssets.push(row);
        return row;
      },
      delete: async ({ where, select }: any) => {
        const index = mediaAssets.findIndex((m) => m.id === where.id);
        const [removed] = mediaAssets.splice(index, 1);
        return select ? { id: removed.id, publicId: removed.publicId } : removed;
      },
    },
    productReferenceGalleryImage: {
      count: async ({ where }: any) =>
        galleryImages.filter(
          (g) =>
            (where.productReferenceId
              ? g.productReferenceId === where.productReferenceId
              : true) && (where.mediaId ? g.mediaId === where.mediaId : true),
        ).length,
      aggregate: async ({ where }: any) => {
        const rows = galleryImages.filter(
          (g) => g.productReferenceId === where.productReferenceId,
        );
        return {
          _max: {
            position: rows.length
              ? Math.max(...rows.map((r) => r.position))
              : null,
          },
        };
      },
      create: async ({ data, include }: any) => {
        const row = {
          id: `gallery-${++imageSeq}`,
          position: data.position ?? 0,
          isPrimary: data.isPrimary ?? false,
          altText: data.altText ?? null,
          createdAt: new Date(2026, 6, 1, 0, imageSeq),
          updatedAt: new Date(2026, 6, 1, 0, imageSeq),
          ...data,
        };
        galleryImages.push(row);
        return withMedia(row, include);
      },
      findMany: async ({ where, orderBy, include }: any) => {
        let rows = galleryImages.filter(
          (g) => g.productReferenceId === where.productReferenceId,
        );
        if (where.id?.in) {
          rows = rows.filter((g) => where.id.in.includes(g.id));
        }
        rows = rows
          .slice()
          .sort(
            (a, b) =>
              a.position - b.position ||
              a.createdAt.getTime() - b.createdAt.getTime(),
          );
        void orderBy;
        return rows.map((r) => withMedia(r, include));
      },
      findFirst: async ({ where, select, include }: any) => {
        let rows = galleryImages.filter(
          (g) => g.productReferenceId === where.productReferenceId,
        );
        if (where.id) {
          rows = rows.filter((g) => g.id === where.id);
        }
        rows = rows
          .slice()
          .sort(
            (a, b) =>
              a.position - b.position ||
              a.createdAt.getTime() - b.createdAt.getTime(),
          );
        const row = rows[0];
        if (!row) return null;
        if (select) {
          return {
            id: row.id,
            ...(select.mediaId ? { mediaId: row.mediaId } : {}),
            ...(select.isPrimary ? { isPrimary: row.isPrimary } : {}),
          };
        }
        return withMedia(row, include);
      },
      update: async ({ where, data, include }: any) => {
        const row = galleryImages.find((g) => g.id === where.id)!;
        for (const [key, value] of Object.entries(data)) {
          if (value !== undefined) row[key] = value;
        }
        row.updatedAt = new Date();
        return withMedia(row, include);
      },
      updateMany: async ({ where, data }: any) => {
        const rows = galleryImages.filter(
          (g) =>
            g.productReferenceId === where.productReferenceId &&
            (where.isPrimary === undefined || g.isPrimary === where.isPrimary) &&
            (where.id?.not === undefined || g.id !== where.id.not),
        );
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      delete: async ({ where }: any) => {
        const index = galleryImages.findIndex((g) => g.id === where.id);
        const [removed] = galleryImages.splice(index, 1);
        return removed;
      },
    },
    // countMediaReferences fans out across every relation.
    productImage: zeroCount,
    packImage: zeroCount,
    categoryImage: zeroCount,
    productReferenceImage: zeroCount,
    reviewImage: zeroCount,
    $transaction: async (arg: any) =>
      Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
  };

  const storage = fakeStorage();
  const mediaUrlService = new MediaUrlService(storage as any);
  const configService = { get: () => undefined } as any;
  const service = new MediaService(
    prisma,
    storage as any,
    configService,
    mediaUrlService,
  );

  return { service, prisma };
}

beforeEach(() => {
  uploadedPublicIds.length = 0;
  deletedPublicIds.length = 0;
});

describe('Reference gallery — upload & primary rules', () => {
  it('supports multiple gallery images on one reference', async () => {
    const env = buildEnv();

    await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );

    const list = await env.service.listProductReferenceGalleryImages('ref-1');

    expect(list).toHaveLength(3);
    expect(list.map((image) => image.position)).toEqual([0, 1, 2]);
  });

  it('makes the first uploaded image primary and later ones non-primary', async () => {
    const env = buildEnv();

    const first = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    const second = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );

    expect(first.isPrimary).toBe(true);
    expect(second.isPrimary).toBe(false);
  });

  it('switches the primary image and unsets the previous one', async () => {
    const env = buildEnv();

    const first = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    const second = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );

    const list = await env.service.setPrimaryProductReferenceGalleryImage(
      'ref-1',
      second.id,
    );

    const primaries = list.filter((image) => image.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(second.id);
    expect(list.find((image) => image.id === first.id)?.isPrimary).toBe(false);
  });

  it('promotes the next image by position when the primary is deleted', async () => {
    const env = buildEnv();

    const first = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    const second = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    const third = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );

    await env.service.deleteProductReferenceGalleryImage('ref-1', first.id);

    const list = await env.service.listProductReferenceGalleryImages('ref-1');
    expect(list).toHaveLength(2);
    const primaries = list.filter((image) => image.isPrimary);
    expect(primaries).toHaveLength(1);
    // Second (now lowest position) is promoted, not the third.
    expect(primaries[0].id).toBe(second.id);
    expect(list.find((image) => image.id === third.id)?.isPrimary).toBe(false);
    // The removed asset was cleaned up from storage after the DB commit.
    expect(deletedPublicIds).toHaveLength(1);
  });

  it('leaves the gallery without a primary only when it is empty', async () => {
    const env = buildEnv();

    const only = await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );

    await env.service.deleteProductReferenceGalleryImage('ref-1', only.id);

    const list = await env.service.listProductReferenceGalleryImages('ref-1');
    expect(list).toHaveLength(0);
  });
});

describe('Reference gallery — isolation & guards', () => {
  it('never exposes another reference’s gallery images', async () => {
    const env = buildEnv();

    await env.service.uploadProductReferenceGalleryImage(
      'ref-1',
      imageFile(),
      {},
      currentAdmin,
    );
    const ref2Image = await env.service.uploadProductReferenceGalleryImage(
      'ref-2',
      imageFile(),
      {},
      currentAdmin,
    );

    const ref1List =
      await env.service.listProductReferenceGalleryImages('ref-1');
    expect(ref1List).toHaveLength(1);
    expect(ref1List.map((image) => image.id)).not.toContain(ref2Image.id);
    // Each reference's first image is independently primary.
    expect(ref1List[0].isPrimary).toBe(true);
    expect(ref2Image.isPrimary).toBe(true);
  });

  it('refuses to promote an image that belongs to a different reference', async () => {
    const env = buildEnv();

    const ref2Image = await env.service.uploadProductReferenceGalleryImage(
      'ref-2',
      imageFile(),
      {},
      currentAdmin,
    );

    await expect(
      env.service.setPrimaryProductReferenceGalleryImage('ref-1', ref2Image.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects operations on an unknown reference', async () => {
    const env = buildEnv();

    await expect(
      env.service.listProductReferenceGalleryImages('missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
