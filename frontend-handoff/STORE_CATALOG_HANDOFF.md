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

## Public Products

### `GET /products`

Returns active public products. With no query params, the response remains the existing plain array shape.

Supported query params:

| Param          | Example                                                     | Notes                                                            |
| -------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `search`       | `/products?search=primer`                                   | Searches product text plus category and brand names.             |
| `categoryId`   | `/products?categoryId=00000000-0000-4000-8000-000000000001` | Filters by category UUID.                                        |
| `categoryCode` | `/products?categoryCode=CHEEKS`                             | Filters by category code.                                        |
| `brandId`      | `/products?brandId=00000000-0000-4000-8000-000000000002`    | Filters by brand UUID.                                           |
| `sortBy`       | `/products?sortBy=basePrice`                                | Allowed values: `createdAt`, `name`, `basePrice`.                |
| `sortOrder`    | `/products?sortOrder=asc`                                   | Allowed values: `asc`, `desc`.                                   |
| `inStock`      | `/products?inStock=true`                                    | Requires at least one active reference with `stockQuantity > 0`. |
| `page`         | `/products?page=1`                                          | Enables paginated response.                                      |
| `size`         | `/products?page=1&size=12`                                  | Page size, max 100; enables paginated response.                  |

Example requests:

```bash
curl "http://localhost:3000/products"
curl "http://localhost:3000/products?search=test"
curl "http://localhost:3000/products?categoryCode=CHEEKS"
curl "http://localhost:3000/products?sortBy=basePrice&sortOrder=asc"
curl "http://localhost:3000/products?inStock=true"
curl "http://localhost:3000/products?page=1&size=12"
```

Example response without pagination:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "name": "Sahra Pore Smooth Primer",
    "slug": "sahra-pore-smooth-primer",
    "description": "Lightweight smoothing primer.",
    "basePrice": "109",
    "currency": "MAD",
    "mainImageUrl": null,
    "status": "ACTIVE",
    "category": {
      "id": "00000000-0000-4000-8000-000000000010",
      "code": "FACE",
      "name": "Face",
      "image": null
    },
    "brand": {
      "id": "00000000-0000-4000-8000-000000000020",
      "name": "Sahra"
    },
    "references": [],
    "coverImage": null,
    "images": []
  }
]
```

Example response with pagination:

```json
{
  "data": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "name": "Sahra Pore Smooth Primer",
      "slug": "sahra-pore-smooth-primer",
      "basePrice": "109",
      "currency": "MAD",
      "status": "ACTIVE",
      "category": {
        "id": "00000000-0000-4000-8000-000000000010",
        "code": "FACE",
        "name": "Face",
        "image": null
      },
      "brand": {
        "id": "00000000-0000-4000-8000-000000000020",
        "name": "Sahra"
      },
      "references": [],
      "coverImage": null,
      "images": []
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

- Existing product adapters can keep using the same product item fields.
- Do not expect pagination metadata unless `page` or `size` is sent.
- Category pages can call `/products?categoryCode=<code>` or `/products?categoryId=<id>`.
- Search pages can call `/products?search=<term>`.
- Listing sort menus should only send `createdAt`, `name`, or `basePrice`.
- Availability toggles should send `inStock=true`.
- Product references remain the source for variant/shade display and stock display.
