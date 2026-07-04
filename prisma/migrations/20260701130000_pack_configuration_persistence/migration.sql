-- Pack Core Evolution (Phase 6) — PackConfiguration persistence & configured
-- checkout link. Additive and backward compatible: existing orders keep a NULL
-- pack_configuration_id and are unaffected.

-- CreateEnum
CREATE TYPE "PackConfigurationSourceType" AS ENUM ('FIXED', 'CUSTOMIZED', 'QUIZ_RECOMMENDED', 'QUIZ_GENERATED');

-- CreateTable
CREATE TABLE "pack_configurations" (
    "id" UUID NOT NULL,
    "source_pack_id" UUID NOT NULL,
    "source_type" "PackConfigurationSourceType" NOT NULL DEFAULT 'CUSTOMIZED',
    "final_price" DECIMAL(10,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "min_allowed_price" DECIMAL(10,2),
    "is_valid" BOOLEAN NOT NULL DEFAULT true,
    "stock_status" VARCHAR(20) NOT NULL,
    "validation_result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_configuration_items" (
    "id" UUID NOT NULL,
    "configuration_id" UUID NOT NULL,
    "pack_item_id" UUID,
    "product_id" UUID NOT NULL,
    "product_reference_id" UUID,
    "role" VARCHAR(30) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "line_total" DECIMAL(10,2) NOT NULL,
    "is_add_on" BOOLEAN NOT NULL DEFAULT false,
    "removed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_configuration_items_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "pack_configuration_id" UUID;

-- CreateIndex
CREATE INDEX "pack_configurations_source_pack_id_idx" ON "pack_configurations"("source_pack_id");

-- CreateIndex
CREATE INDEX "pack_configurations_source_type_idx" ON "pack_configurations"("source_type");

-- CreateIndex
CREATE INDEX "pack_configuration_items_configuration_id_idx" ON "pack_configuration_items"("configuration_id");

-- CreateIndex
CREATE INDEX "pack_configuration_items_product_id_idx" ON "pack_configuration_items"("product_id");

-- CreateIndex
CREATE INDEX "pack_configuration_items_product_reference_id_idx" ON "pack_configuration_items"("product_reference_id");

-- CreateIndex
CREATE INDEX "orders_pack_configuration_id_idx" ON "orders"("pack_configuration_id");

-- AddForeignKey
ALTER TABLE "pack_configurations" ADD CONSTRAINT "pack_configurations_source_pack_id_fkey" FOREIGN KEY ("source_pack_id") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_configuration_items" ADD CONSTRAINT "pack_configuration_items_configuration_id_fkey" FOREIGN KEY ("configuration_id") REFERENCES "pack_configurations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_configuration_id_fkey" FOREIGN KEY ("pack_configuration_id") REFERENCES "pack_configurations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
