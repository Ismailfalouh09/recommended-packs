# Pack Core Evolution — Progress Log

**Checkpoint date:** 2026-07-01
**Checkpoint scope:** Pack Core foundation, Recommendation MVP, and Phase 6 configuration checkout

## Completed

### Phase 0 — Architecture and Current-State Analysis

- Current Pack implementation analyzed.
- Pack Core evolution master plan created.
- Additive and backward-compatible approach selected.

### Phase 1 — CUSTOMER_CHOICE Recommendation Eligibility

- Required customer-choice Pack items no longer automatically exclude a Pack.
- A Pack remains eligible when at least one compatible, active, in-stock option exists.
- Pending selection is returned safely through:
  - `selectionRequired: true`
  - `referenceId: null`
  - `availableOptions`
- Fixed and automatic reference-selection behavior remains unchanged.

### Phase 2 — Pack Item Roles and Customization Foundation

- Added Pack item roles:
  - `FIXED`
  - `REQUIRED_SELECTABLE`
  - `OPTIONAL_INCLUDED`
  - `OPTIONAL_ADDON`
- Added future customization rule fields.
- Added allowed-reference and allowed-add-on foundations.
- Existing Packs remain fixed and backward-compatible by default.

### Phase 2.5 — Pack Compatibility Profile Foundation

- Added Pack compatibility profiles for:
  - Skin tone
  - Skin type
  - Makeup style
  - Budget
  - Occasion
- Added explicit compatibility modes:
  - `UNIVERSAL`
  - `RESTRICTED`
  - `UNCONFIGURED` represented by absence of a profile.
- Compatibility values reuse canonical quiz/attribute values.

### Recommendation MVP

- Added single-responsibility recommendation components:
  - Pack eligibility service
  - One matcher per criterion
  - Score aggregator
  - Customer-safe explanation service
  - Recommendation use case/orchestrator
- Implemented five-criteria recommendation matching:
  - Skin tone
  - Skin type
  - Makeup style
  - Budget
  - Occasion
- Rules:
  - Skin tone mismatch: hard exclusion
  - Skin type mismatch: hard exclusion
  - Makeup style mismatch: soft mismatch
  - Occasion mismatch: soft mismatch
  - Budget uses actual Pack price and canonical numeric ranges
- Centralized recommendation weights:
  - Makeup style: 30
  - Skin tone: 25
  - Skin type: 20
  - Budget: 15
  - Occasion: 10

### Phase 3 — Pack Pricing Floor & Order Snapshot Safety

- Added a reusable server-side price-floor guard (`assertAtOrAboveMinAllowedPrice` / `isAtOrAboveMinAllowedPrice`):
  - Allows any price when `Pack.minAllowedPrice` is null.
  - Allows a price equal to or above the floor.
  - Rejects a price strictly below the floor with a `BadRequestException`.
  - Uses `Prisma.Decimal` comparison (no float drift), consistent with existing money conventions.
- Added additive, nullable `Order.packConfigurationSnapshot` (JSONB) storage:
  - Migration `20260701120000_order_pack_configuration_snapshot`.
  - Existing orders continue with a null snapshot (backward compatible).
- Added a typed, reusable pack-configuration snapshot builder (`buildPackConfigurationSnapshot`):
  - Captures source pack id/name, source type, final price, min price, currency, validation result, and selected/removed/added item data.
  - Privacy-safe by construction: no private quiz answers, internal scores, costs, or margins.
- Admin order detail now returns `packConfigurationSnapshot` only when the order actually carries one.
- No change to checkout, cart, order creation, Pack pricing, or recommendation behavior (all inert plumbing until later phases).

### Phase 4A — Public Pack Catalog Discovery & Availability

- Added additive, backward-compatible public discovery fields on `Pack`
  (migration `20260701005043_pack_public_discovery_fields`, applied):
  - `category` (reuses the shared `Category` entity via `categoryId`, no
    `PackCategory` duplication)
  - `tier` (`PackTier`), `occasion` (`PackOccasion`),
    `experienceLevel` (`PackExperienceLevel`)
  - `isFeatured`, `isNew`, `isBestSeller`
  - `tags` (`String[]`), `searchKeywords`
  - All discovery columns indexed for filter performance.
