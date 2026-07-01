-- Reviews & Ratings (Phase R2.5) — customer-attached review photos.
-- Additive and backward compatible: a single new "review_images" join table
-- linking a Review to a MediaAsset. No image bytes are stored in PostgreSQL and
-- no existing catalog, media, review, order, or customer table is altered.
--
-- Mirrors the product_images / pack_images pattern: each row references exactly
-- one review and one media asset, ordering is preserved via "position", and both
-- foreign keys cascade so removing a review (or its media) cleans up the link.

-- CreateTable
CREATE TABLE "review_images" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "review_images_review_id_position_idx" ON "review_images"("review_id", "position");

-- CreateIndex
CREATE INDEX "review_images_media_id_idx" ON "review_images"("media_id");

-- CreateIndex
-- One media asset is attached to a given review at most once.
CREATE UNIQUE INDEX "review_images_review_id_media_id_key" ON "review_images"("review_id", "media_id");

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
