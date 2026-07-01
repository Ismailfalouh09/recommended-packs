# Pack Core Evolution — Progress Log

**Checkpoint date:** 2026-06-30
**Checkpoint scope:** Pack Core foundation and Recommendation MVP

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

4. Next Pack business phase — Phase 4:
   - Fixed Pack catalog discovery and filtering, plus direct fixed-Pack purchase.

## Explicitly Deferred

- Customer PackConfiguration persistence
- Customer Pack customization checkout
- Writing pack-config snapshots during checkout (Phase 3 added storage + builder only; order creation does not yet populate it)
- Wishlist and sharing
- Add-on recommendations
- Generated personalized Packs
- Margin-based ranking
- Promotions and campaign ranking
