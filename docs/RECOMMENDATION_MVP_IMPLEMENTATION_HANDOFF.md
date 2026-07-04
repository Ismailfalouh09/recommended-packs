# Recommendation MVP Implementation Handoff

## Files and Components

- `src/modules/recommendations/matching/*`: one matcher per approved criterion.
- `src/modules/recommendations/scoring/recommendation-weights.ts`: central 30/25/20/15/10 weights.
- `src/modules/recommendations/scoring/pack-score-aggregator.service.ts`: sums matcher scores only.
- `src/modules/recommendations/eligibility/pack-eligibility.service.ts`: delegates existing Pack eligibility to the legacy engine, including Phase 1 customer-choice handling.
- `src/modules/recommendations/explanation/recommendation-explanation.service.ts`: builds customer-safe reasons from positive matches only.
- `src/modules/recommendations/recommendation-use-case.service.ts`: orchestrates eligibility, matching, hard exclusions, ranking, dedupe, and response enrichment.
- `src/modules/recommendations/recommendations.service.ts`: loads active Packs with compatibility profiles and price inputs, calls the use case, persists safe results, and maps responses.
- `src/common/swagger/api-response.models.ts`: documents optional `customerReasons`, `recommendationType`, `selectionRequired`, and `availableOptions`.

## Five Matching Rules

- Skin tone: restricted exact match scores 25; restricted mismatch is a hard exclusion.
- Skin type: restricted exact match scores 20; restricted mismatch is a hard exclusion.
- Makeup style: restricted exact match scores 30; mismatch is soft and scores 0.
- Budget: inside selected numeric range scores 15; below selected range scores 12; above selected range is a hard exclusion.
- Occasion: restricted exact match scores 10; mismatch is soft and scores 0.

`UNIVERSAL` is eligible but scores 0 and creates no reason. `UNCONFIGURED` is absence of a profile row, scores 0, creates no reason, and is never treated as universal.

## Budget Behavior

Canonical `BUDGET` attribute options now carry nullable numeric bounds on `AttributeOption`:

- `LOW`: 150-220 MAD
- `MEDIUM`: 221-350 MAD
- `HIGH`: 351-600 MAD

The boundary convention is non-overlapping and inclusive: 220 MAD belongs to `LOW`, 350 MAD belongs to `MEDIUM`, and the next tier starts at the next whole MAD value.

For a selected customer Budget option with a complete numeric range, the Budget matcher compares the actual Pack selling price against that range:

- price inside the selected range: `MATCH`, 15 points
- price below the selected range minimum: `MATCH`, 12 points
- price above the selected range maximum: `NO_MATCH`, hard exclusion

The old `LOW` / `MEDIUM` / `HIGH` tier-order fallback is disabled. If a legacy Budget option has no complete numeric range, Budget is treated as `NOT_APPLICABLE`: 0 points, no hard exclusion, and no positive customer reason. Missing numeric values never create a budget-compatible match.

## Customer Choice Protection

Required `CUSTOMER_CHOICE` items remain recommendable when at least one compatible, active, in-stock option exists. The response keeps `selectionRequired: true`, exposes `availableOptions`, and leaves the selected `referenceId` as `null`. Pending selections are not persisted because `RecommendationResultItem.selectedProductReferenceId` is still non-null.

`FIXED_REFERENCE` and `AUTO_BEST_REFERENCE` selection continue through the existing engine behavior.

## Public API Additions

- `customerReasons?: string[]`
- `recommendationType?: BEST_MATCH | ALTERNATIVE`
- Item-level pending selection fields from Phase 1: `selectionRequired` and `availableOptions`

Compatibility scores, criterion scores, weights, and internal ranking details are kept out of the public response reason payload.

## Deferred

Undertone, experience level, finish preference, exclusions, promotions, add-ons, customization persistence, cart/checkout/order changes, wishlist/sharing, generated Packs, new quiz questions, and public Pack filters remain deferred.
