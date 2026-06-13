-- CreateEnum
CREATE TYPE "SourceChannel" AS ENUM ('INSTAGRAM', 'WHATSAPP', 'TIKTOK', 'FACEBOOK', 'DIRECT', 'OTHER');

-- CreateEnum
CREATE TYPE "SelectionType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PackStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PriceMode" AS ENUM ('FIXED', 'SUM_ITEMS', 'SUM_ITEMS_WITH_DISCOUNT');

-- CreateEnum
CREATE TYPE "SelectionMode" AS ENUM ('FIXED_REFERENCE', 'AUTO_BEST_REFERENCE', 'CUSTOMER_CHOICE');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('COMPATIBLE', 'NOT_COMPATIBLE', 'BOOST');

-- CreateEnum
CREATE TYPE "RecommendationTargetType" AS ENUM ('PACK', 'PRODUCT', 'REFERENCE');

-- CreateEnum
CREATE TYPE "RecommendationConditionType" AS ENUM ('MUST_MATCH', 'SHOULD_MATCH', 'EXCLUDE_IF_MATCH');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH_ON_DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELED', 'RETURNED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "attribute_groups" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_customer_attribute" BOOLEAN NOT NULL DEFAULT false,
    "is_product_attribute" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_options" (
    "id" UUID NOT NULL,
    "attribute_group_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "attribute_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" UUID NOT NULL,
    "attribute_group_id" UUID,
    "question_text" TEXT NOT NULL,
    "helper_text" TEXT,
    "selection_type" "SelectionType" NOT NULL DEFAULT 'SINGLE',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "step_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_question_options" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "attribute_option_id" UUID NOT NULL,
    "display_label" VARCHAR(120),
    "display_image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "quiz_question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profiles" (
    "id" UUID NOT NULL,
    "session_token" VARCHAR(255) NOT NULL,
    "source_channel" "SourceChannel" NOT NULL DEFAULT 'DIRECT',
    "algorithm_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_profile_answers" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "attribute_group_id" UUID NOT NULL,
    "attribute_option_id" UUID,
    "value_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_profile_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "main_image_url" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_references" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "reference_code" VARCHAR(80) NOT NULL,
    "reference_name" VARCHAR(160) NOT NULL,
    "barcode" VARCHAR(120),
    "sku" VARCHAR(120),
    "price_override" DECIMAL(10,2),
    "price_delta" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "image_url" TEXT,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "reserved_quantity" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reference_attributes" (
    "id" UUID NOT NULL,
    "product_reference_id" UUID NOT NULL,
    "attribute_group_id" UUID NOT NULL,
    "attribute_option_id" UUID NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'COMPATIBLE',
    "score_value" INTEGER NOT NULL DEFAULT 0,
    "is_hard_filter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_reference_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packs" (
    "id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "main_image_url" TEXT,
    "price_mode" "PriceMode" NOT NULL DEFAULT 'FIXED',
    "fixed_price" DECIMAL(10,2),
    "discount_amount" DECIMAL(10,2),
    "discount_percentage" DECIMAL(5,2),
    "min_budget" DECIMAL(10,2),
    "max_budget" DECIMAL(10,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "PackStatus" NOT NULL DEFAULT 'DRAFT',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_items" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_reference_id" UUID,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "selection_mode" "SelectionMode" NOT NULL DEFAULT 'AUTO_BEST_REFERENCE',
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pack_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pack_attributes" (
    "id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "attribute_group_id" UUID NOT NULL,
    "attribute_option_id" UUID NOT NULL,
    "match_type" "MatchType" NOT NULL DEFAULT 'COMPATIBLE',
    "score_value" INTEGER NOT NULL DEFAULT 0,
    "is_hard_filter" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_rules" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "target_type" "RecommendationTargetType" NOT NULL,
    "attribute_group_id" UUID,
    "condition_type" "RecommendationConditionType" NOT NULL,
    "score_value" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(5,2) NOT NULL DEFAULT 1.0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_sessions" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID NOT NULL,
    "algorithm_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "total_candidate_packs" INTEGER NOT NULL DEFAULT 0,
    "total_recommended_packs" INTEGER NOT NULL DEFAULT 0,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_results" (
    "id" UUID NOT NULL,
    "recommendation_session_id" UUID NOT NULL,
    "pack_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "match_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "reason_summary" TEXT,
    "reason_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_result_items" (
    "id" UUID NOT NULL,
    "recommendation_result_id" UUID NOT NULL,
    "pack_item_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "selected_product_reference_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "item_score" INTEGER NOT NULL DEFAULT 0,
    "reason_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_result_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "phone" VARCHAR(30) NOT NULL,
    "whatsapp_phone" VARCHAR(30),
    "email" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "city" VARCHAR(120) NOT NULL,
    "address_line" TEXT NOT NULL,
    "extra_info" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(40) NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_profile_id" UUID,
    "recommendation_result_id" UUID,
    "selected_pack_id" UUID NOT NULL,
    "customer_address_id" UUID NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH_ON_DELIVERY',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "order_status" "OrderStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "subtotal_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "delivery_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'MAD',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "pack_id" UUID,
    "product_id" UUID NOT NULL,
    "product_reference_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(180) NOT NULL,
    "reference_name_snapshot" VARCHAR(160) NOT NULL,
    "unit_price_snapshot" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "old_status" "OrderStatus",
    "new_status" "OrderStatus" NOT NULL,
    "changed_by_admin_id" UUID,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" UUID NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_events" (
    "id" UUID NOT NULL,
    "customer_profile_id" UUID,
    "customer_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_logs" (
    "id" UUID NOT NULL,
    "customer_id" UUID,
    "order_id" UUID,
    "channel" "MessageChannel" NOT NULL,
    "message_type" VARCHAR(100) NOT NULL,
    "recipient" VARCHAR(120) NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "provider_message_id" VARCHAR(180),
    "payload_json" JSONB,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_groups_code_key" ON "attribute_groups"("code");

-- CreateIndex
CREATE INDEX "attribute_options_attribute_group_id_idx" ON "attribute_options"("attribute_group_id");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_options_attribute_group_id_code_key" ON "attribute_options"("attribute_group_id", "code");

-- CreateIndex
CREATE INDEX "quiz_questions_attribute_group_id_idx" ON "quiz_questions"("attribute_group_id");

-- CreateIndex
CREATE INDEX "quiz_questions_step_order_idx" ON "quiz_questions"("step_order");

-- CreateIndex
CREATE INDEX "quiz_question_options_question_id_idx" ON "quiz_question_options"("question_id");

-- CreateIndex
CREATE INDEX "quiz_question_options_attribute_option_id_idx" ON "quiz_question_options"("attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "quiz_question_options_question_id_attribute_option_id_key" ON "quiz_question_options"("question_id", "attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_profiles_session_token_key" ON "customer_profiles"("session_token");

-- CreateIndex
CREATE INDEX "customer_profiles_source_channel_idx" ON "customer_profiles"("source_channel");

-- CreateIndex
CREATE INDEX "customer_profiles_created_at_idx" ON "customer_profiles"("created_at");

-- CreateIndex
CREATE INDEX "customer_profile_answers_customer_profile_id_idx" ON "customer_profile_answers"("customer_profile_id");

-- CreateIndex
CREATE INDEX "customer_profile_answers_question_id_idx" ON "customer_profile_answers"("question_id");

-- CreateIndex
CREATE INDEX "customer_profile_answers_attribute_group_id_idx" ON "customer_profile_answers"("attribute_group_id");

-- CreateIndex
CREATE INDEX "customer_profile_answers_attribute_option_id_idx" ON "customer_profile_answers"("attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_code_key" ON "categories"("code");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_sort_order_idx" ON "categories"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "products_brand_id_idx" ON "products"("brand_id");

-- CreateIndex
CREATE INDEX "products_status_idx" ON "products"("status");

-- CreateIndex
CREATE INDEX "products_is_active_idx" ON "products"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "product_references_barcode_key" ON "product_references"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "product_references_sku_key" ON "product_references"("sku");

-- CreateIndex
CREATE INDEX "product_references_product_id_idx" ON "product_references"("product_id");

-- CreateIndex
CREATE INDEX "product_references_is_active_idx" ON "product_references"("is_active");

-- CreateIndex
CREATE INDEX "product_references_stock_quantity_idx" ON "product_references"("stock_quantity");

-- CreateIndex
CREATE UNIQUE INDEX "product_references_product_id_reference_code_key" ON "product_references"("product_id", "reference_code");

-- CreateIndex
CREATE INDEX "product_reference_attributes_product_reference_id_idx" ON "product_reference_attributes"("product_reference_id");

-- CreateIndex
CREATE INDEX "product_reference_attributes_attribute_group_id_idx" ON "product_reference_attributes"("attribute_group_id");

-- CreateIndex
CREATE INDEX "product_reference_attributes_attribute_option_id_idx" ON "product_reference_attributes"("attribute_option_id");

-- CreateIndex
CREATE INDEX "product_reference_attributes_match_type_idx" ON "product_reference_attributes"("match_type");

-- CreateIndex
CREATE UNIQUE INDEX "product_reference_attributes_product_reference_id_attribute_key" ON "product_reference_attributes"("product_reference_id", "attribute_group_id", "attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "packs_slug_key" ON "packs"("slug");

-- CreateIndex
CREATE INDEX "packs_status_idx" ON "packs"("status");

-- CreateIndex
CREATE INDEX "packs_is_active_idx" ON "packs"("is_active");

-- CreateIndex
CREATE INDEX "packs_priority_idx" ON "packs"("priority");

-- CreateIndex
CREATE INDEX "packs_min_budget_max_budget_idx" ON "packs"("min_budget", "max_budget");

-- CreateIndex
CREATE INDEX "pack_items_pack_id_idx" ON "pack_items"("pack_id");

-- CreateIndex
CREATE INDEX "pack_items_product_id_idx" ON "pack_items"("product_id");

-- CreateIndex
CREATE INDEX "pack_items_product_reference_id_idx" ON "pack_items"("product_reference_id");

-- CreateIndex
CREATE INDEX "pack_items_selection_mode_idx" ON "pack_items"("selection_mode");

-- CreateIndex
CREATE INDEX "pack_attributes_pack_id_idx" ON "pack_attributes"("pack_id");

-- CreateIndex
CREATE INDEX "pack_attributes_attribute_group_id_idx" ON "pack_attributes"("attribute_group_id");

-- CreateIndex
CREATE INDEX "pack_attributes_attribute_option_id_idx" ON "pack_attributes"("attribute_option_id");

-- CreateIndex
CREATE INDEX "pack_attributes_match_type_idx" ON "pack_attributes"("match_type");

-- CreateIndex
CREATE UNIQUE INDEX "pack_attributes_pack_id_attribute_group_id_attribute_option_key" ON "pack_attributes"("pack_id", "attribute_group_id", "attribute_option_id");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_rules_code_key" ON "recommendation_rules"("code");

-- CreateIndex
CREATE INDEX "recommendation_rules_target_type_idx" ON "recommendation_rules"("target_type");

-- CreateIndex
CREATE INDEX "recommendation_rules_attribute_group_id_idx" ON "recommendation_rules"("attribute_group_id");

-- CreateIndex
CREATE INDEX "recommendation_rules_condition_type_idx" ON "recommendation_rules"("condition_type");

-- CreateIndex
CREATE INDEX "recommendation_rules_is_active_idx" ON "recommendation_rules"("is_active");

-- CreateIndex
CREATE INDEX "recommendation_sessions_customer_profile_id_idx" ON "recommendation_sessions"("customer_profile_id");

-- CreateIndex
CREATE INDEX "recommendation_sessions_status_idx" ON "recommendation_sessions"("status");

-- CreateIndex
CREATE INDEX "recommendation_sessions_created_at_idx" ON "recommendation_sessions"("created_at");

-- CreateIndex
CREATE INDEX "recommendation_results_recommendation_session_id_rank_idx" ON "recommendation_results"("recommendation_session_id", "rank");

-- CreateIndex
CREATE INDEX "recommendation_results_pack_id_idx" ON "recommendation_results"("pack_id");

-- CreateIndex
CREATE INDEX "recommendation_results_is_selected_idx" ON "recommendation_results"("is_selected");

-- CreateIndex
CREATE UNIQUE INDEX "recommendation_results_recommendation_session_id_pack_id_key" ON "recommendation_results"("recommendation_session_id", "pack_id");

-- CreateIndex
CREATE INDEX "recommendation_result_items_recommendation_result_id_idx" ON "recommendation_result_items"("recommendation_result_id");

-- CreateIndex
CREATE INDEX "recommendation_result_items_pack_item_id_idx" ON "recommendation_result_items"("pack_item_id");

-- CreateIndex
CREATE INDEX "recommendation_result_items_product_id_idx" ON "recommendation_result_items"("product_id");

-- CreateIndex
CREATE INDEX "recommendation_result_items_selected_product_reference_id_idx" ON "recommendation_result_items"("selected_product_reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_phone_idx" ON "customers"("phone");

-- CreateIndex
CREATE INDEX "customers_whatsapp_phone_idx" ON "customers"("whatsapp_phone");

-- CreateIndex
CREATE INDEX "customer_addresses_customer_id_idx" ON "customer_addresses"("customer_id");

-- CreateIndex
CREATE INDEX "customer_addresses_city_idx" ON "customer_addresses"("city");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_customer_id_idx" ON "orders"("customer_id");

-- CreateIndex
CREATE INDEX "orders_customer_profile_id_idx" ON "orders"("customer_profile_id");

-- CreateIndex
CREATE INDEX "orders_recommendation_result_id_idx" ON "orders"("recommendation_result_id");

-- CreateIndex
CREATE INDEX "orders_selected_pack_id_idx" ON "orders"("selected_pack_id");

-- CreateIndex
CREATE INDEX "orders_customer_address_id_idx" ON "orders"("customer_address_id");

-- CreateIndex
CREATE INDEX "orders_order_status_idx" ON "orders"("order_status");

-- CreateIndex
CREATE INDEX "orders_payment_status_idx" ON "orders"("payment_status");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "order_items_pack_id_idx" ON "order_items"("pack_id");

-- CreateIndex
CREATE INDEX "order_items_product_id_idx" ON "order_items"("product_id");

-- CreateIndex
CREATE INDEX "order_items_product_reference_id_idx" ON "order_items"("product_reference_id");

-- CreateIndex
CREATE INDEX "order_status_history_order_id_idx" ON "order_status_history"("order_id");

-- CreateIndex
CREATE INDEX "order_status_history_changed_by_admin_id_idx" ON "order_status_history"("changed_by_admin_id");

-- CreateIndex
CREATE INDEX "order_status_history_new_status_idx" ON "order_status_history"("new_status");

-- CreateIndex
CREATE INDEX "order_status_history_created_at_idx" ON "order_status_history"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- CreateIndex
CREATE INDEX "admin_users_role_idx" ON "admin_users"("role");

-- CreateIndex
CREATE INDEX "admin_users_is_active_idx" ON "admin_users"("is_active");

-- CreateIndex
CREATE INDEX "customer_events_customer_profile_id_idx" ON "customer_events"("customer_profile_id");

-- CreateIndex
CREATE INDEX "customer_events_customer_id_idx" ON "customer_events"("customer_id");

-- CreateIndex
CREATE INDEX "customer_events_event_type_idx" ON "customer_events"("event_type");

-- CreateIndex
CREATE INDEX "customer_events_created_at_idx" ON "customer_events"("created_at");

-- CreateIndex
CREATE INDEX "message_logs_customer_id_idx" ON "message_logs"("customer_id");

-- CreateIndex
CREATE INDEX "message_logs_order_id_idx" ON "message_logs"("order_id");

-- CreateIndex
CREATE INDEX "message_logs_channel_idx" ON "message_logs"("channel");

-- CreateIndex
CREATE INDEX "message_logs_status_idx" ON "message_logs"("status");

-- CreateIndex
CREATE INDEX "message_logs_message_type_idx" ON "message_logs"("message_type");

-- CreateIndex
CREATE INDEX "message_logs_created_at_idx" ON "message_logs"("created_at");

-- AddForeignKey
ALTER TABLE "attribute_options" ADD CONSTRAINT "attribute_options_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question_options" ADD CONSTRAINT "quiz_question_options_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_question_options" ADD CONSTRAINT "quiz_question_options_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile_answers" ADD CONSTRAINT "customer_profile_answers_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile_answers" ADD CONSTRAINT "customer_profile_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile_answers" ADD CONSTRAINT "customer_profile_answers_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_profile_answers" ADD CONSTRAINT "customer_profile_answers_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_references" ADD CONSTRAINT "product_references_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_attributes" ADD CONSTRAINT "product_reference_attributes_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_attributes" ADD CONSTRAINT "product_reference_attributes_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reference_attributes" ADD CONSTRAINT "product_reference_attributes_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_items" ADD CONSTRAINT "pack_items_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_attributes" ADD CONSTRAINT "pack_attributes_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_attributes" ADD CONSTRAINT "pack_attributes_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pack_attributes" ADD CONSTRAINT "pack_attributes_attribute_option_id_fkey" FOREIGN KEY ("attribute_option_id") REFERENCES "attribute_options"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_rules" ADD CONSTRAINT "recommendation_rules_attribute_group_id_fkey" FOREIGN KEY ("attribute_group_id") REFERENCES "attribute_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_recommendation_session_id_fkey" FOREIGN KEY ("recommendation_session_id") REFERENCES "recommendation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_results" ADD CONSTRAINT "recommendation_results_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_result_items" ADD CONSTRAINT "recommendation_result_items_recommendation_result_id_fkey" FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_result_items" ADD CONSTRAINT "recommendation_result_items_pack_item_id_fkey" FOREIGN KEY ("pack_item_id") REFERENCES "pack_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_result_items" ADD CONSTRAINT "recommendation_result_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_result_items" ADD CONSTRAINT "recommendation_result_items_selected_product_reference_id_fkey" FOREIGN KEY ("selected_product_reference_id") REFERENCES "product_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_recommendation_result_id_fkey" FOREIGN KEY ("recommendation_result_id") REFERENCES "recommendation_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_selected_pack_id_fkey" FOREIGN KEY ("selected_pack_id") REFERENCES "packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_address_id_fkey" FOREIGN KEY ("customer_address_id") REFERENCES "customer_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_pack_id_fkey" FOREIGN KEY ("pack_id") REFERENCES "packs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_reference_id_fkey" FOREIGN KEY ("product_reference_id") REFERENCES "product_references"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_changed_by_admin_id_fkey" FOREIGN KEY ("changed_by_admin_id") REFERENCES "admin_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_profile_id_fkey" FOREIGN KEY ("customer_profile_id") REFERENCES "customer_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_events" ADD CONSTRAINT "customer_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
