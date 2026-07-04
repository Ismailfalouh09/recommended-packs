# Public Catalog Improvements

## Reason

The normal ecommerce store needs public catalog reads that are not tied to the admin dashboard. Public categories support navigation, home category tiles, category pages, and category filters. Product search, filters, sorting, and pagination let listing pages stay backend-driven as the catalog grows instead of requiring the frontend to fetch every product and reimplement catalog rules.

## Backend Changes

- Added `src/modules/categories/categories.controller.ts` with public `GET /categories`.
- Updated `src/modules/categories/categories.module.ts` to register the public controller while keeping the admin controller registered.
- Updated `src/modules/categories/categories.service.ts` with `publicFindAll()` and a store-safe public category mapper.
- Added `src/modules/products/dto/query-public-products.dto.ts`.
- Updated `src/modules/products/products.controller.ts` to accept optional public product query params.
- Updated `src/modules/products/products.service.ts` to apply optional public search, filters, sorting, and pagination.
- Updated `src/common/swagger/api-response.models.ts` and `src/common/swagger/openapi.config.ts` for public catalog Swagger docs.
- Updated tests in `src/modules/categories/categories.service.spec.ts` and `src/modules/products/products.service.admin.spec.ts`.
- Regenerated `docs/openapi.json` and `docs/openapi.yaml`.

The existing public product response item mapper is still used. `GET /products` with no query params still returns the same compatible plain array of active products ordered by `createdAt desc`.

## Public Categories Contract

- Endpoint: `/categories`
- Method: `GET`
- Authentication: none

Response shape:

```ts
Array<{
  id: string;
  code: string;
  name: string;
  description?: string | null;
  image?: {
    urls?: {
      thumbnail?: string;
      card?: string;
      detail?: string;
      original?: string;
    };
    altText?: string | null;
  } | null;
  sortOrder?: number | null;
  productCount?: number;
  childCategoryCount?: number;
}>;
```

Notes and limitations:

- Only active categories are returned.
- Categories are ordered by `sortOrder asc`, then `name asc`.
- `productCount` counts active products with status `ACTIVE`.
- `childCategoryCount` counts active child categories.
- The public category image response is intentionally slim: URL variants and alt text only.

## Product Listing Contract

- Endpoint: `/products`
- Method: `GET`
- Authentication: none

Supported query params:

| Param          | Behavior                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------- |
| `search`       | Searches product `name`, `slug`, `description`, category `code`/`name`, and brand `name`.   |
| `categoryId`   | Filters by category UUID.                                                                   |
| `categoryCode` | Filters by category code.                                                                   |
| `brandId`      | Filters by brand UUID.                                                                      |
| `sortBy`       | Allows `createdAt`, `name`, or `basePrice`.                                                 |
| `sortOrder`    | Allows `asc` or `desc`.                                                                     |
| `inStock`      | When `true`, returns products with at least one active reference where `stockQuantity > 0`. |
| `page`         | Enables paginated response when sent.                                                       |
| `size`         | Page size, max 100; also enables paginated response when sent.                              |

Response behavior with no params:

- Returns a plain array.
- Keeps the existing active-product behavior.
- Keeps item response shape compatible with the previous public product mapper.
- Default ordering remains `createdAt desc`.

Response behavior with pagination:

- If `page` or `size` is sent, the endpoint returns:

```ts
{
  data: ProductResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
```

Notes and limitations:

- Advanced facets, price ranges, shade filters, and full-text ranking were not added.
- `inStock=false` does not force an out-of-stock filter; it behaves like no stock filter.
- Product response media URLs, references, category, brand, and existing fields are preserved.

## No-Impact Confirmation

- Admin category routes untouched.
- Admin category DTOs untouched.
- Admin category guards remain in place.
- Existing product response shape preserved.
- Existing `GET /products` no-param behavior remains compatible.
- Checkout/order flow untouched.
- `POST /orders` untouched.
- `POST /orders/checkout` untouched.
- Quiz/recommendation flow untouched.
- Existing frontend handoff remains compatible.

## Verification Results

| Check                      | Result | Notes                                                                                                                            |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`            | Passed | Nest build completed successfully.                                                                                               |
| `npm run test`             | Passed | 16 test suites passed, 185 tests passed.                                                                                         |
| `npx prisma validate`      | Passed | Prisma schema is valid.                                                                                                          |
| `npm run swagger:generate` | Passed | Regenerated `docs/openapi.json` and `docs/openapi.yaml`.                                                                         |
| `npm run swagger:check`    | Passed | OpenAPI verification completed successfully.                                                                                     |
| Curl categories            | Passed | `GET http://localhost:3011/categories` returned HTTP 200 with active category data.                                              |
| Curl products query        | Passed | `GET /products?search=test`, `GET /products?sortBy=basePrice&sortOrder=asc`, and `GET /products?inStock=true` returned HTTP 200. |

## Next Step

Recommended next backend task: public brands endpoint.
