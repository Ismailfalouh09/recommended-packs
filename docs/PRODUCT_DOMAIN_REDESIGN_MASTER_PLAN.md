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

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 5.1 | Product media handling | Cover/gallery via join; retire scalar URL | Media, products | 4.1 | Media flow + `mainImageUrl` retirement plan | Cover from `role=COVER`; legacy field deprecated | Image source ambiguity |
| 5.2 | ProductReference media & swatches | Keep 1:1 swatch + swatchHex | Media, references | 4.2 | Swatch handling | Swatch image + optional hex surfaced | Shade visual gaps |
| 5.3 | Attribute/facet assignments | Add product-level assignment layer | Attributes, products | 4.1,1.3 | Product-attribute capability | `isProductAttribute` groups assignable to Product | Wrong-layer attributes |
| 5.4 | Category/product-type behaviour | productType + category slug | Taxonomy | 4.1 | Taxonomy update | productType filterable; category slug available | Broken browse |
| 5.5 | Suitability assignments (type/concern/finish/coverage/tone/undertone) | Full beauty facet coverage | Attributes, references, products | 5.3 | Suitability mapping | General at product, shade at reference | Engine input gaps |
| 5.6 | Storefront search/filter requirements | Filter by facet/brand/category/price/stock | Storefront | 5.3,5.4 | Search/filter spec + index plan | Filters defined; ILIKE→index path identified | Slow/limited search |
| 5.7 | Product detail aggregation requirements | Assemble PDP response | Storefront | 5.1–5.5 | PDP aggregation spec (= conception §9) | One response = product+refs+price+stock+media+facets | N+1 / heavy response |

### Phase 6 — Packs and Recommendation Engine Adaptation

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 6.1 | Update pack item model usage | Align PackItem with new reference fields | Packs | 4.2 | Pack item review | Fixed/auto modes still resolve references | Pack breakage |
| 6.2 | Decide fixed vs dynamic compatible reference | Implement MVP selection modes | Packs, recs | 1.4 | Selection-mode behaviour | FIXED+AUTO_BEST shipped; CUSTOMER_CHOICE gated | Wrong bundle behaviour |
| 6.3 | Adapt recommendation candidate filtering | Use product + reference suitability | Engine | 5.5 | Filtering update | Hard filters honor both layers | Mis-recommendation |
| 6.4 | Adapt shade selection rules | Pick best available shade per profile | Engine | 6.3 | Shade scoring | Tone/undertone drive reference choice | Wrong shade chosen |
| 6.5 | Define fallback for unavailable compatible references | Policy when no shade matches | Engine, packs | 1.4 | Fallback rule (drop/substitute/flag) | Behaviour deterministic + tested | Empty/blocked pack |
| 6.6 | Define product/reference recommendation priorities | Tie-breaking/boost | Engine | 5.5 | Priority handling | Priority influences ranking predictably | Unstable ranking |
| 6.7 | Test recommendation outcomes (realistic beauty cases) | Validate end-to-end | Engine, tests | 6.3–6.6 | Scenario test suite | Tone/undertone/skin-type/concern cases pass | Hidden scoring bugs |

### Phase 7 — Orders, Stock Safety, and Historical Snapshot Adaptation

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 7.1 | Order item snapshot rules | Freeze required fields at purchase | Orders | 1.5,4.2 | Snapshot rule | Snapshot written on both order paths | History drift |
| 7.2 | Reference-level pricing snapshot | Freeze effective unit price | Orders, price | 7.1 | Price snapshot | `unitPriceSnapshot` = effective price at order time | Wrong historical price |
| 7.3 | Product/name/image/shade/SKU snapshots | Extend snapshot columns | Orders | 7.1,3.3 | Extended snapshot | name+sku+shade/size+image+brand frozen | Receipts degrade |
| 7.4 | Stock reservation/release interaction | Atomic decrement/reserve + release on cancel | Stock, orders | 4.7 | Stock-write logic | Conditional guarded decrement; no oversell under concurrency | Overselling / TOCTOU |
| 7.5 | Archive behaviour for ordered products | Safe archive when referenced | Products, orders | 2.4 | Archive guard | Archived product still resolvable in past orders | Broken history |
| 7.6 | Validate historical orders readable after catalog changes | Regression guarantee | Orders | 7.1–7.5 | History regression test | Edit/archive product → old orders unchanged | Silent corruption |

