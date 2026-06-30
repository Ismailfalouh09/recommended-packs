# Pack Item Role Foundation (Phase 2)

> **Status:** Foundation-only. This document describes additive data introduced
> in **Phase 2** of the [Pack Core Evolution Master Plan](./PACK_CORE_EVOLUTION_MASTER_PLAN.md).
> Every field below is **persisted and returned through the admin Pack APIs but
> inert in runtime business logic.** Nothing here activates customization,
> checkout, cart, pricing, stock, or recommendation behavior.

---

## 1. The four `PackItem` roles

A new `PackItemRole` enum is added to `PackItem.role` (default `FIXED`). It is the
seed of a first-class item-role taxonomy that future phases will make
authoritative. **In Phase 2 the legacy `selectionMode` + `isRequired` fields
remain the only authoritative signals at runtime.**

| Role | Business meaning |
| --- | --- |
| `FIXED` | Included by default. Cannot be removed. The customer does not select it. |
| `REQUIRED_SELECTABLE` | Required in the Pack. The customer will later select an allowed product/reference. No customer-selection behavior is activated in this task. |
| `OPTIONAL_INCLUDED` | Included by default. May later be removable when allowed. |
| `OPTIONAL_ADDON` | Not included by default. May later be added when allowed. |

### Additive per-item rule fields

| Field | Type | Default | Meaning (deferred) |
| --- | --- | --- | --- |
| `minQuantity` | `Int?` | `null` | Lower bound for future customer quantity edits. |
| `maxQuantity` | `Int?` | `null` | Upper bound for future customer quantity edits. |
| `quantityEditable` | `Boolean` | `false` | Whether the customer may later change quantity. |
| `removalAllowed` | `Boolean` | `false` | Whether an optional item may later be removed. |
| `replacementAllowed` | `Boolean` | `false` | Whether the item may later be replaced. |

### Allowed-reference foundation

`PackItemAllowedReference` links a `PackItem` to the `ProductReference` records a
customer will later be allowed to choose (unique per item/reference). Exposed on
the admin item DTO/read as `allowedReferenceIds`. Each id must belong to the
item's product. **Foundation data only** — not consumed by any runtime logic.

---

## 2. New `Pack`-level rule fields

| Field | Type | Default | Meaning (deferred) |
| --- | --- | --- | --- |
| `isCustomizable` | `Boolean` | `false` | Marks a Pack as customizable. **Does not enable customization in Phase 2.** |
| `minRequiredItems` | `Int?` | `null` | Future minimum item count for a valid configuration. |
| `maxItemCount` | `Int?` | `null` | Future maximum item count for a valid configuration. |
| `minAllowedPrice` | `Decimal?` | `null` | Future minimum configured price floor. **Not enforced in Phase 2.** |

### Allowed add-on foundation

`PackAllowedAddOn` links a `Pack` to an allowed add-on `Product` (and optionally a
`ProductReference`), unique per combination. Exposed on the admin Pack DTO/read as
`allowedAddOnIds` (product ids). **Foundation data only.**

---

## 3. Structural validation (the only validation added)

Admin create/update validate structure only — no business rules:

- `minQuantity >= 0`, `maxQuantity >= 0`, and `minQuantity <= maxQuantity` when both present.
- `minRequiredItems >= 0`, `maxItemCount >= 0`, and `minRequiredItems <= maxItemCount` when both present.
- `minAllowedPrice >= 0` when present.
- Each `allowedReferenceIds` entry must belong to the item's product; each `allowedAddOnIds` product must exist.

Deferred (NOT added here): "required-selectable must have options", "min price
below default price", add-on price calculation, customer-selection validation.

---

## 4. Default behavior for existing Packs

The Phase 2 migration is fully additive. Existing rows backfill to safe defaults:

- `Pack.isCustomizable = false`; `minRequiredItems`/`maxItemCount`/`minAllowedPrice = null`.
- `PackItem.role = FIXED`; `quantityEditable`/`removalAllowed`/`replacementAllowed = false`; `minQuantity`/`maxQuantity = null`.

Legacy `selectionMode`, `isRequired`, `quantity`, and the product/reference
relations are unchanged and remain authoritative. Existing Packs behave
**exactly as before** through public reads, admin CRUD, recommendation, cart,
checkout, order creation, and pricing.

---

## 5. What remains deferred to later phases

| Capability | Phase |
| --- | --- |
| Recommendation tolerance for customer-choice slots | 1 (done) |
| Customizable Pack rules + configuration validator | 5 |
| Customer Pack configuration persistence + configured checkout | 6 |
| Admin management of allowed sets / limits / min price | 7 |
| Minimum-price + margin enforcement | 5 / 10 |
| Quiz-preconfigured and quiz-generated Packs | 9 / 10 |

Until those phases, the fields described here are **structural foundation only.**
