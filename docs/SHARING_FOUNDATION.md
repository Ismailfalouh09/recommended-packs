# Sharing Foundation (Phase 8B)

Universal share support for **Products**, **Packs**, and (as a safe foundation)
persisted **Pack configurations**. This phase adds only the backend metadata and
tokens needed for a client to render a share/Open Graph card. It deliberately
does **not** add share analytics, social login, Open Graph frontend pages, or
checkout from a shared link.

## Public Products and Packs — metadata only

Products and normal Packs are already public, so **no share token or database
record is created for them**. Instead, their existing public detail responses
now carry a storefront-safe `share` block:

```json
"share": {
  "shareUrl": "/products/foundation-x",
  "shareTitle": "Foundation X",
  "shareDescription": "Lightweight buildable foundation.",
  "shareImageUrl": "https://cdn.example.com/foundation-x.jpg"
}
```

- **Availability:** share metadata is only ever built inside the public detail
  mappers, which are only reached for **active public** Products
  (`status = ACTIVE`, via `GET /products/:id` and `GET /products/slug/:slug`) and
  **active public** Packs (`status = ACTIVE` and `isActive = true`, via
  `GET /packs/:id`, `GET /packs/slug/:slug`, and the discovery list). An
  inactive/archived/non-public Product or Pack resolves `404` and can never be
  shared. No duplicate share endpoints were added — the existing public detail
  endpoints are sufficient.
- **Fields:**
  - `shareUrl` — the canonical public path built from the existing slug
    (`/products/:slug`, `/packs/:slug`). Absolute when `STORE_FRONTEND_ORIGIN`
    is configured (the same origin the API already trusts for CORS); otherwise
    the canonical relative path.
  - `shareTitle` — Product: `metaTitle ?? name`; Pack: `name`.
  - `shareDescription` — Product: `metaDescription ?? shortDescription ??
    description`; Pack: `description`. Trimmed to a compact card length.
  - `shareImageUrl` — the public cover image URL, falling back to `mainImageUrl`.
- **Reuse & safety:** the metadata is composed inside the existing public
  product/Pack response mappers from already-public fields only. No admin fields,
  costs, margins, stock internals, reserved quantities, recommendation data, or
  raw suitability scores are exposed.

The share helper lives in
[`src/common/share/share-metadata.util.ts`](../src/common/share/share-metadata.util.ts)
and is shared by both mappers.

## Configured Packs — opt-in share tokens

Because Phase 6 `PackConfiguration` persistence exists, configured Packs can be
shared through an opt-in, unique token.

### Data model

A single additive column on `pack_configurations`:

| Field        | Notes                                                                 |
| ------------ | --------------------------------------------------------------------- |
| `shareToken` | Nullable, **unique** (`VARCHAR(64)`). `NULL` until explicitly shared. |

`NULL`s are distinct in Postgres, so unshared configurations never collide on
the unique index. Migration:
**`20260701150000_pack_configuration_share_token`** (additive; no existing row
is altered — `share_token` is `NULL` until minted).

### `POST /configurations/:id/share`

Mints (or returns the existing) opaque share token for a persisted
configuration and returns a public share link:

```json
{
  "id": "<configuration-id>",
  "shareToken": "a3f1…e5f6",
  "shareUrl": "/shared/configurations/a3f1…e5f6"
}
```

- **Idempotent:** a configuration keeps a single stable token, so re-sharing
  returns the same link (the token is only generated once).
- **Authorization:** possession of the configuration **id** is the capability —
  mirroring the already-public `GET /configurations/:id` read. A persisted
  `PackConfiguration` carries no session owner in the data model (configurations
  are created without a session token), so ownership cannot be enforced at the
  row level in this phase. The security boundary that matters — never leaking
  customer/quiz/internal data — is enforced by the dedicated safe mapper below.
  Adding a true session owner is deferred to a later phase.
- Unknown id → `404`.

### `GET /shared/configurations/:shareToken`

Public, read-only view resolved by the opaque token, using a **dedicated safe
mapper** (`toSharedConfigurationResponse`). Unknown/blank token → `404`.

```json
{
  "sourcePack": { "name": "Natural Glow", "slug": "natural-glow", "imageUrl": "…" },
  "items": [
    {
      "productId": "…",
      "productName": "Foundation X",
      "productReferenceId": "…",
      "referenceName": "RF2 Medium",
      "shadeName": "Medium",
      "quantity": 1,
      "lineTotal": 120,
      "isAddOn": false
    }
  ],
  "finalPrice": 349,
  "currency": "MAD",
  "createdAt": "2026-07-01T10:00:00.000Z",
  "share": { "shareUrl": "…", "shareTitle": "Natural Glow — shared configuration", "shareImageUrl": "…" }
}
```

**Included** (customer-safe only): source Pack name/slug/image, selected
products/references, quantities, add-ons, and the final displayed price +
currency. Removed optional lines are dropped from the shared composition.

**Never included:** customer name/phone/address, session token, quiz answers,
recommendation scores, validation details/errors, the `minAllowedPrice` price
floor, `stockStatus`/`isValid`, costs, margins, or stock internals. (The internal
`GET /configurations/:id` response — which does carry `validationResult`,
`minAllowedPrice`, `stockStatus`, `isValid` — is **not** reused for sharing.)

## Scope guardrails

- No share tokens or DB records for Products or normal Packs.
- No share analytics, social login, Open Graph frontend pages, or checkout from
  a shared link.
- No Wishlist changes.
- Additive migration only; no existing table column is altered.
