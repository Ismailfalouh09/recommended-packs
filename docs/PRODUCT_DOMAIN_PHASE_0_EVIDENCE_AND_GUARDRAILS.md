# Product Domain Redesign — Phase 0: Evidence Review & Guardrails

> Documentation-only deliverable. No source code, Prisma schema, migration, DTO, endpoint, seed, or configuration was modified while producing it.
> Executes Phase 0 of `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md` (steps 0.1–0.5).
> Every claim below was re-verified against live code at HEAD `8676e2c` ("Befaure Product Object Update"); evidence is cited as `path:line`.
> Companion inputs: `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md`, `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md`, `prisma/schema.prisma`, `frontend-handoff/*`.

---

## 0. Phase 0 Exit Status

| Step | Deliverable | Status |
|---|---|---|
| 0.1 | Validated/annotated current-state analysis (deltas logged) | ✅ Complete — §1 |
| 0.2 | Verified Product/ProductReference consumer map | ✅ Complete — §2 |
| 0.3 | Backward-compatibility risk register | ✅ Complete — §3 |
| 0.4 | Frozen-assumption list (= conception §12) | ✅ Complete — §4 |
| 0.5 | Baseline / checkpoint / rollback strategy | ✅ Complete — §5 |

**Headline finding:** `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` is **accurate** against live code — every schema field, relation, `onDelete` rule, and the four critical behaviours (no stock decrement, thin snapshot, dual visibility flags, TOCTOU) were re-confirmed. The only material drift is in the **`frontend-handoff/*` docs**, which are stale (they list already-shipped public endpoints as "not implemented"). No code or schema change is needed to begin Phase 1; the design rests on a verified foundation.

---

## 1. Step 0.1 — Current-State Analysis Validation

### 1.1 Confirmed Accurate (spot-checked against code)

| Analysis claim | Verified against | Result |
|---|---|---|
| `Product` is a thin header; all suitability/stock/SKU live on `ProductReference` | `prisma/schema.prisma:310-373` | ✅ Exact |
| Dual lifecycle flags; public read requires `status=ACTIVE` **and** `isActive=true` | `products.service.ts:160-192,355-358` | ✅ Exact |
| Stock **never decremented** on order; both paths only read to validate | `orders.service.ts:80-157` (`create`), `168-243` (`createFromCart`) | ✅ Exact — no `update`/`updateMany` on stock in either tx |
| `OrderItem` snapshot = name + refName + unitPrice only (no image/SKU/brand) | `prisma/schema.prisma:663-686`; written at `orders.service.ts:124-136,215-227` | ✅ Exact |
| Engine scores **references**, not products; `Product` has no attribute relation | `recommendation-engine.service.ts:339-406`; `schema.prisma:310-340` (no attr relation) | ✅ Exact |
| `isReferenceAvailable = isActive && stockQuantity > reservedQuantity` | `recommendation-engine.service.ts:426-430` | ✅ Exact |
| Price resolution = `priceOverride` else `basePrice + priceDelta` | `orders.service.ts:821-833` | ✅ Exact |
| Slug/SKU/barcode uniqueness via service read-then-write (race → raw P2002) | `products.service.ts:750-759`; `product-references.service.ts:525-556` | ✅ Exact |
| No hard delete; archive sets `status=ARCHIVED`+`isActive=false`, cascades ref deactivation in a tx | `products.service.ts:330-353` | ✅ Exact |
| Strict global pipe: `whitelist + forbidNonWhitelisted + transform` | `main.ts:30-36` | ✅ Exact |
| Public projection hides `costPrice`, ref `sku/barcode/reservedQuantity/lowStockThreshold`; exposes ref `stockQuantity` + full `attributes` | `products.service.ts:27-120` | ✅ Exact |
| No `costPrice ≤ basePrice` and no currency-allowed-set validation | `create-product.dto.ts:50-66` | ✅ Exact |
| Catalog search is `contains`/ILIKE over name/slug/description/category/brand, no FTS index | `products.service.ts:376-419`; `schema.prisma:335-339` | ✅ Exact |
| 4 migrations; Product shape unchanged since `init` | `prisma/migrations/*` (init, add_media_assets, add_media_management, order_selected_pack_optional) | ✅ Exact |