- Discovery `occasion`/`tier`/`experienceLevel` are coarse browsing facets kept
  distinct from `PackCompatibilityProfile` (recommendation suitability set) — no
  compatibility data duplicated; discovery fields never affect scoring/eligibility.
- Extended public `GET /packs` with optional, additive filters: `category`,
  `tier`, `occasion`, `experienceLevel`, `customizable`, `availableNow`,
  `featured`, `tags`, `search`, `sort`, `page`, `limit`.
  - **No query parameters ⇒ unchanged legacy behavior** (plain array of active
    packs; no `availableNow`, no pagination envelope).
  - With any filter/pagination param ⇒ a paginated envelope `{ data, pagination }`
    whose items carry an `availableNow` flag.
  - Only active/public packs are ever returned.
- Added a reusable, side-effect-free browsing availability calculation
  (`isPackAvailableNow` in `pack-availability.util.ts`):
  - Pack available now = active/public AND every `FIXED`/`REQUIRED_SELECTABLE`
    item has ≥1 active reference with available stock ≥ required quantity.
  - Optional included items and add-ons never block availability.
  - Does NOT reserve stock and does NOT change checkout. Reserved-stock counts are
    stripped from public reference output.
- Discovery fields are settable via the admin Pack create/update DTOs (additive);
  `categoryId` is validated against an existing `Category`.
- Focused tests added: each public filter, combined filters, search, sort,
  `availableNow` true/false, no-filter backward compatibility, optional-items-do-
  not-block, required-unavailable-blocks, pagination, reserved-stock non-leak.
- Swagger/OpenAPI regenerated and verified. Prisma validate/generate + build pass.

### Phase 4B — Fixed Pack Direct Purchase

- Added one additive endpoint `POST /packs/:packId/order` for a Cash-on-Delivery
  order of a single **fixed, non-customizable** Pack as one unit — see
  [PACK_FIXED_PURCHASE_FLOW.md](./PACK_FIXED_PURCHASE_FLOW.md).
- Reuses existing order machinery (customer upsert, address, atomic stock
  reservation, per-line snapshots, status history). **No order logic duplicated.**
  The price-mode logic was extracted into a shared `applyPackPriceMode` helper
  used by both the funnel path and the new fixed-pack path.
- Server-authoritative throughout: the Pack is identified only by `:packId`; items
  and prices are never taken from the client (`CreatePackOrderDto` carries only
  customer/delivery fields).
- Validation gate: accepts only active, available, non-customizable Packs; rejects
  customizable Packs, Packs with `REQUIRED_SELECTABLE`/`CUSTOMER_CHOICE` items, and
  packs that are not available now (reuses `isPackAvailableNow`).
- Expansion: only `FIXED`-role items form the composition (exactly matches the
  availability blocking set), each resolved to one concrete reference server-side
  (`FIXED_REFERENCE` → pinned; `AUTO_BEST_REFERENCE` → first active in-stock).
  Expanded into normal `OrderItem`s with `OrderItem.packId` set.
- Applies Pack `priceMode` correctly: `FIXED`, `SUM_ITEMS`,
  `SUM_ITEMS_WITH_DISCOUNT`.
- `Order.packConfigurationSnapshot` remains `null` in this phase.
- Existing `POST /orders` and `POST /orders/checkout` behavior preserved unchanged.
- Focused tests added ([orders.service.pack.spec.ts](../src/modules/orders/orders.service.pack.spec.ts));
  Swagger/OpenAPI regenerated and verified; Prisma validate/generate + build pass.

### Phase 4 — COMPLETE

- Both Phase 4A (public catalog discovery, filtering, browsing availability) and
  Phase 4B (fixed Pack direct purchase) are done. Phase 4 is complete.

### Phase 5 — Controlled Customizable Pack Rules & Configuration Validator