### Phase 8 — Admin Dashboard and Storefront Contract Integration

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 8.1 | Identify impacted admin pages | Scope FE admin changes | Admin dashboard | 4–7 | Admin impact list | Each affected page + endpoint mapped | Missed admin page |
| 8.2 | Identify storefront catalog & PDP endpoints | Scope FE storefront changes | Storefront | 5.7,7.* | Endpoint list | List/detail/slug/filter endpoints defined | Missing endpoint |
| 8.3 | Define pagination/filter/sort/search behaviour | Lock list semantics | Storefront, admin | 5.6 | List behaviour spec | Params + envelopes documented | Inconsistent lists |
| 8.4 | Define product detail response | Final PDP contract | Storefront | 5.7 | PDP contract | Matches conception §9 | PDP gaps |
| 8.5 | Define loading/error/empty-state API behaviour | Predictable FE states | Storefront, admin | 8.2 | State/error spec | Error shape consistent (Nest default) | FE state bugs |
| 8.6 | Confirm frontend-handoff changes | Keep handoff docs accurate | `frontend-handoff/*` | 8.1–8.5 | Updated handoff docs | KNOWN_LIMITATIONS/PAGE_ENDPOINT/ROLE matrices updated | Stale handoff |
| 8.7 | Prepare frontend integration tasks separately | Decouple FE work | FE backlog | 8.6 | FE task list | Tasks scoped + handed off | Coupled releases |

### Phase 9 — Test, Migration, Documentation, and Release Readiness

| Step ID | Step Name | Purpose | Main Areas Impacted | Prerequisites | Deliverables | Verification / Exit Criteria | Risks |
|---|---|---|---|---|---|---|---|
| 9.1 | Database migration test plan | Verify migrations on prod-like data | DB | 3.* | Migration test plan | Forward+rollback rehearsed on snapshot | Migration failure in prod |
| 9.2 | API regression test plan | Catch contract regressions | All endpoints | 4–8 | Regression suite | Public+admin contracts green | Broken API |
| 9.3 | Recommendation regression scenarios | Protect engine | Engine | 6.* | Rec scenario suite | Beauty cases stable vs baseline | Scoring regression |
| 9.4 | Pack regression scenarios | Protect bundles | Packs | 6.* | Pack scenario suite | Fixed/auto packs resolve correctly | Pack regression |
| 9.5 | Order safety regression scenarios | Protect checkout/history | Orders, stock | 7.* | Order scenario suite | No oversell; snapshots intact | Order regression |
| 9.6 | Role & authorization test plan | Protect access control | Auth | 4.9 | Authz test suite | OWNER/ADMIN/STAFF matrix enforced | Privilege leak |
| 9.7 | Performance & N+1 review | Protect mobile perf | Storefront, orders | 5.7,7.4 | Perf report | PDP/list queries batched; no hot N+1 | Slow storefront |
| 9.8 | Documentation updates | Keep docs truthful | docs/, handoff | 8.6 | Updated docs | Analysis/conception/handoff aligned | Doc drift |
| 9.9 | Deployment & rollback checklist | Safe release | Ops | 9.1–9.8 | Release runbook | Go/no-go + rollback steps defined | Unsafe deploy |

---

## 6. Dependency Graph

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

- **Expand → migrate → contract** for every risky change. New fields land **nullable/additive** first; backfill (`referenceName`→`shadeName`, snapshot enrichment); only then tighten constraints.
- **Visibility contract:** keep `status` + `isActive` physically during a compat window; switch reads to the single source of truth; remove redundancy only after all consumers migrated. *(`products.service.ts` `publicProductWhere`.)*
- **Stock decrement:** introduce guarded conditional decrement behind validation; never retro-apply to historical orders.
- **Order snapshots:** new snapshot columns nullable + backfilled from current product/reference; old orders keep working via existing FKs (`Restrict`) and current snapshot fields. *(`prisma/schema.prisma` `OrderItem`.)*
- **Locked relations preserved:** no migration may violate `onDelete: Restrict` (orders/packs/recs) or `Cascade`/`SetNull` semantics. *(Phase 3.6.)*
- **API additive-first:** new response fields are additive; breaking shape changes are versioned/announced via handoff. *(`frontend-handoff/*`.)*
- **Every migration reversible** (Phase 3.5 playbook); baseline tagged (Phase 0.5).

---

## 8. Test Strategy by Phase

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

1. **After Phase 1.7** — signed-off capability matrix + the 12 business decisions (no schema work begins without this).
2. **After Phase 2.8** — approved data model, lifecycle, public/admin field visibility, and migration strategy.
3. **After Phase 3.5/3.6** — migration order, backfill, rollback, and FK-safety sign-off before any migration is written.
4. **Before Phase 7 deploy** — explicit approval of the stock-decrement timing and order-snapshot field set (irreversible behavioural change).
5. **After Phase 8.6 / before Phase 9 release** — frontend-handoff acceptance + deployment/rollback go/no-go.

---

## 11. Suggested First Implementation Task

**Phase 0, Step 0.2 — "Build the verified Product/ProductReference consumer map."**

A documentation-only task: enumerate every backend reader and writer of `Product` and `ProductReference` (products, product-references, packs, recommendations, orders, media, storefront controllers/services) and every public/admin contract field that depends on them, cross-checked against `prisma/schema.prisma` relations and `frontend-handoff/PAGE_ENDPOINT_MAPPING.md`.

**Why this first:** it is small, safe, touches no code or schema, and produces the single artifact every later phase depends on (the backward-compatibility risk register). It directly de-risks the two critical fixes (stock decrement, order snapshots) by proving exactly who consumes the data before anything changes. It also validates whether `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` is still accurate, satisfying Phase 0's exit criteria.
