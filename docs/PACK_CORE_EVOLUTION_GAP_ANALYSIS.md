# Pack Core Evolution — Gap Analysis

> **Companion to** [PACK_CURRENT_STATE_ANALYSIS.md](./PACK_CURRENT_STATE_ANALYSIS.md). Read that first for the current-state evidence; this document compares it against the target Pack Core conception and quantifies every gap.
> **Analysis only** — no code/schema/API/test/seed changes.
> **Legend — Gap level:** `none` (already works) · `small` (additive field/param) · `medium` (new logic + additive schema) · `large` (new entities + flows) · `architectural` (cross-cutting design decision required first).
> **Reuse legend:** ✅ reuse as-is · ♻️ exists but must evolve · 🆕 does not exist · ⏸️ postpone.

---

## 1. Summary scorecard

| # | Target capability | Status | Gap level |
| --- | --- | --- | --- |
| 1 | Public Pack catalog (browse/detail/COD) | ♻️ display only; no direct purchase | medium |
| 2 | Filtering & discovery (category, tier, style, occasion, availability, search) | 🆕 none on Pack | large |
| 3 | Fixed Pack selling (add-to-cart & order as a unit) | 🆕 no pack-to-cart/order path | medium |
| 4 | Customizable Pack behavior | 🆕 explicitly blocked | architectural |
| 5 | Required selectable items (shade choice) | ♻️ engine auto-selects; customer cannot | large |
| 6 | Optional included items (removable) | ♻️ `isRequired=false` exists; no removal flow | medium |
| 7 | Optional add-ons | 🆕 none | large |
| 8 | Quantity changes by customer | 🆕 none (qty is admin-fixed) | medium |
| 9 | Product / reference replacements | 🆕 none | large |
| 10 | Minimum Pack price | 🆕 no field, no enforcement | medium |
| 11 | Margin protection (cost-based) | 🆕 `costPrice` unused | medium |
| 12 | Pack-level discount / value | ✅ exists (3 price modes) | none |
| 13 | Pack item pricing (stored per item) | 🆕 derived only | small |
| 14 | Pack stock availability (derived) | ♻️ logic exists, not exposed | medium |
| 15 | Reference-level availability | ✅ implemented | none |
| 16 | Quiz eligibility w/ customer-choice items | 🆕 broken-by-design | medium |
| 17 | Quiz recommendation of existing packs | ✅ works (fixed/auto) | small |
| 18 | Quiz preconfigured Pack (choose shade then add) | ♻️ recommendation exists; no customer selection | large |
| 19 | Quiz-generated Pack | 🆕 none | architectural / ⏸️ |
| 20 | Wishlist | 🆕 none | medium |
| 21 | Sharing (public + configured) | ♻️ slug exists; no share/meta/config link | medium |
| 22 | Configured Pack persistence | 🆕 none | large |
| 23 | Cart snapshot (pack config) | 🆕 no server cart | large |
| 24 | Order snapshot (pack config) | ♻️ line snapshots solid; no pack-config snapshot | medium |
| 25 | Admin Pack management | ♻️ solid base; no customization/discovery fields | medium |
| 26 | Pack media | ✅ implemented | none |
| 27 | Validation rules (configuration) | 🆕 none (no config to validate) | large |
| 28 | Authorization | ✅ JWT + Roles solid | none |
| 29 | Tests | ♻️ good coverage of current behavior | medium |
| 30 | Swagger / OpenAPI | ♻️ generated & published | small |
| 31 | Seed data | ♻️ exists; no customization examples | small |
| 32 | Backward compatibility | ♻️ must be preserved | architectural |

---

## 2. Detailed gap matrix

Each entry: **status · reusable assets · gap level · required backend / API / data-model / cart-order / recommendation / admin changes · dependencies · risks · recommended phase.**

---

### 2.1 Public Pack catalog behavior — `medium`

