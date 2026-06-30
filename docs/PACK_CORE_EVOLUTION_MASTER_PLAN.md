# Pack Core Evolution — Master Plan

> **Companion to** [PACK_CURRENT_STATE_ANALYSIS.md](./PACK_CURRENT_STATE_ANALYSIS.md) and [PACK_CORE_EVOLUTION_GAP_ANALYSIS.md](./PACK_CORE_EVOLUTION_GAP_ANALYSIS.md).
> **This document is a phased migration plan, not an implementation.** No code, schema, migrations, APIs, tests, or seed data are changed here.
> **Guiding principle:** every change is **additive and backward-compatible**. Existing fixed/auto packs, the funnel `POST /orders` contract, the cart `POST /orders/checkout` contract, public pack reads, admin pack CRUD, recommendation determinism, and order/line snapshots must keep working byte-for-byte until intentionally evolved.

---

## 0. How to read this plan

- The phase order below **adapts** the suggested order from the brief based on real repository facts. The most important adaptation: **a small recommendation-eligibility fix (Phase 1) and an architectural decision on the configured-pack entity (Phase 0) must precede any customization code**, because the engine currently *excludes* customer-choice packs and there is no entity to hold a customer configuration.
- Phases 0–4 are **MVP-enabling and low-risk** (foundations, safety, discovery, fixed-pack selling). Phases 5–9 deliver **customization and configured purchase**. Phase 10 is **future/optional** (quiz-generated packs). Phase 11 is **hardening/rollout**.
- Each phase lists likely-affected modules using real paths so it can be turned into implementation tasks directly.

---

## Architecture decisions (answer these before Phase 2 code)

These map to the brief's "Critical Architecture Questions". They must be ratified in Phase 0.

**Q1 — Is the existing Pack model a suitable base?**
Yes, as the **catalog/template** layer. `Pack` + `PackItem` + `PackAttribute` are a sound admin-curated definition. They should **not** be overloaded to also store customer choices. Evolve `Pack`/`PackItem` additively (roles, rule fields, discovery fields) and add a **separate customer-configuration entity** for runtime choices.

**Q2 — One entity, separate entities, or pack + configuration entity?**
**One `Pack` entity (with a mode/role layer) + one `PackConfiguration` entity for customer choices.** Fixed, customizable, quiz-recommended, and quiz-generated packs are all the *same* catalog object differentiated by a `Pack.kind`/`isCustomizable` flag and item roles; the *difference at runtime* is captured by `PackConfiguration.sourceType` (`FIXED` / `CUSTOMIZED` / `QUIZ_RECOMMENDED` / `QUIZ_GENERATED`). Quiz-generated packs are configurations whose `sourcePackId` is null. This avoids four divergent entities and a re-migration later.

**Q3 — Safest way to represent item types?**
Introduce a `PackItemRole` enum: `FIXED`, `REQUIRED_SELECTABLE`, `OPTIONAL_INCLUDED`, `OPTIONAL_ADDON`. Add it additively to `PackItem` with a **backfill default of `FIXED`** for existing rows. Keep `selectionMode`/`isRequired` during transition (derive role from them initially), then make role authoritative. This preserves all current packs.

**Q4 — Preserve existing behavior while introducing customization?**
Gate everything behind `Pack.isCustomizable = false` (default). Non-customizable packs follow today's exact code paths. Customization fields are nullable/defaulted so existing packs validate unchanged. The engine's fixed/auto scoring is untouched; only the (currently dead) `CUSTOMER_CHOICE` branch changes.

