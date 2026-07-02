# Postman Endpoint Test Checklist

Do not mark a result as passed unless it was actually run against a backend environment.

| Module | Method | Route | Happy Path | Validation | Auth | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Health | GET | / |  |  | N/A | NOT RUN |  |
| Authentication | POST | /auth/login |  |  | N/A | NOT RUN |  |
| Authentication | GET | /auth/me |  |  |  | NOT RUN |  |
| Attributes | GET | /attributes |  |  | N/A | NOT RUN |  |
| Attributes | GET | /attributes/{code}/options |  |  | N/A | NOT RUN |  |
| Attributes | GET | /admin/attributes |  |  |  | NOT RUN |  |
| Attributes | POST | /admin/attributes |  |  |  | NOT RUN |  |
| Attributes | GET | /admin/attributes/{id} |  |  |  | NOT RUN |  |
| Attributes | PATCH | /admin/attributes/{id} |  |  |  | NOT RUN |  |
| Attributes | DELETE | /admin/attributes/{id} |  |  |  | NOT RUN |  |
| Attributes | GET | /admin/attributes/{attributeGroupId}/options |  |  |  | NOT RUN |  |
| Attributes | POST | /admin/attributes/{attributeGroupId}/options |  |  |  | NOT RUN |  |
| Attributes | GET | /admin/attribute-options/{id} |  |  |  | NOT RUN |  |
| Attributes | PATCH | /admin/attribute-options/{id} |  |  |  | NOT RUN |  |
| Attributes | DELETE | /admin/attribute-options/{id} |  |  |  | NOT RUN |  |
| Categories | GET | /categories |  |  | N/A | NOT RUN |  |
| Categories | GET | /admin/categories |  |  |  | NOT RUN |  |
| Categories | POST | /admin/categories |  |  |  | NOT RUN |  |
| Categories | GET | /admin/categories/{id} |  |  |  | NOT RUN |  |
| Categories | PATCH | /admin/categories/{id} |  |  |  | NOT RUN |  |
| Categories | DELETE | /admin/categories/{id} |  |  |  | NOT RUN |  |
| Media | POST | /admin/media/upload |  |  |  | NOT RUN |  |
| Media | GET | /admin/media |  |  |  | NOT RUN |  |
| Media | GET | /admin/media/{id} |  |  |  | NOT RUN |  |
| Media | PATCH | /admin/media/{id} |  |  |  | NOT RUN |  |
| Media | DELETE | /admin/media/{id} |  |  |  | NOT RUN |  |
| Product Media | POST | /admin/products/{productId}/images |  |  |  | NOT RUN |  |
| Product Media | PATCH | /admin/products/{productId}/images/reorder |  |  |  | NOT RUN |  |
| Product Media | PATCH | /admin/products/{productId}/images/{imageId} |  |  |  | NOT RUN |  |
| Product Media | DELETE | /admin/products/{productId}/images/{imageId} |  |  |  | NOT RUN |  |
| Pack Media | POST | /admin/packs/{packId}/images |  |  |  | NOT RUN |  |
| Pack Media | PATCH | /admin/packs/{packId}/images/reorder |  |  |  | NOT RUN |  |
| Pack Media | PATCH | /admin/packs/{packId}/images/{imageId} |  |  |  | NOT RUN |  |
| Pack Media | DELETE | /admin/packs/{packId}/images/{imageId} |  |  |  | NOT RUN |  |
| Category Media | PUT | /admin/categories/{categoryId}/image |  |  |  | NOT RUN |  |
| Category Media | DELETE | /admin/categories/{categoryId}/image |  |  |  | NOT RUN |  |
| Product Reference Media | PUT | /admin/product-references/{referenceId}/image |  |  |  | NOT RUN |  |
| Product Reference Media | DELETE | /admin/product-references/{referenceId}/image |  |  |  | NOT RUN |  |
| Brands | GET | /brands |  |  | N/A | NOT RUN |  |
| Brands | GET | /admin/brands |  |  |  | NOT RUN |  |
| Brands | POST | /admin/brands |  |  |  | NOT RUN |  |
| Brands | GET | /admin/brands/{id} |  |  |  | NOT RUN |  |
| Brands | PATCH | /admin/brands/{id} |  |  |  | NOT RUN |  |
| Brands | DELETE | /admin/brands/{id} |  |  |  | NOT RUN |  |
| Quiz | GET | /quiz/questions |  |  | N/A | NOT RUN |  |
| Quiz | POST | /quiz/profiles |  |  | N/A | NOT RUN |  |
| Quiz | GET | /admin/quiz/questions |  |  |  | NOT RUN |  |
| Quiz | POST | /admin/quiz/questions |  |  |  | NOT RUN |  |
| Quiz | PATCH | /admin/quiz/questions/reorder |  |  |  | NOT RUN |  |
| Quiz | GET | /admin/quiz/questions/{id} |  |  |  | NOT RUN |  |
| Quiz | PATCH | /admin/quiz/questions/{id} |  |  |  | NOT RUN |  |
| Quiz | DELETE | /admin/quiz/questions/{id} |  |  |  | NOT RUN |  |
| Products | GET | /products |  |  | N/A | NOT RUN |  |
| Products | GET | /products/slug/{slug} |  |  | N/A | NOT RUN |  |
| Products | GET | /products/{id} |  |  | N/A | NOT RUN |  |
| Products | GET | /admin/products |  |  |  | NOT RUN |  |
| Products | POST | /admin/products |  |  |  | NOT RUN |  |
| Products | GET | /admin/products/{id} |  |  |  | NOT RUN |  |
| Products | PATCH | /admin/products/{id} |  |  |  | NOT RUN |  |
| Products | DELETE | /admin/products/{id} |  |  |  | NOT RUN |  |
| Product References | GET | /admin/products/{productId}/references |  |  |  | NOT RUN |  |
| Product References | POST | /admin/products/{productId}/references |  |  |  | NOT RUN |  |
| Product References | GET | /admin/product-references/{id} |  |  |  | NOT RUN |  |
| Product References | PATCH | /admin/product-references/{id} |  |  |  | NOT RUN |  |
| Product References | DELETE | /admin/product-references/{id} |  |  |  | NOT RUN |  |
| Product References | PATCH | /admin/product-references/{id}/stock |  |  |  | NOT RUN |  |
| Packs | GET | /packs |  |  | N/A | NOT RUN |  |
| Packs | POST | /packs/{packId}/order |  |  | N/A | NOT RUN |  |
| Packs | POST | /packs/{packId}/validate-configuration |  |  | N/A | NOT RUN |  |
| Packs | POST | /packs/{packId}/configurations |  |  | N/A | NOT RUN |  |
| Packs | GET | /packs/slug/{slug} |  |  | N/A | NOT RUN |  |
| Packs | GET | /packs/{id} |  |  | N/A | NOT RUN |  |
| Packs | GET | /configurations/{id} |  |  | N/A | NOT RUN |  |
| Packs | POST | /configurations/{id}/share |  |  | N/A | NOT RUN |  |
| Packs | POST | /configurations/{id}/checkout |  |  | N/A | NOT RUN |  |
| Recommendations | POST | /recommendations/{resultId}/configure |  |  | N/A | NOT RUN |  |
| Packs | GET | /shared/configurations/{shareToken} |  |  | N/A | NOT RUN |  |
| Packs | GET | /admin/packs |  |  |  | NOT RUN |  |
| Packs | POST | /admin/packs |  |  |  | NOT RUN |  |
| Packs | GET | /admin/packs/{id} |  |  |  | NOT RUN |  |
| Packs | PATCH | /admin/packs/{id} |  |  |  | NOT RUN |  |
| Packs | DELETE | /admin/packs/{id} |  |  |  | NOT RUN |  |
| Orders | POST | /orders/checkout |  |  | N/A | NOT RUN |  |
| Orders | POST | /orders |  |  | N/A | NOT RUN |  |
| Orders | GET | /orders/{id} |  |  | N/A | NOT RUN |  |
| Orders | GET | /admin/orders |  |  |  | NOT RUN |  |
| Orders | GET | /admin/orders/{id} |  |  |  | NOT RUN |  |
| Orders | PATCH | /admin/orders/{id}/status |  |  |  | NOT RUN |  |
| Recommendations | POST | /recommendations |  |  | N/A | NOT RUN |  |
| Recommendations | GET | /recommendations/{sessionId} |  |  | N/A | NOT RUN |  |
| Recommendation Rules | GET | /admin/recommendation-rules |  |  |  | NOT RUN |  |
| Recommendation Rules | POST | /admin/recommendation-rules |  |  |  | NOT RUN |  |
| Recommendation Rules | POST | /admin/recommendation-rules/preview |  |  |  | NOT RUN |  |
| Recommendation Rules | GET | /admin/recommendation-rules/{id} |  |  |  | NOT RUN |  |
| Recommendation Rules | PATCH | /admin/recommendation-rules/{id} |  |  |  | NOT RUN |  |
| Recommendation Rules | DELETE | /admin/recommendation-rules/{id} |  |  |  | NOT RUN |  |
| Wishlist | POST | /wishlist/items |  |  | N/A | NOT RUN |  |
| Wishlist | GET | /wishlist |  |  | N/A | NOT RUN |  |
| Wishlist | DELETE | /wishlist/items/{itemId} |  |  | N/A | NOT RUN |  |
| Reviews | POST | /reviews |  |  | N/A | NOT RUN |  |
| Reviews | PATCH | /reviews/{reviewId} |  |  | N/A | NOT RUN |  |
| Reviews | DELETE | /reviews/{reviewId} |  |  | N/A | NOT RUN |  |
| Reviews | POST | /reviews/{reviewId}/images |  |  | N/A | NOT RUN |  |
| Reviews | DELETE | /reviews/{reviewId}/images/{imageId} |  |  | N/A | NOT RUN |  |
| Reviews | GET | /products/{slug}/reviews |  |  | N/A | NOT RUN |  |
| Reviews | GET | /packs/{slug}/reviews |  |  | N/A | NOT RUN |  |
| Reviews | GET | /admin/reviews |  |  |  | NOT RUN |  |
| Reviews | PATCH | /admin/reviews/{reviewId}/moderation |  |  |  | NOT RUN |  |
