# API Audit Report

Date: 2026-06-12 23:45 +01:00

Task: Task 14-DOC, documentation and OpenAPI preparation.

Source of truth inspected:
- `prisma/schema.prisma`
- `src/main.ts`
- `src/app.module.ts`
- all controllers under `src/modules`
- all DTOs under `src/modules/**/dto`
- auth guards and decorators
- Swagger/OpenAPI configuration
- existing documentation files

## 1. Implemented Modules

- Root application health/scaffold endpoint
- Authentication
- Attributes
- Quiz
- Products
- Product references
- Packs
- Recommendations
- Orders
- Admin categories
- Admin brands
- Admin products
- Admin product references
- Admin packs
- Admin attributes
- Admin quiz
- Admin recommendation rules
- Admin orders
- Prisma infrastructure

## 2. Implemented Endpoints

Health:
- `GET /`

Authentication:
- `POST /auth/login`
- `GET /auth/me`

Public attributes and quiz:
- `GET /attributes`
- `GET /attributes/:code/options`
- `GET /quiz/questions`
- `POST /quiz/profiles`

Public catalog and packs:
- `GET /products`
- `GET /products/:id`
- `GET /packs`
- `GET /packs/:id`

Recommendations:
- `POST /recommendations`
- `GET /recommendations/:sessionId`

Public orders:
- `POST /orders`
- `GET /orders/:id`

Admin categories:
- `GET /admin/categories`
- `GET /admin/categories/:id`
- `POST /admin/categories`
- `PATCH /admin/categories/:id`
- `DELETE /admin/categories/:id`

Admin brands:
- `GET /admin/brands`
- `GET /admin/brands/:id`
- `POST /admin/brands`
- `PATCH /admin/brands/:id`
- `DELETE /admin/brands/:id`

Admin products:
- `GET /admin/products`
- `GET /admin/products/:id`
- `POST /admin/products`
- `PATCH /admin/products/:id`
- `DELETE /admin/products/:id`

Admin product references:
- `GET /admin/products/:productId/references`
- `GET /admin/product-references/:id`
- `POST /admin/products/:productId/references`
- `PATCH /admin/product-references/:id`
- `PATCH /admin/product-references/:id/stock`
- `DELETE /admin/product-references/:id`

Admin packs:
- `GET /admin/packs`
- `GET /admin/packs/:id`
- `POST /admin/packs`
- `PATCH /admin/packs/:id`
- `DELETE /admin/packs/:id`

Admin attributes:
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

Admin quiz:
- `GET /admin/quiz/questions`
- `GET /admin/quiz/questions/:id`
- `POST /admin/quiz/questions`
- `PATCH /admin/quiz/questions/:id`
- `DELETE /admin/quiz/questions/:id`
- `PATCH /admin/quiz/questions/reorder`

Admin recommendation rules:
- `GET /admin/recommendation-rules`
- `GET /admin/recommendation-rules/:id`
- `POST /admin/recommendation-rules`
- `PATCH /admin/recommendation-rules/:id`
- `DELETE /admin/recommendation-rules/:id`
- `POST /admin/recommendation-rules/preview`

Admin orders:
- `GET /admin/orders`
- `GET /admin/orders/:id`
- `PATCH /admin/orders/:id/status`

## 3. Endpoint Authentication Requirements

Public endpoints:
- `GET /`
- `POST /auth/login`
- `GET /attributes`
- `GET /attributes/:code/options`
- `GET /quiz/questions`
- `POST /quiz/profiles`
- `GET /products`
- `GET /products/:id`
- `GET /packs`
- `GET /packs/:id`
- `POST /recommendations`
- `GET /recommendations/:sessionId`
- `POST /orders`
- `GET /orders/:id`

JWT bearer authentication required:
- `GET /auth/me`
- all `/admin/*` endpoints

## 4. Endpoint Role Requirements

Read roles:
- `OWNER`, `ADMIN`, and `STAFF` can read admin catalog, pack, quiz, rule, and order endpoints.

Write roles:
- `OWNER` and `ADMIN` can create, update, deactivate, archive, reorder, and update order status.

Staff restrictions:
- `STAFF` is read-only for admin catalog/configuration/order endpoints.
- `STAFF` can use recommendation preview but cannot create/update/delete rules.

## 5. Missing Swagger Decorators

Before Task 14-DOC:
- Public controllers had no Swagger tags, operation summaries, response schemas, or error documentation.
- Several admin controllers had tags and auth decorators but sparse operation descriptions.
- Public DTOs for profile, recommendation, and order requests lacked Swagger metadata.

