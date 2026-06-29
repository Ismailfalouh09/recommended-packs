# Product Domain Redesign — Master Plan

> Planning-only document. No source code, Prisma schema, migration, DTO, endpoint, seed, configuration, or API contract was modified while producing it.
> Companion to `docs/BEAUTY_BAY_PRODUCT_OBJECT_REFERENCE_ANALYSIS.md` (reference) and `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md` (target).
> Every phase is designed to evolve the Product domain **without breaking** existing backend work, packs, recommendation logic, admin dashboard work, or future storefront integration.

---

## 1. Goal

Evolve the current thin-`Product` catalog into a Beauty-Bay-grade product experience — parent Product over sellable ProductReference SKUs, with two-tier beauty suitability, structured shades/sizes, safe stock, and historically-immutable orders — **adapted** to a Morocco/MAD/COD/mobile-first store, delivered in **additive, reversible phases**.

**Evidence:** `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md` §1, §14.

---

## 2. Current Constraints

- **No rewrite.** The `Product`/`ProductReference` backbone is validated and must be preserved. *(`prisma/schema.prisma`; reference §6.)*
- **Referential locks.** Orders, packs, and recommendation results hold products/references via `onDelete: Restrict` — schema changes must not break these. *(`prisma/schema.prisma` — `OrderItem`, `PackItem`, `RecommendationResultItem`.)*
- **Two known-critical behaviours.** Stock is never decremented on order; order snapshots are thin. Both must be fixed without changing existing order history semantics. *(`docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` §8; `frontend-handoff/KNOWN_LIMITATIONS.md`.)*
- **Frontend handoff in flight.** Admin dashboard + storefront consume current contracts; changes need coordinated handoff updates. *(`frontend-handoff/*`.)*
- **Validation pipe is strict** (`whitelist + forbidNonWhitelisted`), so any new DTO field must be added deliberately. *(`src/main.ts`.)*
- **Business decisions are blocking.** 12 decisions (conception §12) must be locked before schema work.

---

## 3. Implementation Strategy

1. **Decisions before schema.** Lock the 12 business decisions and the capability matrix first (Phases 0–1).
2. **Additive-first.** Prefer nullable additive columns and new tables over destructive changes; backfill, then tighten constraints.
3. **Expand → migrate → contract.** For risky changes (visibility contract, stock decrement), run dual-write/compat windows, never a hard cutover.
4. **Safety phases are non-removable.** Evidence review (0), migration design (3), and order/stock safety (7) cannot be skipped or merged away.
5. **Vertical slices behind the contract.** Ship backend + tests + Swagger + handoff note per phase; frontend integration is sequenced last (Phase 8).
6. **Every change reversible.** Each schema step has a rollback; each behavioural change is feature-gated or compat-windowed.

---

## 4. Phase Overview

| Phase | Name | Goal | Depends On | Main Outputs |
|---|---|---|---|---|
| 0 | Evidence Review & Guardrails | Confirm current state, consumers, risks, baseline | — | Validated consumer map, guardrails, checkpoint strategy |
| 1 | Business Decisions & Scope Lock | Resolve the 12 decisions; lock MVP/deferred/rejected | 0 | Signed-off capability matrix |
| 2 | Target Data Model & API Contract Design | Design models, lifecycle, constraints, public/admin contracts | 1 | Model/contract spec + migration strategy |
| 3 | Database & Prisma Migration Design | Plan migration order, backfill, rollback, FK safety | 2 | Migration plan + data validation plan |
| 4 | Core Product & ProductReference Implementation | CRUD, SKU/slug, visibility, price, stock link, DTOs | 3 | Updated services/controllers + tests + Swagger |
| 5 | Media, Attributes & Discovery | Product/reference media, facets, suitability, search | 4 | Attribute + media + search capability |
| 6 | Packs & Recommendation Adaptation | Pack item behaviour, shade selection, fallback, priority | 4,5 | Updated engine + pack logic + tests |
| 7 | Orders, Stock Safety & Snapshots | Atomic stock, richer snapshots, archive safety | 4,6 | Safe checkout + immutable history |
| 8 | Admin & Storefront Contract Integration | Endpoints, PDP response, handoff, frontend tasks | 4–7 | Contracts + handoff docs + FE tasks |
| 9 | Test, Migration, Docs & Release | Full regression, perf, rollback, docs | 0–8 | Release-ready domain |

---

## 5. Detailed Phases and Steps

> Each step uses: `Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks`.

### Phase 0 — Evidence Review and Redesign Guardrails

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 0.1 | Validate current Product analysis accuracy | Re-confirm `PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` against live code | Products, references, schema | — | Validated/annotated analysis | Each claim traced to code/schema; deltas logged | Stale doc misleads design |
| 0.2 | Confirm all existing Product consumers | Map every reader/writer of Product/Reference | Products, packs, orders, recs, media, storefront | 0.1 | Consumer map (modules + endpoints) | All `productId`/`productReferenceId` usages enumerated | Hidden consumer breaks later |
| 0.3 | Identify backward-compatibility risks | List contracts/data that must not break | Orders, packs, recs, FE handoff | 0.2 | Risk register | Each `Restrict` relation + public field documented | Unseen FK/contract break |
| 0.4 | Freeze assumptions needing business approval | Prevent silent schema decisions | All | 0.2 | Frozen-assumption list (= conception §12) | 12 decisions explicitly listed as blocking | Implicit assumption baked into schema |
| 0.5 | Define safe baseline/checkpoint strategy | Enable rollback per phase | Repo/CI/DB | — | Branch + DB snapshot + migration-checkpoint plan | Documented rollback per phase; tag baseline commit | No clean revert point |

