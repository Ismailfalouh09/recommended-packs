# Quiz-Recommended Existing Packs (Phase 9)

Turn a **recommended existing Pack** into a checkout-ready, server-authoritative
`PackConfiguration` without introducing a new checkout path.

```text
Quiz recommendation result
  → customer selects required shades/options
  → PackConfiguration (sourceType = QUIZ_RECOMMENDED)
  → existing configured checkout (POST /configurations/:id/checkout)
```

Phase 9 is **additive**. It does not implement quiz-*generated* packs; it only
configures an existing recommended Pack.

## Endpoint

```text
POST /recommendations/:resultId/configure
```

- `:resultId` is a **real persisted `RecommendationResult` id** (returned by
  `POST /recommendations` and `GET /recommendations/:sessionId` as
  `recommendationResultId`). The Pack is resolved server-side from it — never
  from the body.
- Request body (`ConfigureFromRecommendationDto`):
  - `selections[]` — the customer's chosen references for the pack's
    `REQUIRED_SELECTABLE` (customer-choice) slots (`{ packItemId,
    productReferenceId, quantity?, removed? }`).
  - `addOns[]` — optional add-ons, validated against `PackAllowedAddOn`.
  - **No price, product name, or item snapshot is ever accepted from the client.**
- Response: the persisted `PackConfiguration` (same shape as
  `GET /configurations/:id`) plus `pendingSelections` — the pack item ids still
  awaiting a valid customer selection (empty when the configuration is ready to
  check out). A `QUIZ_RECOMMENDED` configuration also carries the
  `recommendationResultId` it was created from.

## What the endpoint does

1. Loads the `RecommendationResult` (`404` if it does not exist) and, from it,
   its recommended Pack. The Pack must still be active/sellable (`400`
   otherwise). It **need not be customizable** — a recommended fixed Pack yields
   a fully-resolved configuration.
2. Runs the **same Phase 5 validator** (`validatePackConfiguration`) used by the
   customizable-pack flow. Fixed and auto-selected items are resolved
   server-side from the recommended Pack (prefilled); the customer's `selections`
   fill the required customer-choice slots. Price and stock are recomputed from
   the *current* allowed references.
3. Classifies the validator result:
   - **Pending** — the only issue is a missing required selection
     (`MISSING_REQUIRED_SELECTION`). The configuration is persisted with
     `isValid = false`, and each pending slot is stored with a **null reference**
     (a dedicated configuration-pending representation). The validator's fallback
     pick is never stored as if it were chosen.
   - **Hard rejection** — any other error (disallowed / inactive / out-of-stock
     reference, below-floor price, unknown slot, invalid quantity/removal). The
     request is rejected with `400` and **nothing is written**.
   - **Valid** — no errors. The configuration is persisted with `isValid = true`
     and every slot committed.
4. Persists a `PackConfiguration` with:
   - `sourceType = QUIZ_RECOMMENDED`
   - `recommendationResultId` linked to the source result
   - the server-recomputed `finalPrice`, `currency`, `minAllowedPrice`,
     `stockStatus`, and the frozen validator `validationResult`.

Quiz answers and internal recommendation scores (`itemScore`, `totalScore`,
`matchPercentage`, reason JSON, …) are **never copied** into the configuration.

## Pending vs. valid, and checkout

The existing configured checkout (`POST /configurations/:id/checkout`,
`OrdersService.createFromConfiguration`) is reused **unchanged in shape** and
still **revalidates everything** against the live Pack before reserving stock or
creating an order:

- A **pending** configuration keeps its required slot stored as a null
  reference. At checkout the validator re-derives `MISSING_REQUIRED_SELECTION`,
  so the order is **rejected and no stock is reserved** until the customer
  re-configures with a valid selection.
- A **valid** configuration checks out normally: it expands into ordinary
  `OrderItem`s (each carrying the source `packId`), reserves stock through the
  existing atomic flow, and freezes an immutable
  `Order.packConfigurationSnapshot` whose `sourceType` is **`QUIZ_RECOMMENDED`**.

Two small, faithful adjustments were made to the shared checkout so it can serve
Phase 9 without changing existing behavior:

- The `isCustomizable` gate now exempts `QUIZ_RECOMMENDED` configurations (a
  recommended *fixed* pack is not customizable). Its composition is still fully
  revalidated by the same validator. A `CUSTOMIZED` configuration still requires
  a customizable source pack — unchanged.
- The order snapshot now records the configuration's **real** `sourceType`
  (`CUSTOMIZED` or `QUIZ_RECOMMENDED`) instead of a hard-coded `CUSTOMIZED`.

To finalize a pending configuration, the customer re-calls
`POST /recommendations/:resultId/configure` with the required `selections`; a new
valid configuration is produced and can be checked out.

## Data model

Additive migration `20260701160000_pack_configuration_quiz_recommended`:

- `pack_configurations.recommendation_result_id` — nullable UUID, indexed,
  `ON DELETE SET NULL` FK to `recommendation_results(id)`. Null for every Phase 6
  `CUSTOMIZED` configuration.

`RecommendationResultItem.selected_product_reference_id` remains **NOT NULL** and
is deliberately untouched: pending customer-choice slots are represented in the
*configuration* (null `PackConfigurationItem.productReferenceId`), never by
weakening the recommendation schema. No historical recommendation result is
altered.

## Guarantees / non-goals

- Reuses the existing `PackConfiguration` validation and the existing configured
  checkout; no new order/checkout machinery.
- Server-authoritative: never trusts client prices, references, quantities, or
  stock; everything is revalidated at checkout before an order is created.
- Unchanged: `POST /orders`, `POST /orders/checkout`, fixed Pack purchase
  (`POST /packs/:packId/order`), and the recommendation generation/read APIs.
- Out of scope: quiz-*generated* packs, add-on recommendations, and any change to
  recommendation scoring.

## Tests

- `src/modules/packs/packs.service.recommendation-config.spec.ts`
  - recommended fixed Pack → valid `QUIZ_RECOMMENDED` configuration
  - recommended Pack with a customer-choice slot → pending configuration
    (null reference stored)
  - valid selected option → valid configuration
  - disallowed / out-of-stock option → rejected, nothing persisted
  - no quiz answers / internal scores copied into the configuration
  - inactive recommended pack rejected; missing result → `404`
- `src/modules/orders/orders.service.recommendation-config.spec.ts`
  - pending required selection blocks checkout (no stock reserved, no order)
  - valid selection allows checkout; snapshot `sourceType = QUIZ_RECOMMENDED`
  - recommended fixed (non-customizable) pack checks out
  - `CUSTOMIZED` configuration still requires a customizable pack (unchanged)