**Conclusion:** the analysis may be relied upon as the design baseline for Phases 1–2.

### 1.2 Deltas Logged (corrections / refinements to record before Phase 1)

- **D1 — `frontend-handoff/KNOWN_LIMITATIONS.md` is stale (HIGH priority to fix).** It lists under "Not Implemented" several capabilities that are **now shipped** (Tasks 4, 6, 7, 8):
  - *"Customer cart API" / "Direct regular-store checkout"* → shipped: `POST /orders/checkout` (`orders.controller.ts:27-72`, `orders.service.ts:168`).
  - *"Public category and brand listing endpoints"* → public brands shipped (Task 7, commit `0eac700`).
  - *"Public product/pack search, filters, pagination, sorting, or slug lookup"* → shipped for products: `GET /products` with search/filter/sort/pagination (`products.controller.ts:19-49`) and `GET /products/slug/:slug` (`products.controller.ts:51-66`).
  - Still genuinely not implemented: stock reservation/decrement, customer-selected reference override at recommendation checkout, brand-logo media-join endpoint. The analysis §5/§10 already flagged this doc as "partly stale"; this itemizes it.
- **D2 — `frontend-handoff/CUSTOMER_PAGE_ENDPOINT_MAPPING.md` is stale.** It states product listing has "no pagination, search, filters… or sort", "Public slug lookup does not exist yet", "Regular Store Checkout — No current public endpoint", and "Category Or Brand Pages — No current public endpoint." All but category pages are now contradicted by live routes (above). Must be reconciled in Phase 8.6.
- **D3 — Public cart-checkout endpoint not enumerated in analysis §4.3.** The analysis lists only the three public `GET /products*` routes. The live public surface also includes `POST /orders/checkout` (cart) and `POST /orders` (recommendation funnel), path `/orders/checkout` — not `/orders` — for the cart path (`orders.controller.ts:27`). Recorded here for the consumer map (§2).
- **D4 — Stock-validation logic differs between the two order paths (refines §8 Critical/High).** Neither writes stock, but the *read* checks are not identical:
  - Recommendation path validates `stockQuantity <= reservedQuantity` **only for `isRequired` items**, ignoring requested quantity (`orders.service.ts:556-564`).
  - Cart path validates `reference.stockQuantity < requestedQuantity` (aggregated per reference) but **ignores `reservedQuantity`** (`orders.service.ts:676-683`).
  - Implication for Phase 7: the decrement fix must also **unify** the availability predicate (ideally `available = stock - reserved`) across both paths.
- **D5 — Public response still exposes `status` and exact `stockQuantity`.** `productSelect` returns `status` (`products.service.ts:33`) and per-reference `stockQuantity` (`:80`). Harmless but confirms the §10 Q3/Q12 exposure decision is still open.

No delta invalidates any conclusion in the current-state analysis or target conception.

---

## 2. Step 0.2 — Verified Product / ProductReference Consumer Map

Every backend reader/writer of `Product` / `ProductReference`, cross-checked against `prisma/schema.prisma` relations.

### 2.1 Writers

| Module | Operation | Target | Evidence |
|---|---|---|---|
| products | `adminCreate` / `adminUpdate` | Product | `products.service.ts:245-328` |
| products | `adminArchive` (status+isActive, cascade-deactivate refs) | Product + ProductReference | `products.service.ts:330-353` |
| product-references | `create` / `update` / `updateStock` / `deactivate` | ProductReference (+ its attributes) | `product-references.service.ts:106-312` |
| orders | `orderItem.createMany` (snapshot rows referencing productId/productReferenceId) | OrderItem (FK to Product/Reference) | `orders.service.ts:124-136,215-227` |
| recommendations | `recommendationResultItem` rows hold productId + selectedProductReferenceId | RecommendationResultItem (FK) | `schema.prisma:555-576` |
| packs | `packItem` rows hold productId + optional productReferenceId | PackItem (FK) | `schema.prisma:436-459` |
| media | product / reference image join rows keyed by productId / referenceId | ProductImage / ProductReferenceImage | `media/controllers/product-media.controller.ts`, `media/media.service.ts` |

> No path hard-deletes a `Product` or `ProductReference`. `adminArchive` is the only "removal," and it is a soft update.

### 2.2 Readers