### Phase 1 — Business Decisions and Target Scope Lock

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 1.1 | Resolve Product vs ProductReference decisions | Settle multi-axis, 1-SKU-per-ref, shade vs size | Products, references | 0.4 | Decisions on conception §12 Q1–Q2 | Written, signed answers | Ambiguity reopens in Phase 2 |
| 1.2 | Resolve price & stock ownership | Confirm price resolution + manual stock + decrement step | Price, stock, orders | 0.4 | Decisions on §12 Q3, Q6, Q7 | Signed answers; decrement timing chosen | Overselling policy unclear |
| 1.3 | Resolve beauty attribute ownership | Fix product-level vs reference-level split + mandatory-by-type | Attributes, recs | 0.4 | Decisions on §12 Q10–Q11 | Group-by-group ownership table | Engine scores wrong layer |
| 1.4 | Resolve pack reference selection behaviour | Lock fixed/auto MVP, customer-choice later | Packs, recs | 0.4 | Decision on §12 Q4–Q5 | MVP selection modes chosen | Pack UX mismatch |
| 1.5 | Resolve order snapshot requirements | Decide frozen fields | Orders | 0.4 | Decision on snapshot field set | Field list approved | History gaps |
| 1.6 | Define MVP / deferred / rejected scope | Bound the build | All | 1.1–1.5 | Scope document | Each feature tagged MVP/defer/reject | Scope creep |
| 1.7 | Produce signed-off capability matrix | Single source of truth for build | All | 1.6 | Approved capability matrix | Stakeholder sign-off recorded | Build without mandate |

### Phase 2 — Target Data Model and API Contract Design

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 2.1 | Define target object responsibilities | Lock what each model owns | Products, references, attributes, media, orders | 1.7 | Responsibility spec (= conception §4–§6) | No field owned by two models | Overlap/duplication |
| 2.2 | Define relation cardinalities | Confirm FKs + new product-attribute relation | All catalog relations | 2.1 | Cardinality diagram | Each relation has required/optional + onDelete | Wrong cardinality |
| 2.3 | Define lifecycle statuses | Single visibility contract | Products, references | 2.1 | Status state machine (DRAFT/ACTIVE/HIDDEN/ARCHIVED) | Transitions + visibility rules defined | Ambiguous visibility persists |
| 2.4 | Define deletion/archive rules | Codify archive-over-delete | Products, packs, orders, recs | 2.2 | Delete/archive policy | Every `Restrict` path has archive path | Accidental hard delete |
| 2.5 | Define unique constraints & indexes | Integrity + search perf | Products, references | 2.2 | Constraint/index list | New uniques (slug, sku) + search index plan | Dup data / slow search |
| 2.6 | Define admin & storefront API response concepts | Shape contracts before code | Storefront, admin | 2.1,2.3 | Response concept spec (= conception §9) | Admin vs public projections defined | Contract drift |
| 2.7 | Define public vs admin-only fields | Lock exposure | Storefront security | 2.6,1.* | Field-visibility matrix | costPrice/barcode/reserved hidden; stock-exposure decided | Leak internal data |
| 2.8 | Define migration & compatibility strategy | Plan before any schema change | DB, all consumers | 2.1–2.7 | Expand/contract strategy | Each change classified additive/compat/destructive | Breaking migration |

### Phase 3 — Database and Prisma Migration Design

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 3.1 | Plan Prisma model evolution | Map spec to model changes | `schema.prisma` | 2.* | Annotated model-change plan | Every new/changed field listed w/ nullability | Schema surprise |
| 3.2 | Plan migration order | Sequence additive→backfill→constrain | Migrations | 3.1 | Ordered migration list | Each migration independently revertible | Out-of-order failure |
| 3.3 | Plan legacy data migration/backfill | Fill new fields from existing data | Products, references, orders | 3.1 | Backfill scripts plan (e.g. `referenceName`→`shadeName`, snapshot backfill) | Backfill mapping per field | Null/garbage data |
| 3.4 | Plan data validation before & after | Guarantee integrity | All catalog tables | 3.3 | Validation query set | Pre/post counts + invariants defined | Silent corruption |
| 3.5 | Plan rollback approach | Reversibility per migration | Migrations, DB | 3.2 | Rollback playbook | Down-path or compensating script per step | Stuck mid-migration |
| 3.6 | Plan safe handling of Pack/Rec/Stock/Order references | Protect locked relations | Packs, recs, stock, orders | 3.1 | FK-safety checklist | No migration violates `Restrict`/`Cascade`/`SetNull` | Referential break |
| 3.7 | Identify test data & seed strategy | Realistic beauty fixtures | Seed, tests | 3.1 | Seed plan (shade + size products) | Seed covers shade, size, OOS, pack cases | Unrepresentative tests |

### Phase 4 — Core Product and ProductReference Backend Implementation

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 4.1 | Product CRUD adaptation | Support new product fields | `products.service.ts`, controllers | 3.* | Updated create/update/read | New fields persisted + projected | Regression in CRUD |
| 4.2 | ProductReference CRUD adaptation | Support measurement/shade fields | `product-references.service.ts` | 3.* | Updated reference CRUD | Shade/size fields persisted | Variant regression |
| 4.3 | SKU validation | Enforce sku/barcode uniqueness cleanly | References | 4.2 | Validation + friendly conflict | Duplicate sku → `ConflictException` not raw P2002 | Race-prone uniqueness |
| 4.4 | Slug validation | Keep slug unique + format | Products | 4.1 | Slug rule retained/strengthened | Duplicate slug → friendly error | Slug collision |
| 4.5 | Visibility/status management | Implement single lifecycle | Products, references | 2.3,4.1 | Status transitions + guards | DRAFT/ACTIVE/HIDDEN/ARCHIVED enforced; public read uses one source | Visibility drift |
| 4.6 | Price & sale-price rules | compareAtPrice + cost≤base guard | Price, products | 4.1 | Pricing validation | `onSale`/`% saving` derivable; invalid prices rejected | Bad financial data |
| 4.7 | Reference-level stock association | Keep stock per reference, expose status | Stock, references | 4.2 | Stock projection (derived availability) | Available = active && stock>reserved | Misreported stock |
| 4.8 | Admin DTO validation | New fields validated under strict pipe | DTOs | 4.1–4.6 | Updated DTOs | All new fields whitelisted + validated | Rejected/blind fields |
| 4.9 | Role/permission review | Confirm OWNER/ADMIN write, STAFF read | Auth | 4.1 | Permission check | Matches `ROLE_PERMISSION_MATRIX.md` | Authz regression |
| 4.10 | Swagger/OpenAPI contract update | Keep generated contract accurate | `openapi.*`, Swagger | 4.1–4.8 | Updated response models | Admin vs public shapes documented | Contract mismatch |
| 4.11 | Unit & integration test requirements | Lock behaviour | Tests | 4.1–4.10 | Test suite | CRUD/visibility/price/stock covered green | Untested regressions |

