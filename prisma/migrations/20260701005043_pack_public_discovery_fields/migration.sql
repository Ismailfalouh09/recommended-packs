-- CreateEnum
CREATE TYPE "PackTier" AS ENUM ('ESSENTIAL', 'PREMIUM', 'LUXE');

-- CreateEnum
CREATE TYPE "PackOccasion" AS ENUM ('EVERYDAY', 'WORK', 'EVENING', 'PARTY', 'WEDDING', 'SPECIAL_EVENT');

-- CreateEnum
CREATE TYPE "PackExperienceLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'EXPERT');

-- AlterTable
ALTER TABLE "packs" ADD COLUMN     "category_id" UUID,
ADD COLUMN     "experience_level" "PackExperienceLevel",
ADD COLUMN     "is_best_seller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_new" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "occasion" "PackOccasion",
ADD COLUMN     "search_keywords" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tier" "PackTier";

-- CreateIndex
CREATE INDEX "packs_category_id_idx" ON "packs"("category_id");

-- CreateIndex
CREATE INDEX "packs_tier_idx" ON "packs"("tier");

-- CreateIndex
CREATE INDEX "packs_occasion_idx" ON "packs"("occasion");

-- CreateIndex
CREATE INDEX "packs_experience_level_idx" ON "packs"("experience_level");

-- CreateIndex
CREATE INDEX "packs_is_featured_idx" ON "packs"("is_featured");

-- CreateIndex
CREATE INDEX "packs_is_new_idx" ON "packs"("is_new");

-- CreateIndex
CREATE INDEX "packs_is_best_seller_idx" ON "packs"("is_best_seller");

-- AddForeignKey
ALTER TABLE "packs" ADD CONSTRAINT "packs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
