-- Reviews & Ratings (Phase R1) — verified-purchase review foundation.
-- Additive and backward compatible: a new table + two enums, no changes to any
-- existing catalog, customer, cart, checkout, order, or recommendation table.
--
-- One shared "reviews" table serves both PRODUCT and PACK reviews (the same
-- polymorphic pattern as wishlist_items). Two database CHECK constraints enforce
-- invariants Prisma cannot express: rating is bounded 1..5, and exactly one of
-- product_id / pack_id is set in a way consistent with target_type (XOR).

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('PRODUCT', 'PACK');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "target_type" "ReviewTargetType" NOT NULL,
    "product_id" UUID,
    "pack_id" UUID,
    "customer_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(160),
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "is_verified_purchase" BOOLEAN NOT NULL DEFAULT true,
    "author_display_name" VARCHAR(160) NOT NULL,
    "moderation_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_product_id_idx" ON "reviews"("product_id");

-- CreateIndex
CREATE INDEX "reviews_pack_id_idx" ON "reviews"("pack_id");

-- CreateIndex
CREATE INDEX "reviews_customer_id_idx" ON "reviews"("customer_id");

-- CreateIndex
CREATE INDEX "reviews_order_id_idx" ON "reviews"("order_id");

-- CreateIndex
CREATE INDEX "reviews_target_type_idx" ON "reviews"("target_type");

-- CreateIndex
CREATE INDEX "reviews_status_idx" ON "reviews"("status");

-- CreateIndex
-- Per (customer, order, target) de-duplication. NULLs are distinct in Postgres,
-- so the product-scoped unique never conflicts with PACK rows (product_id NULL)
-- and vice versa.
CREATE UNIQUE INDEX "reviews_customer_id_order_id_product_id_key" ON "reviews"("customer_id", "order_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_customer_id_order_id_pack_id_key" ON "reviews"("customer_id", "order_id", "pack_id");

-- AddCheckConstraint
-- Rating is a 1..5 star value.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range_check" CHECK ("rating" >= 1 AND "rating" <= 5);

-- AddCheckConstraint
-- Exactly one target is set, consistent with the discriminator (PRODUCT/PACK XOR).
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_target_xor_check" CHECK (
    ("target_type" = 'PRODUCT' AND "product_id" IS NOT NULL AND "pack_id" IS NULL)
    OR
    ("target_type" = 'PACK' AND "pack_id" IS NOT NULL AND "product_id" IS NULL)
);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