### Phase 5 — Media, Attributes, and Catalog Discovery Implementation

Continuation note: the previous agent had completed Phase 5 only through `5.7 Product detail aggregation requirements`. This continuation preserves those completed steps, expands missing Phase 5 exit work, and then completes Phases 6-9.

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 5.1 | Product media ownership and ordered gallery | Make `ProductImage` + `MediaAsset` the source for cover/gallery ordering while planning retirement of scalar `mainImageUrl` | Media, products, public catalog | 4.1 | Product media ownership plan, ordered gallery contract, scalar URL compatibility rule | Cover is selected from `role=COVER`; gallery sorted by `position`; old `mainImageUrl` is fallback-only during migration | Image source ambiguity, stale scalar URLs |
| 5.2 | ProductReference media, swatches, and variation images | Use reference-level media for shade image/swatch while keeping `swatchHex` as optional UI support | Media, references, PDP variants | 4.2 | Reference-media response contract for shade/size selector | Reference response includes swatch image/URLs and optional hex; missing swatch has deterministic fallback | Shade selector gaps |
| 5.3 | Media roles and future video boundary | Define supported roles now and reserve video without implementing it | Media, DTOs, Swagger | 5.1,5.2 | Role matrix: COVER, GALLERY, SWATCH, DETAIL/THUMBNAIL policy, video deferred | Existing `MediaRole` values mapped; `MediaAssetType=IMAGE` respected; no fake video support claimed | Over-promising media capability |
| 5.4 | Media cleanup and orphan prevention | Preserve provider cleanup and prevent unreferenced or double-deleted assets | Media service, Cloudinary provider, products, references | 5.1,5.2 | Cleanup/orphan-prevention checklist | Delete flows remove join first, delete provider asset only if unreferenced, and never let feature services call Cloudinary directly | Orphaned Cloudinary assets or broken shared media |
| 5.5 | Product-level beauty attribute assignments | Confirm `ProductAttribute` behavior for general suitability | Products, attributes, admin DTOs | 4.1,1.3 | Product-level attribute create/update/list contract | Only product-level groups are assignable to Product; duplicate assignments rejected; public projection is curated | Wrong-layer suitability |
| 5.6 | ProductReference-level shade matching attributes | Keep tone/undertone/shade-family attributes at SKU level | References, attributes, recommendation input | 4.2,5.5 | Reference attribute ownership and validation rules | Skin tone/undertone hard filters remain reference-level; reference CRUD preserves attributes | Wrong shade chosen |
| 5.7 | Category and product-type behavior | Clarify category vs product type for browse/search | Categories, products, catalog API | 4.1,1.3 | Taxonomy contract for category, productType, and future slug parity | Category filters and `productType` filters are defined; brand/category slug gaps logged for Phase 8 handoff | Broken browse taxonomy |
| 5.8 | Required attributes by product type | Decide which suitability fields are mandatory for foundation, serum, cleanser, lipstick, etc. | Attributes, admin validation, recommendations | 1.3,5.5,5.6 | Required-by-product-type matrix | Missing mandatory attributes fail admin validation or are clearly marked incomplete before publish | Under-specified products entering recommendations |
| 5.9 | Storefront filtering requirements | Define public filters over category, productType, brand, price, stock, sale, and suitability | Products, catalog endpoints, indexes | 5.5-5.8 | Filter contract and index plan | Filters are expressible without exposing admin-only fields; exact stock exposure decision is documented | Slow or leaky filters |
| 5.10 | Search and catalog discovery requirements | Improve search semantics while avoiding premature search-engine work | Products, categories, brands | 5.7,5.9 | Search behavior spec: fields searched, sort order, empty states, pagination | Current `contains`/ILIKE risk is documented; index/full-text path is planned before growth | Catalog scans degrade |
| 5.11 | Product detail aggregation requirements | Assemble rich PDP response from normalized tables | Storefront, products, references, media, attributes | 5.1-5.10 | PDP aggregation spec aligned with conception section 9 | One response contains product master data, selected reference, all variants, price, stock signal, media, taxonomy, and suitability | Heavy response or missing variant data |
| 5.12 | Prevent N+1 query issues | Keep listings and PDP loading batched and explicitly selected | Products service, Prisma selects, media URLs | 5.9-5.11 | Query-shape review and select/include plan | Listing and detail paths use bounded includes/selects; tests or query logging prove no per-reference media/attribute loops | Mobile storefront latency |
| 5.13 | Public storefront vs admin-only fields | Separate safe public projection from admin detail payloads | Products, references, Swagger, handoff | 5.9-5.12 | Field exposure matrix | Public payload hides `costPrice`, `barcode`, `reservedQuantity`, raw scoring, provider IDs, and internal media IDs unless approved | Inventory/security leakage |
| 5.14 | Phase 5 tests and validation gate | Prove media, attributes, filtering, and PDP aggregation before packs/recs | Tests, Swagger, handoff | 5.1-5.13 | Phase 5 test checklist and contract examples | Media role tests, attribute assignment tests, catalog filter tests, PDP aggregation tests, and N+1 review are complete | Recommendation phase starts with bad inputs |

