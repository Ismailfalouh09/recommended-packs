-- Pack Core Evolution (Phase 8B) — Universal Share Support (configured Pack tokens).
-- Additive and backward compatible: a single nullable, unique column on the
-- existing pack_configurations table. No existing row is affected (share_token is
-- NULL until a configuration is explicitly shared) and no other table changes.

-- AlterTable
ALTER TABLE "pack_configurations" ADD COLUMN "share_token" VARCHAR(64);

-- CreateIndex
-- Opaque, per-configuration share capability. NULLs are distinct in Postgres, so
-- unshared configurations never collide on the unique index.
CREATE UNIQUE INDEX "pack_configurations_share_token_key" ON "pack_configurations"("share_token");