**Q5 — How should pricing work?**
- **Default pack price:** existing `priceMode` (`FIXED` / `SUM_ITEMS` / `SUM_ITEMS_WITH_DISCOUNT`) — unchanged.
- **Original total value (marketing):** Σ(`compareAtPrice` or effective price) of base items — computed, not stored on Pack; snapshot at config/order if displayed.
- **Removed optional items / added add-ons / replacements / quantity:** recompute the configured subtotal server-side from the *current* allowed selections using `effectiveProductReferencePrice` ([orders.service.ts:951](../src/modules/orders/orders.service.ts#L951)) — never trust client prices.
- **Minimum final price:** new `Pack.minAllowedPrice`; reject configured price `< minAllowedPrice`.
- **Future margin:** Σ(reference cost × qty) vs. price; advisory first, hard block later (Phase 10+).

**Q6 — How should availability be calculated?**
Pack is purchasable when: `status=ACTIVE && isActive` AND every `FIXED`/`REQUIRED_SELECTABLE` slot has ≥1 active reference with `availableStock ≥ requiredQty`. Optional items/add-ons never block availability. Reuse `availableReferenceStock` ([packs.service.ts:1181](../src/modules/packs/packs.service.ts#L1181)) and the reference-loading filter from `loadActivePacks` ([recommendations.service.ts:390](../src/modules/recommendations/recommendations.service.ts#L390)).

**Q7 — Recommendation change for `CUSTOMER_CHOICE`?**
In `selectReference` ([recommendation-engine.service.ts:304](../src/modules/recommendations/recommendation-engine.service.ts#L304)), a `REQUIRED_SELECTABLE`/`CUSTOMER_CHOICE` slot must return an **"eligible, selection pending"** result when ≥1 compatible available reference exists (using `isReferenceCompatibleWithAnswers`), instead of `null`. The pack stays recommendable; the slot is flagged for the customer. Only return `null` (and thus exclude a required slot) when **zero** valid options exist.

**Q8 — What must be saved when adding a configurable/generated pack to cart?**
A `PackConfiguration`: `sourcePackId` (nullable for generated), `sourceType`, selected references per slot, final quantities, removed optional ids, added add-ons, computed final price, applied discount, min-price + stock validation result, currency, and (for quiz flows) the originating `recommendationResultId` — **without** copying private quiz answers.

**Q9 — What must be snapshotted at order creation?**
Keep today's per-line snapshots (already robust). **Add** a pack-config snapshot on the order: source pack id+name, source type, removed/added items, final validated price, floor, and validation outcome — frozen and never mutated. This guarantees historical safety even if the pack/product/stock changes later.

**Q10 — MVP vs. Phase 2 vs. future?**
- **MVP (Phases 1–4):** stabilize eligibility; item-role foundation; price/stock/order-snapshot safety; discovery filters; **fixed-pack direct purchase**.
- **Phase 2 (Phases 5–9):** controlled customization; configured-pack persistence; configured cart/order; admin customization management; wishlist/share; quiz-preconfigured packs.
- **Future (Phase 10+):** quiz-generated packs; cost-based margin protection; reviews/recently-viewed.

**Q11 — Quiz-generated packs without an uncontrolled dynamic cart?**
Generation must output a **validated `PackConfiguration`** (same entity as customization), not loose cart lines. The cart/checkout only ever accepts a configuration id that the server re-validates (allowed composition, stock, min price). There is no path to inject arbitrary lines under a pack — generation is bounded by the same rules engine as customization.

**Q12 — Biggest risks?** Stock oversell (mitigated by atomic reservation, already present); price manipulation (mitigated by server-side pricing only); customer tampering with composition (mitigated by server-authoritative validation against allowed sets); invalid/stale references (re-validate at every step); stale recommendations (re-validate at checkout); order consistency (immutable snapshots); backward compatibility (`RecommendationResultItem.selectedProductReferenceId` is NOT NULL — see Phase 1 risk).

---

## Phase 0 — Current-state confirmation & architectural decisions

- **Objective:** ratify the architecture decisions above; lock the configured-pack entity shape; confirm backward-compat constraints.
- **Business value:** prevents a costly re-migration of the central object.
- **Scope:** documentation + decision sign-off only. No code.
- **Modules/files:** these three docs; `prisma/schema.prisma` (review only).
- **Data model evolution:** decide (not apply) `PackItemRole`, `Pack.isCustomizable`, `Pack.minAllowedPrice`, `PackConfiguration` shape, and the `RecommendationResultItem.selectedProductReferenceId` nullability question.
- **API / validation / migration / impact:** none yet.
- **Tests:** none.
- **Acceptance criteria:** signed-off answers to Q1–Q12; agreed entity diagram for `PackConfiguration`.
- **Risks/rollback:** none (no code).

---

## Phase 1 — Stabilize recommendation eligibility for customer-choice slots

- **Objective:** make the engine treat a required selectable slot as "eligible, pending selection" when valid options exist, instead of dropping the pack. Ship this **before** customization so the engine is ready.
- **Business value:** unblocks the core conception rule (§2.7); prevents packs from silently vanishing once customer-choice items exist.
- **Scope:** engine selection logic + its tests; no customer-facing customization yet.
- **Modules/files:** [recommendation-engine.service.ts](../src/modules/recommendations/recommendation-engine.service.ts) (`selectReference` 304, `scorePack` 220); [recommendation-engine.service.spec.ts](../src/modules/recommendations/recommendation-engine.service.spec.ts) (replace the line-558 "not implemented" test); [recommendations.service.ts](../src/modules/recommendations/recommendations.service.ts) persistence (`create` 41) if a "pending" item must be stored.
- **Data model evolution:** likely none if "pending" is represented in the response only. If a pending slot must persist as a `RecommendationResultItem`, widen `RecommendationResultItem.selectedProductReferenceId` to nullable (additive, backward-compatible) — **decide in Phase 0**.
- **API evolution:** recommendation response marks slots needing customer choice + candidate references; existing fields preserved.
- **Validation/business rules:** pack excluded only when a required slot has **zero** valid compatible available references.
- **Backward compatibility:** fixed/auto packs score identically (the changed branch is currently dead because admin blocks `CUSTOMER_CHOICE`). Persisted historical results unaffected.
- **Migration strategy:** none, or one additive nullable-widening.
- **Admin / public-store / cart-order impact:** none yet (customer-choice packs still can't be created until Phase 2/5).
- **Recommendation impact:** core (intended).
- **Tests:** new unit tests: pack with a customer-choice slot stays recommendable with ≥1 option; excluded with 0 options; fixed/auto unchanged.
- **Swagger/OpenAPI:** regenerate (response gains optional fields).
- **Docs:** update recommendation behavior notes.
- **Acceptance criteria:** a pack with a required selectable item and ≥1 compatible in-stock reference appears in recommendations with that slot flagged "selection required".
- **Risks/rollback:** NOT-NULL constraint on `RecommendationResultItem`; mitigate per Phase 0. Rollback = revert engine branch.

> **Implementation note (Phase 1 — done).** `selectReference` now delegates `CUSTOMER_CHOICE` slots to a new `selectCustomerChoice` helper that reuses the existing `isReferenceAvailable` + `isReferenceCompatibleWithAnswers` filters. It returns an "eligible, selection pending" `SelectedRecommendationItem` (`referenceId: null`, `selectionRequired: true`, `scoredForAverage: false`, plus an `availableOptions` list) when ≥1 valid candidate exists, and only `null` (excluding the pack on a required slot) when there are zero candidates. Pending slots do not contribute to scoring, so fixed/auto packs score byte-identically. **No Prisma migration was taken (Option A):** the pending state lives in the runtime `POST /recommendations` response only; `recommendations.service.create` skips persisting pending slots (the NOT-NULL `selectedProductReferenceId` is untouched), so stored historical results are unaffected. Follow-up: when customer-choice packs become orderable (Phases 5/9), persisting a pending slot will require widening `selectedProductReferenceId` to nullable or a dedicated marker.

---

## Phase 2 — Pack item roles & customization-rule foundation (data only)

- **Objective:** introduce the role taxonomy and rule fields as **additive, defaulted** schema, without behavior change.
- **Business value:** the structural base for all customization.
- **Scope:** schema + admin read/write of the new fields; no runtime customization behavior yet.
- **Modules/files:** `prisma/schema.prisma` (`Pack` 450, `PackItem` 483); [packs.service.ts](../src/modules/packs/packs.service.ts) (`resolveItems` 917, selects); [dto/pack-item-input.dto.ts](../src/modules/packs/dto/pack-item-input.dto.ts), [dto/create-pack.dto.ts](../src/modules/packs/dto/create-pack.dto.ts), [dto/update-pack.dto.ts](../src/modules/packs/dto/update-pack.dto.ts).
- **Data model evolution (additive):**
  - `enum PackItemRole { FIXED, REQUIRED_SELECTABLE, OPTIONAL_INCLUDED, OPTIONAL_ADDON }`.
  - `PackItem.role PackItemRole @default(FIXED)`, `minQuantity Int?`, `maxQuantity Int?`, `quantityEditable Boolean @default(false)`, `removalAllowed Boolean @default(false)`, `replacementAllowed Boolean @default(false)`.
  - `Pack.isCustomizable Boolean @default(false)`, `minRequiredItems Int?`, `maxItemCount Int?`, `minAllowedPrice Decimal?`.
  - New `PackItemAllowedReference` (item ↔ allowed reference) and `PackAllowedAddOn` (pack ↔ allowed product/reference) tables.
- **API evolution:** DTOs gain optional fields; responses include role/rules. Defaults reproduce current behavior.
- **Validation/business rules:** if `isCustomizable=false`, ignore rule fields (current path). Still reject `CUSTOMER_CHOICE` selectionMode until Phase 5 wires behavior (or map it to `REQUIRED_SELECTABLE` role internally).
- **Backward compatibility:** existing packs backfill `role=FIXED`, `isCustomizable=false` → byte-identical behavior.
- **Migration strategy:** additive columns/tables + backfill; no drops/renames.
- **Admin impact:** can set roles/rules (inert until Phase 5).
- **Public-store / recommendation / cart-order impact:** none.
- **Tests:** schema/DTO round-trip; existing pack tests still pass; backfill correctness.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** document the role taxonomy.
- **Acceptance criteria:** new fields persist and read back; all current pack/recommendation/order tests green; default-created packs behave exactly as before.
- **Risks/rollback:** low (inert fields). Rollback = drop additive columns.

---

## Phase 3 — Strengthen pack stock, pricing & order-snapshot safety

- **Objective:** add the minimum-price concept and a pack-config snapshot capability **before** customers can configure, so the safety net exists first.
- **Business value:** prevents below-floor sales and guarantees historical safety once configuration ships.
- **Scope:** pricing helpers, order snapshot fields; min-price validation plumbing (enforced fully in Phase 5/6).
- **Modules/files:** [orders.service.ts](../src/modules/orders/orders.service.ts) (`calculateOrderPrice` 839, `calculateCartOrderPrice` 666); [packs.service.ts](../src/modules/packs/packs.service.ts) (`validatePricing` 868); `prisma/schema.prisma` (`Order` 669 / `OrderItem` 710).
- **Data model evolution (additive):** `Order.packConfigurationSnapshot Json?` (or `OrderPackConfiguration` table) to freeze source pack id/name, source type, removed/added items, final price, floor, validation. (`minAllowedPrice` added in Phase 2.)
- **API evolution:** admin order detail surfaces the snapshot when present.
- **Validation/business rules:** a reusable `assertAboveMinPrice(finalPrice, pack.minAllowedPrice)` helper; reusable pack-config snapshot builder.
- **Backward compatibility:** snapshot column nullable; existing orders/lines untouched; price modes unchanged.
- **Migration strategy:** additive.
- **Admin impact:** richer order detail.
- **Recommendation impact:** none.
- **Cart/order impact:** order creation can (optionally) write a pack-config snapshot; not required until Phase 6.
- **Tests:** min-price helper; snapshot builder; existing order pricing tests unchanged.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** pricing/floor + snapshot conventions.
- **Acceptance criteria:** below-floor configured prices are rejectable via the helper; a snapshot can be attached to an order and read back unchanged.
- **Risks/rollback:** low. Rollback = drop snapshot column + helper.

---

## Phase 4 — Public catalog discovery, filtering & fixed-pack purchase

- **Objective:** make packs behave like real storefront products: filterable discovery + ability to buy a **fixed** pack directly.
- **Business value:** the public Pack catalog and the first real "buy a pack" path — high commercial value, low customization risk.
- **Scope:** public list filters + availability flag; fixed-pack-to-order path.
- **Modules/files:** [packs.controller.ts](../src/modules/packs/packs.controller.ts), [packs.service.ts](../src/modules/packs/packs.service.ts) (`findAll` 209); new `QueryPublicPacksDto`; [orders.service.ts](../src/modules/orders/orders.service.ts) (reuse `createFromCart`/`create`), [orders.controller.ts](../src/modules/orders/orders.controller.ts); `prisma/schema.prisma` (`Pack`).
- **Data model evolution (additive):** discovery fields on `Pack`: `categoryId?` (or `PackCategory`), `tier`, `occasion`, `experienceLevel`, `isFeatured`/`isNew`/`isBestSeller`, `tags String[]`, `searchKeywords`. Skin-compat facets reuse `PackAttribute` (no new columns).
- **API evolution:**
  - `GET /packs` gains optional query params (category, tier, priceRange, style, occasion, experienceLevel, skin compat, customizable, availableNow, featured, tags, search, sort, page). **No params ⇒ current behavior.**
  - New fixed-pack order path: either `POST /packs/:id/order` or `packId` group support in checkout. Server expands the fixed pack into priced lines (each item's fixed reference; reject required slots without a fixed reference), applies the pack price mode, reserves stock, snapshots lines, sets `OrderItem.packId`.
- **Validation/business rules:** only `isCustomizable=false` packs allowed on the fixed-purchase path in this phase; availability per Q6.
- **Backward compatibility:** existing endpoints unchanged; new params/route additive.
- **Migration strategy:** additive columns + indexes.
- **Admin impact:** manage discovery fields (DTO extension).
- **Public-store impact:** full browse/filter/detail/buy for fixed packs.
- **Recommendation impact:** none (could later use category/tier).
- **Cart/order impact:** fixed packs become orderable units.
- **Tests:** filter combinations; availability calc; fixed-pack order pricing matches pack price mode; stock reserved; rejects unavailable/customizable packs.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** discovery params + fixed-pack purchase flow.
- **Acceptance criteria:** a shopper can filter packs and place a COD order for a fixed pack as one unit with correct price and stock effects.
- **Risks/rollback:** price mismatch (pack price vs. line sum) — reconcile per gap 2.3; perf on availability — consider denormalized availability. Rollback = remove route/params.

---

## Phase 5 — Controlled customizable Pack rules & configuration validator

- **Objective:** enable real customization (select shades, remove optional, change qty, add add-ons, replace) governed by server-authoritative rules.
- **Business value:** the customizable Pack — the differentiator.
- **Scope:** activate roles/rules from Phase 2; build the validator; allow `CUSTOMER_CHOICE`/`REQUIRED_SELECTABLE` at admin write.
- **Modules/files:** [packs.service.ts](../src/modules/packs/packs.service.ts) (`resolveItems` 917 — stop rejecting customer-choice when allowed; new validator); new `pack-configuration.validator`; [recommendation-engine.service.ts](../src/modules/recommendations/recommendation-engine.service.ts) (uses Phase 1 eligibility).
- **Data model evolution:** uses Phase 2 tables (`PackItemAllowedReference`, `PackAllowedAddOn`, role, min/max qty, removal/replacement flags, min items/max count/min price). No new tables beyond Phase 2 unless replacements need a dedicated `PackItemAllowedReplacement`.
- **API evolution:** `POST /packs/:id/validate-configuration` returning validity, computed price, floor status, stock status, and normalized selection. Read-only — does not persist (persistence is Phase 6).
- **Validation/business rules (server-authoritative):** required items present; each required-selectable slot has a chosen allowed+available reference; removals only where `removalAllowed`; quantities within `[minQuantity,maxQuantity]`; add-ons only from allowed set; total item count ≤ `maxItemCount`; ≥ `minRequiredItems`; computed price ≥ `minAllowedPrice`; currency consistent.
- **Backward compatibility:** non-customizable packs bypass the validator entirely. Existing "reject CUSTOMER_CHOICE" tests are **intentionally updated** to "reject unless pack is customizable and slot is REQUIRED_SELECTABLE".
- **Migration strategy:** none beyond Phase 2.
- **Admin impact:** define allowed references/add-ons/replacements and limits.
- **Public-store impact:** customers can preview a valid configuration (no checkout yet).
- **Recommendation impact:** customer-choice packs now creatable and recommendable (Phase 1).
- **Cart/order impact:** none yet (validation only).
- **Tests:** each rule (happy + violation); price-floor breach; stock breach; add-on/replacement allow-list enforcement; tamper attempts (disallowed reference/add-on) rejected.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** customization rules reference.
- **Acceptance criteria:** a configuration violating any rule is rejected server-side with a clear reason; a valid one returns a correct computed price ≥ floor.
- **Risks/rollback:** validator drift vs. client preview (server is authoritative); combinatorial complexity (start with select/remove/qty; replacements last). Rollback = keep `isCustomizable=false` everywhere.

---

## Phase 6 — Customer final Pack configuration persistence + configured checkout

- **Objective:** persist a customer's configuration and let them check it out (COD), with full snapshotting.
- **Business value:** completes the customizable purchase loop.
- **Scope:** `PackConfiguration` entity; configured checkout; order pack-config snapshot.
- **Modules/files:** new `pack-configurations` module (or extend `packs`); [orders.service.ts](../src/modules/orders/orders.service.ts) (`createFromCart` 187 reuse: customer/address/price/stock/snapshot); `prisma/schema.prisma`.
- **Data model evolution (additive):** `PackConfiguration` (`id`, `sourcePackId?`, `sourceType`, `recommendationResultId?`, `finalPrice`, `currency`, `validationJson`, `shareToken?`, timestamps) + `PackConfigurationItem` (`role`, `productId`, `productReferenceId`, `quantity`, `unitPrice`, `removed`, `isAddOn`). Reuses the Phase 3 order snapshot.
- **API evolution:** `POST /packs/:id/configurations` (create/validate+persist), `GET /configurations/:id`; checkout accepts a `configurationId`. Server re-validates against live allowed sets/stock/min-price before ordering.
- **Validation/business rules:** re-run the Phase 5 validator at persist and again at checkout (stock/price can change); freeze the snapshot at order creation.
- **Backward compatibility:** new module/routes; existing order paths unchanged; `selectedPackId`/`OrderItem.packId` reused.
- **Migration strategy:** additive tables.
- **Admin impact:** view configurations behind orders.
- **Public-store impact:** configure → review → COD for customizable packs.
- **Recommendation impact:** none directly (preconfigured flow is Phase 9).
- **Cart/order impact:** configured pack becomes an order with a frozen pack-config snapshot + line snapshots.
- **Tests:** persist/read configuration; checkout from configuration; re-validation rejects stale/below-floor/out-of-stock; snapshot immutability after catalog change.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** configuration lifecycle + snapshot guarantees.
- **Acceptance criteria:** a customer configures a customizable pack, checks out COD, and the resulting order preserves the exact configuration + prices even after the pack/product later changes.
- **Risks/rollback:** stale configuration vs. live stock (re-validate); over-engineering a server cart (prefer configuration-id-at-checkout, not a full cart subsystem). Rollback = disable configured checkout route.

---

## Phase 7 — Admin management for customization & compatibility

- **Objective:** give admins full, ergonomic control over customization rules, allowed sets, discovery taxonomy, and min price.
- **Business value:** operational self-service for the new model.
- **Scope:** admin DTO/UI surface for everything added in Phases 2–6.
- **Modules/files:** [admin-packs.controller.ts](../src/modules/packs/admin-packs.controller.ts), [packs.service.ts](../src/modules/packs/packs.service.ts) (admin create/update/validate), DTOs.
- **Data model evolution:** none new (uses prior phases).
- **API evolution:** extend admin create/update to manage allowed references/add-ons/replacements, roles, limits, min price, discovery fields; admin validation preview.
- **Validation/business rules:** admin save-time validation (e.g., a customizable pack must have ≥1 valid option per required-selectable slot; min price ≤ default price).
- **Backward compatibility:** additive DTO fields; existing admin contract preserved.
- **Migration strategy:** none.
- **Admin / public / recommendation / cart-order impact:** admin only.
- **Tests:** admin can configure a full customizable pack; invalid admin configs rejected.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** admin guide (extend [ADMIN_RULES_GUIDE.md](./ADMIN_RULES_GUIDE.md)).
- **Acceptance criteria:** an admin can build a complete customizable pack end-to-end through the API and it validates.
- **Risks/rollback:** DTO bloat; keep optional/additive.

---

## Phase 8 — Wishlist & sharing foundations

- **Objective:** add engagement features: wishlist + shareable links (public packs and configured packs) with privacy-safe previews.
- **Business value:** retention, virality, social proof.
- **Scope:** wishlist CRUD; share tokens + social metadata.
- **Modules/files:** new `wishlist` + `sharing` modules; reuse `CustomerProfile.sessionToken` ([schema:239](../prisma/schema.prisma#L239)) / `Customer` for ownership; `PackConfiguration.shareToken` (Phase 6).
- **Data model evolution (additive):** `Wishlist`/`WishlistItem` tables; `shareToken` index on `PackConfiguration`.
- **API evolution:** add/remove/list wishlist; create/read share link; OG-metadata endpoint for SSR previews.
- **Validation/business rules:** shared configured-pack payloads expose composition but **strip all `CustomerProfileAnswer`/quiz data** (conception §2.8).
- **Backward compatibility:** new modules; nothing existing changes.
- **Migration strategy:** additive.
- **Admin impact:** optional analytics on wishlist/shares.
- **Public-store impact:** wishlist + share UX.
- **Recommendation impact:** wishlist could later be a signal (out of scope here).
- **Cart/order impact:** none.
- **Tests:** wishlist by session/customer; share token resolves; shared payload contains no quiz answers.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** wishlist/share contracts + privacy note.
- **Acceptance criteria:** a configured pack can be shared via a link that renders a preview without leaking quiz answers; items can be wishlisted and listed.
- **Risks/rollback:** identity without accounts (only session tokens today) — scope wishlist to session/customer phone; token guessability — use unguessable tokens.

---

## Phase 9 — Quiz-preconfigured existing Packs

- **Objective:** let the quiz hand the customer a recommended pack, have them pick required shades, and add the configured pack to cart/checkout.
- **Business value:** closes the quiz → personalized purchase loop using existing packs.
- **Scope:** bridge recommendation results into editable `PackConfiguration`s.
- **Modules/files:** [recommendations.service.ts](../src/modules/recommendations/recommendations.service.ts), [recommendation-engine.service.ts](../src/modules/recommendations/recommendation-engine.service.ts) (Phase 1 eligibility), new "configure from recommendation" path, `PackConfiguration` (Phase 6).
- **Data model evolution:** `PackConfiguration.sourceType=QUIZ_RECOMMENDED`, `recommendationResultId` link (no quiz answers copied).
- **API evolution:** `POST /recommendations/:resultId/configure` → a `PackConfiguration` with required-selectable slots pending; then Phase-6 configured checkout.
- **Validation/business rules:** required-selectable slots must be chosen before checkout; re-validate stock/price/floor at checkout.
- **Backward compatibility:** existing `POST /orders` funnel (engine-auto reference) remains for fixed/auto packs; preconfigured path is additive.
- **Migration strategy:** none beyond Phase 6.
- **Admin impact:** none.
- **Public-store impact:** quiz results become configurable+buyable.
- **Recommendation impact:** uses Phase 1 eligibility for customer-choice packs.
- **Cart/order impact:** configured-from-quiz orders carry source type + snapshot.
- **Tests:** recommend a customer-choice pack → configure shades → checkout; pending slot blocks checkout; privacy (no answers in configuration/share).
- **Swagger/OpenAPI:** regenerate.
- **Docs:** quiz→configure→buy flow.
- **Acceptance criteria:** a quiz-recommended customizable pack can be completed by the customer choosing required shades and ordered COD.
- **Risks/rollback:** consistency between recommendation snapshot and live stock; mitigate with checkout-time re-validation.

---

## Phase 10 — Quiz-generated Packs (future; only when prerequisites are safe)

- **Objective:** dynamically build a pack composition from a profile, as a validated `PackConfiguration`.
- **Business value:** fully personalized packs.
- **Scope:** generation algorithm bounded by the customization rules engine.
- **Preconditions:** Phases 1, 5, 6, 9 proven; margin/min-price enforcement solid.
- **Modules/files:** recommendation module (new generation service), `PackConfiguration` (`sourceType=QUIZ_GENERATED`, `sourcePackId=null`).
- **Data model evolution:** `PackConfiguration` already supports null source pack; possibly generation templates/guardrail config.
- **API evolution:** `POST /recommendations/:profileId/generate-pack` → validated configuration for review → Phase-6 checkout.
- **Validation/business rules:** generation must produce only allowed/available compositions, priced ≥ floor (and ≥ margin when Phase-10 margin lands); **no path to arbitrary cart lines** (architecture Q11).
- **Backward compatibility:** additive; everything else untouched.
- **Migration strategy:** additive.
- **Admin impact:** generation guardrails.
- **Public-store / recommendation / cart-order impact:** new generated-pack flow reusing configured checkout.
- **Tests:** generated pack always valid + above floor + in stock; cannot bypass rules; margin (if enabled) respected.
- **Swagger/OpenAPI:** regenerate.
- **Docs:** generation design + guardrails.
- **Acceptance criteria:** generated packs are always valid, purchasable configurations that obey every customization/price/stock rule.
- **Risks/rollback:** uncontrolled dynamic cart, price/stock/margin abuse — highest risk; keep behind a flag; rollback = disable generation route.

---

## Phase 11 — Regression, documentation & rollout

- **Objective:** full regression, doc refresh, staged rollout.
- **Business value:** safe launch.
- **Scope:** end-to-end tests across funnel + store + customization; refresh stale docs; feature-flag rollout.
- **Modules/files:** test suites across `orders`, `packs`, `recommendations`; [docs/openapi.json](./openapi.json)/[openapi.yaml](./openapi.yaml); [frontend-handoff/](../frontend-handoff/); refresh stale [backend-store-gap-confirmation.md](./backend-store-gap-confirmation.md) (note: it already misstates `selectedPackId` and the cart endpoint).
- **Data model evolution:** none.
- **API evolution:** finalize; deprecate nothing without notice.
- **Validation/business rules:** confirm server authority everywhere (no client-trusted prices/compositions).
- **Backward compatibility:** verify old funnel + cart contracts unchanged.
- **Migration strategy:** confirm all migrations were additive; verify rollback paths.
- **Admin/public/recommendation/cart-order impact:** verification across all.
- **Tests:** regression matrix; load/perf on filtered pack list + availability; tamper/security tests.
- **Swagger/OpenAPI:** final regenerate + publish.
- **Docs:** update all handoff docs; mark superseded docs.
- **Acceptance criteria:** all legacy flows pass unchanged; new flows pass; OpenAPI current; stale docs corrected.
- **Risks/rollback:** feature flags per phase enable targeted rollback.

---

## Cross-phase backward-compatibility & risk register

| Risk | Where | Mitigation |
| --- | --- | --- |
| `RecommendationResultItem.selectedProductReferenceId` NOT NULL blocks "pending" slots | [schema:607](../prisma/schema.prisma#L607) | Decide in Phase 0; widen to nullable (additive) or represent pending in response only |
| Pack `FIXED` price ≠ sum of line snapshots | [orders.service.ts:879](../src/modules/orders/orders.service.ts#L879) | Reconcile: store pack price as subtotal + explicit adjustment line, or document the chosen rule |
| Client-supplied prices/compositions (tampering) | all configure/checkout paths | Price + validate **server-side only**; never trust client values (matches today's design) |
| Stock oversell | configured checkout | Reuse atomic `reserveForNewOrder` ([order-stock.service.ts:16](../src/modules/orders/order-stock.service.ts#L16)); re-validate at checkout |
| Stale recommendation/configuration vs. live catalog | Phases 6/9/10 | Re-validate stock/price/floor at checkout; immutable order snapshot |
| Quiz answer leakage via share | Phase 8 | Strip `CustomerProfileAnswer` from shared/configured payloads |
| Wholesale item replacement on `PATCH /admin/packs` losing rules | [packs.service.ts:407](../src/modules/packs/packs.service.ts#L407) | Ensure allowed-set/role data is re-applied or preserved on item replacement |
| Existing "CUSTOMER_CHOICE rejected/unimplemented" tests | [packs.service.admin.spec.ts:300](../src/modules/packs/packs.service.admin.spec.ts#L300), [recommendation-engine.service.spec.ts:558](../src/modules/recommendations/recommendation-engine.service.spec.ts#L558) | These are guardrails; intentionally update them in Phases 1/5, don't silently break |
| Discovery filter perf as catalog grows | Phase 4 | Index discovery columns; consider denormalized availability cache |

---

## MVP / Phase-2 / Future split (quick reference)

- **MVP (Phases 1–4):** eligibility fix · item-role + rule schema · price/stock/order-snapshot safety · public discovery + **fixed-pack purchase**.
- **Phase 2 (Phases 5–9):** customization rules + validator · configured-pack persistence + checkout · admin management · wishlist + sharing · quiz-preconfigured packs.
- **Future (Phase 10–11):** quiz-generated packs · cost-based margin · full regression/rollout. (Reviews, recently-viewed, server-side cart subsystem remain deferred.)
