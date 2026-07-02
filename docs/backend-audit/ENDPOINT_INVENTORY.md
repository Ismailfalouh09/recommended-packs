# Endpoint Inventory

Generated from `docs/openapi.json` on 2026-07-02. The inventory lists real routes exposed by the current NestJS controllers and Swagger decorators.

| Module | Method | Route | Public/Admin | Auth Required | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| Health | GET | / | Public | No | IMPLEMENTED | Root API check |
| Authentication | POST | /auth/login | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Authentication | GET | /auth/me | Admin | Yes | IMPLEMENTED | Get current authenticated admin |
| Attributes | GET | /attributes | Public | No | IMPLEMENTED | List active attribute groups |
| Attributes | GET | /attributes/{code}/options | Public | No | IMPLEMENTED | List active options for an attribute group code |
| Attributes | GET | /admin/attributes | Admin | Yes | IMPLEMENTED | List admin attribute groups |
| Attributes | POST | /admin/attributes | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Attributes | GET | /admin/attributes/{id} | Admin | Yes | IMPLEMENTED | Get admin attribute group details |
| Attributes | PATCH | /admin/attributes/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Attributes | DELETE | /admin/attributes/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Attributes | GET | /admin/attributes/{attributeGroupId}/options | Admin | Yes | IMPLEMENTED | List admin attribute options |
| Attributes | POST | /admin/attributes/{attributeGroupId}/options | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Attributes | GET | /admin/attribute-options/{id} | Admin | Yes | IMPLEMENTED | Get admin attribute option details |
| Attributes | PATCH | /admin/attribute-options/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Attributes | DELETE | /admin/attribute-options/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Categories | GET | /categories | Public | No | IMPLEMENTED | List active public categories |
| Categories | GET | /admin/categories | Admin | Yes | IMPLEMENTED | List admin categories |
| Categories | POST | /admin/categories | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Categories | GET | /admin/categories/{id} | Admin | Yes | IMPLEMENTED | Get admin category details |
| Categories | PATCH | /admin/categories/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Categories | DELETE | /admin/categories/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Media | POST | /admin/media/upload | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Media | GET | /admin/media | Admin | Yes | IMPLEMENTED | List media assets |
| Media | GET | /admin/media/{id} | Admin | Yes | IMPLEMENTED | Get media asset details |
| Media | PATCH | /admin/media/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Media | DELETE | /admin/media/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Media | POST | /admin/products/{productId}/images | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Media | PATCH | /admin/products/{productId}/images/reorder | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Media | PATCH | /admin/products/{productId}/images/{imageId} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Media | DELETE | /admin/products/{productId}/images/{imageId} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Pack Media | POST | /admin/packs/{packId}/images | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Pack Media | PATCH | /admin/packs/{packId}/images/reorder | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Pack Media | PATCH | /admin/packs/{packId}/images/{imageId} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Pack Media | DELETE | /admin/packs/{packId}/images/{imageId} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Category Media | PUT | /admin/categories/{categoryId}/image | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Category Media | DELETE | /admin/categories/{categoryId}/image | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Reference Media | PUT | /admin/product-references/{referenceId}/image | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product Reference Media | DELETE | /admin/product-references/{referenceId}/image | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Brands | GET | /brands | Public | No | IMPLEMENTED | List active public brands |
| Brands | GET | /admin/brands | Admin | Yes | IMPLEMENTED | List admin brands |
| Brands | POST | /admin/brands | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Brands | GET | /admin/brands/{id} | Admin | Yes | IMPLEMENTED | Get admin brand details |
| Brands | PATCH | /admin/brands/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Brands | DELETE | /admin/brands/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Quiz | GET | /quiz/questions | Public | No | IMPLEMENTED | List active quiz questions |
| Quiz | POST | /quiz/profiles | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Quiz | GET | /admin/quiz/questions | Admin | Yes | IMPLEMENTED | List admin quiz questions |
| Quiz | POST | /admin/quiz/questions | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Quiz | PATCH | /admin/quiz/questions/reorder | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Quiz | GET | /admin/quiz/questions/{id} | Admin | Yes | IMPLEMENTED | Get admin quiz question details |
| Quiz | PATCH | /admin/quiz/questions/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Quiz | DELETE | /admin/quiz/questions/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Products | GET | /products | Public | No | IMPLEMENTED | List active products |
| Products | GET | /products/slug/{slug} | Public | No | IMPLEMENTED | Get an active product by slug |
| Products | GET | /products/{id} | Public | No | IMPLEMENTED | Get an active product by ID |
| Products | GET | /admin/products | Admin | Yes | IMPLEMENTED | List admin products |
| Products | POST | /admin/products | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Products | GET | /admin/products/{id} | Admin | Yes | IMPLEMENTED | Get admin product details |
| Products | PATCH | /admin/products/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Products | DELETE | /admin/products/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product References | GET | /admin/products/{productId}/references | Admin | Yes | IMPLEMENTED | List product references for a product |
| Product References | POST | /admin/products/{productId}/references | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product References | GET | /admin/product-references/{id} | Admin | Yes | IMPLEMENTED | Get product reference details |
| Product References | PATCH | /admin/product-references/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product References | DELETE | /admin/product-references/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Product References | PATCH | /admin/product-references/{id}/stock | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | GET | /packs | Public | No | IMPLEMENTED | List active packs (public catalog discovery) |
| Packs | POST | /packs/{packId}/order | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | POST | /packs/{packId}/validate-configuration | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | POST | /packs/{packId}/configurations | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | GET | /packs/slug/{slug} | Public | No | IMPLEMENTED | Get an active pack by slug |
| Packs | GET | /packs/{id} | Public | No | IMPLEMENTED | Get an active pack by ID |
| Packs | GET | /configurations/{id} | Public | No | IMPLEMENTED | Get a persisted pack configuration |
| Packs | POST | /configurations/{id}/share | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | POST | /configurations/{id}/checkout | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Recommendations | POST | /recommendations/{resultId}/configure | Public | No | IMPLEMENTED | Rule-based recommendation flow. |
| Packs | GET | /shared/configurations/{shareToken} | Public | No | IMPLEMENTED | Get a shared pack configuration by its share token |
| Packs | GET | /admin/packs | Admin | Yes | IMPLEMENTED | List admin packs |
| Packs | POST | /admin/packs | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | GET | /admin/packs/{id} | Admin | Yes | IMPLEMENTED | Get admin pack details |
| Packs | PATCH | /admin/packs/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Packs | DELETE | /admin/packs/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Orders | POST | /orders/checkout | Public | No | IMPLEMENTED | Checkout from submitted cart lines; no persistent cart resource exists. |
| Orders | POST | /orders | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Orders | GET | /orders/{id} | Public | No | IMPLEMENTED | Get safe public order summary |
| Orders | GET | /admin/orders | Admin | Yes | IMPLEMENTED | List admin orders |
| Orders | GET | /admin/orders/{id} | Admin | Yes | IMPLEMENTED | Get admin order details |
| Orders | PATCH | /admin/orders/{id}/status | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Recommendations | POST | /recommendations | Public | No | IMPLEMENTED | Rule-based recommendation flow. |
| Recommendations | GET | /recommendations/{sessionId} | Public | No | IMPLEMENTED | Rule-based recommendation flow. |
| Recommendation Rules | GET | /admin/recommendation-rules | Admin | Yes | IMPLEMENTED | List recommendation rules |
| Recommendation Rules | POST | /admin/recommendation-rules | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Recommendation Rules | POST | /admin/recommendation-rules/preview | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Recommendation Rules | GET | /admin/recommendation-rules/{id} | Admin | Yes | IMPLEMENTED | Get recommendation rule details |
| Recommendation Rules | PATCH | /admin/recommendation-rules/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Recommendation Rules | DELETE | /admin/recommendation-rules/{id} | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Wishlist | POST | /wishlist/items | Public | No | IMPLEMENTED | Anonymous-session wishlist using customer profile/session identity; no customer auth. |
| Wishlist | GET | /wishlist | Public | No | IMPLEMENTED | Anonymous-session wishlist using customer profile/session identity; no customer auth. |
| Wishlist | DELETE | /wishlist/items/{itemId} | Public | No | IMPLEMENTED | Anonymous-session wishlist using customer profile/session identity; no customer auth. |
| Reviews | POST | /reviews | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Reviews | PATCH | /reviews/{reviewId} | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Reviews | DELETE | /reviews/{reviewId} | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Reviews | POST | /reviews/{reviewId}/images | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Reviews | DELETE | /reviews/{reviewId}/images/{imageId} | Public | No | IMPLEMENTED | Mutating endpoint; use safe test data. |
| Reviews | GET | /products/{slug}/reviews | Public | No | IMPLEMENTED | List approved reviews for a product |
| Reviews | GET | /packs/{slug}/reviews | Public | No | IMPLEMENTED | List approved reviews for a pack |
| Reviews | GET | /admin/reviews | Admin | Yes | IMPLEMENTED | List reviews for moderation |
| Reviews | PATCH | /admin/reviews/{reviewId}/moderation | Admin | Yes | IMPLEMENTED | Mutating endpoint; use safe test data. |

## Totals

- Total endpoints: 108
- Public endpoints: 37
- Admin endpoints: 71
- Protected endpoints: 71
- Partial/unverified endpoints: 0
