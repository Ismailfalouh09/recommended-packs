# Store Slug Routes Handoff

## Public Product Slug Detail

### `GET /products/slug/:slug`

Returns the same public product detail response shape as `GET /products/:id`.

Example request:

```bash
curl http://localhost:3000/products/slug/foundation-x
```

Frontend usage notes:

- Use this endpoint for product detail pages whose route parameter is a product slug.
- The backend only returns active products with status `ACTIVE`.
- Product media, cover image, gallery images, category, brand, and active references match the UUID detail endpoint.
- If a product payload does not have a slug, link to the existing UUID route instead.
- Unknown or inactive slugs return `404`.

## Public Pack Slug Detail

### `GET /packs/slug/:slug`

Returns the same public pack detail response shape as `GET /packs/:id`.

Example request:

```bash
curl http://localhost:3000/packs/slug/natural-glow-pack
```

Frontend usage notes:

- Use this endpoint for pack detail pages whose route parameter is a pack slug.
- The backend only returns active packs with status `ACTIVE`.
- Pack items, media, attributes, fixed references, and useful product references match the UUID detail endpoint.
- If a pack payload does not have a slug, link to the existing UUID route instead.
- Unknown or inactive slugs return `404`.

## Fallback Behavior

- Prefer slugs for user-facing URLs when the catalog payload includes `slug`.
- Fall back to `GET /products/:id` or `GET /packs/:id` when slug is missing.
- Existing UUID detail routes remain supported and compatible.