- **Status:** Packs are browsable and viewable but **cannot be purchased as packs**. Only display works ([packs.controller.ts](../src/modules/packs/packs.controller.ts)).
- **Reuse:** ✅ `GET /packs`, `GET /packs/:id`, `GET /packs/slug/:slug`; ✅ media pipeline; ✅ order snapshot + stock reservation in `orders.service`.
- **Backend changes:** add a "configure + add to cart/order" path for a Pack (resolve a fixed pack into concrete order lines, reuse `effectiveProductReferencePrice`, `reserveForNewOrder`, snapshot writers).
- **API changes:** new endpoint to order/checkout a pack by id (or extend the cart DTO to accept a `packId` per line group). Keep existing routes unchanged.
- **Data model:** none required for *fixed* packs (can resolve at order time); a configured-pack entity is required for customizable packs (see 2.22).
- **Cart/order:** populate `OrderItem.packId` (already nullable) for pack lines; optionally store a pack-config snapshot (see 2.24).
- **Recommendation:** none.
- **Admin:** none.
- **Dependencies:** 2.3.
- **Risks:** double-counting price (pack fixed price vs. summed lines) — must mirror `calculateOrderPrice` modes.
- **Phase:** 4 (after stock/price safety) / 6.

### 2.2 Filtering & discovery — `large`

- **Status:** 🆕 No category, subcategory, tier, makeup style, occasion, experience level, skin-tone/undertone/skin-type compat filter, customizable flag, availability flag, featured/new/best-seller, or tag/keyword field on `Pack`. `GET /packs` has no query params.
- **Reuse:** ♻️ `PackAttribute` already encodes style/occasion/skin compatibility (could back attribute-based facets); ♻️ `QueryPacksDto` admin pattern for pagination/sort.
- **Backend changes:** add public list filtering/sorting/pagination; index new discovery columns.
- **API changes:** add query params to `GET /packs` (category, tier, priceRange, style, occasion, experienceLevel, skinTone/undertone/skinType, customizable, availableNow, featured, tags, search). Additive — default returns current behavior.
- **Data model:** add to `Pack`: `categoryId?` (or new `PackCategory`), `tier`, `occasion`, `experienceLevel`, `isCustomizable`, `isFeatured`/`isNew`/`isBestSeller`, `tags String[]`, `searchKeywords`. Decide whether skin-compat facets reuse `PackAttribute` (recommended) or new columns.
- **Cart/order:** none.
- **Recommendation:** none directly (but a `Pack.category`/`tier` could feed future scoring).
- **Admin:** expose new fields in create/update DTOs + UI.
- **Dependencies:** taxonomy decision (reuse AttributeGroup vs. dedicated enums).
- **Risks:** scope creep; choosing columns vs. attribute rows; index/perf as catalog grows.
- **Phase:** 4.

### 2.3 Fixed Pack selling — `medium`

- **Status:** 🆕 A fixed pack cannot be added to cart or ordered as a unit. `POST /orders/checkout` ignores packs; `POST /orders` requires a `recommendationResultId`.
- **Reuse:** ✅ `createFromCart`/`create` order machinery, ✅ `OrderItem.packId` nullable, ✅ stock reservation, ✅ price modes.
- **Backend:** function to expand a fixed Pack into priced order lines (each `PackItem` → its fixed reference; reject if any required item lacks a fixed reference) and apply the pack price mode for the subtotal.
- **API:** accept `packId` in checkout (new field or new route `POST /orders/checkout` group), or a dedicated `POST /packs/:id/order`.
- **Data model:** none for fixed packs.
- **Cart/order:** set `OrderItem.packId`; reconcile pack `FIXED` price vs. line sum (line snapshots must still total to the charged amount or store an explicit pack-level adjustment line).
- **Recommendation:** none.
- **Admin:** none.
- **Dependencies:** decide price reconciliation rule (store pack price as the subtotal and prorate, or keep line sums and a pack discount line).
- **Risks:** price mismatch between displayed pack price and summed lines; tampering if client sends prices (must price server-side, as today).
- **Phase:** 4.

