# Customer Page Endpoint Mapping

This maps a mobile-first customer frontend to the current public backend endpoints.

## App Bootstrap

- Optional health/home check: `GET /`
- API docs during development: `GET /api/docs`
- OpenAPI JSON during development: `GET /api/docs-json`

## Quiz Landing / First Step

- `GET /quiz/questions`

Use this to decide whether the quiz can start and to render the first active question. Sort/render by `stepOrder`.

## Quiz Step Screen

- Already-loaded data from `GET /quiz/questions`

Use `question.attributeGroup.code` and selected `option.code` to build the answers payload.

## Quiz Submit

- `POST /quiz/profiles`
- `POST /recommendations`

Submit the profile first, then generate recommendations from the returned `customerProfileId`.

## Recommendation Results

- Initial data: `POST /recommendations`
- Reload/share/restore: `GET /recommendations/:sessionId`

Use each result's `recommendationResultId` for checkout. Show pack image, rank, `matchPercentage`, selected items, reference names, and item quantities.

## Recommended Pack Detail

- Preferred after quiz: selected object from `recommendedPacks`
- Optional catalog detail: `GET /packs/:id`

The recommendation result is the source of truth for checkout because it contains the selected references and `recommendationResultId`.

## Checkout

- `POST /orders`

Required customer fields are `fullName`, `phone`, `city`, and `addressLine`. Use the chosen recommendation's `recommendationResultId`.

## Order Confirmation

- Initial data: `POST /orders` response
- Reload/share/restore: `GET /orders/:id`

The public order lookup is intentionally limited. Keep the richer `POST /orders` response in local state if the confirmation page must show line items immediately after checkout.

## Store Home

- `GET /packs`
- `GET /products`

There is no public hero/banner/content endpoint. Storefront merchandising must be frontend-managed or derived from active packs/products.

## Pack Listing

- `GET /packs`

No backend pagination, search, filters, or sort parameters are currently supported.

## Pack Detail

- `GET /packs/:id`

Use UUID, not slug. Public slug lookup does not exist yet.

## Product Listing

- `GET /products`

No backend pagination, search, filters, category filter, brand filter, or sort parameters are currently supported.

## Product Detail

- `GET /products/:id`

Use UUID, not slug. Public slug lookup does not exist yet.

## Product Shade / Reference Picker

- Use `product.references` from `GET /products/:id`
- Optional attribute helper: `GET /attributes`
- Optional group options helper: `GET /attributes/:code/options`

Shade/reference images are exposed as `reference.image.urls.swatch` when uploaded through the media system.

## Category Or Brand Pages

No current public endpoint.

Possible temporary frontend approaches:

- Derive categories/brands from `GET /products`.
- Hide category/brand pages until public endpoints are added.

## Regular Store Checkout

No current public endpoint.

The current `POST /orders` endpoint requires a `recommendationResultId`, so it supports quiz/recommendation checkout only. A regular cart/direct checkout API would need backend work.
