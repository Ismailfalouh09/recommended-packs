# Product Domain Redesign — Phase 1: Business Decisions & Scope Lock

> Planning-only deliverable. No source code, Prisma schema, migration, DTO, endpoint, seed, or configuration was modified while producing it.
> Executes Phase 1 of `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md` (steps 1.1–1.7).
> Builds on `docs/PRODUCT_DOMAIN_PHASE_0_EVIDENCE_AND_GUARDRAILS.md` (verified baseline) and the 12 frozen assumptions in `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md` §12.
> **This document satisfies Master Plan Checkpoint #1** (signed-off capability matrix + 12 business decisions). No Phase 2 schema work may begin until this is accepted.

---

## 0. Sign-off Record

| Field | Value |
|---|---|
| Decision-maker | ismail (business owner) |
| Date locked | 2026-06-29 |
| Method | 4 high-leverage decisions confirmed interactively (Q1, Q6, Q8, Q12); the remaining 8 locked to code-constrained / conception-recommended defaults below |
| Status | **APPROVED** — Phase 2 unblocked |
| Supersedes | Open questions in `PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` §10 and `PRODUCT_DOMAIN_TARGET_CONCEPTION.md` §12 |

---

## 1. Decision Log — The 12 Frozen Assumptions, Resolved

Steps 1.1–1.5 resolve every blocking decision. Each row: the question, the locked decision, rationale, and the owning implementation phase.

### 1.1 Product vs ProductReference (§12 Q1–Q2)

| # | Decision | Resolution | Rationale | Phase |
|---|---|---|---|---|
| **Q1** | Can one Product mix variant axes (shade × size)? | **Single-axis for MVP; reserve multi-axis.** Each product varies on ONE axis. Add a `variationType` descriptor (`SHADE` / `SIZE` / `BUNDLE`) on the reference now; design the schema so a second axis can be added later **without** a breaking migration. | Confirmed by owner. Keeps the validated `Product`→`ProductReference` 1:N backbone; avoids combinatorial SKU/admin complexity at launch; `variationType` makes storefront rendering (`showSwatch` analogue) explicit. | 4–5 |
| **Q2** | Is one `ProductReference` always exactly one SKU? | **Yes.** One reference = one sellable SKU. `sku` stays optional + globally unique. | Code-constrained: `sku` is already `@unique` and nullable (`schema.prisma:348`). No bundle-as-SKU modelling needed (bundles are Packs). | 4 |

### 1.2 Price & Stock Ownership (§12 Q3, Q6, Q7)

| # | Decision | Resolution | Rationale | Phase |
|---|---|---|---|---|
| **Q3** | Reference price: always override, or delta-based? | **Keep the dual model.** Effective price = `priceOverride` if set, else `basePrice + priceDelta`. | Code-constrained and validated (`orders.service.ts:821-833`). Delta covers the common "+10 MAD for the larger size" case; override covers exceptions. No simplification needed. | 4 |
| **Q6** | Behaviour when ALL references are out of stock? | **Stay visible; show "Sold out" with disabled add-to-cart.** Product remains listed and on the PDP; CTA disabled; product is NOT auto-hidden or archived. | Confirmed by owner. Preserves SEO/discoverability and inbound links; mirrors Beauty Bay's in/out-of-stock rendering. Visibility stays admin-controlled via the lifecycle (Q4 of §10 → state machine). | 5, 7 |
| **Q7** | Manual stock + decrement on order? | **Yes — manual admin stock; atomic guarded decrement at order creation; release on cancel/return.** No supplier integration. Decrement of **available** stock happens in the order-create transaction (COD has no separate payment-confirm step). Final decrement *timing* is reaffirmed at **Checkpoint #4** before Phase 7 deploy. | Confirmed by owner. Stock is already manual (`product-references.service.ts:273-297` `updateStock`). Fixes the Critical risk R1/R2 and unifies the divergent availability predicate (Phase 0 delta D4). | 7 |

### 1.3 Beauty Attribute Ownership (§12 Q10–Q11)

