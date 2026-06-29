# Store Catalog Handoff

## Base URL

Local backend base URL:

```txt
http://localhost:3000
```

No bearer token is required for these public catalog endpoints.

## Public Categories

### `GET /categories`

Returns active categories for store navigation, home tiles, category pages, and category filters.

Example request:

```bash
curl http://localhost:3000/categories
```

Example response:

```json
[
  {
    "id": "3a349aff-18fc-4e13-a795-ba81530fd9f0",
    "code": "CHEEKS",
    "name": "Cheeks",
    "description": "Blush and cheek color products.",
    "image": {
      "urls": {
        "original": "https://res.cloudinary.com/demo/image/upload/categories/cheeks",
        "thumbnail": "https://res.cloudinary.com/demo/image/upload/c_fill,w_200,h_200/categories/cheeks",
        "card": "https://res.cloudinary.com/demo/image/upload/c_fill,w_600,h_600/categories/cheeks",
        "detail": "https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,h_1200/categories/cheeks"
      },
      "altText": "Cheeks category"
    },
    "sortOrder": 1,
    "productCount": 4,
    "childCategoryCount": 0
  }
]
```

Frontend notes:

- Use `code` for category filter links when a stable readable identifier is preferred.
- Use `id` when the UI already has category UUIDs.
- Use `image.urls.card` for category tiles and `image.urls.thumbnail` for compact nav imagery.
- Only active categories are returned.
- `productCount` counts active products with status `ACTIVE`.

## Public Brands

### `GET /brands`

Returns active brands for brand filters, brand list UI, and optional brand strips.

Example request:

```bash
curl http://localhost:3000/brands
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

- Use brand `id` with `/products?brandId=<id>` for product listing filters.
- Use `logoUrl` only when present; fall back to brand text when it is `null`.
- The Brand model does not have a public `code` field.
- `productCount` counts active products with status `ACTIVE`.
- Only active brands are returned.

## Public Products

### `GET /products`

Returns active public products. With no query params, the response remains the existing plain array shape.

Supported query params:

| Param              | Example                                                     | Notes                                                            |
| ------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `search`           | `/products?search=primer`                                   | Searches product text plus category and brand names.             |
| `categoryId`       | `/products?categoryId=00000000-0000-4000-8000-000000000001` | Filters by category UUID.                                        |
| `categoryCode`     | `/products?categoryCode=CHEEKS`                             | Filters by category code.                                        |
| `brandId`          | `/products?brandId=00000000-0000-4000-8000-000000000002`    | Filters by brand UUID.                                           |
| `productType`      | `/products?productType=face-serum`                          | Filters by stable product-type code.                             |
| `minPrice`         | `/products?minPrice=50`                                     | Filters by base price lower bound.                               |
| `maxPrice`         | `/products?maxPrice=300`                                    | Filters by base price upper bound.                               |
| `attributeOptions` | `/products?attributeOptions=DRY,MEDIUM`                     | AND filter across product/reference suitability option codes.    |
| `sortBy`           | `/products?sortBy=basePrice`                                | Allowed values: `createdAt`, `name`, `basePrice`.                |
| `sortOrder`        | `/products?sortOrder=asc`                                   | Allowed values: `asc`, `desc`.                                   |
| `inStock`          | `/products?inStock=true`                                    | Requires at least one active reference with `stockQuantity > 0`. |
| `onSale`           | `/products?onSale=true`                                     | Filters products with an original/compare-at price.              |
| `page`             | `/products?page=1`                                          | Enables paginated response.                                      |
| `size`             | `/products?page=1&size=12`                                  | Page size, max 100; enables paginated response.                  |

Example requests:

```bash
curl "http://localhost:3000/products"
curl "http://localhost:3000/products?search=test"
curl "http://localhost:3000/products?categoryCode=CHEEKS"
curl "http://localhost:3000/products?sortBy=basePrice&sortOrder=asc"
curl "http://localhost:3000/products?inStock=true"
curl "http://localhost:3000/products?onSale=true"
curl "http://localhost:3000/products?page=1&size=12"
```

Example response without pagination:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "slug": "sahra-pore-smooth-primer",
    "name": "Sahra Pore Smooth Primer",
    "brand": {
      "id": "00000000-0000-4000-8000-000000000020",
      "name": "Sahra"
    },
    "category": {
      "id": "00000000-0000-4000-8000-000000000010",
      "code": "FACE",
      "name": "Face"
    },
    "productType": "primer",
    "coverImage": null,
    "coverImageUrl": null,
    "priceFrom": 109,
    "currentPrice": 109,
    "originalPrice": null,
    "compareAtPrice": null,
    "onSale": false,
    "percentageSaving": 0,
    "currency": "MAD",
    "inStock": true,
    "availability": {
      "inStock": true,
      "label": "IN_STOCK"
    }
  }
]
```

