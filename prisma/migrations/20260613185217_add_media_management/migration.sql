-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('COVER', 'GALLERY', 'THUMBNAIL', 'SWATCH', 'ICON');

-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "provider_asset_id" VARCHAR(255),
ADD COLUMN     "resource_type" VARCHAR(40) NOT NULL DEFAULT 'image',
ADD COLUMN     "version" VARCHAR(80);

-- CreateTable
CREATE TABLE "product_images" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
    "position" INTEGER NOT NULL DEFAULT 0,
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_images" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
    "position" INTEGER NOT NULL DEFAULT 0,
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_images" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reference_images" (
    "id" UUID NOT NULL,
    "product_reference_id" UUID NOT NULL,
    "media_id" UUID NOT NULL,
    "role" "MediaRole" NOT NULL DEFAULT 'SWATCH',
    "alt_text" VARCHAR(255),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_reference_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_images_product_id_position_idx" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE INDEX "product_images_product_id_role_idx" ON "product_images"("product_id", "role");

-- CreateIndex
CREATE INDEX "product_images_media_id_idx" ON "product_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_product_id_media_id_key" ON "product_images"("product_id", "media_id");

-- CreateIndex
CREATE INDEX "pack_images_pack_id_position_idx" ON "pack_images"("pack_id", "position");

-- CreateIndex
CREATE INDEX "pack_images_pack_id_role_idx" ON "pack_images"("pack_id", "role");

-- CreateIndex
CREATE INDEX "pack_images_media_id_idx" ON "pack_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_images_pack_id_media_id_key" ON "pack_images"("pack_id", "media_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_images_category_id_key" ON "category_images"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_images_media_id_key" ON "category_images"("media_id");

-- CreateIndex
CREATE INDEX "category_images_category_id_idx" ON "category_images"("category_id");

-- CreateIndex
CREATE INDEX "category_images_media_id_idx" ON "category_images"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reference_images_product_reference_id_key" ON "product_reference_images"("product_reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_reference_images_media_id_key" ON "product_reference_images"("media_id");

-- CreateIndex
CREATE INDEX "product_reference_images_product_reference_id_idx" ON "product_reference_images"("product_reference_id");

-- CreateIndex
CREATE INDEX "product_reference_images_media_id_idx" ON "product_reference_images"("media_id");

-- CreateIndex
CREATE INDEX "media_assets_provider_asset_id_idx" ON "media_assets"("provider_asset_id");

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_images" ADD CONSTRAINT "pack_images_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_images" ADD CONSTRAINT "pack_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_images" ADD CONSTRAINT "category_images_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_images" ADD CONSTRAINT "category_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_images" ADD CONSTRAINT "product_reference_images_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_images" ADD CONSTRAINT "product_reference_images_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