| # | Decision | Resolution | Rationale | Phase |
|---|---|---|---|---|
| **Q10** | Are ingredients/directions required per category? | **Add as nullable Product fields.** Strongly recommended for skincare, optional for makeup. Enforce "required-by-type" as an **admin/validation policy**, not a DB `NOT NULL`. | Keeps the migration additive (R3/G1). A hard DB constraint would break existing rows and makeup products. Mandatory-by-type lives in DTO/service validation, configurable later. | 4 (fields), 5 (policy) |
| **Q11** | Which attributes are mandatory by product type? | **Baseline mapping, enforced as configurable admin validation (not DB):** foundation/concealer/complexion → `SKIN_COLOR` (tone) + `UNDERTONE` required **at reference**; serum/skincare → `SKIN_TYPE` + `CONCERN` recommended **at product**. Two-tier suitability: general at Product, shade-specific at Reference. | Confirms conception §3 two-tier model. Uses the already-present-but-unused `AttributeGroup.isProductAttribute` flag (`schema.prisma:144`) for product-level groups. Exact group split is a Phase 5 config, not a schema lock. | 5–6 |

**Attribute-ownership split (locked):**

| Attribute group | Owner layer | isProductAttribute |
|---|---|---|
| Skin tone (`SKIN_COLOR`) | ProductReference (shade-specific) | false |
| Undertone (`UNDERTONE`) | ProductReference (shade-specific) | false |
| Skin type (`SKIN_TYPE`) | Product (general) | true |
| Concern (`CONCERN`) | Product (general) | true |
| Finish / Coverage / Formulation (if added) | Product (general) | true |
| Style | ProductReference (kept as today) | false |

### 1.4 Pack Reference Selection (§12 Q4–Q5)

| # | Decision | Resolution | Rationale | Phase |
|---|---|---|---|---|
| **Q4** | Can a pack contain a fixed reference? | **Yes — `FIXED_REFERENCE` stays MVP.** | Code-constrained (`SelectionMode` enum; `recommendation-engine.service.ts:299-315`). | 6 |
| **Q5** | Can a pack dynamically choose a compatible reference? Is customer-choice MVP? | **Ship `FIXED_REFERENCE` + `AUTO_BEST_REFERENCE` for MVP. Defer `CUSTOMER_CHOICE` override.** | Confirmed-recommended. Auto-best is already implemented and tested (`recommendation-engine.service.ts:317-336`). Customer-choice override at checkout is currently "not implemented" and adds funnel scope → deferred. | 6 (MVP), 6/8 (deferred) |

### 1.5 Order Snapshot Requirements (§12 Q5 of §10)