**Evidence**
- `prisma/schema.prisma` - `MediaAsset`, `ProductImage`, `ProductReferenceImage`, `MediaRole`, `MediaAssetType`, `ProductAttribute`, `ProductReferenceAttribute`, `Product.productType`.
- `src/modules/media/media.service.ts` - cover demotion, reorder, reference image replacement, delete-if-unreferenced provider cleanup.
- `src/modules/products/products.service.ts` - public projection, curated suitability, cover/gallery response, derived public stock signal.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - media duplication risk, product/reference attributes, search performance risk, public exposure risk.
- `docs/reference/beauty-bay-product-object-sample.json` - `media.images[]`, `variants[].swatch`, `variants[].imageUrl`, `attraqt.facets[]`, `productType`.

### Phase 6 — Packs and Recommendation Engine Adaptation

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 6.1 | PackItem relationship review | Confirm `PackItem.productId` is required and `productReferenceId` is optional only for fixed items | Packs, Prisma, admin DTOs | 4.2 | Pack item ownership note and validation matrix | Fixed items require a reference; dynamic items do not accept a reference; quantity remains on `PackItem` | Pack items point at invalid reference/product pairs |
| 6.2 | Fixed ProductReference behavior | Preserve packs that contain an exact sellable SKU | Packs, recommendations, order snapshots | 6.1 | Fixed-reference behavior spec | Out-of-stock or inactive fixed references disqualify or flag the pack per approved policy | Fixed kits sell unavailable SKU |
| 6.3 | Dynamic compatible reference behavior | Define product-level pack items that require later reference selection | Packs, recommendation engine | 6.1,5.14 | Dynamic-selection spec for `AUTO_BEST_REFERENCE`; `CUSTOMER_CHOICE` remains gated unless approved | Engine selects one compatible reference per dynamic item and records it | UX promises customer choice that backend cannot accept |
| 6.4 | MVP pack behavior decision | Lock which selection modes ship in MVP | Packs, frontend handoff | 1.4,6.2,6.3 | Signed MVP decision: fixed + auto; customer override later unless approved | Handoff states exactly what cart/order can submit | Business/UX mismatch |
| 6.5 | Candidate filtering by product and reference suitability | Combine product-level general suitability and reference-level shade suitability | Recommendations, products, references, attributes | 5.5,5.6 | Candidate filter design | Product-level hard filters exclude unsuitable products; reference-level filters choose suitable SKU | Mis-recommendation |
| 6.6 | Tone and undertone matching at reference level | Keep shade-specific match rules on ProductReference | Recommendation engine, attributes | 6.5 | Shade scoring matrix | Tone/undertone answers affect reference choice, not only product ranking | Wrong foundation/concealer shade |
| 6.7 | General matching at product level | Score skin type, concern, makeup style, finish, coverage, formulation where appropriate | Recommendation engine, ProductAttribute | 6.5 | Product-level scoring adapter | General suitability boosts/filters products before or alongside reference scoring | Repeated attributes on every SKU or missed skincare fit |
| 6.8 | Priority and scoring ownership | Decide whether priority belongs to pack, product, or reference | Packs, recommendations | 6.5-6.7 | Priority ownership policy | Existing `Pack.priority` behavior remains stable; any product/reference priority is explicitly approved | Unstable ranking |
| 6.9 | Out-of-stock compatible reference behavior | Define behavior when best or fixed reference is unavailable | Recommendations, stock, packs | 6.2,6.3 | OOS fallback policy | Engine skips unavailable dynamic references; fixed required OOS items fail/flag deterministically | Recommended pack cannot be ordered |
| 6.10 | No matching shade fallback | Define behavior when no tone/undertone-compatible reference exists | Recommendations, admin data quality | 6.6,6.9 | Fallback policy: drop, substitute, mark incomplete, or fail pack | Required items and optional items have distinct approved outcomes | Silent bad shade recommendations |
| 6.11 | Mixed fixed and dynamic pack behavior | Ensure packs can contain both exact SKUs and dynamic selections | Packs, recommendation result items, orders | 6.2-6.10 | Mixed-pack resolution spec | Recommendation result records the actual selected reference for every item | Pack snapshot ambiguity |
| 6.12 | Regression scenarios and backward compatibility | Protect existing packs/recommendations while adapting engine | Tests, packs, recommendations, handoff | 6.1-6.11 | Scenario test suite using realistic beauty examples | Foundation shade, serum concern, lipstick finish, OOS fixed SKU, mixed pack, and legacy pack cases pass | Existing recommendation behavior breaks |

**Evidence**
- `prisma/schema.prisma` - `PackItem.productId`, `PackItem.productReferenceId`, `SelectionMode`, `Pack.priority`, `RecommendationResultItem.selectedProductReferenceId`.
- `src/modules/packs/packs.service.ts` - validation around `FIXED_REFERENCE`, `AUTO_BEST_REFERENCE`, and `CUSTOMER_CHOICE`.
- `src/modules/recommendations/recommendation-engine.service.ts` - `selectReference`, `scoreReference`, `isReferenceAvailable`.
- `frontend-handoff/CUSTOMER_FRONTEND_HANDOFF.md` - `CUSTOMER_CHOICE` override not supported in order flow.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - pack and recommendation lifecycle notes and fallback gap.