Example response with pagination:

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "slug": "sahra-pore-smooth-primer",
      "name": "Sahra Pore Smooth Primer",
      "category": {
        "id": "00000000-0000-4000-8000-000000000010",
        "code": "FACE",
        "name": "Face"
      },
      "brand": {
        "id": "00000000-0000-4000-8000-000000000020",
        "name": "Sahra"
      },
      "productType": "primer",
      "coverImage": null,
      "currentPrice": 109,
      "priceFrom": 109,
      "originalPrice": null,
      "onSale": false,
      "currency": "MAD",
      "availability": {
        "inStock": true,
        "label": "IN_STOCK"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 12,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

Frontend notes:

- Product listing returns safe cards only. It does not include references, raw stock, internal media IDs, provider IDs, status, cost price, barcode, or admin audit fields.
- Do not expect pagination metadata unless `page` or `size` is sent.
- Category pages can call `/products?categoryCode=<code>` or `/products?categoryId=<id>`.
- Search pages can call `/products?search=<term>`.
- Listing sort menus should only send `createdAt`, `name`, or `basePrice`.
- Availability toggles should send `inStock=true`.
- Product references are returned by the product detail route, not by listing cards.

## Public Product Detail Routes

### `GET /products/:id`

Returns active product details by UUID.

### `GET /products/slug/:slug`

Returns active product details by slug with the same response shape as `GET /products/:id`.

Both detail routes accept optional `selectedReferenceId=<uuid>` to preselect an active reference. If omitted, the backend selects the default in-stock reference, then the first in-stock reference, then the default/first active reference.

Example request:

```bash
curl http://localhost:3000/products/slug/sahra-pore-smooth-primer
```

Frontend notes:

- Prefer `/products/slug/:slug` for SEO-friendly product detail URLs when a product payload includes `slug`.
- Fall back to `/products/:id` if slug is missing.
- Unknown or inactive product slugs return `404`.
- The response is one aggregated PDP payload containing product content, brand/category, product media, selected reference, selectable references, suitability, and add-to-cart constraints.
- `selectableReferences[]` includes `id`, `label`, `sku`, shade/measurement/swatch, image, current/original price, availability, and `disabledReason`.
- Public images omit internal media IDs/provider IDs. Reference availability exposes booleans and reasons, not exact reserved stock.

## Public Pack Detail Routes

### `GET /packs/:id`

Returns active pack details by UUID.

### `GET /packs/slug/:slug`

Returns active pack details by slug with the same response shape as `GET /packs/:id`.

Example request:

```bash
curl http://localhost:3000/packs/slug/natural-glow-pack
```

Frontend notes:

- Prefer `/packs/slug/:slug` for SEO-friendly pack detail URLs when a pack payload includes `slug`.
- Fall back to `/packs/:id` if slug is missing.
- Unknown or inactive pack slugs return `404`.
- Pack items, media, attributes, and product reference fields match the UUID detail endpoint.
