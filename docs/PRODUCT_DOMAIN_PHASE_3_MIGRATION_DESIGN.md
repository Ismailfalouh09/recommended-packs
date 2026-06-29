# Product Domain Redesign — Phase 3: Database & Prisma Migration Design

> Planning-only deliverable. **No Prisma schema, migration file, seed, or code was modified while producing it.** Every SQL/Prisma snippet below is a *design artifact* to be implemented in Phase 4+, not an applied change.
> Executes Phase 3 of `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md` (steps 3.1–3.7).
> Builds on the **APPROVED** `docs/PRODUCT_DOMAIN_PHASE_2_DATA_MODEL_AND_API_CONTRACT.md` (Checkpoint #2 accepted 2026-06-29) and the Phase 0 lock map / baseline.
> Verified against live code at HEAD `bc1e975`; schema evidence cited as `path:line`, migration evidence as `prisma/migrations/<name>`.
> **This document is the input to Master Plan Checkpoint #3** (migration order, backfill, rollback, FK-safety sign-off). No migration file is written until this is accepted.

---

## 0. Sign-off Record

| Field | Value |
|---|---|
| Author | design (Phase 3) |
| Decision-maker | ismail (business owner) |
| Date drafted | 2026-06-29 |
| Status | **DRAFT — awaiting Checkpoint #3 sign-off** |
| Depends on | Phase 2 model/contract (APPROVED), Phase 0 §2.4 lock map + §5 baseline |
| Blocks | Phase 4 (core implementation) — no migration applied until approved |
| Tooling | Prisma `^7.8.0` + PostgreSQL; `prisma migrate dev` (`package.json:18`); forward-only SQL migrations under `prisma/migrations/` |
| Guardrails | G1 additive-first · G2 never violate `Restrict` · G3 visibility compat window · G4 gate behavioural fixes · G5 deliberate DTO whitelisting |

**Environment facts that shape this plan:**
- 4 migrations applied; latest `20260619202732_order_selected_pack_optional`; Product/Reference shape unchanged since `init` (Phase 0 §1.1).
- Prisma migrations are **forward-only** — there is no generated down-migration. Rollback = restore from a pre-phase `pg_dump` **or** a hand-written compensating migration (§5).
- Columns map to `snake_case` via `@map` (e.g. `short_description`); enums are Postgres types (`prisma/migrations/...init` lines 8, 17).

---

## 1. Step 3.1 — Annotated Prisma Model Evolution

Every new/changed field from Phase 2 §1, with nullability, mapped column, default, and class. **All adds are nullable; no `NOT NULL`, no type narrowing, no drop** (Phase 2 §8.1 — zero destructive).

### 1.1 New enums

| Enum | Definition | Note |
|---|---|---|
| `VariationType` | `SHADE \| SIZE \| BUNDLE` | NEW type. SQL: `CREATE TYPE "VariationType" AS ENUM ('SHADE','SIZE','BUNDLE');` |
| `ProductStatus` | += `HIDDEN` | Extends existing `('DRAFT','ACTIVE','ARCHIVED')` (`init` line 8). SQL: `ALTER TYPE "ProductStatus" ADD VALUE 'HIDDEN';` ⚠ see §2.3 (enum-add constraints) |

### 1.2 `Product` — additive nullable columns (`schema.prisma:310-340`)

| Prisma field | Column (`@map`) | Type | Nullable | Default | Class |
|---|---|---|---|---|---|
| `productType` | `product_type` | `String? @db.VarChar(60)` | yes | — | Additive |
| `shortDescription` | `short_description` | `String? @db.VarChar(280)` | yes | — | Additive |
| `ingredients` | `ingredients` | `String? @db.Text` | yes | — | Additive |
| `directions` | `directions` | `String? @db.Text` | yes | — | Additive |
| `compareAtPrice` | `compare_at_price` | `Decimal? @db.Decimal(10,2)` | yes | — | Additive |
| `metaTitle` | `meta_title` | `String? @db.VarChar(180)` | yes | — | Additive |
| `metaDescription` | `meta_description` | `String? @db.VarChar(320)` | yes | — | Additive |

New indexes: `@@index([productType])`, `@@index([status, categoryId])` (Phase 2 §5.2). `mainImageUrl` (`:320`) **kept** (compat window C9 — not dropped this phase).

### 1.3 `ProductReference` — additive nullable columns (`schema.prisma:342-373`)

| Prisma field | Column | Type | Nullable | Default | Class |
|---|---|---|---|---|---|
| `shadeName` | `shade_name` | `String? @db.VarChar(120)` | yes | — | Additive |
| `shadeCode` | `shade_code` | `String? @db.VarChar(60)` | yes | — | Additive |
| `swatchHex` | `swatch_hex` | `String? @db.VarChar(7)` | yes | — | Additive |
| `measurement` | `measurement` | `String? @db.VarChar(40)` | yes | — | Additive |
| `variationType` | `variation_type` | `VariationType?` | yes | — | Additive |

New index: `@@index([variationType])`. `referenceName` (`:346`) **kept** as the human label (Phase 2 §1.2). `reservedQuantity` already exists (`:353`) — no new stock column; decrement is Phase 7.

### 1.4 `OrderItem` — additive nullable snapshot columns (`schema.prisma:663-686`)

| Prisma field | Column | Type | Nullable | Class |
|---|---|---|---|---|
| `skuSnapshot` | `sku_snapshot` | `String? @db.VarChar(120)` | yes | Additive |
| `variationSnapshot` | `variation_snapshot` | `String? @db.VarChar(160)` | yes | Additive |
| `productImageUrlSnapshot` | `product_image_url_snapshot` | `String? @db.Text` | yes | Additive |
| `brandNameSnapshot` | `brand_name_snapshot` | `String? @db.VarChar(120)` | yes | Additive |

Existing `productNameSnapshot`/`referenceNameSnapshot`/`unitPriceSnapshot` unchanged. Backfilled in §3; written live in Phase 7.

### 1.5 `ProductAttribute` — NEW table (mirrors `ProductReferenceAttribute` `schema.prisma:375-395`)

```prisma
model ProductAttribute {
  id                String    @id @default(uuid()) @db.Uuid
  productId         String    @map("product_id") @db.Uuid
  attributeGroupId  String    @map("attribute_group_id") @db.Uuid
  attributeOptionId String    @map("attribute_option_id") @db.Uuid
  matchType         MatchType @default(COMPATIBLE) @map("match_type")
  scoreValue        Int       @default(0) @map("score_value")
  isHardFilter      Boolean   @default(false) @map("is_hard_filter")
  createdAt         DateTime  @default(now()) @map("created_at")

  product         Product         @relation(fields: [productId], references: [id], onDelete: Cascade)
  attributeGroup  AttributeGroup  @relation(fields: [attributeGroupId], references: [id], onDelete: Restrict)
  attributeOption AttributeOption @relation(fields: [attributeOptionId], references: [id], onDelete: Restrict)

  @@unique([productId, attributeGroupId, attributeOptionId])
  @@index([productId])
  @@index([attributeGroupId])
  @@index([attributeOptionId])
  @@index([matchType])
  @@map("product_attributes")
}
```
Requires back-relations on `Product` (`productAttributes ProductAttribute[]`), `AttributeGroup`, `AttributeOption` — additive, no column change on those tables.

### 1.6 `PackItem` — relation hardening (`schema.prisma:436-459`)

Change `productReference` relation `onDelete: SetNull` → `Restrict` (Phase 2 §4.3). No column change; FK constraint replaced (§2.4 / §6).

---

## 2. Step 3.2 — Migration Order (additive → backfill → constrain)

Sequenced so **each migration is independently revertible** and the DB is functional after every step. Each becomes one timestamped folder `prisma/migrations/<ts>_<name>/migration.sql` (naming mirrors existing convention).

| # | Migration name | Class | Contents | Reversible by |
|---|---|---|---|---|
| **M1** | `add_product_domain_enums` | Additive (enum) | `CREATE TYPE "VariationType"`; `ALTER TYPE "ProductStatus" ADD VALUE 'HIDDEN'` | §5 — recreate type (enum values can't be dropped) |
| **M2** | `add_product_domain_columns` | Additive | All nullable columns on `products`, `product_references`, `order_items` (§1.2–1.4) + new indexes (§1.2–1.3) | `DROP COLUMN` / `DROP INDEX` (safe — nullable) |
| **M3** | `add_product_attributes_table` | Additive | `CREATE TABLE product_attributes` + FKs + unique + indexes (§1.5) | `DROP TABLE` (no inbound FK) |
| **M4** | `backfill_product_domain` | Backfill (data) | Idempotent `UPDATE`s (§3) — order snapshots, optional gated shade/status reconciliation | Re-run resets to NULL is unsafe → restore from snapshot (§5); data-only, no shape change |
| **M5** | `harden_pack_item_reference_fk` | Compat (FK) | Drop `pack_items_product_reference_id_fkey`, re-add with `ON DELETE RESTRICT` — **after** §6 pre-check passes | Re-add original `ON DELETE SET NULL` |

**Notes on ordering:**
- M1 before M2/M3 because `variation_type` column (M2) references the `VariationType` type.
- M4 (backfill) after M2/M3 so target columns exist.
- M5 last and **gated** on the §6 FK-safety pre-check returning 0 orphans.
- **No constrain/contract migration in MVP.** No column is made `NOT NULL`; `mainImageUrl`/`isActive` drops are deferred to a post-MVP contract migration (Phase 2 C8/C9) outside this set. "Required-by-type" stays service validation, never a DB constraint (Phase 1 Q10/Q11).

### 2.3 Enum-addition constraint (M1) — explicit gotcha

- PostgreSQL **cannot drop an enum value**; rollback of `ADD VALUE 'HIDDEN'` means recreating `ProductStatus` (rename old → create new → cast column → drop old) — captured in §5. Because `HIDDEN` is never *written* by M1–M4, leaving it unused is inert, so the practical rollback is "leave it" unless a clean type is mandatory.
- Keep M1 **enum-only** (no DML in the same migration) so the new value is not used in the transaction that adds it (safe across PG versions). M2 may then reference `VariationType` freely.

---

## 3. Step 3.3 — Legacy Data Backfill Plan (M4)

Principle: **never manufacture misleading data** (3.3 risk = "null/garbage data"). Where a value can't be derived safely, leave it NULL and let admin enrichment fill it in Phase 4/5.

### 3.1 Order-item snapshot backfill (fills R3 gap for existing orders)

Existing orders have **no** sku/variation/image/brand snapshot. Backfill **best-effort from the current catalog** — strictly better than NULL, with the documented caveat that it reflects *current* values, not purchase-time (true historical accuracy only holds for orders placed after Phase 7 writes snapshots live).

```sql
UPDATE order_items oi
SET sku_snapshot                = pr.sku,
    variation_snapshot          = COALESCE(pr.shade_name, pr.measurement, pr.reference_name),
    product_image_url_snapshot  = p.main_image_url,
    brand_name_snapshot         = b.name
FROM product_references pr
JOIN products p  ON p.id  = pr.product_id
LEFT JOIN brands b ON b.id = p.brand_id
WHERE oi.product_reference_id = pr.id
  AND oi.sku_snapshot IS NULL;            -- idempotent guard
```

### 3.2 Shade/size backfill — **deliberate NO blind copy**

Blindly copying `reference_name → shade_name` would mislabel size variants as shades (legacy rows have no `variation_type`). **Decision: leave `shade_name`, `measurement`, `variation_type` NULL at migration time**; `reference_name` continues to render as the label. Admins enrich during Phase 4/5 CRUD.

*Optional, gated heuristic (only if the makeup/skincare split is clean in the category tree):*
```sql
-- ONLY for references whose product sits under a makeup category code set:
UPDATE product_references pr SET shade_name = pr.reference_name, variation_type = 'SHADE'
FROM products p JOIN categories c ON c.id = p.category_id
WHERE pr.product_id = p.id AND pr.shade_name IS NULL
  AND c.code IN (/* makeup category codes, confirmed in Phase 3.7 */);
```
Recommended posture: **skip the heuristic for MVP**; enrich via admin. Listed for completeness.

### 3.3 Visibility reconciliation (supports the C8 compat window)

Validation (§4) may surface drift where `status='ACTIVE'` but `is_active=false`. These were effectively "soft-hidden" — map them to the new `HIDDEN` state so the single-source-of-truth switch (Phase 4.5) is clean:
```sql
UPDATE products SET status = 'HIDDEN'
WHERE status = 'ACTIVE' AND is_active = false;
```
Gated: run **only if** §4 pre-check finds such rows; otherwise no-op. `is_active` is retained physically through the compat window (G3).

### 3.4 What is NOT backfilled (left NULL by design)

`productType`, `shortDescription`, `ingredients`, `directions`, `compareAtPrice`, `metaTitle/Description`, `shadeCode`, `swatchHex` — all admin-authored; no source to derive from. `product_attributes` starts empty (populated as merchandising assigns suitability, Phase 5).

---

## 4. Step 3.4 — Data Validation (before & after)

Run as a query set against the pre-phase snapshot and the post-migration DB. **Invariant: additive migrations change zero row counts on existing tables.**

### 4.1 Pre-migration baseline capture
```sql
SELECT 'products' t, count(*) n FROM products
UNION ALL SELECT 'product_references', count(*) FROM product_references
UNION ALL SELECT 'order_items', count(*) FROM order_items
UNION ALL SELECT 'product_reference_attributes', count(*) FROM product_reference_attributes
UNION ALL SELECT 'pack_items_with_ref', count(*) FROM pack_items WHERE product_reference_id IS NOT NULL;
```
Plus drift probe (drives §3.3): `SELECT count(*) FROM products WHERE status='ACTIVE' AND is_active=false;`

### 4.2 Post-migration invariants

| # | Invariant | Check | Expected |
|---|---|---|---|
| V1 | No row loss (additive) | counts in 4.1 re-run | identical for products/references/order_items/attrs |
| V2 | New columns exist + nullable | `information_schema.columns` | all present, `is_nullable='YES'` |
| V3 | Snapshot backfill complete | `count(*) order_items WHERE sku_snapshot IS NULL AND product_reference_id IN (SELECT id FROM product_references WHERE sku IS NOT NULL)` | `0` |
| V4 | No FK orphan before M5 | §6 pre-check query | `0` |
| V5 | `product_attributes` integrity | every row's group has `is_product_attribute=true` | `0` violations (enforced in service from Phase 5; query is the audit) |
| V6 | Enum extended | `HIDDEN` ∈ `pg_enum` for `ProductStatus`; `VariationType` exists | true |
| V7 | No unintended status change | `count` of products per status vs pre, minus the §3.3 reconciliation delta | matches reconciliation count exactly |

---

## 5. Step 3.5 — Rollback Playbook (per migration)

Prisma is forward-only; every step gets a **compensating action**. Primary safety net = pre-phase `pg_dump` (Phase 0 §5.2).

| Migration | Forward | Compensating rollback |
|---|---|---|
| M1 enums | `CREATE TYPE VariationType`, `ADD VALUE HIDDEN` | `DROP TYPE "VariationType"` (after M2 reverted). `HIDDEN`: inert if unused → leave; for a clean type, recreate `ProductStatus` (rename→create→`ALTER TABLE products ALTER COLUMN status TYPE ... USING`→drop old) |
| M2 columns/indexes | `ALTER TABLE ADD COLUMN ...`, `CREATE INDEX` | `ALTER TABLE DROP COLUMN ...`, `DROP INDEX ...` — safe, columns nullable & unread until Phase 4 |
| M3 table | `CREATE TABLE product_attributes` | `DROP TABLE product_attributes` — no inbound FK, orphan-safe |
| M4 backfill | data `UPDATE`s | Data-only; reverse is **restore from snapshot** (cannot reliably reconstruct prior NULLs). Snapshot/visibility backfills are forward-safe improvements — preferred rollback is "leave data, revert code" |
| M5 FK | drop+re-add FK as `RESTRICT` | drop+re-add original `ON DELETE SET NULL` (1-statement reverse) |

**Whole-phase rollback:** `git revert` the schema/migration commits **and** `psql < pre_phase_3.dump` restore. Because Phase 4 code is not yet shipped, the additive columns are unread — leaving M1–M3 applied while reverting M4/M5 is also valid and lower-risk than a full restore.

---

## 6. Step 3.6 — FK-Safety Checklist (protect Pack/Rec/Stock/Order locks)

Guarantee no migration violates the §2.4 lock map (G2). Verified against `prisma/migrations/...init` FK definitions.

| Locked relation | onDelete (live) | This phase | Safety |
|---|---|---|---|
| OrderItem → Product / Reference | Restrict (`init`) | untouched | ✅ snapshots extended additively; FKs unchanged |
| PackItem → Product | Restrict (`init`) | untouched | ✅ |
| **PackItem → Reference** | **SetNull (`init` line 809)** | **→ Restrict (M5)** | ⚠ gated on pre-check below |
| RecommendationResultItem → Product / Reference | Restrict | untouched | ✅ |
| Product → ProductReference | Cascade | untouched | ✅ |
| Category → Product (required) | Restrict | untouched | ✅ |
| Brand → Product (optional) | SetNull | untouched | ✅ |
| **ProductAttribute → Product** | n/a (new) | Cascade (M3) | ✅ matches `ProductReferenceAttribute` pattern |
| ProductAttribute → Group/Option | n/a (new) | Restrict (M3) | ✅ no delete of in-use attribute metadata |

**M5 pre-flight (must return 0 before applying):**
```sql
-- orphaned pack references (should already be impossible under existing FK, but verify):
SELECT count(*) FROM pack_items pi
WHERE pi.product_reference_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM product_references pr WHERE pr.id = pi.product_reference_id);

-- FIXED_REFERENCE pack items missing a reference (data-quality flag, not a blocker):
SELECT count(*) FROM pack_items
WHERE selection_mode = 'FIXED_REFERENCE' AND product_reference_id IS NULL;
```
First query **must** be 0 to apply M5. Second is a data-quality report (R13 context) — surfaced to admin, not auto-fixed.

**Stock note:** no stock column changes this phase. `reservedQuantity` exists; the decrement/reservation write is Phase 7 (gated, Checkpoint #4) — explicitly out of Phase 3 scope.

---

## 7. Step 3.7 — Seed & Test Data Strategy

Extend `prisma/seed.ts` (deterministic UUID scheme, `prisma/seed.ts:25-47`) so fixtures exercise every new shape. Seed changes ship **with Phase 4**, not as a migration.

### 7.1 Required fixture coverage

| Case | Fixture | Exercises |
|---|---|---|
| **Shade axis** | Foundation with 3 references: `shadeName`+`shadeCode`+`swatchHex`, `variationType=SHADE` | swatch UI, shade matching, reference-level tone/undertone attrs |
| **Size axis** | Serum with 2 references: `measurement` `30ml`/`50ml`, `variationType=SIZE`, `priceDelta` on the larger | size selector, delta pricing |
| **Out-of-stock** | One reference `stockQuantity=0` (and one `stock ≤ reserved`) on an otherwise `ACTIVE` product | "Sold out" + disabled CTA (Q6); unified availability predicate |
| **Product-level suitability** | `ProductAttribute` rows on the serum (`SKIN_TYPE`, `CONCERN`) using an `isProductAttribute=true` group | product-general matching (Phase 5/6) |
| **Sale price** | Product with `compareAtPrice > basePrice`-effective | `onSale` / `% saving` derivation (Q8) |
| **Visibility states** | One product each `DRAFT`, `HIDDEN`, `ARCHIVED` | lifecycle filtering; public-projection exclusion |
| **Pack — fixed** | PackItem `selectionMode=FIXED_REFERENCE` → a specific shade | fixed resolution; M5 Restrict safety |
| **Pack — auto** | PackItem `selectionMode=AUTO_BEST_REFERENCE` over the shade product | best-available shade selection (Q5) |

### 7.2 Constraints

- Continue deterministic UUIDs (`00000000-0000-4000-8000-...`) so tests assert by id.
- At least one `isProductAttribute=true` `AttributeGroup` must be seeded (today the flag exists but is unused — `schema.prisma:144`) — e.g. promote/duplicate `SKIN_TYPE`/`CONCERN` as product-level.
- Seed must remain **idempotent** (upsert by stable id) so re-seeding a migrated DB is safe (Phase 9.1 rehearsal).

---

## 8. Checkpoint #3 — Exit Criteria & Sign-off Request

| Step | Deliverable | Where | Met |
|---|---|---|---|
| 3.1 | Annotated model-change plan; every field w/ nullability | §1 | ✅ |
| 3.2 | Ordered, independently-revertible migration list | §2 | ✅ |
| 3.3 | Backfill mapping per field (+ deliberate no-blind-copy) | §3 | ✅ |
| 3.4 | Pre/post validation query set + invariants | §4 | ✅ |
| 3.5 | Compensating rollback per migration | §5 | ✅ |
| 3.6 | FK-safety checklist; no `Restrict` violated; M5 pre-flight | §6 | ✅ |
| 3.7 | Seed plan covering shade/size/OOS/pack/visibility | §7 | ✅ |

**Decisions to confirm at Checkpoint #3:**
1. **5-migration split** M1–M5 (enums → columns → table → backfill → FK), additive-first, no MVP constrain step.
2. **Order snapshot backfill = best-effort from current catalog** (accepting it's not purchase-time-accurate for pre-Phase-7 orders).
3. **No blind `reference_name → shade_name` copy** (NULL + admin enrichment; heuristic skipped for MVP).
4. **Visibility reconciliation** maps `ACTIVE + isActive=false` drift → `HIDDEN` (gated on validation finding any).
5. **M5 FK hardening gated** on the orphan pre-check returning 0.

**On approval →** Phase 4 (Core Product & ProductReference Implementation): write M1–M5, update `schema.prisma`, regenerate the client, ship CRUD/visibility/pricing/stock-projection services + DTOs + Swagger + tests against the new shape.

> Carried open item unchanged: stock-decrement timing (Q7) remains locked-for-design as "at order create," reaffirmed at **Checkpoint #4** before Phase 7 deploy. Phase 3 introduces **no behavioural change** — only additive schema + safe backfill + one reversible FK hardening.
