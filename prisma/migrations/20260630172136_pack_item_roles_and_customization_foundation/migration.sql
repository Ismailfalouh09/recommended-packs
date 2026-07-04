-- CreateEnum
CREATE TYPE "PackItemRole" AS ENUM ('FIXED', 'REQUIRED_SELECTABLE', 'OPTIONAL_INCLUDED', 'OPTIONAL_ADDON');

-- AlterTable
ALTER TABLE "pack_items" ADD COLUMN     "max_quantity" INTEGER,
ADD COLUMN     "min_quantity" INTEGER,
ADD COLUMN     "quantity_editable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removal_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replacement_allowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "role" "PackItemRole" NOT NULL DEFAULT 'FIXED';

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "is_customizable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "max_item_count" INTEGER,
ADD COLUMN     "min_allowed_price" DECIMAL(10,2),
ADD COLUMN     "min_required_items" INTEGER;

-- CreateTable
CREATE TABLE "pack_item_allowed_references" (
    "id" UUID NOT NULL,
    "pack_item_id" UUID NOT NULL,
    "product_reference_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_item_allowed_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_allowed_add_ons" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_reference_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_allowed_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pack_item_allowed_references_pack_item_id_idx" ON "pack_item_allowed_references"("pack_item_id");

-- CreateIndex
CREATE INDEX "pack_item_allowed_references_product_reference_id_idx" ON "pack_item_allowed_references"("product_reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_item_allowed_references_pack_item_id_product_reference_key" ON "pack_item_allowed_references"("pack_item_id", "product_reference_id");

-- CreateIndex
CREATE INDEX "pack_allowed_add_ons_pack_id_idx" ON "pack_allowed_add_ons"("pack_id");

-- CreateIndex
CREATE INDEX "pack_allowed_add_ons_product_id_idx" ON "pack_allowed_add_ons"("product_id");

-- CreateIndex
CREATE INDEX "pack_allowed_add_ons_product_reference_id_idx" ON "pack_allowed_add_ons"("product_reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_allowed_add_ons_pack_id_product_id_product_reference_i_key" ON "pack_allowed_add_ons"("pack_id", "product_id", "product_reference_id");

-- CreateIndex
CREATE INDEX "pack_items_role_idx" ON "pack_items"("role");

-- AddForeignKey
ALTER TABLE "pack_item_allowed_references" ADD CONSTRAINT "pack_item_allowed_references_pack_item_id_fkey" FOREIGN KEY ("pack_item_id") REFERENCES "pack_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_item_allowed_references" ADD CONSTRAINT "pack_item_allowed_references_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_allowed_add_ons" ADD CONSTRAINT "pack_allowed_add_ons_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_allowed_add_ons" ADD CONSTRAINT "pack_allowed_add_ons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_allowed_add_ons" ADD CONSTRAINT "pack_allowed_add_ons_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;