| # | Decision | Resolution | Rationale | Phase |
|---|---|---|---|---|
| **Q-Snap** | Which fields freeze at order time? | **Extend `OrderItem` snapshot to freeze: product name, SKU, shade/size descriptor (variation), unit price, product image URL, brand name** (in addition to today's name/refName/unitPrice). New columns nullable + backfilled from current product/reference. | Fixes High risk R3. Makes receipts/disputes survive later catalog edit/archive. Additive + backfilled (G1); old orders keep working via existing `Restrict` FKs. | 7.1–7.3 |

### 1.6 Confirmations (code-constrained, low-controversy)

| # | Decision | Resolution | Rationale |
|---|---|---|---|
| **Q8** | Simple sale price now? | **Yes — add optional nullable `compareAtPrice` at Product level.** Derive `onSale` and `% saving`. No promo engine. | Confirmed by owner. Cheap, additive; enables struck-through pricing on cards/PDP. |
| **Q9** | Is hard delete ever allowed? | **No — archive is mandatory.** Hard delete stays structurally blocked. | Code-constrained: six `Restrict` relations (Phase 0 §2.4) already prevent deletion of referenced products/references. |
| **Q12** | Public vs admin field exposure | **Stock:** expose **in-stock boolean + low-stock badge**, hide exact counts. **Suitability:** expose a **curated subset** (group label + matched option labels); hide internal `scoreValue` / `isHardFilter` / `matchType`. **Admin-only:** `costPrice`, `barcode`, `reservedQuantity`, `lowStockThreshold`, exact `stockQuantity`. | Confirmed by owner (stock). Closes info-leak risk R9; current public projection over-exposes exact stock + raw scoring metadata (`products.service.ts:80-104`). |

---

## 2. Step 1.6 — MVP / Deferred / Rejected Scope

### 2.1 MVP — Build now (additive + the two gated safety fixes)

**Product master**
- Keep `Product` → `ProductReference` backbone (unchanged).
- Add (nullable, additive): `productType`, `ingredients`, `directions`, `shortDescription`, `compareAtPrice`, optional SEO `metaTitle`/`metaDescription`.
- Collapse `status` + `isActive` into **one documented lifecycle**: `DRAFT / ACTIVE / HIDDEN / ARCHIVED` (compat window keeps both physically until readers migrate — G3).
- `cost ≤ base` guard; currency allowed-set validation.

**ProductReference**
- Add (nullable, additive): `measurement`, `shadeName` (augmenting today's free-text `referenceName`), optional `shadeCode` / `swatchHex`, `variationType` (single-axis; multi-axis reserved).
- Keep 1:1 swatch image; keep `priceOverride`/`priceDelta`.
- Friendly `ConflictException` on sku/barcode/refCode/slug uniqueness races (R6).

**Suitability**
- Product-level general suitability assignments (reuse `AttributeGroup.isProductAttribute`); keep reference-level shade suitability.

**Orders & stock (gated safety fixes)**
- Atomic guarded stock decrement / reservation at order create; release on cancel/return; unified availability predicate across both order paths.
- Richer `OrderItem` snapshot (name, sku, shade/size, unit price, image, brand).

**Packs / recommendation**
- `FIXED_REFERENCE` + `AUTO_BEST_REFERENCE`. Fallback policy when no shade matches (drop/substitute/flag — locked in Phase 6.5).

**Storefront contract**
- Public stock = boolean + low-stock badge; curated suitability; derived `onSale`/`% saving`; PDP aggregation.

### 2.2 Deferred — Reserve extension points, do not build

- Multi-axis variant combos (shade × size).
- `CUSTOMER_CHOICE` pack override at checkout.
- Multi-currency pricing (keep single MAD columns).
- Promotions engine beyond `compareAtPrice` (codes, banners, stickers).
- Reviews / ratings.
- Back-in-stock subscriptions.
- Product video / enhanced media zones (MediaAssetType is IMAGE-only).
- Multi-image shade gallery (keep 1:1 swatch).
- Reference-level `compareAtPrice` (per-shade sale) — inherit product's for now.
- Product/reference `recommendationPriority` boost.
- Full-text / trigram search index (Phase 5/9 perf track).
- `maxPerCustomer` purchase cap.
- SEO JSON-LD / structured data beyond meta title/description.

### 2.3 Rejected — Out of scope, not reserved

- Online payment (Cash on Delivery only — confirmed business model).
- Next-day delivery countdown (irrelevant to Morocco COD).
- Loyalty / tribe / exclusivity tiers.
- Platform-specific saleability.
- International localization / language fallback.
- Restricted-item / coming-soon handling.

---

## 3. Step 1.7 — Signed-off Capability Matrix

Single source of truth for the build. **Scope** = MVP / Defer / Reject. **Owner** = the model that owns the data.

| Capability | Decision | Owner | Scope | Phase |
|---|---|---|---|---|
| Parent/SKU split | Keep (validated) | Product / ProductReference | MVP | — |
| Product name, slug | Keep | Product | MVP | — |
| Brand (optional) / Category (required) | Keep | Product → Brand/Category | MVP | — |
| Product type | Add nullable | Product | MVP | 4 |
| Full description | Keep | Product | MVP | — |
| Short description | Add nullable | Product | MVP | 4 |
| Ingredients / Directions | Add nullable; required-by-type via validation | Product | MVP | 4–5 |
| SEO meta title/description | Add nullable | Product | MVP | 4–5 |
| Single visibility contract (DRAFT/ACTIVE/HIDDEN/ARCHIVED) | Collapse `status`+`isActive`, compat window | Product | MVP | 2–4 |
| Base price | Keep numeric MAD | Product | MVP | — |
| Compare-at / sale price | **Add optional `compareAtPrice`; derive onSale/% saving** | Product | MVP | 4 |
| `cost ≤ base` + currency-set guards | Add | Product (DTO) | MVP | 4 |
| Cost price (admin-only) | Keep, hidden from public | Product | MVP | — |
| SKU / barcode (one ref = one SKU) | Keep unique; friendly conflict | ProductReference | MVP | 4 |
| Measurement / size | Add structured `measurement` | ProductReference | MVP | 4 |
| Shade name | Add `shadeName` (augment `referenceName`) | ProductReference | MVP | 4 |
| Shade code / swatch hex | Add optional `shadeCode`/`swatchHex` | ProductReference | MVP | 4–5 |
| Variation axis | **Add `variationType` (single-axis; multi reserved)** | ProductReference | MVP | 4–5 |
| Multi-axis (shade × size) | **Reserve, do not build** | ProductReference | Defer | Future |
| Reference price override/delta | Keep dual model | ProductReference | MVP | — |
| Stock quantity / reserved / threshold | Keep reference-level | ProductReference | MVP | — |
| **Stock decrement + reservation on order** | **Atomic guarded; release on cancel** | ProductReference (write by Orders) | MVP (gated) | 7 |
| Unified availability predicate | Fix divergence (D4) | Orders | MVP | 7 |
| Out-of-stock product behaviour | **Stay visible, "Sold out" + disabled CTA** | Storefront (derived) | MVP | 5,7 |
| Public stock exposure | **Boolean + low-stock badge; hide exact count** | Storefront projection | MVP | 2.7,5 |
| Product-level general suitability | Add (reuse `isProductAttribute`) | Product attribute assignment | MVP | 5–6 |
| Reference-level shade suitability | Keep | ProductReferenceAttribute | MVP | — |
| Mandatory-attributes-by-type | Baseline mapping via validation | Product/Reference (policy) | MVP | 5 |
| Public suitability exposure | Curated subset; hide raw scoring | Storefront projection | MVP | 2.7 |
| Product/reference rec priority | Reserve | Product/ProductReference | Defer | Future |
| Pack fixed reference | Keep `FIXED_REFERENCE` | PackItem | MVP | 6 |
| Pack auto-best reference | Keep `AUTO_BEST_REFERENCE` | PackItem / engine | MVP | 6 |
| Customer-choice pack override | Reserve | PackItem | Defer | 6/8 |
| Fallback when no shade matches | Define policy (drop/substitute/flag) | Engine | MVP | 6.5 |
| **Order snapshot (name, sku, shade/size, price, image, brand)** | **Extend, nullable + backfill** | OrderItem | MVP (gated) | 7 |
| Archive over delete | Mandatory; no hard delete | All referenced models | MVP | — |
| Product cover / gallery media | Keep join; retire scalar `mainImageUrl` | ProductImage | MVP | 5 |
| Reference swatch (1:1) | Keep | ProductReferenceImage | MVP | — |
| Multi-image shade gallery | Reserve | ProductReferenceImage | Defer | Future |
| Full-text search | Reserve (ILIKE for now) | Storefront | Defer | 5/9 |
| Multi-currency | Reserve single MAD | Product/Reference | Defer | Future |
| Promotions engine | Reserve (only `compareAtPrice`) | Future domain | Defer | Future |
| Reviews / ratings | Reserve relation point | Future domain | Defer | Future |
| Back-in-stock alerts | Reserve | Future (subscription) | Defer | Future |
| Product video / enhanced zones | Reserve | Future content | Defer | Future |
| `maxPerCustomer` cap | Reserve | Product/Reference | Defer | Future |
| Online payment | — | — | Reject | — |
| Loyalty / localization / next-day countdown | — | — | Reject | — |

---

## 4. Exit Criteria & Next Step

**Phase 1 exit criteria (Master Plan) — met:**
- 1.1–1.5: every §12 decision has a written, signed answer (§1). ✅
- 1.6: each feature tagged MVP / Defer / Reject (§2). ✅
- 1.7: approved capability matrix with sign-off recorded (§0, §3). ✅
- **Checkpoint #1 cleared** — no schema work began; design is mandated. ✅

**Next:** Proceed to **Phase 2 — Target Data Model & API Contract Design** (steps 2.1–2.8), which translates this matrix into model responsibilities, relation cardinalities, the visibility state machine, unique/index plans, public-vs-admin field-visibility matrix, and the expand→contract migration strategy. Phase 2 ends at **Checkpoint #2** (approved data model + migration strategy) before any migration is written in Phase 3.

> Open item to carry: the final **stock-decrement timing** (Q7) is locked as "at order create" for design purposes but is formally reaffirmed at **Checkpoint #4** before Phase 7 deploy, since it is the one irreversible behavioural change.