### 2.4 Customizable Pack behavior — `architectural`

- **Status:** 🆕 Customization is **explicitly disabled**: `CUSTOMER_CHOICE` rejected at write ([packs.service.ts:966](../src/modules/packs/packs.service.ts#L966)) and nulled in the engine ([recommendation-engine.service.ts:309](../src/modules/recommendations/recommendation-engine.service.ts#L309)). No customization-rule fields exist.
- **Reuse:** ♻️ `selectionMode` + `isRequired` as the seed of a role taxonomy; ♻️ reference-compatibility logic.
- **Backend:** define item roles + per-item/per-pack customization rules; build a configuration validator.
- **API:** new "configure pack" / "validate configuration" endpoints.
- **Data model:** add item-role + rule fields (see 2.5–2.11) and a configured-pack entity (2.22). **This is the central architectural decision** (see §3 of the master plan and architecture Q2/Q3).
- **Cart/order:** configured pack must round-trip through cart and order (2.23/2.24).
- **Recommendation:** eligibility must tolerate customer-choice items (2.16).
- **Admin:** rule management UI (2.25).
- **Dependencies:** everything customization-related hangs off this.
- **Risks:** the biggest design risk in the whole evolution — getting the entity model wrong forces re-migration. Validate the model before any code (architecture Q2/Q3).
- **Phase:** 2 (foundation: roles + rule fields) then 5 (behavior).

### 2.5 Required selectable items (shade choice) — `large`

- **Status:** ♻️ The engine auto-selects the best reference (`AUTO_BEST_REFERENCE`); the customer never chooses. `CUSTOMER_CHOICE` is blocked.
- **Reuse:** ✅ `ProductReferenceAttribute` compatibility; ✅ `isReferenceCompatibleWithAnswers`; ♻️ pack detail already returns candidate references.
- **Backend:** model "allowed references/shades" per item; validate a customer's chosen reference against the allowed set + stock + compatibility.
- **API:** configuration payload carries `{ packItemId, selectedReferenceId }`; validation endpoint.
- **Data model:** allowed-reference set per item (new table `PackItemAllowedReference`, or derive "any active reference of this product" as the default allowed set).
- **Cart/order:** persist selected reference in the configuration + order line (already snapshotted per line).
- **Recommendation:** see 2.16 (eligibility), 2.18 (preconfigured).
- **Admin:** allow enabling customer choice + defining allowed references.
- **Dependencies:** 2.4.
- **Risks:** invalid/stale reference selection; compatibility drift; ensuring at least one valid option exists at config time.
- **Phase:** 5.

### 2.6 Optional included items (removable) — `medium`

- **Status:** ♻️ `PackItem.isRequired = false` already marks optional items, but there is **no removal flow** and no "removable" permission distinct from "optional".
- **Reuse:** ✅ `isRequired` flag; ✅ engine already skips unavailable optional items.
- **Backend:** allow a configuration to drop an optional item if removal is permitted; recompute price; enforce min-price/min-items.
- **API:** configuration carries removed item ids.
- **Data model:** `PackItem.removalAllowed` (or derive from role); min-required-items on `Pack`.
- **Cart/order:** configuration records removed items.
- **Recommendation:** none.
- **Admin:** toggle removal per item.
- **Dependencies:** 2.4, 2.10.
- **Risks:** removing items below min price/min items; beauty-logic violations.
- **Phase:** 5.

### 2.7 Optional add-ons — `large`

- **Status:** 🆕 No concept of an add-on (an item not included by default but addable).
- **Reuse:** ♻️ `PackItem` structure could host add-ons with a role flag; ✅ reference pricing/stock.
- **Backend:** model allowed add-ons; validate added add-ons against the allowed set, stock, max-item count, max-price.
- **API:** configuration carries added add-ons `{ productId/referenceId, quantity }`.
- **Data model:** add-on role on `PackItem` **or** new `PackAllowedAddOn` table.
- **Cart/order:** add-ons become extra order lines under the same `packId`.
- **Recommendation:** none (add-ons are post-recommendation customization).
- **Admin:** manage allowed add-ons per pack.
- **Dependencies:** 2.4.
- **Risks:** unbounded basket growth; price/stock validation; double add-on.
- **Phase:** 5.

### 2.8 Quantity changes by customer — `medium`

- **Status:** 🆕 `PackItem.quantity` is admin-fixed; customer cannot change it.
- **Reuse:** ✅ quantity already flows through pricing/stock/order.
- **Backend:** validate customer quantity against per-item min/max and stock.
- **API:** configuration carries per-item quantities.
- **Data model:** `PackItem.minQuantity`/`maxQuantity` (+ `quantityEditable`).
- **Cart/order:** configured quantity into order line.
- **Recommendation:** none.
- **Admin:** set min/max and editable flag.
- **Dependencies:** 2.4, 2.10.
- **Risks:** quantity pushing price below floor or beyond stock.
- **Phase:** 5.

### 2.9 Product / reference replacements — `large`

- **Status:** 🆕 No replacement concept (swap an allowed product/reference for another).
- **Reuse:** ♻️ allowed-reference modeling from 2.5.
- **Backend:** model allowed replacements; validate a replacement against the allowed set + compatibility + stock + price floor.
- **API:** configuration carries `{ packItemId, replacementProductId/ReferenceId }`.
- **Data model:** `PackItemAllowedReplacement` table (or reuse allowed-reference table scoped to the slot).
- **Cart/order:** replacement reflected in order line.
- **Recommendation:** optional fallback/replacement hinting (conception §2.6 marks fallback as non-MVP).
- **Admin:** define replacement sets.
- **Dependencies:** 2.4, 2.5.
- **Risks:** complexity; combinatorial validation; price manipulation via cheaper replacement.
- **Phase:** 5 (or later sub-phase).

### 2.10 Minimum Pack price — `medium`

- **Status:** 🆕 No minimum-allowed-price field; nothing enforces a floor. `minBudget` is a hint, not a floor, and is unused by pricing.
- **Reuse:** ♻️ pricing pipeline in `orders.service` is the natural enforcement point.
- **Backend:** after computing a configured price, reject if `< Pack.minAllowedPrice`.
- **API:** validation endpoint returns the floor breach; configure/checkout rejects.
- **Data model:** `Pack.minAllowedPrice Decimal?`.
- **Cart/order:** validate at add-to-cart and at order; store the validated final price + floor in the config snapshot.
- **Recommendation:** none.
- **Admin:** set min allowed price; warn if default price < floor.
- **Dependencies:** 2.4 (configuration exists to validate).
- **Risks:** floor not re-checked after later edits; bypass if client computes price.
- **Phase:** 3 (field + concept) → enforced in 5.

### 2.11 Margin protection (cost-based) — `medium` (future)

- **Status:** 🆕 `Product.costPrice` exists ([schema:332](../prisma/schema.prisma#L332)) but is **never used**. No profitability calculation.
- **Reuse:** ✅ `costPrice` column.
- **Backend:** compute configured-pack cost = Σ(reference effective cost × qty); compare to configured price for a margin floor.
- **API:** admin-only margin diagnostics; optional hard block.
- **Data model:** possibly `ProductReference.costOverride`/`costDelta` for reference-level cost; `Pack.minMarginPercentage?`.
- **Cart/order:** optional block at order time.
- **Recommendation:** none.
- **Admin:** margin visibility.
- **Dependencies:** 2.10 (price floor first; conception explicitly sequences "min price first, margin later").
- **Risks:** reference-level cost data may be incomplete; treat as advisory before hard-blocking.
- **Phase:** 10+ (future).

### 2.12 Pack-level discount / value — `none`

- **Status:** ✅ Three price modes incl. discount supported and validated.
- **Reuse:** ✅ as-is.
- **Changes:** none required for MVP. (May add an "original total value" display = Σ compareAtPrice for marketing.)
- **Phase:** n/a.

### 2.13 Pack item pricing (stored per item) — `small`

- **Status:** 🆕 `PackItem` has no price column; prices derive from product/reference.
- **Reuse:** ✅ derived pricing is correct and tamper-resistant.
- **Decision:** **keep derived** (do not store per-item price) to avoid drift; only snapshot at order time (already done). Optionally store per-item price *in the config/order snapshot* for customizable packs.
- **Gap is small and largely a non-action.** Phase: 3 (snapshot side only).

### 2.14 Pack stock availability (derived & exposed) — `medium`

- **Status:** ♻️ Availability logic exists (activation + recommendation + reservation) but there is **no exposed pack availability flag** and the public payload lacks `reservedQuantity`.
- **Reuse:** ✅ `availableReferenceStock`, ✅ structural validation in `adminFindOne`.
- **Backend:** compute "pack purchasable" = active + all required fixed items available + each required selectable slot has ≥1 valid option (conception §2.9).
- **API:** expose `availableNow`/`isPurchasable` on public pack list/detail.
- **Data model:** none (derived); optionally cache.
- **Cart/order:** re-validate at order (already done per line).
- **Recommendation:** aligns with eligibility (2.16).
- **Admin:** already shown via `validationIssues`.
- **Risks:** N+1/perf when computing availability across many packs; consider denormalized availability cache.
- **Phase:** 4.

### 2.15 Reference-level availability — `none`

- **Status:** ✅ `stockQuantity`/`reservedQuantity` + atomic reservation implemented ([order-stock.service.ts](../src/modules/orders/order-stock.service.ts)).
- **Changes:** none. Phase: n/a.

### 2.16 Quiz eligibility with customer-choice items — `medium`

- **Status:** 🆕 A required `CUSTOMER_CHOICE` item drops the whole pack from recommendations ([recommendation-engine.service.ts:235](../src/modules/recommendations/recommendation-engine.service.ts#L235)). Intended rule (stay eligible if ≥1 compatible option exists) not implemented.
- **Reuse:** ✅ `isReferenceCompatibleWithAnswers`, ✅ available-reference loading.
- **Backend:** change `selectReference` so `CUSTOMER_CHOICE` returns an "eligible, pending customer selection" outcome when ≥1 compatible available reference exists, instead of `null`. Pack stays recommendable; the slot is marked "needs selection".
- **API:** recommendation response marks slots requiring customer choice + candidate references.
- **Data model:** none required (can model "pending" without schema change), though storing candidate options may help.
- **Cart/order:** order from such a recommendation must require the customer's selection first (cannot auto-commit).
- **Recommendation:** core change; add tests replacing the current "does not implement CUSTOMER_CHOICE" test ([spec:558](../src/modules/recommendations/recommendation-engine.service.spec.ts#L558)).
- **Dependencies:** 2.4/2.5 (allowing customer-choice items in the first place).
- **Risks:** breaking the deterministic single-reference assumption that `RecommendationResultItem` (NOT NULL `selectedProductReferenceId`, [schema:607](../prisma/schema.prisma#L607)) relies on. May need that column nullable or a "pending" marker.
- **Phase:** 1 (stabilize eligibility logic, even before customer-choice ships) → completed in 9.

### 2.17 Quiz recommendation of existing packs — `small`

- **Status:** ✅ Works for fixed/auto packs; persisted sessions/results/items.
- **Reuse:** ✅ entire engine + persistence.
- **Changes:** small — extend to handle customer-choice eligibility (2.16) and richer reasons. Phase: 1/9.

### 2.18 Quiz preconfigured Pack (choose shade then add) — `large`

- **Status:** ♻️ Recommendation produces engine-chosen references; there is no "customer opens pack, picks required shades, adds configured pack to cart" flow.
- **Reuse:** ✅ recommendation result as the starting composition; ♻️ configuration entity from 2.22.
- **Backend:** turn a recommendation result into an editable configuration where required-selectable slots await customer choice; validate; checkout.
- **API:** `configure from recommendation` + `checkout configured pack`.
- **Data model:** configured-pack entity (2.22).
- **Cart/order:** 2.23/2.24.
- **Recommendation:** 2.16.
- **Admin:** none.
- **Dependencies:** 2.16, 2.22, 2.23.
- **Risks:** consistency between recommendation snapshot and live stock at checkout.
- **Phase:** 9.

### 2.19 Quiz-generated Pack — `architectural` / ⏸️

- **Status:** 🆕 No dynamic pack generation.
- **Reuse:** ♻️ compatible-product/reference selection logic; ♻️ configured-pack entity.
- **Backend:** build a composition from compatible products/references, price it, apply customization permissions, validate stock + min price, present for review.
- **API:** generate-pack endpoint producing a configured (not catalog) pack.
- **Data model:** configured-pack entity must support "no source catalog Pack" (generated source type).
- **Cart/order:** must reuse the same configured-pack snapshot → no uncontrolled dynamic cart (architecture Q11).
- **Recommendation:** large extension.
- **Admin:** generation templates/guardrails.
- **Dependencies:** **all** of customization + configured-pack persistence + eligibility must be safe first.
- **Risks:** uncontrolled dynamic cart, price/stock/margin abuse — highest-risk feature.
- **Phase:** 10 (only when prerequisites proven).

### 2.20 Wishlist — `medium`

- **Status:** 🆕 No wishlist model/endpoint (confirmed: only a passing mention in [backend-store-gap-confirmation.md](./backend-store-gap-confirmation.md)).
- **Reuse:** ♻️ `CustomerProfile`/`Customer` as owner; ♻️ `CustomerEvent` for tracking.
- **Backend:** wishlist CRUD keyed by session/customer.
- **API:** add/remove/list wishlist (packs and/or products).
- **Data model:** new `Wishlist`/`WishlistItem` table.
- **Cart/order:** none.
- **Recommendation:** optional signal.
- **Admin:** optional analytics.
- **Dependencies:** identity model (session token vs. customer).
- **Risks:** identity without accounts (no customer login today — only `CustomerProfile.sessionToken`).
- **Phase:** 8.

### 2.21 Sharing (public + configured) — `medium`

- **Status:** ♻️ Public packs are slug-addressable (shareable URL already possible). 🆕 No share endpoint, no social preview metadata, no shareable *configured* pack link, no privacy guard against exposing quiz answers.
- **Reuse:** ✅ slug routes; ♻️ configured-pack entity for configured links.
- **Backend:** generate share tokens for configured packs that expose composition but **not** quiz answers (conception §2.8).
- **API:** create/read share link; OG metadata endpoint or SSR hints.
- **Data model:** `shareToken` on configured-pack entity.
- **Cart/order:** none.
- **Recommendation:** must strip `CustomerProfileAnswer` data from shared payloads.
- **Admin:** none.
- **Dependencies:** 2.22.
- **Risks:** privacy leak of quiz answers; token guessability.
- **Phase:** 8.

### 2.22 Configured Pack persistence — `large`

- **Status:** 🆕 No entity stores a customer's final pack configuration. `RecommendationResult` is engine output, not customer choice.
- **Reuse:** ♻️ snapshot patterns from `OrderItem`.
- **Backend:** new entity holding source pack + source type + selected products/references/shades + final quantities + removed items + add-ons + final price + discounts + min-price/stock validation results.
- **API:** create/read/update configuration.
- **Data model:** new `PackConfiguration` (+ `PackConfigurationItem`) tables (architecture Q1/Q2).
- **Cart/order:** cart references a configuration; order snapshots it (2.24).
- **Recommendation:** preconfigured/generated flows produce a configuration.
- **Admin:** view configurations behind orders.
- **Dependencies:** 2.4 architectural decision.
- **Risks:** wrong shape → re-migration; must support all four source types (fixed, customizable, quiz-recommended, quiz-generated).
- **Phase:** 6.

### 2.23 Cart snapshot (pack config) — `large`

- **Status:** 🆕 No server cart; client cart only; checkout takes raw lines.
- **Reuse:** ♻️ `createFromCart` pricing/stock/snapshot.
- **Backend:** decide server cart vs. "configuration id at checkout". Recommended: keep client cart for plain products; for packs, persist a `PackConfiguration` and reference it at checkout (avoids a full cart subsystem).
- **API:** checkout accepts configuration ids alongside product lines.
- **Data model:** 2.22.
- **Cart/order:** re-validate price/stock/min-price at checkout.
- **Recommendation:** none.
- **Admin:** none.
- **Dependencies:** 2.22.
- **Risks:** stale configuration vs. live stock/price; must re-validate server-side.
- **Phase:** 6.

### 2.24 Order snapshot (pack config) — `medium`

- **Status:** ♻️ Per-line snapshots are robust ([orders.service.ts:136](../src/modules/orders/orders.service.ts#L136)); 🆕 no pack-level config snapshot (which items were removed, which add-ons added, the final validated pack price, source type).
- **Reuse:** ✅ line snapshot writers.
- **Backend:** at order creation, snapshot the configuration (source pack id+name, source type, removed/added, final price, floor, validations) onto the order.
- **API:** admin order detail surfaces pack-config snapshot.
- **Data model:** `Order.packConfigurationSnapshot Json?` or a `OrderPackConfiguration` table; could reuse `reasonJson` patterns.
- **Cart/order:** write at create; never mutate after.
- **Recommendation:** none.
- **Admin:** display.
- **Dependencies:** 2.22.
- **Risks:** historical safety if config/catalog changes later (the line snapshots already protect prices; the pack-config snapshot protects the *composition rationale*).
- **Phase:** 6 (with configured-pack flow).

### 2.25 Admin Pack management — `medium`

- **Status:** ♻️ Solid CRUD; 🆕 missing fields for customization rules, discovery taxonomy, min price, allowed add-ons/replacements/references.
- **Reuse:** ✅ controller/service/validation/transaction structure.
- **Backend:** extend resolve/validate to new fields; allow `CUSTOMER_CHOICE` once supported.
- **API:** extend `CreatePackDto`/`UpdatePackDto`/`PackItemInputDto` additively.
- **Data model:** all new columns from 2.2/2.4–2.11.
- **Cart/order:** none.
- **Recommendation:** none.
- **Admin:** new UI surfaces.
- **Dependencies:** schema decisions.
- **Risks:** DTO bloat; keeping additive (no breaking changes to current admin contracts).
- **Phase:** 7 (and incrementally with each feature).

### 2.26 Pack media — `none`

- **Status:** ✅ `PackImage` + `mainImageUrl` + media pipeline complete. Phase: n/a (only add social-preview/OG for sharing in 2.21).

### 2.27 Validation rules (configuration) — `large`

- **Status:** 🆕 No configuration validator (there is no configuration). Current validation covers admin pack integrity only ([packs.service.ts:906/1136](../src/modules/packs/packs.service.ts#L906)).
- **Reuse:** ♻️ `structuralValidation` as a template.
- **Backend:** central validator: required items present, selectable slots chosen, removals allowed, quantities within min/max, add-ons allowed, item count within max, stock valid, price ≥ floor.
- **API:** `POST /packs/:id/validate-configuration`.
- **Data model:** rule fields from 2.4–2.11.
- **Cart/order:** validate at add-to-cart and at order.
- **Recommendation:** eligibility uses a subset.
- **Admin:** validate on save.
- **Dependencies:** 2.4, 2.22.
- **Risks:** validation drift between client preview and server enforcement — server must be authoritative.
- **Phase:** 5/6.

### 2.28 Authorization — `none`

- **Status:** ✅ JWT + Roles guards on all admin routes ([admin-packs.controller.ts:34](../src/modules/packs/admin-packs.controller.ts#L34)); public read/funnel endpoints intentionally open. Changes: keep additive; never relax admin guards. Phase: n/a.

### 2.29 Tests — `medium`

- **Status:** ♻️ Good coverage of current behavior, including tests that *assert* customization is disabled ([packs.service.admin.spec.ts:300-324](../src/modules/packs/packs.service.admin.spec.ts#L300), [recommendation-engine.service.spec.ts:558](../src/modules/recommendations/recommendation-engine.service.spec.ts#L558)).
- **Reuse:** ✅ test harness/utilities.
- **Backend:** new tests for each capability; **the existing "CUSTOMER_CHOICE rejected/unimplemented" tests must be intentionally updated** when those features land (they are guardrails, not bugs).
- **Phase:** every phase.

### 2.30 Swagger / OpenAPI — `small`

- **Status:** ♻️ Generated and published ([docs/openapi.json](./openapi.json)).
- **Changes:** regenerate after each additive API change; document new DTOs/endpoints. Phase: every phase + 11.

### 2.31 Seed data — `small`

- **Status:** ♻️ Seed exists ([prisma/seed.ts](../prisma/seed.ts), [SEED_DATA_QUIZ_AND_RULES.md](./SEED_DATA_QUIZ_AND_RULES.md)); no customizable-pack or configured-pack examples.
- **Changes:** add fixed + customizable example packs, allowed references/add-ons, min-price examples. Phase: 5/7.

### 2.32 Backward compatibility — `architectural`

- **Status:** ♻️ Must preserve: funnel `POST /orders` contract, cart `POST /orders/checkout`, public pack reads, admin pack CRUD, existing recommendation determinism, order/line snapshots.
- **Approach:** all schema changes additive (new nullable columns/tables, widen NOT NULL only where safe); new endpoints not modified ones; new DTO fields optional; engine changes behind the (currently empty) customer-choice path so existing fixed/auto packs score identically.
- **Risks:** `RecommendationResultItem.selectedProductReferenceId` is NOT NULL — supporting "pending customer selection" may require widening it or a separate marker (see 2.16).
- **Phase:** 0 + every phase.

---

## 3. Classification roll-up

### Already exists and can be reused as-is

- Reference-level stock + atomic reservation (`order-stock.service.ts`).
- Order/line snapshotting (`orders.service.ts`).
- Pack media (`PackImage` + media pipeline).
- Pack pricing modes incl. discount.
- Admin Pack CRUD skeleton + authorization.
- Recommendation engine for fixed/auto packs + persistence.
- Reference-compatibility scoring (`ProductReferenceAttribute`, `isReferenceCompatibleWithAnswers`).
- Slug-addressable public packs.

### Exists but needs evolution

- `selectionMode` + `isRequired` → first-class item roles.
- Recommendation eligibility → tolerate customer-choice slots.
- Admin DTOs → new customization/discovery fields.
- Public `GET /packs` → filtering/sorting/pagination.
- Order snapshot → add pack-config snapshot.
- Pack availability logic → exposed availability flag.
- `minBudget`/`maxBudget` → either wire into scoring or supersede with real min-price.

### Does not exist (must be built)

- Configured-pack entity + persistence.
- Customization rule fields + validator.
- Required-selectable / optional-add-on / replacement modeling.
- Customer pack-to-cart / pack-to-order path.
- Discovery taxonomy (category/tier/occasion/tags/featured) on packs.
- Wishlist; share tokens + social preview for configured packs.
- Minimum-allowed-price enforcement.

### Should be postponed

- Quiz-generated dynamic packs (2.19).
- Cost-based margin protection (2.11).
- Reviews/ratings, recently-viewed (conception marks "later").
- Full server-side cart subsystem (prefer configuration-id-at-checkout).
