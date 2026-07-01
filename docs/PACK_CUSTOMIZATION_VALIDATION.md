# Pack Customization Validation (Phase 5)

> **Companion to** [PACK_CORE_EVOLUTION_MASTER_PLAN.md](./PACK_CORE_EVOLUTION_MASTER_PLAN.md) (Phase 5)
> and [PACK_CORE_EVOLUTION_PROGRESS.md](./PACK_CORE_EVOLUTION_PROGRESS.md).

Phase 5 adds a **read-only, server-authoritative validator** for customizable
Packs. It answers one question: *"Is this proposed composition valid, and what
does it actually cost?"* — without persisting anything, reserving any stock, or
ever trusting a client-supplied price.

Persistence, configured checkout, wishlist/sharing, and quiz-to-configuration
flows are explicitly **out of scope** (Phases 6+).

---

## Endpoint contract

```
POST /packs/:packId/validate-configuration
```

Returns HTTP `200` with the validation result (even when the configuration is
invalid — the failure detail is in `validationErrors`). It throws only when the
request cannot be interpreted:

- `404 Not Found` — the Pack does not exist.
- `400 Bad Request` — the Pack is inactive/archived, or is **not** customizable
  (`isCustomizable=false`). Non-customizable Packs must use the fixed-purchase
  path ([`POST /packs/:packId/order`](./PACK_FIXED_PURCHASE_FLOW.md)).

### Request body

Only the customer's proposed selections — never prices or item snapshots.

```jsonc
{
  "items": [
    {
      "packItemId": "…",           // required: the slot being configured
      "productReferenceId": "…",   // optional: chosen reference / replacement
      "quantity": 2,                // optional: proposed quantity
      "removed": false              // optional: request removal of an optional item
    }
  ],
  "addOns": [
    {
      "productId": "…",            // required: must exist in PackAllowedAddOn
      "productReferenceId": "…",   // optional (required if the allow-list doesn't pin one)
      "quantity": 1                 // optional (defaults to 1)
    }
  ]
}
```

Both arrays are optional. Base items the client does not mention keep their
default reference and quantity.

### Response body

```jsonc
{
  "isValid": true,                 // true only when validationErrors is empty
  "computedPrice": 349,            // server-recomputed from current references
  "minAllowedPrice": 300,          // the Pack price floor, or null
  "stockStatus": "IN_STOCK",       // "IN_STOCK" | "OUT_OF_STOCK"
  "normalizedItems": [
    {
      "packItemId": "…",           // null for add-ons
      "productId": "…",
      "productReferenceId": "…",
      "role": "REQUIRED_SELECTABLE", // PackItemRole, or "ADD_ON"
      "quantity": 1,
      "unitPrice": 120,
      "lineTotal": 120,
      "isAddOn": false,
      "removed": false
    }
  ],
  "validationErrors": [
    { "code": "REFERENCE_NOT_ALLOWED", "message": "…", "packItemId": "…" }
  ]
}
```

The result is privacy-safe by construction: it carries no quiz answers, internal
scores, costs, or margins.

---

## Validation rules implemented

Base composition roles are `FIXED`, `REQUIRED_SELECTABLE`, and
`OPTIONAL_INCLUDED`. Add-ons are validated separately against `PackAllowedAddOn`.

| Rule | Behavior | Error code |
| --- | --- | --- |
| Only customizable Packs | `isCustomizable=false` (or inactive) is rejected before validation | `400` (throws) |
| Required `FIXED` items stay present | Removing a `FIXED` (or `REQUIRED_SELECTABLE`) item is rejected | `REQUIRED_ITEM_REMOVAL` |
| Required-selectable slot needs a valid choice | A `REQUIRED_SELECTABLE` slot must carry one allowed, active, in-stock reference | `MISSING_REQUIRED_SELECTION` |
| Optional removal is gated | Removing an `OPTIONAL_INCLUDED` item needs `removalAllowed=true` | `REMOVAL_NOT_ALLOWED` |
| Quantity is gated + bounded | Quantity may change only when `quantityEditable=true` and within `[minQuantity, maxQuantity]` | `QUANTITY_NOT_EDITABLE`, `QUANTITY_BELOW_MIN`, `QUANTITY_ABOVE_MAX` |
| Replacements are gated | Replacing a `FIXED`/`OPTIONAL_INCLUDED` reference needs `replacementAllowed=true` | `REPLACEMENT_NOT_ALLOWED` |
| References must be allowed | A chosen selectable/replacement reference must exist in `PackItemAllowedReference` | `REFERENCE_NOT_ALLOWED` |
| Add-ons must be allowed | An add-on must exist in `PackAllowedAddOn` (matched by product, and by reference when pinned) | `ADDON_NOT_ALLOWED` |
| Item-count limits | Final included item count must respect `minRequiredItems` / `maxItemCount` when set | `MIN_ITEMS_NOT_MET`, `MAX_ITEMS_EXCEEDED` |
| Live stock | Every resolved reference must be active with `availableStock ≥ quantity` (shared `availableReferenceStock`) | `INSUFFICIENT_STOCK`, `REFERENCE_INACTIVE` |
| Price floor | Computed price must be `≥ minAllowedPrice` (Phase 3 `isAtOrAboveMinAllowedPrice`) | `BELOW_MIN_PRICE` |
| Unknown slot | A selection targeting a slot the Pack does not own is rejected | `UNKNOWN_ITEM` |
| Unresolvable reference | A slot/add-on whose reference cannot be resolved is reported | `REFERENCE_UNRESOLVED`, `ADDON_REFERENCE_UNRESOLVED` |

### Pricing

Customizable Packs are priced by **summing the current effective reference
prices** (`priceOverride`, else `basePrice + priceDelta`) × quantity over the
final included composition (base items kept + add-ons). When the Pack's
`priceMode` is `SUM_ITEMS_WITH_DISCOUNT`, the Pack's configured discount is
applied to that subtotal (never below zero). Client prices are never used.

### Item count

`minRequiredItems` / `maxItemCount` count the number of **included line items**
in the final composition (each kept base slot and each add-on counts once,
regardless of its quantity). Validly removed optional items do not count.

---

## Design notes

- The rule engine lives in a pure, dependency-free function,
  [`validatePackConfiguration`](../src/modules/packs/pack-configuration.validator.ts),
  so every rule is unit-testable without a database. `PacksService` only loads
  the Pack (rejecting missing/non-customizable Packs) and maps it onto the
  validator input.
- It reuses existing helpers: the Phase 3 price floor
  ([`isAtOrAboveMinAllowedPrice`](../src/common/utils/pack-price-floor.util.ts))
  and the stock calculation
  ([`availableReferenceStock`](../src/modules/packs/pack-availability.util.ts)).
- **Read-only and additive.** Nothing is persisted, no stock is reserved, and
  `POST /orders`, `POST /orders/checkout`, `POST /packs/:id/order`, the fixed
  Pack purchase, the recommendation algorithm, cart behavior, and order creation
  are all unchanged.

---

## Tests

- [pack-configuration.validator.spec.ts](../src/modules/packs/pack-configuration.validator.spec.ts)
  — the rule matrix (valid selectable reference, missing selection, disallowed
  reference/replacement, disallowed add-on, quantity/min/max, unauthorized
  removal, min/max item counts, unavailable stock, below-minimum price, add-on
  pricing, discount, unknown slot).
- [packs.service.config.spec.ts](../src/modules/packs/packs.service.config.spec.ts)
  — loading + guarding: happy path, non-customizable rejection, inactive
  rejection, not-found.
