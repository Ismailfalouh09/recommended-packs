# Page Endpoint Mapping

OpenAPI is the source of truth for exact request and response shapes. Use `Authorization: Bearer {{adminAccessToken}}` for protected admin requests.

| Page | Endpoint(s) | Access | Readiness | Notes |
| --- | --- | --- | --- | --- |
| Customer Store - Home/catalog | GET /categories; GET /brands; GET /products; GET /packs | Public | READY | Public catalog discovery endpoints exist. |
| Customer Store - Product listing | GET /products | Public | READY | Supports public product listing filters from OpenAPI query params. |
| Customer Store - Product details | GET /products/{id}; GET /products/slug/{slug}; GET /products/{slug}/reviews | Public | READY | Slug and ID detail routes exist; reviews are approved-only. |
| Customer Store - Pack details | GET /packs/{id}; GET /packs/slug/{slug}; GET /packs/{slug}/reviews | Public | READY | Public pack details and approved reviews exist. |
| Customer Store - Cart | POST /orders/checkout | Public | PARTIAL | Checkout accepts cart-line payloads; no persistent cart CRUD resource exists. |
| Customer Store - Checkout | POST /orders/checkout; POST /orders; POST /packs/{packId}/order; POST /configurations/{id}/checkout | Public | READY | COD-only checkout paths. |
| Customer Store - Order confirmation | GET /orders/{id} | Public | READY | Safe public order summary only. |
| Customer Store - Order tracking | GET /orders/{id} | Public | PARTIAL | No carrier/delivery tracking; order status summary only. |
| Customer Store - Reviews | GET /products/{slug}/reviews; GET /packs/{slug}/reviews; POST /reviews; PATCH /reviews/{reviewId}; DELETE /reviews/{reviewId}; POST /reviews/{reviewId}/images; DELETE /reviews/{reviewId}/images/{imageId} | Public | READY | Review submission requires verified purchase data per backend rules. |
| Customer Store - Quiz/recommendations | GET /quiz/questions; POST /quiz/profiles; POST /recommendations; GET /recommendations/{sessionId}; POST /recommendations/{resultId}/configure | Public | READY | Rule-based V1 recommendations. |
| Admin Dashboard - Login | POST /auth/login; GET /auth/me | Public login, protected me | READY | Bearer token required after login. |
| Admin Dashboard - Categories | GET/POST/PATCH/DELETE /admin/categories; PUT/DELETE /admin/categories/{categoryId}/image | Admin | READY | Read roles include STAFF; writes generally OWNER/ADMIN. |
| Admin Dashboard - Brands | GET/POST/PATCH/DELETE /admin/brands | Admin | READY | No dedicated media relationship endpoint for brand logo. |
| Admin Dashboard - Products | GET/POST/PATCH/DELETE /admin/products; product image endpoints | Admin | READY | Product media endpoints are implemented. |
| Admin Dashboard - Product references / stock | GET/POST /admin/products/{productId}/references; GET/PATCH/DELETE /admin/product-references/{id}; PATCH /admin/product-references/{id}/stock; PUT/DELETE /admin/product-references/{referenceId}/image | Admin | READY | Reference stock update and swatch image endpoints exist. |
| Admin Dashboard - Packs | GET/POST/PATCH/DELETE /admin/packs; pack image endpoints | Admin | READY | Pack CRUD and media endpoints are implemented. |
| Admin Dashboard - Quiz | GET/POST/PATCH/DELETE /admin/quiz/questions; PATCH /admin/quiz/questions/reorder | Admin | READY | No dedicated media relationship endpoint for quiz option images. |
| Admin Dashboard - Recommendation rules | GET/POST/PATCH/DELETE /admin/recommendation-rules; POST /admin/recommendation-rules/preview | Admin | READY | Rule management and preview are implemented. |
| Admin Dashboard - Orders | GET /admin/orders; GET /admin/orders/{id}; PATCH /admin/orders/{id}/status | Admin | READY | Admin status workflow exists. |
| Admin Dashboard - Reviews | GET /admin/reviews; PATCH /admin/reviews/{reviewId}/moderation | Admin | READY | Moderation list and approve/reject endpoint exist. |
| Admin Dashboard - Media | POST /admin/media/upload; GET /admin/media; GET/PATCH/DELETE /admin/media/{id}; entity image endpoints | Admin | READY | Cloudinary-backed provider layer. |