### Phase 7 — Orders, Stock Safety, and Historical Snapshot Adaptation

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 7.1 | Selected ProductReference linkage | Ensure each order item points to the actual selected reference | Orders, recommendations, cart | 6.11 | Linkage verification for cart and recommendation paths | `OrderItem.productReferenceId` is always the SKU selected by customer/engine | Parent product ordered without SKU |
| 7.2 | Immutable order-time snapshot field set | Freeze product, brand, reference, SKU, variation, image, unit price, original price if approved | Orders, products, references | 1.5,7.1 | Snapshot field policy | Both order paths populate all approved snapshot fields; missing optional fields are deliberate | History depends on mutable catalog |
| 7.3 | Catalog-change safety | Keep receipts/admin history stable after product/reference edits | Orders, admin products, archive | 7.2 | Edit-after-order regression plan | Rename product/reference, change price/image, archive product, then old order still reads original snapshot | Customer history corruption |
| 7.4 | Archive behavior for previously ordered items | Prefer archive/hidden over hard delete where order/packs/recs reference data | Products, references, orders | 2.4,7.3 | Archive policy and guards | Ordered products/references can be hidden/archived without breaking order reads | Restrict relation blocks admin operations |
| 7.5 | Reference-level stock reservation/decrement design | Define whether COD order creation decrements `stockQuantity`, increments `reservedQuantity`, or both | Orders, stock, references | 1.2,4.7 | Stock lifecycle design | Approved state transition for COD create, confirm, cancel/reject, complete, return | Overselling or trapped stock |
| 7.6 | COD order state stock transitions | Map stock behavior to `PENDING_CONFIRMATION`, `CONFIRMED`, `CANCELED`, `DELIVERED`, `RETURNED` | Orders, stock | 7.5 | COD stock transition table | Cancel/reject releases or restores stock; completed orders do not double-decrement | Inconsistent stock after manual admin actions |
| 7.7 | Pack order snapshots | Store the actual selected references for fixed and dynamic pack items | Orders, packs, recommendations | 6.11,7.2 | Pack item snapshot plan | Mixed fixed/dynamic pack orders show exact selected SKUs and quantities | Bundle history ambiguity |
| 7.8 | Data consistency and transaction boundaries | Make stock writes and order creation atomic | Orders, Prisma transactions | 7.5,7.6 | Transaction design with guarded conditional update | Concurrent orders cannot oversell; failure rolls back order and stock changes together | TOCTOU race |
| 7.9 | Original price and sale snapshot decision | Decide whether to freeze compare-at/original sale price | Orders, price | 1.5,7.2 | Snapshot price rule | `unitPriceSnapshot` is always effective price; original/compare-at snapshot included only if approved | Misleading historical discounts |
| 7.10 | Historical order regression suite | Prove old orders remain readable after catalog changes | Tests, orders, products, references | 7.1-7.9 | Regression tests for cart and recommendation orders | Legacy/thin orders and new rich-snapshot orders both render | Migration breaks order history |

**Evidence**
- `prisma/schema.prisma` - `OrderItem.productId`, `productReferenceId`, snapshot columns, `PaymentMethod.CASH_ON_DELIVERY`, order statuses, `onDelete: Restrict`.
- `src/modules/orders/orders.service.ts` - availability checks, current snapshot mapping, transaction usage, no confirmed stock write safety.
- `frontend-handoff/KNOWN_LIMITATIONS.md` - stock reservation and automatic stock deduction not implemented.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - critical stock decrement risk, TOCTOU risk, order snapshot risk.

### Phase 8 — Admin Dashboard and Storefront Contract Integration

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 8.1 | Admin screens impacted | Inventory every admin product-domain screen affected by redesign | Admin dashboard, handoff docs | 4-7 | Admin screen impact map | Product list/detail, reference manager, stock, media, attributes, packs, recommendations, and orders are mapped | Missed admin workflow |
| 8.2 | Product create/edit lifecycle | Define admin authoring from draft through active/hidden/archive | Products, DTOs, validation | 4.1,5.8,7.4 | Product lifecycle API contract | Admin can create draft, add refs/media/attributes/stock, then publish only when requirements pass | Incomplete products published |
| 8.3 | Reference/shade/size/SKU management | Define SKU manager behavior | References, stock, admin UI handoff | 4.2,5.6 | Reference create/edit contract | Admin can manage SKU, measurement, shade, swatch, active state, default reference, uniqueness errors | Duplicate or ambiguous variants |
| 8.4 | Product and reference media management | Define media upload/reorder/replace/delete UI contracts | Media, products, references | 5.1-5.4 | Media handoff and endpoint matrix | Cover/gallery and swatch flows match backend endpoints and cleanup rules | Broken image management |
| 8.5 | Attribute and suitability management | Define product-level and reference-level attribute UI/contract | Attributes, quiz, recommendations | 5.5-5.8 | Attribute assignment contract | Admin sees required attributes by product type and cannot assign wrong-layer groups | Bad recommendation inputs |
| 8.6 | Price, sale-price, stock, visibility management | Define admin controls and public effects | Products, references, stock, orders | 4.5-4.7,7.5 | Commercial/admin field contract | Price, compare-at, stock, reserved read, low stock, and visibility rules documented | Admin changes have surprising public effects |
| 8.7 | Pack compatibility configuration | Define fixed/dynamic item authoring | Packs, recommendations | 6.1-6.4 | Pack configuration contract | Admin understands when a reference is fixed vs dynamically selected later | Pack setup cannot be ordered/recommended |
| 8.8 | Storefront category listing API requirements | Lock category browse/list API shape | Storefront, products, categories | 5.7,5.9 | Listing response contract | Category listing includes safe product cards, price-from, stock signal, cover image, pagination | Storefront cannot browse |
| 8.9 | Storefront search/filter/sort/pagination | Lock query params and response envelope | Storefront, products | 5.9,5.10 | Search/filter/sort/pagination spec | Filters/sorts are documented with empty-state and invalid-param behavior | Inconsistent client behavior |
| 8.10 | Rich PDP response requirements | Finalize Beauty-Bay-inspired PDP response | Storefront, products, references, media | 5.11,7.2 | PDP contract examples | Response has product content, selected reference, variants, price, stock, media, suitability, brand/category | PDP requires extra unplanned calls |
| 8.11 | Variant selector response requirements | Define shade/size selector payload | Storefront, references, media | 5.2,5.6,8.10 | Variant selector contract | Each variant has id, label, sku, measurement/shade, price, stock signal, swatch/image | Wrong variant added to cart |
| 8.12 | Add-to-cart validation contract | Define what cart/order accepts and rejects | Storefront, orders, stock | 7.1,7.5 | Add-to-cart/order validation spec | Invalid/inactive/OOS reference returns predictable error; parent-only add is rejected | Checkout accepts unsellable item |
| 8.13 | API error/loading/empty-state expectations | Standardize frontend-facing states | Storefront, admin, Swagger | 8.8-8.12 | Error and empty-state contract | 400/404/409/503 cases documented; empty filters return empty envelope, not error | Poor frontend resilience |
| 8.14 | Frontend handoff documentation updates | Update handoff without implementing frontend | `frontend-handoff/*`, Swagger | 8.1-8.13 | Updated handoff task list and known limitations | Handoff docs reflect product domain redesign and remaining unsupported items | Stale FE guidance |
| 8.15 | Admin-only vs public catalog separation | Prevent internal data leakage | Products, references, media, Swagger | 5.13,8.6 | Public/admin field matrix | Public excludes cost, barcode, exact reserved stock, raw scoring, provider IDs, admin audit details | Inventory/commercial leakage |

