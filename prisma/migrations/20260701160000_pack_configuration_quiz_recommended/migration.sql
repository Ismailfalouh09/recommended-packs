-- Pack Core Evolution (Phase 9) — Quiz-Recommended existing Packs.
-- Additive and backward compatible: a single nullable link column on the existing
-- pack_configurations table plus its supporting index and foreign key. No existing
-- row is affected (recommendation_result_id is NULL for every Phase 6 CUSTOMIZED
-- configuration) and no other table is changed. RecommendationResultItem and its
-- NOT NULL selected_product_reference_id are intentionally left untouched, so no
-- historical recommendation result is altered.

-- AlterTable
ALTER TABLE "pack_configurations" ADD COLUMN "recommendation_result_id" UUID;

-- CreateIndex
CREATE INDEX "pack_configurations_recommendation_result_id_idx" ON "pack_configurations"("recommendation_result_id");

-- AddForeignKey
-- SetNull on delete keeps a persisted configuration (and any order that already
-- froze its immutable snapshot) valid even if the recommendation session is pruned.
ALTER TABLE "pack_configurations"
  ADD CONSTRAINT "pack_configurations_recommendation_result_id_fkey"
  FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