| Module | Read purpose | Reads | Evidence |
|---|---|---|---|
| products (public) | `findAll/findOne/findBySlug` storefront projection | Product + active refs + attrs + media | `products.service.ts:122-192` |
| products (admin) | `adminFindAll/adminFindOne` (cost, sku, reserved, stock summaries, packUsageCount) | Product + all refs | `products.service.ts:194-243` |
| product-references | `ensureProductExists`, `validateProductCanReceiveReference` (reads product status/isActive) | Product | `product-references.service.ts:458-490` |
| orders (cart) | `calculateCartOrderPrice` — per-item product then reference lookup (price/active/stock) | Product + ProductReference | `orders.service.ts:621-702` |
| orders (rec) | `loadRecommendationResult` / `validateRecommendationResult` (product + selectedProductReference status/stock) | Product + ProductReference | `orders.service.ts:458-565` |
| recommendations (engine) | `selectReference` / `scoreReference` / `isReferenceAvailable` | ProductReference (+ product active/status) | `recommendation-engine.service.ts:294-430` |
| recommendations (service) | loads candidate packs → products → references for scoring | Product + ProductReference | `recommendations.service.ts` (pack candidate load) |
| packs | validates packItem product/reference membership; admin pack detail | Product + ProductReference | `packs.service.ts` |
| media | resolves swatch/cover URLs onto reference/product responses | via join tables | `media/media.service.ts` |

### 2.3 Endpoint Surface Touching Product / ProductReference

**Public (unguarded):**
- `GET /products`, `GET /products/slug/:slug`, `GET /products/:id` (`products.controller.ts`)
- `POST /orders/checkout` (cart → reads product+reference), `POST /orders` (rec funnel), `GET /orders/:id` (`orders.controller.ts`)
- Public brands listing (Task 7) and pack list/detail (read product/reference indirectly)

**Admin (`JwtAuthGuard + RolesGuard`):** all under `frontend-handoff/PAGE_ENDPOINT_MAPPING.md` — Products (5 + 4 image routes), Product References (6 + 2 image routes), Packs, Orders, Recommendation Rules preview. Write/archive = OWNER/ADMIN; read = OWNER/ADMIN/STAFF (`ROLE_PERMISSION_MATRIX.md`, confirmed by guards on `admin-products.controller.ts`).

### 2.4 Schema-Level (Relational) Consumers — the lock map

| Relation | Field | onDelete | Effect on Product/Reference |
|---|---|---|---|
| OrderItem → Product | `productId` | **Restrict** | Product with any order line **cannot** be hard-deleted |
| OrderItem → ProductReference | `productReferenceId` | **Restrict** | Reference with any order line **cannot** be hard-deleted |
| PackItem → Product | `productId` | **Restrict** | Product in any pack **cannot** be hard-deleted |
| PackItem → ProductReference | `productReferenceId` | SetNull | Deleting a reference nulls the fixed pack ref (silently breaks FIXED_REFERENCE) |
| RecommendationResultItem → Product | `productId` | **Restrict** | Product in any rec result **cannot** be hard-deleted |
| RecommendationResultItem → ProductReference | `selectedProductReferenceId` | **Restrict** | Selected reference **cannot** be hard-deleted |
| Product → ProductReference | child | Cascade (on Product delete) | Unreachable while any Restrict above holds |
| Product → Category | `categoryId` (required) | Restrict | Category in use cannot be deleted |
| Product → Brand | `brandId` (optional) | SetNull | Brand delete nulls product brand |

*Source: `prisma/schema.prisma:326-327,360,448-450,449,567-569,676-679`.*

---

## 3. Step 0.3 — Backward-Compatibility Risk Register

Each item lists what must **not** break and the phase that owns the mitigation.

### 3.1 Behavioural / data-integrity risks (from verified §8 + this review)

