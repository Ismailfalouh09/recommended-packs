-- Pack Core Evolution (Phase 8A) — Universal Wishlist foundation.
-- Additive and backward compatible: a new table + enum, no changes to existing
-- catalog, cart, checkout, order, or recommendation tables.

-- CreateEnum
CREATE TYPE "WishlistTargetType" AS ENUM ('PRODUCT', 'PACK');

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "target_type" "WishlistTargetType" NOT NULL,
    "product_id" UUID,
    "pack_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlist_items_customer_profile_id_idx" ON "wishlist_items"("customer_profile_id");

-- CreateIndex
CREATE INDEX "wishlist_items_product_id_idx" ON "wishlist_items"("product_id");

-- CreateIndex
CREATE INDEX "wishlist_items_pack_id_idx" ON "wishlist_items"("pack_id");

-- CreateIndex
-- Per-owner de-duplication. NULLs are distinct in Postgres, so the product-scoped
-- unique never conflicts with PACK rows (product_id NULL) and vice versa.
CREATE UNIQUE INDEX "wishlist_items_customer_profile_id_product_id_key" ON "wishlist_items"("customer_profile_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_customer_profile_id_pack_id_key" ON "wishlist_items"("customer_profile_id", "pack_id");

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
