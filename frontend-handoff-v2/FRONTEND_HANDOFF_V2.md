# Frontend Handoff V2

Date: 2026-07-02

This folder contains the latest frontend integration handoff generated from the current backend source and OpenAPI contract.

## Source Of Truth

- Main contract: `frontend-handoff-v2/openapi.json`
- YAML copy: `frontend-handoff-v2/openapi.yaml`
- Original generated files: `docs/openapi.json` and `docs/openapi.yaml`

Use OpenAPI for exact schemas, parameters, status codes, and DTO names. The markdown files are implementation guidance for screens and workflow readiness.

## Backend Base URLs

- Local API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON endpoint while server is running: `http://localhost:3000/api/docs-json`

## Authentication

Admin endpoints require `Authorization: Bearer <accessToken>`. Get the token from `POST /auth/login`, then verify it with `GET /auth/me`.

Customer-facing endpoints are public; some flows require identifiers such as `customerProfileId`, `sessionToken`, `orderId`, `packId`, `productId`, or slugs.

## Integration Order

1. Import `openapi.json` into the frontend API client tooling.
2. Wire public catalog reads: categories, brands, products, packs, product/pack reviews.
3. Wire quiz/profile/recommendation flow.
4. Wire checkout paths and order summary page.
5. Wire admin login, then admin read screens, then admin mutating screens.
6. Keep destructive admin actions behind confirmation UI.

## Admin Creation-Time Media

- `POST /admin/products` is documented as `multipart/form-data` and accepts optional `coverImage` plus repeated `images` file fields while creating a product.
- `POST /admin/products/{productId}/references` is documented as `multipart/form-data` and accepts optional `swatch` while creating a product reference.
- For multipart requests, send nested `attributes` as a JSON-encoded string. Existing edit-time media endpoints remain available for later image changes.

## Product Reference Galleries (Media Management)

Each product reference (shade) now supports an ordered, multi-image gallery, in
addition to its single swatch image. There are three separate image layers:

- `product.mediaGallery` — images shared across every reference (packaging, texture, tips).
- `reference.swatch` — the single shade-selector image (unchanged; `swatch`, `image`, `imageUrl` still work).
- `reference.galleryImages` — many images for that exact shade/reference.

Public product detail (`GET /products/{id}`, `GET /products/slug/{slug}`) now
returns, on every reference:

```json
{
  "galleryImages": [
    { "id": "image-id", "position": 0, "isPrimary": true, "altText": "Cherry Red lipstick", "urls": { "detail": "https://..." } }
  ],
  "primaryImageUrl": "https://..."
}
```

Recommended shade view composition:

```
visibleGallery = [selectedReference.galleryImages] + [product.mediaGallery]
```

Use `reference.swatch` for the shade selector control and `reference.primaryImageUrl`
as the hero image when a shade is selected. `primaryImageUrl` is `null` when a
reference has no gallery images.

Admin CRUD (protected; reads OWNER/ADMIN/STAFF, writes OWNER/ADMIN) under
`/admin/product-references/{referenceId}/gallery-images`:

- `GET /` — list gallery images (ordered by position).
- `POST /` — add an image (`multipart/form-data`, `file` + optional `altText`, `position`). The first image uploaded becomes primary automatically.
- `PATCH /reorder` — bulk reorder (`{ items: [{ imageId, position }] }`).
- `PATCH /{imageId}/primary` — set the primary image (previous primary is unset).
- `PATCH /{imageId}` — update `altText` / `position`.
- `DELETE /{imageId}` — delete (deleting the primary auto-promotes the first remaining image by position).

## Verification Snapshot

- `npm run build`: passed.
- `npm run swagger:generate`: passed.
- `npm run swagger:check`: passed.
- `npm test`: passed, 41 suites / 501 tests (includes reference-gallery + public-detail coverage).