| ID | Severity | Risk (must not break) | Evidence | Owning phase |
|---|---|---|---|---|
| R1 | **Critical** | Order placement never decrements stock / writes `reservedQuantity` → overselling | `orders.service.ts:80-243` (no stock write) | 7.4 |
| R2 | **High** | Stock check is read-then-write, no row lock / conditional decrement → TOCTOU even after fix | `orders.service.ts:556-564,676-683` | 7.4 |
| R3 | **High** | `OrderItem` snapshot omits image/SKU/brand → past orders degrade on edit/archive | `schema.prisma:663-686` | 7.1–7.3 |
| R4 | Medium | Dual visibility flags (`status`+`isActive`) can drift; no DB coupling | `schema.prisma:321-322`; `products.service.ts:355-358` | 2.3, 4.5 (compat window) |
| R5 | Medium | Two parallel image systems (scalar `mainImageUrl`/`imageUrl` vs join tables) | `schema.prisma:320,351`; cover from join `products.service.ts:657-660` | 5.1 |
| R6 | Medium | Uniqueness race surfaces as raw `P2002` not `ConflictException` | `products.service.ts:750-759`; `product-references.service.ts:525-556` | 4.3, 4.4 |
| R7 | Medium | Search ILIKE scans degrade as catalog grows | `products.service.ts:376-419` | 5.6, 9.7 |
| R8 | Medium | Divergent stock-availability predicate across the two order paths (D4) | `orders.service.ts:556-564` vs `676-683` | 7.4 |
| R9 | Low | Public exposes exact `stockQuantity` + full suitability attributes + `status` | `products.service.ts:33,80-104` | 2.7 (business decision) |
| R10 | Low | No `costPrice ≤ basePrice` / currency-allowed-set guard | `create-product.dto.ts:50-66` | 4.6 |
| R11 | Low | Reference has no `currency`; single-currency enforced only at cart runtime | `schema.prisma:342-373`; `orders.service.ts:685-688` | deferred (conception §13) |

### 3.2 Contract-break risks (consumers that a migration/edit must preserve)

| ID | Severity | Contract that must not break | Mitigation phase |
|---|---|---|---|
| R12 | **High** | Any migration violating a `Restrict` relation (orders/packs/recs — §2.4) | 3.6 FK-safety checklist; 9.1 rehearsal |
| R13 | High | `PackItem.productReferenceId` SetNull silently disabling FIXED_REFERENCE packs on ref delete | 2.4 archive-over-delete; 6.2 |
| R14 | Medium | Strict pipe rejects any new DTO field not deliberately whitelisted | 4.8 deliberate whitelisting |
| R15 | Medium | Public response shape consumed by storefront (additive-only changes) | 8 additive-first + handoff |
| R16 | Medium | Stale `frontend-handoff/*` docs (D1, D2) misleading FE integration | 8.6 reconcile handoff |
| R17 | Low | `ProductResponse` Swagger type doesn't capture public vs admin divergence | 4.10 |

---

## 4. Step 0.4 — Frozen Assumptions (Blocking Business Decisions)

