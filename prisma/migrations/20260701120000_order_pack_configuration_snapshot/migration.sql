-- Pack Core Evolution (Phase 3) — additive, nullable pack-configuration snapshot.
-- Backward compatible: existing orders keep a NULL snapshot.
-- AlterTable
ALTER TABLE "orders" ADD COLUMN "pack_configuration_snapshot" JSONB;
