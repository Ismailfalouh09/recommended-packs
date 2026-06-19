# Store Brands Handoff

## Public Brands

### `GET /brands`

Returns active brands for storefront brand filters, brand list UI, and optional brand strips.

No bearer token is required.

Example request:

```bash
curl http://localhost:3000/brands
```

Response shape:

```ts
Array<{
  id: string;
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  productCount?: number;
}>;
```

Example response:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000020",
    "name": "Sahra",
    "description": "Moroccan-inspired beauty essentials.",
    "logoUrl": "https://example.com/sahra-logo.png",
    "productCount": 6
  }
]
```

Frontend notes:

- Use this endpoint for brand filter options instead of deriving brands from product lists.
- Use `id` with `GET /products?brandId=<id>` for filtered product listing.
- Use `logoUrl` only when present; fall back to brand text when it is `null`.
- `productCount` counts active products with status `ACTIVE`.
- Only active brands are returned.

Known limitations:

- The backend Brand model does not have a `code` field, so brand filters should use `id`.
- Brand logos are plain `logoUrl` values only; no new media asset relationship or transformed logo URL variants were added.
