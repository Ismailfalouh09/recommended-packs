-- CreateEnum
CREATE TYPE "VariationType" AS ENUM ('SHADE', 'SIZE', 'BUNDLE');

-- AlterEnum
ALTER TYPE "ProductStatus" ADD VALUE 'HIDDEN';

-- DropForeignKey
ALTER TABLE "pack_items" DROP CONSTRAINT "pack_items_product_reference_id_fkey";

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "brand_name_snapshot" VARCHAR(120),
ADD COLUMN     "product_image_url_snapshot" TEXT,
ADD COLUMN     "sku_snapshot" VARCHAR(120),
ADD COLUMN     "variation_snapshot" VARCHAR(160);

-- AlterTable
ALTER TABLE "product_references" ADD COLUMN     "measurement" VARCHAR(40),
ADD COLUMN     "shade_code" VARCHAR(60),
ADD COLUMN     "shade_name" VARCHAR(120),
ADD COLUMN     "swatch_hex" VARCHAR(7),
ADD COLUMN     "variation_type" "VariationType";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "compare_at_price" DECIMAL(10,2),
ADD COLUMN     "directions" TEXT,
ADD COLUMN     "ingredients" TEXT,
ADD COLUMN     "meta_description" VARCHAR(320),
ADD COLUMN     "meta_title" VARCHAR(180),
ADD COLUMN     "product_type" VARCHAR(60),
ADD COLUMN     "short_description" VARCHAR(280);

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "attribute_group_id" UUID NOT NULL,
    "attribute_option_id" UUID NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'COMPATIBLE',
    "score_value" INTEGER NOT NULL DEFAULT 0,
    "is_hard_filter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_attributes_product_id_idx" ON "product_attributes"("product_id");

-- CreateIndex
CREATE INDEX "product_attributes_attribute_group_id_idx" ON "product_attributes"("attribute_group_id");

-- CreateIndex
CREATE INDEX "product_attributes_attribute_option_id_idx" ON "product_attributes"("attribute_option_id");

-- CreateIndex
CREATE INDEX "product_attributes_match_type_idx" ON "product_attributes"("match_type");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_product_id_attribute_group_id_attribute__key" ON "product_attributes"("product_id", "attribute_group_id", "attribute_option_id");

-- CreateIndex
CREATE INDEX "product_references_variation_type_idx" ON "product_references"("variation_type");

-- CreateIndex
CREATE INDEX "products_product_type_idx" ON "products"("product_type");

-- CreateIndex
CREATE INDEX "products_status_category_id_idx" ON "products"("status", "category_id");

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