**Evidence**
- `frontend-handoff/PAGE_ENDPOINT_MAPPING.md`, `CUSTOMER_FRONTEND_HANDOFF.md`, `STORE_CATALOG_HANDOFF.md`, `KNOWN_LIMITATIONS.md`, `ROLE_PERMISSION_MATRIX.md`.
- `src/modules/products/admin-products.controller.ts`, `src/modules/products/products.controller.ts`, `src/modules/product-references/admin-product-references.controller.ts`, `src/modules/media/controllers/*`.
- `src/modules/orders/orders.controller.ts` - existing cart/recommendation order validation errors.
- `prisma/schema.prisma` - public/admin field candidates and relations.

### Phase 9 — Test, Migration, Documentation, and Release Readiness

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 9.1 | Prisma migration test strategy | Rehearse every migration against realistic data | Prisma, DB, CI | 3.* | Migration rehearsal plan | Forward and rollback tested on snapshot; generated client verified after schema changes | Prod migration failure |
| 9.2 | Legacy/backfill data validation | Prove old products/references/orders remain valid | DB, products, orders | 3.3,9.1 | Pre/post validation query set | Counts, null checks, duplicate checks, snapshot completeness, and FK integrity pass | Silent data corruption |
| 9.3 | Database rollback approach | Define rollback or compensating path per migration | DB, ops | 3.5,9.1 | Rollback runbook | Each migration has tested down/compensating action and restore point | Stuck deployment |
| 9.4 | API regression test plan | Catch contract regressions across public/admin endpoints | Products, references, media, packs, orders | 4-8 | API regression suite | Existing documented endpoints remain compatible or intentionally versioned | Broken clients |
| 9.5 | Product CRUD tests | Cover product fields, lifecycle, price, public/admin projections | Products | 4.1,8.2 | Product CRUD suite | Create/update/list/detail/archive and publish guards pass | Bad catalog authoring |
| 9.6 | ProductReference and SKU uniqueness tests | Protect sellable SKU identity | References | 4.2,8.3 | Reference identity test suite | Duplicate `sku`, `barcode`, or product/reference code returns friendly conflict | Duplicate SKUs |
| 9.7 | Price and sale-price tests | Verify effective price, compare-at, sale derivation, MAD currency | Products, references, orders | 4.6,7.2 | Price test suite | Effective price and snapshots are correct; invalid compare-at rejected | Financial errors |
| 9.8 | Stock and reservation tests | Prove no oversell and correct COD state transitions | Orders, stock, references | 7.5-7.8 | Stock concurrency and lifecycle tests | Concurrent checkout guarded; cancel/reject/release behavior passes | Overselling |
| 9.9 | Product/reference media tests | Verify cover/gallery/swatch and cleanup | Media, products, references | 5.1-5.4 | Media regression tests | Cover demotion, reorder, swatch replace/delete, orphan cleanup pass | Broken media or orphan assets |
| 9.10 | Catalog filtering and pagination tests | Protect storefront discovery | Products, search, filters | 5.9,5.10,8.8,8.9 | Catalog list test suite | Filters combine correctly; pagination stable; empty state deterministic | Storefront browse regressions |
| 9.11 | Pack regression scenarios | Protect fixed/dynamic/mixed bundle behavior | Packs, recommendations | 6.1-6.12 | Pack scenario suite | Fixed, auto, mixed, OOS, optional/required cases pass | Bundle regression |
| 9.12 | Recommendation regression scenarios | Protect rule-based quiz outcomes | Recommendations, attributes, quiz | 6.5-6.12 | Recommendation scenario suite | Skin tone, undertone, skin type, concern, style, finish, coverage cases stable | Mis-recommendation |
| 9.13 | Order snapshot regression scenarios | Prove catalog edits do not change history | Orders, products, references | 7.1-7.10 | Snapshot regression suite | Rename/price/image/archive after order does not alter historical order display | History corruption |
| 9.14 | Role and authorization tests | Preserve OWNER/ADMIN/STAFF permissions | Auth, admin endpoints | 8.1-8.7 | Authz test suite | Write/read permissions match role matrix; storefront remains public where intended | Privilege leak |
| 9.15 | Performance and N+1 query review | Keep catalog and PDP performant | Products, Prisma, media URL generation | 5.12,8.10 | Query/performance report | List/PDP query counts bounded; indexes reviewed for filters/search | Slow mobile storefront |
| 9.16 | Swagger/OpenAPI review | Keep generated contracts truthful | Swagger, docs, frontend handoff | 8.8-8.15 | OpenAPI review checklist | Public/admin DTOs, errors, examples, and field visibility are documented | Contract drift |
| 9.17 | Admin and storefront contract verification | Verify backend matches handoff docs | Backend, handoff docs | 8.14,9.16 | Contract verification matrix | Every documented page/API has matching endpoint, DTO, and role/error behavior | Frontend integration failure |
| 9.18 | Documentation and release checklist | Tie analysis, migration, tests, and deployment together | docs, ops, release | 9.1-9.17 | Release readiness checklist | Go/no-go approved; docs updated; known limitations accurate; rollback owner named | Unsafe release |

**Evidence**
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - known high-risk areas and current gaps.
- `frontend-handoff/*` - current contract and known limitation documents that must be updated.
- `src/modules/*/*.spec.ts` - existing test coverage patterns for products, product references, media, packs, recommendations, and orders.
- `prisma/schema.prisma` - models, constraints, indexes, relations, and generated-client dependency.

