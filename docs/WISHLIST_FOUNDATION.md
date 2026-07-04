# Wishlist Foundation (Phase 8A)

Universal, session-scoped wishlist for **Products** and **Packs**. Customers can
save, list, and remove catalog entries. This phase deliberately does **not**
add a full account system, sharing, or PackConfiguration wishlisting.

## Ownership model

The wishlist reuses the existing anonymous-session identity — the
`CustomerProfile` created by `POST /quiz/profiles`, identified by its
`sessionToken`. The client passes that token in the **`X-Session-Token`**
header on every wishlist request. Every read and write is scoped to the
resolved profile, so a session can only ever see or mutate its own wishlist.

- Missing `X-Session-Token` → `400 Bad Request`.
- Unknown `X-Session-Token` → `404 Not Found` (treated as no session, so no
  cross-session data can be reached).

## Data model

`WishlistItem` (`wishlist_items` table):

| Field               | Notes                                                        |
| ------------------- | ----------------------------------------------------------- |
| `id`                | UUID primary key.                                           |
| `customerProfileId` | Owning session (FK → `customer_profiles`, `ON DELETE CASCADE`). |
| `targetType`        | `PRODUCT` \| `PACK` (`WishlistTargetType` enum).            |
| `productId`         | FK → `products` (set only for `PRODUCT`), `ON DELETE CASCADE`. |
| `packId`            | FK → `packs` (set only for `PACK`), `ON DELETE CASCADE`.    |
| `createdAt`         | Timestamp.                                                  |

Exactly one of `productId` / `packId` is ever set per row. Real foreign keys are
used (not snapshot ids), so wishlist rows stay consistent with the catalog and
are removed automatically if the target is deleted.

### Duplicate protection

Two composite unique indexes enforce de-duplication per owner + target at the
database level:

- `@@unique([customerProfileId, productId])`
- `@@unique([customerProfileId, packId])`

Postgres treats `NULL`s as distinct, so the product-scoped unique never
conflicts across the `NULL` `productId` of `PACK` rows (and vice versa), while
still guaranteeing at most one wishlist row per owner per concrete target.

Migration: **`20260701140000_wishlist_foundation`**.

## Endpoints

All endpoints are public (no admin bearer) and require `X-Session-Token`.

### `POST /wishlist/items`

Body:

```json
{ "targetType": "PRODUCT", "targetId": "<product-id>" }
```

or

```json
{ "targetType": "PACK", "targetId": "<pack-id>" }
```

- Only **active, public** Products (`status = ACTIVE`) and **active, public**
  Packs (`status = ACTIVE` and `isActive = true`) can be saved. Anything else →
  `404 Not Found` ("not found or is not available to be saved").
- **Idempotent**: re-adding the same target for the same session returns the
  existing entry with `created: false` instead of erroring (a concurrent
  duplicate is folded into the same path via the unique-constraint guard).
- Response `200 OK`:

```json
{ "created": true, "item": { "id": "...", "targetType": "PRODUCT", "createdAt": "...", "product": { ... }, "pack": null } }
```

### `GET /wishlist`

Returns the session's saved items, newest first, as customer-safe summaries:

```json
{ "items": [ { "id": "...", "targetType": "PACK", "createdAt": "...", "product": null, "pack": { ... } } ] }
```

### `DELETE /wishlist/items/:itemId`

Removes an item owned by the session. Removing an item that does not belong to
the session returns `404` (a session can never remove another owner's item).
Response `200 OK`: `{ "id": "<itemId>", "deleted": true }`.

## Customer-safe summaries

List/add responses return only storefront-safe fields — never stock counts,
reserved quantities, costs, margins, admin/customization rules, quiz answers, or
recommendation data.

**Product summary:** `id`, `slug`, `name`, `productType`, `mainImageUrl`,
`priceFrom` (lowest effective active-reference price), `compareAtPrice`/`onSale`,
`currency`, `brand`, `category`, and a derived boolean `inStock`.

**Pack summary:** `id`, `slug`, `name`, `mainImageUrl`, `price` (fixed price),
`priceMode`, `currency`, `isCustomizable`, discovery facets (`tier`, `occasion`,
`experienceLevel`, `isFeatured`, `isNew`, `isBestSeller`). Pack items, allowed
references, add-ons, `minAllowedPrice`, and compatibility profiles are not
exposed.

## Scope guardrails

- Products, Packs, recommendations, checkout, cart, and orders are unchanged.
- No sharing.
- No PackConfiguration wishlisting.
- Additive migration only; no existing table is altered.
