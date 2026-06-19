# Slug Lookup Routes

## Reason

Slug lookup routes let the normal store use clean, SEO-friendly product and pack URLs while preserving the existing UUID detail endpoints. They are additive public reads and reuse the existing detail response mapping so current consumers do not need to change.

## Backend Changes

- Product slug route: `GET /products/slug/:slug`
- Pack slug route: `GET /packs/slug/:slug`
- Controller files changed:
  - `src/modules/products/products.controller.ts`
  - `src/modules/packs/packs.controller.ts`
- Service methods added:
  - `ProductsService.findBySlug(slug)`
  - `PacksService.findBySlug(slug)`
- Response shape compatibility:
  - Product slug details reuse the same select and public mapper used by UUID product details.
  - Pack slug details reuse the same select and public mapper used by UUID pack details.

## Product Slug Contract

- Method: `GET`
- Endpoint: `/products/slug/:slug`
- Path parameter: `slug` string
- Response behavior: returns one active product with the same response shape as `GET /products/:id`, including category, brand, active references, cover image, and images.
- Not found behavior: returns `404` when no active product with the slug exists.

## Pack Slug Contract

- Method: `GET`
- Endpoint: `/packs/slug/:slug`
- Path parameter: `slug` string
- Response behavior: returns one active pack with the same response shape as `GET /packs/:id`, including attributes, items, product summaries, useful product references, cover image, and images.
- Not found behavior: returns `404` when no active pack with the slug exists.

## No-Impact Confirmation

- Existing `GET /products/:id` untouched.
- Existing `GET /packs/:id` untouched.
- Product response shape preserved.
- Pack response shape preserved.
- Admin routes untouched.
- Checkout/order flow untouched.
- Quiz/recommendation flow untouched.
- Prisma schema untouched.

## Verification Results

| Check | Result | Notes |
| ----- | ------ | ----- |
| `npm run build` | Passed | Nest build completed successfully. |
| `npm run test` | Passed | 16 test suites passed, 196 tests passed. |
| `npx prisma validate` | Passed | Prisma schema is valid. |
| Curl product slug if executed | Passed | Temporary server on port 3013 returned product details for `/products/slug/sahra-pore-smooth-primer`. |
| Curl pack slug if executed | Passed | Temporary server on port 3013 returned pack details for `/packs/slug/bridal-glow-pack`. |
| Curl product UUID if executed | Passed | `GET /products/b838f293-360c-4859-b608-f095aed084a7` returned the same product ID as the slug lookup. |
| Curl pack UUID if executed | Passed | `GET /packs/fde5c65c-cde1-41ea-8a09-c4ad4c4bebb8` returned the same pack ID as the slug lookup. |

## Next Step

Start frontend integration with the template using the completed backend handoff, or add delivery fee rules if needed before frontend checkout.
