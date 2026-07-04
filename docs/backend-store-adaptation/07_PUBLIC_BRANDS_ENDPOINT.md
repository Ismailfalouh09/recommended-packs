# Public Brands Endpoint

## Reason

The normal store needs a public brand list for brand filters, brand list pages, and optional brand strips. Before this change, brand management existed only under protected admin routes, while the storefront could only infer brand names from product payloads.

## Backend Change

- Controller file: `src/modules/brands/brands.controller.ts`
- Service method: `BrandsService.publicFindAll()`
- Endpoint: `GET /brands`
- Authentication: none
- Swagger response model: `PublicBrandResponse`

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

Limitations:

- The Brand model does not have a public `code` field, so no brand code is returned.
- `logoUrl` is returned only from the existing `Brand.logoUrl` field. No new media relationship or transformation was added.
- `productCount` counts active products with status `ACTIVE`.

## Public Brands Contract

- Method: `GET`
- Endpoint: `/brands`
- Authentication: none

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

Notes:

- Only active brands are returned.
- Brands are ordered by `name asc`.
- The response intentionally omits admin-only fields such as `isActive`, `createdAt`, and `updatedAt`.

## No-Impact Confirmation

- Admin brand routes untouched.
- Admin guards untouched.
- Existing product response shape preserved.
- Checkout/order flow untouched.
- Quiz/recommendation flow untouched.
- Prisma schema untouched.

## Verification Results

| Check                 | Result | Notes                                                                                                                                                                         |
| --------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`       | Passed | Nest build completed successfully.                                                                                                                                            |
| `npm run test`        | Passed | 16 test suites passed, 190 tests passed.                                                                                                                                      |
| `npx prisma validate` | Passed | Prisma schema is valid.                                                                                                                                                       |
| Curl brands           | Passed | Port 3000 was already occupied by another Node process, so the app was started with `PORT=3012`; `GET http://localhost:3012/brands` returned HTTP 200 with active brand data. |

## Next Step

Recommended next backend task: product and pack slug lookup routes, or frontend integration start if the normal store backend is enough.
