-- Phase 3 / M4 — legacy data backfill (data-only, idempotent).
-- Runs after the additive structural migration so target columns + the
-- ProductStatus 'HIDDEN' value already exist and are committed.

-- 1) Order-item snapshot enrichment (R3): best-effort from the CURRENT catalog.
--    Caveat: reflects current values, not purchase-time. True purchase-time
--    accuracy only holds for orders placed after Phase 7 writes snapshots live.
UPDATE "order_items" oi
SET "sku_snapshot"               = pr."sku",
    "variation_snapshot"         = COALESCE(pr."shade_name", pr."measurement", pr."reference_name"),
    "product_image_url_snapshot" = p."main_image_url",
    "brand_name_snapshot"        = b."name"
FROM "product_references" pr
JOIN "products" p ON p."id" = pr."product_id"
LEFT JOIN "brands" b ON b."id" = p."brand_id"
WHERE oi."product_reference_id" = pr."id"
  AND oi."sku_snapshot" IS NULL;            -- idempotent guard

-- 2) Visibility reconciliation (C8 compat window): rows that were effectively
--    "soft-hidden" (status ACTIVE but isActive=false) become the new HIDDEN state
--    so the single-source-of-truth switch (Phase 4.5) is clean. No-op if none.
UPDATE "products"
SET "status" = 'HIDDEN'
WHERE "status" = 'ACTIVE' AND "is_active" = false;

-- NOTE (deliberate): no blind reference_name -> shade_name copy. Legacy rows have
-- no variation_type, so copying would mislabel sizes as shades. shade_name /
-- measurement / variation_type are left NULL for admin enrichment (Phase 4/5);
-- reference_name keeps rendering as the label.
