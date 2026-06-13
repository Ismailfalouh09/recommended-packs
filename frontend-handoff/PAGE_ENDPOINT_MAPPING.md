# Page Endpoint Mapping

Use `Authorization: Bearer <accessToken>` for all admin endpoints.

## Login

- `POST /auth/login`
- `GET /auth/me`

## Categories

- `GET /admin/categories`
- `GET /admin/categories/:id`
- `POST /admin/categories`
- `PATCH /admin/categories/:id`
- `DELETE /admin/categories/:id`
- `PUT /admin/categories/:categoryId/image`
- `DELETE /admin/categories/:categoryId/image`

## Brands

- `GET /admin/brands`
- `GET /admin/brands/:id`
- `POST /admin/brands`
- `PATCH /admin/brands/:id`
- `DELETE /admin/brands/:id`

## Products

- `GET /admin/products`
- `GET /admin/products/:id`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id`
- `POST /admin/products/:productId/images`
- `PATCH /admin/products/:productId/images/reorder`
- `PATCH /admin/products/:productId/images/:imageId`
- `DELETE /admin/products/:productId/images/:imageId`

## Product References

- `GET /admin/products/:productId/references`
- `GET /admin/product-references/:id`
- `POST /admin/products/:productId/references`
- `PATCH /admin/product-references/:id`
- `PATCH /admin/product-references/:id/stock`
- `DELETE /admin/product-references/:id`
- `PUT /admin/product-references/:referenceId/image`
- `DELETE /admin/product-references/:referenceId/image`

## Packs

- `GET /admin/packs`
- `GET /admin/packs/:id`
- `POST /admin/packs`
- `PATCH /admin/packs/:id`
- `DELETE /admin/packs/:id`
- `POST /admin/packs/:packId/images`
- `PATCH /admin/packs/:packId/images/reorder`
- `PATCH /admin/packs/:packId/images/:imageId`
- `DELETE /admin/packs/:packId/images/:imageId`

## Quiz And Attributes

- `GET /admin/attributes`
- `GET /admin/attributes/:id`
- `POST /admin/attributes`
- `PATCH /admin/attributes/:id`
- `DELETE /admin/attributes/:id`
- `GET /admin/attributes/:attributeGroupId/options`
- `GET /admin/attribute-options/:id`
- `POST /admin/attributes/:attributeGroupId/options`
- `PATCH /admin/attribute-options/:id`
- `DELETE /admin/attribute-options/:id`
- `GET /admin/quiz/questions`
- `GET /admin/quiz/questions/:id`
- `POST /admin/quiz/questions`
- `PATCH /admin/quiz/questions/:id`
- `PATCH /admin/quiz/questions/reorder`
- `DELETE /admin/quiz/questions/:id`

## Recommendation Rules

- `GET /admin/recommendation-rules`
- `GET /admin/recommendation-rules/:id`
- `POST /admin/recommendation-rules`
- `PATCH /admin/recommendation-rules/:id`
- `DELETE /admin/recommendation-rules/:id`
- `POST /admin/recommendation-rules/preview`

## Orders

- `GET /admin/orders`
- `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status`

## Media Library

- `POST /admin/media/upload`
- `GET /admin/media`
- `GET /admin/media/:id`
- `PATCH /admin/media/:id`
- `DELETE /admin/media/:id`

Use entity-specific image endpoints for catalog attachments. Generic `/admin/media/upload` creates an unassigned media asset.