---

## 6. Dependency Graph

Current dependency graph, superseding the encoded legacy sketch below:

```
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 4
  -> Phase 5 -> Phase 6 -> Phase 7 -> Phase 8 -> Phase 9
```

Current critical path: **0 -> 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9**. Phase 5 is required before Phase 6 because the recommendation engine needs product/reference suitability, and before Phase 8 because storefront/admin contracts need media and facet behavior.

**Evidence**
- `src/modules/recommendations/recommendation-engine.service.ts` - recommendations depend on selected references and attributes.
- `src/modules/products/products.service.ts` - public product responses aggregate media, stock, price, and suitability.
- `frontend-handoff/*` - frontend integration depends on stable backend contracts.

```
Phase 0 (Evidence & Guardrails)
   └─▶ Phase 1 (Business Decisions & Scope Lock)
          └─▶ Phase 2 (Data Model & API Contract Design)
                 └─▶ Phase 3 (Migration Design)
                        └─▶ Phase 4 (Core Product/Reference Impl)
                               ├─▶ Phase 5 (Media/Attributes/Discovery)
                               │       └─▶ Phase 6 (Packs & Recommendation) ◀─┐
                               ├─────────────────────────────────────────────┘
                               └─▶ Phase 6 ─▶ Phase 7 (Orders/Stock/Snapshots)
                                                  └─▶ Phase 8 (Admin & Storefront Contracts)
                                                         └─▶ Phase 9 (Test/Migration/Docs/Release)
```
Critical path: **0 → 1 → 2 → 3 → 4 → 6 → 7 → 8 → 9**. Phase 5 runs in parallel after 4 but must complete before 6 (engine needs suitability) and before 8 (storefront needs media/facets).

---

## 7. Backward Compatibility and Migration Strategy

Current strategy, superseding the older bullets below:

- Use **expand -> backfill -> verify -> contract** for every risky change.
- Treat fields already present in live schema as still requiring contract verification if DTO/service/test coverage is incomplete.
- Keep `status` + `isActive` during a compatibility window; choose one source of truth for public visibility before removing or ignoring the other.
- Keep legacy scalar image fields as fallback-only until all public/admin responses prefer media joins.
- Backfill/verify `shadeName`, `measurement`, `variationType`, snapshot columns, and product attributes before making any required.
- Preserve `onDelete: Restrict` paths for orders, packs, and recommendation results; archive/hidden states are the compatibility path.
- Introduce stock writes with guarded conditional updates inside the order transaction; do not retroactively mutate historical orders.
- Keep API responses additive-first and update `frontend-handoff/*` before any breaking public/admin shape change.
- Every migration needs a tested rollback or compensating migration plus a database snapshot restore point.

**Evidence**
- `prisma/schema.prisma` - `Product.status`, `isActive`, `ProductReference.isActive`, `OrderItem` snapshot columns, `onDelete: Restrict` relations.
- `src/modules/products/products.service.ts` - public visibility requires both `status=ACTIVE` and `isActive=true`.
- `src/modules/media/media.service.ts` - media joins and cleanup are already the structured path.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - duplicate image systems, stock risk, snapshot risk.

- **Expand → migrate → contract** for every risky change. New fields land **nullable/additive** first; backfill (`referenceName`→`shadeName`, snapshot enrichment); only then tighten constraints.
- **Visibility contract:** keep `status` + `isActive` physically during a compat window; switch reads to the single source of truth; remove redundancy only after all consumers migrated. *(`products.service.ts` `publicProductWhere`.)*
- **Stock decrement:** introduce guarded conditional decrement behind validation; never retro-apply to historical orders.
- **Order snapshots:** new snapshot columns nullable + backfilled from current product/reference; old orders keep working via existing FKs (`Restrict`) and current snapshot fields. *(`prisma/schema.prisma` `OrderItem`.)*
- **Locked relations preserved:** no migration may violate `onDelete: Restrict` (orders/packs/recs) or `Cascade`/`SetNull` semantics. *(Phase 3.6.)*
- **API additive-first:** new response fields are additive; breaking shape changes are versioned/announced via handoff. *(`frontend-handoff/*`.)*
- **Every migration reversible** (Phase 3.5 playbook); baseline tagged (Phase 0.5).

---

## 8. Test Strategy by Phase

Current strategy, superseding the older bullets below:

| Phase | Required Test Focus |
|---|---|
| 0 | Golden current-state behavior and consumer map validation |
| 1 | Decision checklist completeness; no code tests |
| 2 | Contract/model review tests where generated schemas/examples exist |
| 3 | Migration dry runs, backfill validation, rollback rehearsals |
| 4 | Product/reference CRUD, slug/SKU uniqueness, lifecycle, price, stock projection |
| 5 | Product/reference media, cleanup, product and reference attributes, filters, PDP aggregation, N+1 review |
| 6 | Fixed/dynamic/mixed packs, tone/undertone shade selection, product-level suitability, fallback/OOS scenarios |
| 7 | COD stock transitions, concurrency, snapshots, archive-then-read-history |
| 8 | Admin/storefront contract tests, pagination/filter/sort, variant selector, add-to-cart errors |
| 9 | Full regression, authorization, OpenAPI, performance, deployment/rollback checklist |

- **0–3 (design):** validation queries + dry-run migrations on a production-like snapshot; no behavioural tests yet.
- **4:** unit + integration for CRUD, SKU/slug uniqueness, visibility transitions, pricing guards, stock projection.
- **5:** media attach/cover-demote, product+reference attribute assignment, taxonomy/productType filtering, PDP aggregation shape.
- **6:** recommendation scenario suite (tone/undertone/skin-type/concern), fixed vs auto pack resolution, fallback when no shade matches.
- **7:** concurrency/oversell tests, snapshot-completeness tests, archive-then-read-history tests.
- **8:** contract tests for admin + storefront responses, list pagination/filter/sort, error/empty states.
- **9:** full regression (API/rec/pack/order/authz), perf/N+1, forward+rollback migration rehearsal.

