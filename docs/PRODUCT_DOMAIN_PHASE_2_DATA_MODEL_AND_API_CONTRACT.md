# Product Domain Redesign — Phase 2: Target Data Model & API Contract Design

> Planning-only deliverable. No source code, Prisma schema, migration, DTO, endpoint, seed, or configuration was modified while producing it.
> Executes Phase 2 of `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md` (steps 2.1–2.8).
> Builds on the signed-off `docs/PRODUCT_DOMAIN_PHASE_1_DECISIONS_AND_SCOPE.md` (Checkpoint #1, APPROVED), the verified `docs/PRODUCT_DOMAIN_PHASE_0_EVIDENCE_AND_GUARDRAILS.md` baseline, and `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md` §4–§9.
> Every schema claim was re-verified against live code at HEAD `bc1e975`; evidence is cited as `path:line`.
> **This document is the input to Master Plan Checkpoint #2** (approved data model + lifecycle + public/admin field visibility + migration strategy). No Prisma migration may be written in Phase 3 until this is accepted.

---

## 0. Sign-off Record

| Field | Value |
|---|---|
| Author | design (Phase 2) |
| Decision-maker | ismail (business owner) |
| Date drafted | 2026-06-29 |
| Status | **APPROVED — Checkpoint #2 ACCEPTED** (owner accepted the package 2026-06-29). Phase 3 unblocked |
| Depends on | Phase 1 capability matrix (APPROVED), Phase 0 lock map §2.4 |
| Blocks | Phase 3 (migration design) — no schema change until approved |
| Guardrails carried | G1 additive-first · G2 never violate `Restrict` · G3 visibility compat window · G4 feature-gate behavioural fixes · G5 deliberate DTO whitelisting |

**What this phase decides:** the exact field ownership, relation cardinalities, the single visibility state machine, the archive-over-delete policy on every locked relation, the unique/index plan, the admin-vs-public response projections, the field-visibility matrix, and the expand→contract classification of every change — *as design, not code*. It deliberately stops short of Prisma model edits (Phase 3.1) and migration files (Phase 3.2).

---

## 1. Step 2.1 — Target Object Responsibilities (lock what each model owns)

**Rule enforced:** *no field is owned by two models.* Each row names the single owning model; readers project but never co-own. Derived values (marked **D**) are computed in the response layer and stored nowhere.

### 1.1 Product — catalog identity & shared content

| Field | State | Type | Owner note |
|---|---|---|---|
| `id`, `categoryId`, `brandId`, `name`, `slug`, `description`, `basePrice`, `costPrice`, `currency`, `status`, `isActive`, `createdAt`, `updatedAt` | Existing | as `schema.prisma:310-324` | Unchanged |
| `productType` | **NEW** nullable | `VarChar(60)` | Sub-classification under Category. **Stored as a stable lowercase code** (e.g. `face-serum`, `foundation`), not free display text — so no typo/casing drift now, slug-ready URLs, and a clean future backfill if promoted to a `ProductType` lookup table. Allowed-set validated in service, **not** a DB enum (keeps "required-by-type" a configurable admin policy — Phase 1 §1.3 Q11). Display label resolved from a small code→label map (Phase 5) |
| `shortDescription` | **NEW** nullable | `VarChar(280)` | PDP teaser |
| `ingredients` | **NEW** nullable | `Text` | Shared across all references; required-by-type is validation, not `NOT NULL` (Phase 1 Q10) |
| `directions` | **NEW** nullable | `Text` | Shared usage/warnings |
| `compareAtPrice` | **NEW** nullable | `Decimal(10,2)` | Drives `onSale` / `% saving` (Phase 1 Q8) |
| `metaTitle` | **NEW** nullable | `VarChar(180)` | Distinct from `slug` |
| `metaDescription` | **NEW** nullable | `VarChar(320)` | SEO |
| `mainImageUrl` | Existing — **retire** | `String?` | Cover moves to `ProductImage role=COVER`; kept physically during compat window (R5), reads switch to the join (Phase 5.1) |

**Product owns NOT:** price-bearing stock, SKU/barcode, shade/size, reservation — all reference-level. Confirmed against the thin-header baseline (`schema.prisma:310-340`; conception §4.1).

### 1.2 ProductReference — the sellable SKU

| Field | State | Type | Owner note |
|---|---|---|---|
| `id`, `productId`, `referenceCode`, `referenceName`, `barcode`, `sku`, `priceOverride`, `priceDelta`, `imageUrl`, `stockQuantity`, `reservedQuantity`, `lowStockThreshold`, `isDefault`, `isActive`, timestamps | Existing | as `schema.prisma:342-358` | Unchanged |
| `shadeName` | **NEW** nullable | `VarChar(120)` | Structured shade identity; **augments** today's free-text `referenceName` (which stays as the human label) |
| `shadeCode` | **NEW** nullable | `VarChar(60)` | Stable shade key |
| `swatchHex` | **NEW** nullable | `VarChar(7)` | `#RRGGBB` for swatch UI |
| `measurement` | **NEW** nullable | `VarChar(40)` | e.g. `45ml`, `30g` |
| `variationType` | **NEW** nullable | enum `VariationType {SHADE, SIZE, BUNDLE}` | Single-axis for MVP; **second axis reserved** without breaking migration (Phase 1 Q1). Nullable ⇒ legacy refs need no backfill |

**Decision — `variationType` is a DB enum, not a string.** Unlike `productType` (which gates configurable validation policy), `variationType` drives storefront rendering branch logic (swatch vs size selector) and has a closed, stable set. A 4th value later is an additive enum-extension, not a breaking change.

**Reference-level `compareAtPrice`: DEFERRED** (Phase 1 §2.2). References inherit the product's `compareAtPrice`; per-shade sale pricing is a reserved extension point, not built.

### 1.3 ProductAttribute (NEW model) — product-level general suitability

Mirrors `ProductReferenceAttribute` (`schema.prisma:375-395`) but keyed to `Product`. This is the **only** new table in Phase 2's design.

| Field | Type | Note |
|---|---|---|
| `id` | `Uuid` | |
| `productId` | `Uuid` FK → Product | `onDelete: Cascade` |
| `attributeGroupId` | `Uuid` FK → AttributeGroup | `onDelete: Restrict` |
| `attributeOptionId` | `Uuid` FK → AttributeOption | `onDelete: Restrict` |
| `matchType` | `MatchType` | reuse existing enum |
| `scoreValue` | `Int` | |
| `isHardFilter` | `Boolean` | |
| `createdAt` | `DateTime` | |

- **Constraint:** `@@unique([productId, attributeGroupId, attributeOptionId])` — same shape as the reference variant.
- **Policy guard (service, not DB):** only `AttributeGroup` rows with `isProductAttribute = true` (`schema.prisma:144`, already present, currently unused) may be assigned here; only `isProductAttribute = false` groups assign at reference level. This enforces the Phase 1 ownership split (skin type/concern → product; tone/undertone/style → reference) **without** a DB-level coupling that would over-constrain future config.

### 1.4 OrderItem — historical snapshot owner (extend)

`OrderItem` already owns its snapshot copies (`schema.prisma:663-686`). Extend the frozen set so receipts survive later catalog edits/archival (Phase 1 §1.5, R3).

| Field | State | Type | Note |
|---|---|---|---|
| `productNameSnapshot`, `referenceNameSnapshot`, `unitPriceSnapshot` | Existing | — | Unchanged |
| `skuSnapshot` | **NEW** nullable | `VarChar(120)` | |
| `variationSnapshot` | **NEW** nullable | `VarChar(160)` | shade and/or size descriptor frozen at purchase |
| `productImageUrlSnapshot` | **NEW** nullable | `Text` | resolved cover URL at purchase |
| `brandNameSnapshot` | **NEW** nullable | `VarChar(120)` | |

Nullable + backfilled from current product/reference (Phase 3.3); old orders keep working via existing `Restrict` FKs (`schema.prisma:678-679`). Snapshot *writing* logic and decrement are Phase 7 (gated, Checkpoint #4).

### 1.5 Derived (owned by no model — response layer only)

`onSale`, `percentageSaving`, `effectiveUnitPrice` (= `priceOverride ?? basePrice + priceDelta`, per `orders.service.ts:821-833`), `availability`/`inStock` boolean, `lowStock` badge, product `coverImageUrl`. **D** values are never persisted — preserves the "normalized DB, rich response" principle (conception §1).

---

## 2. Step 2.2 — Relation Cardinalities

Each relation: side, optionality, and `onDelete`. **Bold** rows are changes from the live schema.

| Relation | Cardinality | FK field | onDelete | Source / change |
|---|---|---|---|---|
| Category → Product | 1 → 0..* | `Product.categoryId` (required) | Restrict | `schema.prisma:326` — unchanged |
| Brand → Product | 0..1 → 0..* | `Product.brandId` (optional) | SetNull | `schema.prisma:327` — unchanged |
| Product → ProductReference | 1 → 1..* | `ProductReference.productId` | Cascade | `schema.prisma:360` — unchanged |
| **Product → ProductAttribute** | **1 → 0..*** | **`ProductAttribute.productId`** | **Cascade** | **NEW (§1.3)** |
| AttributeGroup → ProductAttribute | 1 → 0..* | `attributeGroupId` | Restrict | NEW — mirrors `ProductReferenceAttribute.attributeGroup` (`schema.prisma:386`) |
| AttributeOption → ProductAttribute | 1 → 0..* | `attributeOptionId` | Restrict | NEW — mirrors `:387` |
| Product → ProductImage | 1 → 0..* | `ProductImage.productId` | Cascade | `schema.prisma:794` — unchanged |
| ProductReference → ProductReferenceImage | 1 → 0..1 | `productReferenceId @unique` | Cascade | `schema.prisma:842,849` — 1:1 kept |
| ProductReference → ProductReferenceAttribute | 1 → 0..* | `productReferenceId` | Cascade | `schema.prisma:385` — unchanged |
| PackItem → Product | *..1 (required) | `PackItem.productId` | Restrict | `schema.prisma:449` — unchanged |
| **PackItem → ProductReference** | ***..0..1 (optional)** | **`PackItem.productReferenceId`** | **Restrict (was SetNull)** | **CHANGE — see §4.3 / R13** |
| RecommendationResultItem → Product | *..1 | `productId` | Restrict | `schema.prisma:568` — unchanged |
| RecommendationResultItem → ProductReference | *..1 | `selectedProductReferenceId` | Restrict | `schema.prisma:569` — unchanged |
| OrderItem → Product | *..1 | `productId` | Restrict | `schema.prisma:678` — unchanged |
| OrderItem → ProductReference | *..1 | `productReferenceId` | Restrict | `schema.prisma:679` — unchanged |
| OrderItem → Pack | *..0..1 | `packId` | SetNull | `schema.prisma:677` — unchanged |

**Verification (exit criterion):** every catalog relation has an explicit optionality + `onDelete`; the only cardinality change is the `PackItem.productReferenceId` hardening (SetNull → Restrict), justified in §4.3.

---

## 3. Step 2.3 — Lifecycle / Visibility State Machine

**Problem (R4):** today two uncoupled flags decide visibility — public read requires `status=ACTIVE` **and** `isActive=true` (`products.service.ts:160-192,355-358`). They can drift. The current enum is `DRAFT/ACTIVE/ARCHIVED` (`schema.prisma:29-33`), with no `HIDDEN`.

### 3.1 Target single contract

Add `HIDDEN` to `ProductStatus`. **`status` becomes the single source of truth** for product visibility; `isActive` is retained physically only for the compat window (G3) and stops being a read input once all readers migrate (Phase 4.5).

| State | Store-visible? | Recommendation-eligible? | Meaning |
|---|---|---|---|
| `DRAFT` | No | No | Being authored |
| `ACTIVE` | Yes (if ≥1 active reference) | Yes (if has suitability) | Listed on catalog + PDP |
| `HIDDEN` | No | No | Intentionally unlisted, not retired (resolves the missing state) |
| `ARCHIVED` | No | No | Retired; retained for order/pack/rec history; never hard-deleted |

### 3.2 Transition map

```
        create
          │
          ▼
       DRAFT ──publish (≥1 active ref)──► ACTIVE ──hide──► HIDDEN
          ▲                                 │  ▲             │
          │                                 │  └──unhide─────┘
          └────────unpublish (to DRAFT)─────┘
                                            │
        ACTIVE / HIDDEN / DRAFT ──archive──► ARCHIVED
                                            │
                       ARCHIVED ──restore──► DRAFT  (re-enters authoring, never directly to ACTIVE)
```

**Guards:**
- `→ ACTIVE` requires ≥1 reference with `isActive=true` (reference-level flag stays — references keep their own active toggle, `schema.prisma:356`).
- `→ ARCHIVED` cascades reference deactivation in one transaction (preserves today's `adminArchive` behaviour, `products.service.ts:330-353`).
- `ARCHIVED → DRAFT` only (no silent re-publish); re-publishing re-runs the `→ ACTIVE` guard.
- **Out-of-stock ≠ a state.** A product with all references out of stock **stays `ACTIVE`** and renders "Sold out" with disabled CTA (Phase 1 Q6). Availability is derived (§1.5), never a status.

### 3.3 Reference-level visibility

A `ProductReference` has its own `isActive` + stock. Derived availability = `isActive && stockQuantity > reservedQuantity` (the unified predicate, `recommendation-engine.service.ts:426-430`; fixes D4 divergence in Phase 7). A reference may be inactive/out-of-stock while its parent stays `ACTIVE`.

**Exit criterion:** every visibility decision traces to exactly one field (`Product.status`), with reference availability as an independent derived layer. No reader consults `isActive` after the compat window closes.

---

## 4. Step 2.4 — Deletion / Archive Rules

**Policy (Phase 1 Q9):** archive is mandatory; hard delete stays structurally blocked. Every `Restrict` path must have a documented archive path so admins are never stuck.

### 4.1 The lock map → archive path (every Restrict relation)

| Locked relation | onDelete | Archive path (what admin does instead of delete) |
|---|---|---|
| OrderItem → Product / Reference | Restrict | Set `Product.status=ARCHIVED` (cascades ref deactivation); order history reads via FK + snapshots |
| PackItem → Product | Restrict | Archive product → pack build/validation flags the pack; admin swaps the line |
| **PackItem → Reference** | **Restrict (new)** | Deactivate reference (`isActive=false`); a referenced FIXED ref can't be deleted out from under a pack (see §4.3) |
| RecommendationResultItem → Product / Reference | Restrict | Archive product/deactivate reference; historical rec results retain the FK |
| Category → Product | Restrict | Reassign products before removing a category |

### 4.2 Archive semantics

- **Product archive** = `status=ARCHIVED` + cascade `isActive=false` on its references, in one transaction (existing behaviour, kept).
- **Reference "removal"** = `isActive=false` (soft), never a row delete. There is no public/admin endpoint that hard-deletes a `ProductReference` (Phase 0 §2.1 confirms no path hard-deletes).
- Archived/inactive entities remain fully resolvable in past orders, packs, and rec results (Phase 7.5/7.6 regression).

### 4.3 The one relational hardening — `PackItem.productReferenceId`: SetNull → Restrict

**Why (R13, Phase 0 §2.4 / §3.2):** today `onDelete: SetNull` (`schema.prisma:450`) means deleting a reference silently nulls a `FIXED_REFERENCE` pack line, breaking the bundle with no error. Under archive-over-delete, references are never row-deleted anyway — so `Restrict` is the correct, safer rule: it makes any attempted hard delete of a referenced reference fail loudly instead of silently corrupting a pack.

- **Migration class:** compat / behavioural (no data loss; tightening). Pre-check: assert no `PackItem.productReferenceId` currently dangling before applying (Phase 3.6 FK-safety).
- **No effect on archive flows** (archive sets `isActive=false`, never deletes).

**Exit criterion:** every `Restrict` path has a written archive path; no accidental hard-delete route exists; the one SetNull that could silently break a bundle is closed.

---

## 5. Step 2.5 — Unique Constraints & Indexes

### 5.1 Keep (already correct)

- `Product.slug @unique` (`:315`); `ProductReference.sku @unique`, `barcode @unique` (`:347-348`); `@@unique([productId, referenceCode])` (`:368`).
- Existing indexes: `Product` on `categoryId/brandId/status/isActive` (`:335-338`); `ProductReference` on `productId/isActive/stockQuantity` (`:369-371`).

### 5.2 Add

| Target | Constraint / index | Reason |
|---|---|---|
| `Product.productType` | `@@index([productType])` | Filterable browse (Phase 5.4) |
| `Product` | composite `@@index([status, categoryId])` | Public catalog list filters on visible-by-category (`products.service.ts` `publicProductWhere`) |
| `ProductReference.variationType` | `@@index([variationType])` | Storefront swatch/size grouping |
| `ProductAttribute` | `@@unique([productId, attributeGroupId, attributeOptionId])` + indexes on `productId`, `attributeGroupId`, `attributeOptionId`, `matchType` | Mirror `ProductReferenceAttribute` (`:389-393`) |
| `OrderItem.skuSnapshot` | none | snapshot, not queried |

### 5.3 Uniqueness decisions (deliberate non-uniques)

- `shadeCode`, `shadeName`, `swatchHex`, `measurement`: **not unique** (a shade code like `N20` recurs across products). If per-product shade-code uniqueness is wanted later, add `@@unique([productId, shadeCode])` — reserved, not built for MVP.
- `productType`: free `VarChar` with service allowed-set validation (no DB uniqueness/enum) — keeps "required-by-type" config-driven.

### 5.4 Search

Catalog search stays `contains`/ILIKE over name/slug/description/category/brand (`products.service.ts:376-419`) for MVP. **Full-text / pg_trgm GIN index is reserved** (Phase 1 deferred; owned by Phase 5.6/9.7). Documented here so the index plan is explicit, not accidental.

**Friendly-conflict requirement (R6):** uniqueness races on `sku`/`barcode`/`referenceCode`/`slug` must surface as `ConflictException`, not raw `P2002` — a Phase 4.3/4.4 service concern, noted here as a contract guarantee.

---

## 6. Step 2.6 — Admin & Storefront API Response Concepts

Two projections over the same normalized data. Shapes are conceptual (final DTOs in Phase 4.10 / 8.4); the point is to lock *what each audience sees* before code.

### 6.1 Public catalog list item (`GET /products`)

```
{ id, name, slug, productType?, brand:{name,slug?}, category:{name,slug?},
  coverImageUrl (D, from role=COVER), basePrice, compareAtPrice?,
  onSale (D), percentageSaving (D),
  priceFrom (D, min effective ref price), inStock (D, any ref available),
  badges:{ lowStock? (D) } }
```

### 6.2 Public PDP (`GET /products/slug/:slug`, `GET /products/:id`)

Assembled per request (conception §9), never a flattened table:

```
Product master      → name, slug, productType, description, ingredients?, directions?, shortDescription?, brand{name,slug?}, category{name,slug?}, meta{title?,description?}
Media               → coverImageUrl + gallery[] (role-ordered), each ref swatch
References[]        → { id, shadeName?, shadeCode?, swatchHex?, measurement?, variationType?,
                        effectiveUnitPrice (D), compareAtPrice? (inherited), onSale (D),
                        availability: { inStock (D bool), lowStock? (D) },  swatchImageUrl }
Suitability         → curated facets: general (product-level: skin type/concern/finish) + shade (reference-level: tone/undertone) — labels only
AddToCart           → per-reference inStock; maxPerCustomer reserved
```

### 6.3 Admin list / detail (`GET /admin/products...`)

Superset: everything public **plus** `status`, `isActive`, `costPrice`, per-reference `sku`, `barcode`, `stockQuantity`, `reservedQuantity`, `lowStockThreshold`, raw suitability (`scoreValue`, `isHardFilter`, `matchType`), `packUsageCount`, timestamps. Matches today's `adminFindAll/adminFindOne` superset (`products.service.ts:194-243`), extended with the new fields.

**Exit criterion:** admin and public projections are defined as distinct, named shapes; the public shape is a strict subset of admin minus the §7 hidden set.

---

## 7. Step 2.7 — Public vs Admin-Only Field Visibility Matrix

Locks Phase 1 Q12 and closes R9 (today the public projection over-exposes exact stock + raw scoring + `status`, `products.service.ts:33,80-104`).

| Field | Public | Admin | Rule |
|---|---|---|---|
| `name, slug, productType, description, ingredients, directions, shortDescription` | ✅ | ✅ | content |
| `brand.name/slug, category.name/slug` | ✅ | ✅ | |
| `basePrice, compareAtPrice`, derived `onSale/% saving` | ✅ | ✅ | |
| `costPrice` | ❌ | ✅ | margin — admin only |
| `Product.status` | ❌ | ✅ | visibility resolved server-side; not leaked |
| `Product.isActive` | ❌ | ✅ | internal compat flag |
| `metaTitle/metaDescription` | ✅ (in `<head>`) | ✅ | |
| Reference `shadeName/shadeCode/swatchHex/measurement/variationType` | ✅ | ✅ | merch |
| Reference `sku` | ❌ | ✅ | |
| Reference `barcode` | ❌ | ✅ | |
| Reference **exact `stockQuantity`** | ❌ | ✅ | **hidden — boolean + low-stock badge only** |
| Reference `reservedQuantity` | ❌ | ✅ | internal |
| Reference `lowStockThreshold` | ❌ | ✅ | internal (badge is derived from it server-side) |
| Derived `inStock` (bool), `lowStock` (badge) | ✅ | ✅ | the **only** stock signal public sees |
| Suitability `scoreValue`, `isHardFilter`, `matchType` | ❌ | ✅ | raw scoring hidden |
| Suitability curated labels (group label + matched option labels) | ✅ | ✅ | curated subset only |
| `priceOverride / priceDelta` | ❌ (only resolved `effectiveUnitPrice`) | ✅ | pricing mechanics hidden |
| timestamps, `packUsageCount` | ❌ | ✅ | |

**Change from today:** drop `status` and exact `stockQuantity` from the public projection; replace with derived `inStock` + `lowStock`; strip raw suitability scoring to curated labels. This is an **additive-then-narrowing** public-shape change — sequenced via handoff (R15, Phase 8).

**Exit criterion:** `costPrice`, `barcode`, `reservedQuantity`, `lowStockThreshold`, exact `stockQuantity`, and raw scoring are all admin-only; the stock-exposure decision (boolean + badge) is locked.

---

## 8. Step 2.8 — Migration & Compatibility Strategy (expand → contract)

Every change classified **Additive** (safe, nullable/new), **Compat** (dual-window, reversible), or **Destructive** (none in this design). Detailed migration ordering, backfill, and rollback are Phase 3 (Checkpoint #3); this is the classification + sequencing intent.

### 8.1 Change classification

| # | Change | Class | Strategy |
|---|---|---|---|
| C1 | Product: `productType, shortDescription, ingredients, directions, compareAtPrice, metaTitle, metaDescription` | **Additive** | New nullable columns; no backfill required |
| C2 | ProductReference: `shadeName, shadeCode, swatchHex, measurement, variationType?` | **Additive** | New nullable columns; optional backfill `referenceName → shadeName` (Phase 3.3) |
| C3 | New `ProductAttribute` table + relations | **Additive** | New table; Cascade from Product; no existing-row impact |
| C4 | `ProductStatus` += `HIDDEN` | **Additive** | Enum value addition (Postgres `ADD VALUE`) — forward-only, safe |
| C5 | OrderItem: `skuSnapshot, variationSnapshot, productImageUrlSnapshot, brandNameSnapshot` | **Additive** | New nullable columns; backfill from current product/reference for existing rows (Phase 3.3) |
| C6 | New indexes (§5.2) | **Additive** | Online/concurrent index creation |
| C7 | `PackItem.productReferenceId` SetNull → **Restrict** | **Compat** | Pre-assert no dangling refs; tighten FK; fully reversible to SetNull |
| C8 | Visibility: `status` becomes sole source of truth; `isActive` retained then read-retired | **Compat** | G3 window: keep both columns; migrate readers to `status`; stop reading `isActive`; drop only after all consumers migrate (post-MVP) |
| C9 | Retire scalar `mainImageUrl` / reference `imageUrl` in favour of media join | **Compat** | Keep columns; switch reads to `role=COVER`/swatch join; deprecate, drop later (Phase 5.1) |
| C10 | Public projection narrowing (drop `status`/exact stock/raw scoring) | **Compat (API)** | Additive new derived fields first; remove old fields after FE migrates (R15, Phase 8.6) |
| — | Stock decrement / reservation, snapshot **writing** | **Behavioural (gated)** | Not a Phase 2 schema item; feature-gated in Phase 7, Checkpoint #4 |

**No Destructive changes.** Every column add is nullable; every removal is deferred behind a compat window; no `NOT NULL` tightening, type narrowing, or data-dropping migration is proposed for MVP. "Required-by-type" (ingredients/directions/tone/undertone) is **validation policy, not DB `NOT NULL`** (Phase 1 Q10/Q11) — so it never becomes a destructive constraint.

### 8.2 Expand → migrate → contract per risky change

- **Visibility (C8):** expand (add `HIDDEN`, keep `isActive`) → migrate (readers switch to `status`; backfill any `status/isActive` mismatch to `status`) → contract (retire `isActive` reads, then column) — post-MVP.
- **Order snapshot (C5):** expand (nullable columns) → backfill existing orders → Phase 7 writes them on both order paths → never retro-mutate historical rows.
- **PackItem FK (C7):** expand (validate clean) → migrate (Restrict) → no contract needed.
- **Image source (C9):** expand (join already exists) → migrate reads → contract scalar columns (Phase 5).

### 8.3 Reversibility

Every Phase 2-designed change is reversible: additive columns/tables are safe to leave or drop; C7 reverts to SetNull; C4 enum value is inert if unused; C8/C9/C10 keep legacy columns/fields through their window. This satisfies the per-phase rollback table (Phase 0 §5.3) and feeds the Phase 3.5 rollback playbook.

**Exit criterion:** every change is tagged Additive/Compat/Destructive; zero Destructive; each risky change has an explicit expand→contract path and a revert.

---

## 9. Checkpoint #2 — Exit Criteria & Sign-off Request

**Phase 2 exit criteria (Master Plan) — met by this document:**

| Step | Deliverable | Where | Met |
|---|---|---|---|
| 2.1 | Responsibility spec; no field owned by two models | §1 | ✅ |
| 2.2 | Cardinality table; each relation required/optional + onDelete | §2 | ✅ |
| 2.3 | DRAFT/ACTIVE/HIDDEN/ARCHIVED state machine + visibility rules | §3 | ✅ |
| 2.4 | Delete/archive policy; every `Restrict` path has an archive path | §4 | ✅ |
| 2.5 | Unique + index plan; search-index path identified | §5 | ✅ |
| 2.6 | Admin vs public response concepts | §6 | ✅ |
| 2.7 | Public-vs-admin field-visibility matrix; stock exposure decided | §7 | ✅ |
| 2.8 | Expand/contract strategy; every change classified | §8 | ✅ |

**Decisions LOCKED (owner delegated — "best for now and the future").** Each is chosen to ship cleanly at MVP *and* keep the cheapest upgrade path open. Rationale weighs additive-first safety (G1) and reversibility against a catalog that will grow.

| # | Decision | Locked choice | Why it's best now **and** future |
|---|---|---|---|
| 1 | `variationType` modelling | **DB enum** `SHADE/SIZE/BUNDLE` (nullable) | Closed, render-driving set → type safety now; a 4th axis is an additive `ADD VALUE`, and the nullable column means a second axis (multi-variant) bolts on later with no breaking migration (Phase 1 Q1) |
| 1b | `productType` modelling | **Validated stable-code string** (not enum, not a table yet) | Beauty catalogs add types constantly — a string lets you add `face-serum`, `mascara`… via config with **zero migration**; storing a kebab **code** (not display text) prevents drift and makes the later promotion to a `ProductType` lookup table a clean backfill. Building the table now is speculative (YAGNI) — the field gives identical storefront behaviour |
| 2 | Product-level suitability | **New `ProductAttribute` table**, gated in-service by `isProductAttribute` | Reuses the existing `AttributeGroup`/`AttributeOption` + the already-present-but-unused flag (`schema.prisma:144`); service-gating (not a DB constraint) keeps the product/reference split reconfigurable as merchandising learns what's general vs shade-specific |
| 3 | `PackItem.productReferenceId` | **SetNull → Restrict** | Under archive-over-delete a reference is never row-deleted, so Restrict costs nothing now and **closes R13** — the silent FIXED-pack corruption. Fully reversible to SetNull if ever needed |
| 4 | Public stock exposure | **Boolean `inStock` + low-stock badge only**; `status` dropped from public projection | Hides competitive/inventory signal and lets you retune `lowStockThreshold` server-side forever without touching the public contract; closes the R9 leak. Matches owner's confirmed Phase 1 Q12 |
| 5 | Migration risk posture | **Zero Destructive migrations**; required-by-type = validation, never DB `NOT NULL` | Every change stays additive/reversible, so existing rows and makeup products never break; "required for skincare" can tighten or relax as a config policy without a migration (Phase 1 Q10/Q11) |

**Reserved upgrade paths (documented, not built):** `productType` → lookup table; `variationType` → second axis / multi-variant junction; reference-level `compareAtPrice`; per-product `@@unique([productId, shadeCode])`; FTS/`pg_trgm` search index. Each is additive from the chosen MVP shape.

**Remaining human gate:** these are *technical* choices the owner delegated; the *business* decisions were already signed at Checkpoint #1. The only thing left for the owner at Checkpoint #2 is a final "accept the package" before Phase 3 — there are no open questions blocking it.

**On approval →** Phase 3 (Database & Prisma Migration Design, steps 3.1–3.7): translate §1 fields into annotated Prisma model changes, sequence the additive→backfill→constrain migrations, write backfill + validation + rollback plans, and the FK-safety checklist — ending at **Checkpoint #3** before any migration file is written.

> Carried open item: the **stock-decrement timing** (Q7) remains locked-for-design as "at order create" and is reaffirmed at **Checkpoint #4** before Phase 7 deploy — unchanged by this phase, which adds no behavioural change.