- Added one additive, **read-only** endpoint
  `POST /packs/:packId/validate-configuration` — see
  [PACK_CUSTOMIZATION_VALIDATION.md](./PACK_CUSTOMIZATION_VALIDATION.md).
  Returns `isValid`, `computedPrice`, `minAllowedPrice`, `stockStatus`,
  `normalizedItems`, and `validationErrors`. Nothing is persisted and no stock
  is reserved.
- Server-authoritative throughout: the client body carries only proposed
  selections (chosen reference, quantity, removal) and add-ons — never prices or
  item snapshots. Price is recomputed server-side from the current allowed
  references (`priceOverride`, else `basePrice + priceDelta`), summed over the
  final composition, with the Pack's configured discount applied only for
  `SUM_ITEMS_WITH_DISCOUNT`.
- Gate: only `isCustomizable=true`, active Packs are accepted; missing Packs 404,
  non-customizable/inactive Packs 400. All composition/rule/stock/price
  violations return `200` with `isValid=false` and a coded `validationErrors`
  list.
- Rules enforced (activating the Phase 2 role/rule fields): required `FIXED`
  items stay present; `REQUIRED_SELECTABLE` slots need one allowed active
  in-stock reference; optional removal only when `removalAllowed`; quantity
  changes only when `quantityEditable` and within `[minQuantity, maxQuantity]`;
  replacements only when `replacementAllowed`; chosen references must exist in
  `PackItemAllowedReference`; add-ons must exist in `PackAllowedAddOn`;
  `minRequiredItems`/`maxItemCount` respected; live stock validated via the
  shared `availableReferenceStock`; computed price rejected below
  `minAllowedPrice` via the Phase 3 `isAtOrAboveMinAllowedPrice` helper.
- The rule engine is a pure, dependency-free function
  (`pack-configuration.validator.ts`) — fully unit-testable without a database;
  `PacksService` only loads the Pack and maps it onto the validator input.
- No new schema (reuses Phase 2 tables/fields). Existing `POST /orders`,
  `POST /orders/checkout`, `POST /packs/:id/order`, fixed Pack purchase, the
  recommendation algorithm, cart behavior, and order creation are unchanged.
- Focused tests added
  ([pack-configuration.validator.spec.ts](../src/modules/packs/pack-configuration.validator.spec.ts),
  [packs.service.config.spec.ts](../src/modules/packs/packs.service.config.spec.ts));
  Swagger/OpenAPI regenerated and verified; Prisma validate/generate + build pass.

### Phase 6 - PackConfiguration Persistence & Configured Checkout

- Added additive Pack configuration persistence via
  `POST /packs/:packId/configurations`.
  - The server reloads the current Pack, reuses the Phase 5 validator,
    recomputes price/stock, and persists only valid configurations.
  - Invalid configurations are rejected with `400` and are not written.
- Added persisted configuration read and configured checkout:
  - `GET /configurations/:id`
  - `POST /configurations/:id/checkout`
- Lifecycle documented in
  [PACK_CONFIGURATION_LIFECYCLE.md](./PACK_CONFIGURATION_LIFECYCLE.md):
  `validate/persist configuration -> revalidate at checkout -> reserve stock -> create normal OrderItems -> write immutable packConfigurationSnapshot`.
- Checkout revalidates the saved composition against the current source Pack
  before reservation/order creation, including active/customizable status, live
  stock, allowed references/add-ons, and `minAllowedPrice`.
- Successful configured checkout creates normal `OrderItem` rows, reserves stock
  through the existing atomic order-stock flow, and writes immutable
  `Order.packConfigurationSnapshot`.
- Existing `POST /orders`, `POST /orders/checkout`, and fixed Pack purchase
  behavior remain unchanged.

### Phase 7 - Admin Pack Customization Management

- Admin `POST /admin/packs`, `PATCH /admin/packs/:id`, and
  `GET /admin/packs/:id` now expose and preserve Pack customization fields:
  - `isCustomizable`
  - `minAllowedPrice`
  - `minRequiredItems`
  - `maxItemCount`
  - Pack item roles
  - allowed item references
  - allowed add-ons, including `{ productId, productReferenceId }`
  - quantity, removal, and replacement rules
  - compatibility profile data
