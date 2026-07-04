-- CreateEnum
CREATE TYPE "MediaAssetProvider" AS ENUM ('CLOUDINARY');

-- CreateEnum
CREATE TYPE "MediaAssetType" AS ENUM ('IMAGE');

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "provider" "MediaAssetProvider" NOT NULL DEFAULT 'CLOUDINARY',
    "asset_type" "MediaAssetType" NOT NULL DEFAULT 'IMAGE',
    "public_id" VARCHAR(255) NOT NULL,
    "secure_url" TEXT NOT NULL,
    "url" TEXT,
    "folder" VARCHAR(180),
    "original_name" VARCHAR(255),
    "mime_type" VARCHAR(120) NOT NULL,
    "format" VARCHAR(40),
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER NOT NULL,
    "alt_text" VARCHAR(255),
    "usage_context" VARCHAR(120),
    "related_entity" VARCHAR(80),
    "related_entity_id" UUID,
    "uploaded_by_admin_id" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_public_id_key" ON "media_assets"("public_id");

-- CreateIndex
CREATE INDEX "media_assets_provider_idx" ON "media_assets"("provider");

-- CreateIndex
CREATE INDEX "media_assets_asset_type_idx" ON "media_assets"("asset_type");

-- CreateIndex
CREATE INDEX "media_assets_folder_idx" ON "media_assets"("folder");

-- CreateIndex
CREATE INDEX "media_assets_usage_context_idx" ON "media_assets"("usage_context");

-- CreateIndex
CREATE INDEX "media_assets_related_entity_related_entity_id_idx" ON "media_assets"("related_entity", "related_entity_id");

-- CreateIndex
CREATE INDEX "media_assets_uploaded_by_admin_id_idx" ON "media_assets"("uploaded_by_admin_id");

-- CreateIndex
CREATE INDEX "media_assets_is_deleted_idx" ON "media_assets"("is_deleted");

-- CreateIndex
CREATE INDEX "media_assets_created_at_idx" ON "media_assets"("created_at");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_admin_id_fkey" FOREIGN KEY ("uploaded_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
