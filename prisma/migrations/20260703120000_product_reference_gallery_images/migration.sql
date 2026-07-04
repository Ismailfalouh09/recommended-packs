-- Media Management (Task 14) — per-reference (per-shade) gallery images.
-- Additive and backward compatible: a single new
-- "product_reference_gallery_images" join table linking a ProductReference to a
-- MediaAsset. No image bytes are stored in PostgreSQL and no existing catalog,
-- media, product, reference, or order table is altered. The existing single
-- swatch relation ("product_reference_images", role SWATCH) is untouched.
--
-- Mirrors the product_images / review_images pattern: each row references
-- exactly one reference and one media asset, ordering is preserved via
-- "position", and both foreign keys cascade so removing a reference (or its
-- media) cleans up the link. In addition, exactly one row per reference may be
-- primary, enforced by a partial unique index below.

-- CreateTable
CREATE TABLE "product_reference_gallery_images" (
    "id" UUID NOT NULL,
    "product_reference_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reference_gallery_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_reference_gallery_images_product_reference_id_positi_idx" ON "product_reference_gallery_images"("product_reference_id", "position");

-- CreateIndex
CREATE INDEX "product_reference_gallery_images_product_reference_id_is_pri_idx" ON "product_reference_gallery_images"("product_reference_id", "is_primary");

-- CreateIndex
CREATE INDEX "product_reference_gallery_images_media_id_idx" ON "product_reference_gallery_images"("media_id");

-- CreateIndex
-- One media asset is attached to a given reference at most once.
CREATE UNIQUE INDEX "product_reference_gallery_images_product_reference_id_media__key" ON "product_reference_gallery_images"("product_reference_id", "media_id");

-- CreateIndex
-- Database-level guarantee that at most one gallery image per reference is
-- primary. Not expressible in the Prisma schema; the service layer keeps this
-- invariant, and this partial unique index is the safety net against races.
CREATE UNIQUE INDEX "product_reference_gallery_images_one_primary_per_reference_key" ON "product_reference_gallery_images"("product_reference_id") WHERE "is_primary";

-- AddForeignKey
ALTER TABLE "product_reference_gallery_images" ADD CONSTRAINT "product_reference_gallery_images_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_gallery_images" ADD CONSTRAINT "product_reference_gallery_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