These **12 decisions** (verbatim scope from `PRODUCT_DOMAIN_TARGET_CONCEPTION.md` §12) are frozen as **blocking**: no Phase 2 schema work may proceed until Phase 1 signs them off (Master Plan checkpoint #1). None can be settled from code or the Beauty Bay reference.

1. Can one Product have both **shade and size** variants (multi-axis)?
2. Is one `ProductReference` always exactly **one SKU**?
3. Should reference prices always **override** product price, or stay **delta-based** with override-when-needed?
4. Can a pack contain a **fixed** `ProductReference`? (Confirm `FIXED_REFERENCE` stays MVP.)
5. Can a pack **dynamically** choose a compatible reference from quiz answers (`AUTO_BEST_REFERENCE`)? Is customer-choice override MVP or later?
6. How should products with **all references out of stock** behave (hidden / "sold out" / disabled CTA + back-in-stock)?
7. Is stock **manually managed** in MVP (no supplier integration), with decrement-on-order?
8. Do we need a simple **sale price** now (`compareAtPrice`/`onSale`) or are pack discounts enough?
9. Is deleting a Product ever allowed, or is **archiving mandatory**? (Code already blocks hard delete via `Restrict`.)
10. Are **ingredients/directions** required for every product category?
11. Which **beauty attributes are mandatory by product type** (e.g. foundation = tone+undertone; serum = skin type+concern)?
12. Which fields are **public vs admin-only** — expose exact `stockQuantity` or a boolean/low-stock badge; full suitability or curated subset? (Ties to R9.)

> Cross-reference: each decision maps to a Phase 1 step (1.1–1.5) and gates the Phase 2 model design. Decisions 2, 7, 9 are **already constrained by code** (global-unique `sku`; manual stock via `updateStock`; `Restrict`-blocked hard delete) — Phase 1 should confirm rather than re-open them.

---

## 5. Step 0.5 — Safe Baseline & Checkpoint Strategy

### 5.1 Baseline established

- **Working branch:** `feature/task-14-media-management` (current).
- **Pre-redesign baseline commit:** `8676e2c` — *"Befaure Product Object Update"* already exists as the checkpoint immediately before this redesign. **Action: tag it** (no tags currently exist in the repo) so it is a named, durable revert point:
  ```
  git tag -a baseline/product-domain-redesign 8676e2c -m "Baseline before Product domain redesign (Phase 0)"
  ```
- **Recommend** a dedicated branch per phase off this baseline (e.g. `redesign/phase-4-core-product`) so each phase is independently reviewable and revertible (Master Plan §3.6).

### 5.2 Database snapshot & migration checkpoint plan

- **Migration tooling present:** `prisma:migrate`, `prisma:validate`, `prisma:generate`, `prisma:seed` (package.json). Provider: PostgreSQL (`schema.prisma:5-7`). 4 migrations applied; Product shape unchanged since `init`.
- **Before each migration-bearing phase (3+):**
  1. Capture a logical snapshot: `pg_dump` of the target DB to a timestamped file (prod-like data for Phase 9 rehearsal).
  2. Record `prisma migrate status` and the latest applied migration name as the checkpoint marker.
  3. Apply migrations **additive-first** (new nullable columns / new tables), backfill, then constrain — never a hard cutover (Master Plan §3, §7).
- **Per-migration reversibility:** every migration step in Phase 3 must ship a documented down-path or compensating script (Master Plan 3.5). Prisma migrations are forward-only by default, so the rollback playbook = restore from the pre-phase `pg_dump` **or** a hand-written compensating migration.

### 5.3 Rollback per phase

| Phase | Change type | Revert mechanism |
|---|---|---|
| 0–2 (design) | Docs only | `git revert` / discard doc commits; no DB impact |
| 3 (migration design) | Plans only | Docs revert |
| 4 (core impl) | Code + additive migration(s) | Branch revert + `pg_dump` restore; additive columns left nullable are safe to leave |
| 5 (media/attributes) | Additive | Branch revert; new join/attr rows orphan-safe |
| 6 (packs/engine) | Code only (no schema if priorities deferred) | Branch revert |
| 7 (stock/snapshot) | **Behavioural + schema** (decrement, snapshot cols) | Feature-gate decrement; new snapshot cols nullable + backfilled → revert = disable gate + branch revert; **checkpoint approval required (Master Plan checkpoint #4)** |
| 8 (contracts/handoff) | Additive API + docs | Branch revert; additive response fields safe |
| 9 (release) | Release wiring | Runbook go/no-go + `pg_dump` restore |

### 5.4 Guardrails carried into Phase 1+

- **G1 — Additive-first.** New columns nullable; backfill; constrain later (R3, R4).
- **G2 — Never violate a `Restrict` relation** (§2.4 lock map; R12).
- **G3 — Compat window for the visibility contract** — keep `status`+`isActive` physically until all readers migrate to one source (R4).
- **G4 — Feature-gate the two behavioural fixes** (stock decrement R1/R2, snapshot enrichment R3); they are non-removable safety phases (Master Plan §3.4) and need explicit sign-off.
- **G5 — Every new DTO field deliberately whitelisted** under the strict pipe (R14).
- **G6 — Reconcile `frontend-handoff/*`** (D1, D2) before Phase 8 hand-off so FE work isn't planned against stale "not implemented" notes.

---

## 6. Recommended Next Step

Proceed to **Phase 1 — Business Decisions & Scope Lock**, beginning with step **1.1** (Product vs ProductReference decisions, conception §12 Q1–Q2). All Phase 0 exit criteria are met: the analysis is validated, consumers are mapped, risks are registered, the 12 assumptions are frozen as blocking, and a baseline + rollback strategy is defined. **Recommended immediate action:** tag baseline commit `8676e2c` (§5.1) and open the Phase 1 decision log so the 12 frozen assumptions can be signed off (Master Plan checkpoint #1) before any schema work.