Baseline: capture current behaviour as golden tests in Phase 0 so every later phase diffs against a known-good baseline.

---

## 9. Risks and Mitigations

Current risk register, superseding the older table below:

| Risk | Severity | Mitigation |
|---|---|---|
| Overselling because order flow validates stock without a safe write | Critical | Phase 7.5-7.8 atomic guarded stock design; Phase 9.8 concurrency tests |
| Order history corruption after catalog edit/archive | High | Phase 7.2-7.4 snapshot verification; Phase 9.13 regression tests |
| Visibility drift between `status` and `isActive` | High | Phase 2.3 source-of-truth decision; Phase 4.5 transitions; compatibility window |
| Suitability scored at wrong layer | High | Phase 5.5-5.8 ownership matrix; Phase 6.5-6.7 engine adaptation |
| Dynamic pack behavior promises unsupported customer choice | High | Phase 6.4 MVP decision; Phase 8.7/8.12 handoff clarity |
| Media asset orphaning or stale scalar URLs | Medium | Phase 5.1-5.4 cleanup and fallback plan; Phase 9.9 tests |
| Breaking `Restrict` relations during migration | High | Phase 3.6 FK checklist; Phase 9.1-9.3 migration rehearsal |
| Public catalog leaks admin-only fields | Medium | Phase 5.13 and 8.15 field matrix; OpenAPI review |
| Search/catalog performance degrades | Medium | Phase 5.10/5.12 index and N+1 review; Phase 9.15 |
| Scope creep into reviews, promotions, multi-currency, frontend implementation | Medium | Phase 1 scope lock; Phase 8 handoff only; explicit deferrals retained |

**Evidence**
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - critical/high/medium risk register.
- `frontend-handoff/KNOWN_LIMITATIONS.md` - unsupported stock deduction and customer-choice override.
- `prisma/schema.prisma` - relations and current schema surface.

| Risk | Severity | Mitigation |
|---|---|---|
| Overselling — stock never decremented (existing) | Critical | Phase 7.4 atomic guarded decrement; concurrency tests in 9.5 |
| Order history corruption on catalog edit/archive | High | Phase 7.1–7.3 richer snapshots; 7.6 history regression |
| Visibility drift (`status` vs `isActive`) | Medium | Phase 2.3 single contract; 4.5 enforced transitions; compat window |
| Suitability scored at wrong layer | Medium | Phase 1.3 ownership lock; 5.5 mapping; 6.7 scenario tests |
| Breaking a `Restrict` relation in migration | High | Phase 3.6 FK-safety checklist; 9.1 rehearsal |
| Strict ValidationPipe rejects new fields | Medium | Phase 4.8 deliberate DTO whitelisting |
| Search degradation as catalog grows | Medium | Phase 5.6 index plan; 9.7 perf review |
| Scope creep into promotions/reviews/multi-currency | Medium | Phase 1.6 explicit deferral; reserve extension points only |
| Frontend/admin contract break | Medium | Phase 8 additive-first contracts + handoff updates |
| Unrepresentative test data | Low | Phase 3.7 seed covers shade/size/OOS/pack cases |

---

## 10. Checkpoints Requiring Human Approval

Current checkpoints, superseding the older list below:

1. **After Phase 1.7** - signed-off capability matrix and business decisions, especially variation axes, price ownership, pack selection modes, stock timing, and public field exposure.
2. **After Phase 2.8** - approved data model, lifecycle source of truth, public/admin field matrix, and migration/compatibility strategy.
3. **After Phase 3.5/3.6** - migration order, backfill plan, rollback plan, and FK-safety sign-off before any migration is written.
4. **Before Phase 6 implementation** - approval of fixed vs dynamic pack behavior and fallback when no compatible reference exists.
5. **Before Phase 7 deploy** - approval of COD stock decrement/reservation timing and final order snapshot field set.
6. **After Phase 8.14 / before Phase 9 release** - frontend-handoff acceptance, OpenAPI review, and deployment/rollback go/no-go.

1. **After Phase 1.7** — signed-off capability matrix + the 12 business decisions (no schema work begins without this).
2. **After Phase 2.8** — approved data model, lifecycle, public/admin field visibility, and migration strategy.
3. **After Phase 3.5/3.6** — migration order, backfill, rollback, and FK-safety sign-off before any migration is written.
4. **Before Phase 7 deploy** — explicit approval of the stock-decrement timing and order-snapshot field set (irreversible behavioural change).
5. **After Phase 8.6 / before Phase 9 release** — frontend-handoff acceptance + deployment/rollback go/no-go.

---

## 11. Suggested First Implementation Task

Current recommendation. Exactly one first implementation task is recommended; any older doc-only note below this paragraph is superseded and is not part of the implementation sequence:

**Add a safe ProductReference commercial identity baseline: introduce an explicit ProductReference lifecycle/status policy while preserving the existing unique SKU.**

This is one small, foundational backend task: add or design the minimal reference status source of truth (for example `DRAFT/ACTIVE/HIDDEN/ARCHIVED` or a documented replacement for `isActive`) around the already-global-unique `ProductReference.sku`, then update DTO validation, service guards, and tests for reference create/update/public visibility. It should not change recommendation scoring, packs, orders, media, or stock writes yet.

**Justification from current-state evidence**
- `prisma/schema.prisma` - `ProductReference.sku` is already `@unique`, but references have only `isActive`; `Product` has a richer `ProductStatus`.
- `src/modules/recommendations/recommendation-engine.service.ts` - availability currently depends on reference `isActive` plus stock.
- `src/modules/orders/orders.service.ts` - order validation rejects inactive selected references.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - public visibility and lifecycle ambiguity are documented risks.

**Exit criteria**
- One documented reference lifecycle/status rule exists and is enforced consistently in reference admin writes, public catalog reads, recommendation availability, and order validation.
- Existing unique SKU behavior remains intact with friendly duplicate handling.
- No pack behavior, recommendation scoring, order stock mutation, or media schema is changed in this first task.
