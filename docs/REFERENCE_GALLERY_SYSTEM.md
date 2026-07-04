# Reference Gallery System (Media Management — Task 14)

Per-reference (per-shade) image galleries. This is an **additive** layer: nothing
about the existing product gallery or the single swatch image changed.

## The three image layers

There are now three clearly separated image collections on a product detail:

```
product.mediaGallery      = shared product images  (packaging, texture, tips)
reference.swatch          = shade selector image    (one per reference)
reference.galleryImages   = images for THIS exact shade / reference
```

| Layer | Model | Cardinality | Role | Purpose |
|-------|-------|-------------|------|---------|
| Product gallery | `ProductImage` | many per product | `COVER` / `GALLERY` | Images shared across every reference |
| Reference swatch | `ProductReferenceImage` | **one** per reference | `SWATCH` | The shade selector thumbnail |
| Reference gallery | `ProductReferenceGalleryImage` | **many** per reference | `GALLERY` | Photos of one exact shade (on-lip, on-hand, that shade's box) |

The swatch (`ProductReferenceImage`) is untouched — `swatch`, `image`, and
`imageUrl` on each reference behave exactly as before.

## Data model

`ProductReferenceGalleryImage` links a reference to a `MediaAsset` and reuses the
shared media pipeline (Cloudinary upload, transforms, dedupe-on-delete). No image
bytes live in PostgreSQL.

Fields: `productReferenceId`, `mediaId`, `position`, `isPrimary`, `altText`.

Invariants (enforced by the service inside a transaction, and by a partial unique
index `WHERE is_primary` in the migration):

- One reference has many gallery images, ordered by `position`.
- **At most one** gallery image per reference is `isPrimary`.
- The **first** uploaded image for a reference becomes primary automatically.
- Setting a new primary unsets the previous one (same transaction).
- Deleting the primary promotes the **first remaining image by position**.

## Admin endpoints

All protected (`JwtAuthGuard` + `RolesGuard`). Reads: OWNER/ADMIN/STAFF. Writes:
OWNER/ADMIN. Base path: `/admin/product-references/:referenceId/gallery-images`.

| Method | Path | Action |
|--------|------|--------|
| `GET` | `/` | List gallery images (ordered by position) |
| `POST` | `/` | Upload/add an image (multipart `file`, optional `altText`, `position`) |
| `PATCH` | `/reorder` | Bulk reorder (`{ items: [{ imageId, position }] }`) |
| `PATCH` | `/:imageId/primary` | Set an image as primary |
| `PATCH` | `/:imageId` | Update `altText` / `position` |
| `DELETE` | `/:imageId` | Delete an image (auto-promotes a new primary if needed) |

## Public product detail

Every reference in the public product-detail response gains two additive fields:

```json
{
  "galleryImages": [
    {
      "id": "image-id",
      "position": 0,
      "isPrimary": true,
      "altText": "Cherry Red lipstick",
      "urls": {
        "detail": "https://..."
      }
    }
  ],
  "primaryImageUrl": "https://..."
}
```

`primaryImageUrl` is the `detail` URL of the primary gallery image (falling back
to the first image, or `null` when the gallery is empty). The `swatch` object and
`imageUrl` field are unchanged.

## Frontend usage

To render a shade's full visual set, combine the selected reference's own gallery
with the shared product gallery:

```
visibleGallery =
  [selectedReference.galleryImages]   // this exact shade
  +
  [product.mediaGallery]              // shared across all shades
```

Use `reference.swatch` only for the shade selector control, and
`reference.primaryImageUrl` as the hero/lead image when a shade is selected.

## Migration

`prisma/migrations/20260703120000_product_reference_gallery_images/` — creates
`product_reference_gallery_images` (additive; alters no existing table) with the
one-primary-per-reference partial unique index.