After Task 14-DOC:
- All implemented controllers have `@ApiTags`.
- All implemented operations have `@ApiOperation` summaries.
- Protected admin routes declare bearer authentication.
- Main public request DTOs have explicit Swagger metadata.
- Response model classes were added for important public/admin responses.

Remaining limitation:
- Some admin list endpoints return paginated objects whose exact nested metadata is documented generally rather than with one unique class per resource.

## 6. Missing Request Examples

Before Task 14-DOC:
- Public profile/recommendation/order DTO examples were incomplete or absent.
- Login password example was too generic.

After Task 14-DOC:
- Public profile, recommendation, order, and status update requests have examples.
- Admin DTOs mostly already had examples from earlier tasks.
- Login examples are safe placeholders.

## 7. Missing Response Examples

Before Task 14-DOC:
- Response models were mostly implicit and service-return-shape based.

After Task 14-DOC:
- Clean response classes exist for auth, attributes, quiz, profiles, products, packs, recommendations, orders, admin orders, pagination metadata, and errors.

Remaining limitation:
- Swagger response examples are schema-driven. Not every endpoint has a full literal JSON example block.

## 8. Missing Error Documentation

Before Task 14-DOC:
- Error responses were partially documented on admin controllers only.

After Task 14-DOC:
- Common error model is documented as `ApiErrorResponse`.
- Controllers include the main expected `400`, `401`, `403`, `404`, and `409` cases where relevant.

Implementation note:
- The application currently uses Nest's default exception response shape. It does not include `timestamp` or `path` because no compatible global exception filter exists.

## 9. DTOs Missing Swagger Metadata

Fixed during Task 14-DOC:
- `CreateCustomerProfileDto`
- `CreateCustomerProfileAnswerDto`
- `CreateRecommendationDto`
- `CreateOrderDto`
- `LoginDto` descriptions/examples

Inherited metadata:
- Update DTOs based on `PartialType` or `OmitType` inherit metadata from create DTOs.

## 10. Possible Differences Between Documentation and Implementation

- Error examples in docs describe the Nest default response format, which is usually `{ statusCode, message, error }`. The requested `{ timestamp, path }` fields are not currently implemented.
- Some admin list response schemas are summarized because the services return rich calculated objects with pagination metadata rather than dedicated response classes.
- OpenAPI generation initially failed under `tsx` because Nest dependency injection metadata was not emitted. The generator script now uses `ts-node`.
- Explicit `@Inject(ConfigService)` was added to `PrismaService` and `JwtStrategy` for robust tooling/bootstrap behavior. This does not change business behavior.

## 11. Endpoints That May Expose Sensitive Data

Reviewed:
- `GET /orders/:id` returns a safe public summary only after Task 13.
- `GET /admin/orders/:id` exposes customer phone and address intentionally to authenticated admins.
- `POST /auth/login` and `GET /auth/me` do not return `passwordHash`.
- OpenAPI verification checks that `passwordHash`, `JWT_SECRET`, and `DATABASE_URL` are absent from generated docs.

Current sensitive-data concern:
- Public `POST /orders` response may include order item snapshots. This is not credential-sensitive, but public order response details should remain limited in future expansions.

## 12. Known Backend Limitations

- Feature development is paused after Admin Order Management.
- No stock reservation or stock deduction occurs during order creation or status updates.
- No payment provider integration exists.
- Cash on Delivery is the only payment method.
- No delivery provider integration exists.
- No WhatsApp or messaging workflow exists.
- No admin user management CRUD exists.
- No customer authentication exists.
- Recommendation logic is V1 and rule-driven, but not ML/personalization beyond stored answers and compatibility rules.
- No global exception filter adds timestamp/path to errors.

## 13. Entities With No API

Internal-only or future-ready entities:
- `CustomerEvent`
- `MessageLog`

Entities with indirect/internal APIs only:
- `Customer` is created/reused by `POST /orders` but has no direct CRUD API.
- `CustomerAddress` is created by `POST /orders` but has no direct CRUD API.
- `OrderItem` is created by `POST /orders` and read through admin/public order responses but has no direct CRUD API.
- `OrderStatusHistory` is created by order creation/status workflow and read through admin order detail but has no direct CRUD API.
- `AdminUser` is created/updated by the local `npm run admin:create` script and used by auth, but has no admin CRUD API.
