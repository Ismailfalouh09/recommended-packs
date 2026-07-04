-- CreateEnum
CREATE TYPE "PackCompatibilityCriterion" AS ENUM ('SKIN_TONE', 'SKIN_TYPE', 'MAKEUP_STYLE', 'BUDGET', 'OCCASION');

-- CreateEnum
CREATE TYPE "PackCompatibilityMode" AS ENUM ('UNIVERSAL', 'RESTRICTED');

-- CreateTable
CREATE TABLE "pack_compatibility_profiles" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "criterion" "PackCompatibilityCriterion" NOT NULL,
    "mode" "PackCompatibilityMode" NOT NULL DEFAULT 'RESTRICTED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_compatibility_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_compatibility_values" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "attribute_option_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_compatibility_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pack_compatibility_profiles_pack_id_idx" ON "pack_compatibility_profiles"("pack_id");

-- CreateIndex
CREATE INDEX "pack_compatibility_profiles_criterion_idx" ON "pack_compatibility_profiles"("criterion");

-- CreateIndex
CREATE UNIQUE INDEX "pack_compatibility_profiles_pack_id_criterion_key" ON "pack_compatibility_profiles"("pack_id", "criterion");

-- CreateIndex
CREATE INDEX "pack_compatibility_values_profile_id_idx" ON "pack_compatibility_values"("profile_id");

-- CreateIndex
CREATE INDEX "pack_compatibility_values_attribute_option_id_idx" ON "pack_compatibility_values"("attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "pack_compatibility_values_profile_id_attribute_option_id_key" ON "pack_compatibility_values"("profile_id", "attribute_option_id");

-- AddForeignKey
ALTER TABLE "pack_compatibility_profiles" ADD CONSTRAINT "pack_compatibility_profiles_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_compatibility_values" ADD CONSTRAINT "pack_compatibility_values_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "pack_compatibility_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_compatibility_values" ADD CONSTRAINT "pack_compatibility_values_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