- Added admin save-time validation for customizable Packs:
  - `REQUIRED_SELECTABLE` items must use `CUSTOMER_CHOICE` and have at least one
    active, in-stock allowed reference.
  - Allowed references must belong to the item product and be active/in stock
    for customizable Packs.
  - Allowed add-ons must exist; customizable Pack add-ons must be active and
    have an active, in-stock reference. Pinned add-on references must belong to
    the add-on product.
  - `minQuantity` / `maxQuantity`, `minRequiredItems` / `maxItemCount`, and
    `minAllowedPrice` are checked before save.
  - `minAllowedPrice` cannot exceed the Pack default sellable price.
- Partial admin updates validate the final saved rule graph while preserving
  omitted nested allowed references, add-ons, attributes, and compatibility
  profiles.
- Fixed non-customizable Pack admin create/update/read behavior remains
  backward-compatible.
- Admin guide added:
  [ADMIN_PACK_CUSTOMIZATION_GUIDE.md](./ADMIN_PACK_CUSTOMIZATION_GUIDE.md).

### Budget Range Foundation

- Added canonical Budget option numeric ranges:
  - LOW: 150–220 MAD
  - MEDIUM: 221–350 MAD
  - HIGH: 351–600 MAD
- Actual Pack selling price is used for numeric budget matching.

### Database Readiness

- Applied Pack compatibility profile migration.
- Applied AttributeOption budget range migration.
- Verified local database schema is aligned with Prisma schema.

### Validation Completed

- Prisma validation and generation passed.
- Build passed.
- Swagger generation and validation passed.
- Focused recommendation test suites passed.
- Manual API recommendation test matrix passed:
  - 6 passed
  - 0 failed
  - 1 blocked

## Manual Test Results

- Exact match Pack ranked first.
- Skin tone mismatch Pack excluded.
- Skin type mismatch Pack excluded.
- Makeup style mismatch Pack ranked below exact match.
- Budget-above-range Pack excluded.
- Unconfigured Pack did not receive false compatibility reasons.
- CUSTOMER_CHOICE live manual test remains blocked because the selected profile did not return a compatible customer-choice fixture.

## Known Follow-Ups

1. Customer-facing recommendation response sanitization:
   - Review/remove or hide legacy public scoring fields such as:
     - `totalScore`
     - `matchPercentage`
     - `selectedItems.itemScore`
     - nested legacy score and match-detail fields
   - Keep internal diagnostic data available only where appropriate.

2. Add or identify a controlled live CUSTOMER_CHOICE recommendation fixture:
   - Manually verify:
     - `selectionRequired = true`
     - selected reference is `null`
     - `availableOptions` is non-empty

3. Occasion is not currently part of the active public quiz flow:
   - Keep Occasion matcher coverage in automated tests.
   - Add the public quiz question only in a separate intentional quiz evolution.

4. Next Pack business phase:
   - Phase 4 is **complete**: Phase 4A (catalog discovery, filtering, browsing
     availability — [PACK_PUBLIC_DISCOVERY.md](./PACK_PUBLIC_DISCOVERY.md)) and
     Phase 4B (fixed Pack direct purchase via `POST /packs/:packId/order` —
     [PACK_FIXED_PURCHASE_FLOW.md](./PACK_FIXED_PURCHASE_FLOW.md)).
   - Phase 5 is **complete**: controlled customizable Pack rules & the read-only
     configuration validator (`POST /packs/:packId/validate-configuration` —
     [PACK_CUSTOMIZATION_VALIDATION.md](./PACK_CUSTOMIZATION_VALIDATION.md)).
   - Phase 6 is **complete**: `PackConfiguration` persistence and configured
     checkout are implemented and documented.
   - Phase 7 is **complete**: admin Pack customization management is implemented
     and documented.
   - Next: Phase 8 remains intentionally unstarted.

## Explicitly Deferred

- Phase 8 and later Pack business flows
- Wishlist and sharing
- Add-on recommendations
- Generated personalized Packs
- Margin-based ranking
- Promotions and campaign ranking
