# Current Backend Test Plan

## Purpose

This test plan verifies the backend from foundation through recommendation score calibration.
It now also covers the Cash on Delivery Orders API.
It also covers Admin Authentication V1.
It also covers Protected Admin Catalog CRUD V1.
It also covers Protected Admin Pack CRUD V1.
It also covers Protected Admin Quiz, Attributes, and Recommendation Rules CRUD V1.
It also covers Protected Admin Order Management and Status Workflow V1.
It also covers Task 14-DOC OpenAPI generation and manual API documentation preparation.

## Prerequisites

- Node.js installed.
- npm dependencies installed with `npm install`.
- PostgreSQL installed locally on Windows.
- Local database exists and is reachable through `.env`.
- Prisma migration has been applied.
- Seed data has been inserted.

## Environment Setup

1. Confirm `.env` exists and contains a working local `DATABASE_URL`.
2. Confirm `.env` is ignored by git.
3. Start PostgreSQL locally if it is not already running.
4. From the project root, run:

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

The backend should start on `http://localhost:3000` unless `PORT` is set.

Swagger UI should be available at:

```text
http://localhost:3000/api/docs
```

OpenAPI JSON should be available at:

```text
http://localhost:3000/api/docs-json
```

Generate and check local OpenAPI files:

```bash
npm run swagger:generate
npm run swagger:check
```

## Database Checks

Run:

```bash
npx prisma studio
```

Verify these tables contain data:
- `attribute_groups`
- `attribute_options`
- `quiz_questions`
- `quiz_question_options`
- `categories`
- `brands`
- `products`
- `product_references`
- `product_reference_attributes`
- `packs`
- `pack_items`
- `pack_attributes`
- `recommendation_rules`

After order smoke tests, also verify:
- `customers`
- `customer_addresses`
- `orders`
- `order_items`
- `order_status_history`

After admin auth smoke tests, also verify:
- `admin_users`

After admin catalog smoke tests, verify:
- new categories and brands are present
- created products have three references
- reference compatibility attributes exist
- archived products have `status = ARCHIVED`
- archived products and references have `isActive = false`

After admin pack smoke tests, verify:
- created packs exist
- pack items exist
- pack attributes exist
- archived packs have `status = ARCHIVED`
- archived packs have `isActive = false`
- historical pack items and attributes remain present

After admin quiz/attribute/rule smoke tests, verify:
- created attribute groups and options exist
- created quiz questions and mappings exist
- deactivated quiz questions remain stored
- created recommendation rules exist
- deactivated recommendation rules remain stored
- preview does not create `recommendation_sessions`, `recommendation_results`, or `recommendation_result_items`

After admin order workflow smoke tests, verify:
- order status changes are stored in `order_status_history`
- `changedByAdminId` is set for admin-driven status updates
- final order status matches the last valid transition
- COD payment status changes to `PAID` on delivery and `REFUNDED` on return
- public order fetch does not expose phone, address, notes, or status history

## Seed Checks

Expected seeded data includes:
- Attribute groups: `SKIN_COLOR`, `UNDERTONE`, `SKIN_TYPE`, `STYLE`, `BUDGET`
- Brand: `Demo Beauty`
- Products: `Foundation X`, `Concealer X`, `Lipstick Y`, `Mascara Z`, `Blush A`, `Setting Powder B`
- Packs: `Natural Glow Pack`, `Soft Glam Pack`, `Full Glam Pack`, `Budget Daily Pack`
- Recommendation rules for skin color, undertone, style, skin type, and budget

Run the seed more than once:

```bash
npx prisma db seed
npx prisma db seed
```

Expected result: seeding completes without duplicate-key failures.

## API Tests

Start the backend:

```bash
npm run start:dev
```

Test read endpoints:
- `GET /attributes`
- `GET /attributes/SKIN_COLOR/options`
- `GET /quiz/questions`
- `GET /products`
- `GET /products/:id`
- `GET /packs`
- `GET /packs/:id`

Expected results:
- All list endpoints return HTTP `200`.
- Active seeded records are returned.
- Detail endpoints return HTTP `200` for valid IDs.
- Detail endpoints return HTTP `404` for missing IDs.

## Documentation And OpenAPI Test

1. Run `npm run swagger:generate`.
2. Run `npm run swagger:check`.
3. Open `docs/openapi.json`.
4. Open `docs/openapi.yaml`.
5. Start the backend with `npm run start:dev`.
6. Open `http://localhost:3000/api/docs`.
7. Open `http://localhost:3000/api/docs-json`.
8. Confirm protected endpoints show bearer authentication.
9. Confirm `passwordHash`, `JWT_SECRET`, and `DATABASE_URL` do not appear in generated OpenAPI.
10. Import `docs/openapi.json` into Postman or `docs/openapi.yaml` into Bruno.

Expected result:
- OpenAPI generation succeeds.
- OpenAPI verification succeeds.
- Swagger UI loads.
- Generated docs contain all implemented endpoints.
- Generated docs contain request DTO schemas and important response schemas.
- No secret values are present.

## Quiz Profile API Test

Call `POST /quiz/profiles` with complete valid answers.

Expected result:
- HTTP `201` or `200` depending on Nest response behavior.
- Response contains `customerProfileId`, `sessionToken`, `sourceChannel`, and normalized answers.
- Database contains one `CustomerProfile`.
- Database contains linked `CustomerProfileAnswer` records.

## Recommendation API Test

1. Create a quiz profile.
2. Use its `customerProfileId` in `POST /recommendations`.
3. Use the returned `sessionId` in `GET /recommendations/:sessionId`.

Expected result:
- `POST /recommendations` returns ranked packs.
- Response includes selected items and reason details.
- Foundation X should select `RF2 Medium Warm` for the medium/warm/oily profile.
- Natural Glow Pack should rank `#1` for the medium/warm/oily/natural/medium profile.
- Reason JSON should include `rawItemsScore`, `scoredItemCount`, `normalizedItemsScore`, `totalScore`, and `matchPercentage`.
- Database contains `RecommendationSession`, `RecommendationResult`, and `RecommendationResultItem`.
- `GET /recommendations/:sessionId` returns stored results.

## Orders API Test

1. Create a quiz profile.
2. Generate recommendations.
3. Copy a `recommendationResultId` from `POST /recommendations`.
4. Call `POST /orders` with customer and delivery information.
5. Copy `orderId` from the order response.
6. Call `GET /orders/:id`.

Expected result:
- `POST /orders` creates a Cash on Delivery order.
- Existing customers are reused by phone.
- New customers are created when the phone does not exist.
- Previous default customer addresses are set to `isDefault = false`.
- A new default address is created.
- Order price is calculated from the selected pack price mode.
- Order item snapshots include product and reference names at order time.
- Initial order status history is created with `PENDING_CONFIRMATION`.
- The selected recommendation result is marked `isSelected = true`.
- `GET /orders/:id` returns a safe public summary only: order ID, order number, order status, payment status, total amount, currency, pack name, and timestamps.
- `GET /orders/:id` must not expose customer phone, delivery address, notes, item internals, or status history.

## Admin Authentication Test

1. Configure safe local environment values:
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `ADMIN_FULL_NAME`
2. Run:

```bash
npm run admin:create
```

3. Start the backend:

```bash
npm run start:dev
```

4. Call `POST /auth/login`.
5. Copy `accessToken`.
6. Call `GET /auth/me` with `Authorization: Bearer ACCESS_TOKEN`.

Expected result:
- Admin user is created or updated with a bcrypt password hash.
- Password is never logged.
- Login succeeds with valid credentials.
- Login returns `accessToken`, `tokenType`, `expiresIn`, and safe admin data.
- Login response does not contain `passwordHash`.
- `/auth/me` returns the active authenticated admin.
- Invalid token returns `401`.
- Inactive admin is rejected.

## Admin Catalog CRUD Test

1. Log in with `POST /auth/login`.
2. Copy the `accessToken`.
3. Create a category with `POST /admin/categories`.
4. Create a brand with `POST /admin/brands`.
5. Create an active product with `POST /admin/products`.
6. Create three references with `POST /admin/products/:productId/references`.
7. Add compatibility attributes for skin color and undertone.
8. Update one reference stock with `PATCH /admin/product-references/:id/stock`.
9. Fetch the product with `GET /admin/products/:id`.
10. Fetch the public product with `GET /products/:id`.
11. Archive the product with `DELETE /admin/products/:id`.
12. Fetch the public product again with `GET /products/:id`.

Expected result:
- Admin endpoints require `Authorization: Bearer ACCESS_TOKEN`.
- `OWNER` and `ADMIN` can create, update, and deactivate/archive records.
- `STAFF` can read but cannot write.
- Category and brand list responses include pagination metadata and product counts.
- Product list/detail responses include category, brand, reference counts, stock totals, and available stock.
- Reference responses include compatibility attributes and available stock.
- Creating a default reference unsets sibling defaults.
- Updating reference stock returns `availableStock` and `isLowStock`.
- Archiving a product sets `status = ARCHIVED`, `isActive = false`, and deactivates all references.
- Public `GET /products/:id` returns the active product before archive and `404` after archive.

## Admin Pack CRUD Test

1. Log in with `POST /auth/login`.
2. Copy the `accessToken`.
3. Identify active products and product references from `GET /products`.
4. Create a draft pack with `POST /admin/packs`.
5. Fetch it with `GET /admin/packs/:id`.
6. Patch it with items, attributes, fixed price, `status = ACTIVE`, and `isActive = true`.
7. Confirm it appears in `GET /packs`.
8. Create a quiz profile matching `STYLE = NATURAL`, `BUDGET = MEDIUM`, `SKIN_COLOR = MEDIUM`, `UNDERTONE = WARM`, and `SKIN_TYPE = OILY`.
9. Generate recommendations.
10. Archive the pack with `DELETE /admin/packs/:id`.
11. Confirm it remains visible in `GET /admin/packs/:id`.
12. Confirm it disappears from `GET /packs`.
13. Generate recommendations again and confirm it is no longer returned.

Expected result:
- Admin pack endpoints require `Authorization: Bearer ACCESS_TOKEN`.
- `OWNER` and `ADMIN` can create, update, and archive packs.
- `STAFF` can read but cannot write.
- Draft packs can be created without items.
- Active packs require valid items and active required products/references.
- Pack items support `FIXED_REFERENCE`, `AUTO_BEST_REFERENCE`, and `CUSTOMER_CHOICE`.
- Nested item replacement is all-or-nothing.
- Nested attribute replacement is all-or-nothing.
- Pack pricing mode validation is enforced.
- Public pack endpoints only expose active packs with `status = ACTIVE`.

## Admin Quiz, Attributes, and Recommendation Rules Test

1. Log in with `POST /auth/login`.
2. Create an attribute group with `POST /admin/attributes`.
3. Create attribute options with `POST /admin/attributes/:attributeGroupId/options`.
4. Create an inactive quiz question with `POST /admin/quiz/questions`.
5. Activate the question with `PATCH /admin/quiz/questions/:id`.
6. Confirm it appears in `GET /quiz/questions`.
7. Submit `POST /quiz/profiles` including the new attribute group answer.
8. Create a recommendation rule with `POST /admin/recommendation-rules`.
9. Add matching compatibility to a pack or reference with existing admin APIs.
10. Call `POST /admin/recommendation-rules/preview`.
11. Call `POST /recommendations`.
12. Deactivate the rule.
13. Generate another recommendation and confirm no crash.
14. Deactivate the quiz question.
15. Confirm it disappears from `GET /quiz/questions`.

Expected result:
- Admin config endpoints require `Authorization: Bearer ACCESS_TOKEN`.
- `OWNER` and `ADMIN` can create, update, and deactivate.
- `STAFF` can read and preview but cannot write.
- Public quiz and attribute APIs expose active configuration only.
- Profile creation accepts the new active quiz answer.
- Preview returns ranked packs without persisting recommendation sessions/results/items.
- Persisted recommendation flow still creates sessions/results/items.
- Deactivating a rule falls back to documented V1 behavior or omits custom score without crashing.
- Historical profile answers remain valid after quiz question deactivation.

## Admin Order Management Test

1. Log in with `POST /auth/login`.
2. Copy the `accessToken`.
3. Create a quiz profile.
4. Generate recommendations.
5. Create an order from a selected `recommendationResultId`.
6. Fetch orders with `GET /admin/orders?search=ORDER_NUMBER_OR_PHONE`.
7. Fetch detail with `GET /admin/orders/:id`.
8. Move the order through valid status transitions:
   - `PATCH /admin/orders/:id/status` to `CONFIRMED`
   - `PATCH /admin/orders/:id/status` to `PREPARING`
   - `PATCH /admin/orders/:id/status` to `SHIPPED`
   - `PATCH /admin/orders/:id/status` to `DELIVERED`
9. Confirm COD payment status becomes `PAID` after delivery.
10. Try an invalid transition from `DELIVERED` back to `PREPARING`.
11. Move the order from `DELIVERED` to `RETURNED`.
12. Confirm COD payment status becomes `REFUNDED`.
13. Fetch detail again with `GET /admin/orders/:id`.
14. Fetch public summary with `GET /orders/:id`.

Expected result:
- Admin order endpoints require `Authorization: Bearer ACCESS_TOKEN`.
- `OWNER`, `ADMIN`, and `STAFF` can read admin order list/detail.
- `OWNER` and `ADMIN` can update order status.
- `STAFF` receives `403` for status updates.
- Admin list supports pagination, search, status filters, payment filters, source-channel filters, selected-pack filters, date range filters, total range filters, and sorting.
- Admin detail includes customer, address, selected pack, recommendation result summary, items, status history, and changed-by admin data.
- Admin detail never includes admin password hashes.
- Valid transitions create one status history record per transition.
- Invalid transitions return `400` and do not create history records.
- Conditional update protects against stale concurrent transitions.
- Public order detail returns only the safe summary.

## Negative Tests

Quiz profile:
- Missing `answers` should fail validation.
- Empty `answers` should fail validation.
- Duplicate `attributeGroupCode` should return `400`.
- Invalid `attributeGroupCode` should return `400`.
- Invalid `attributeOptionCode` should return `400`.
- Missing required quiz answer should return `400`.

Recommendations:
- Missing `customerProfileId` should fail validation.
- Invalid UUID should fail validation.
- Unknown `customerProfileId` should return `404`.
- Profile with no answers should return `400`.
- Unknown `sessionId` should return `404`.

Orders:
- Invalid `recommendationResultId` should fail validation.
- Unknown `recommendationResultId` should return `404`.
- Recommendation result with no items should return `400`.
- Inactive pack should return `400`.
- Inactive selected product should return `400`.
- Inactive selected reference should return `400`.
- Out-of-stock required selected reference should return `400`.
- Unknown order ID should return `404`.
- Public `GET /orders/:id` should not expose phone, address, notes, items, or status history.

Admin auth:
- Invalid login email format should fail validation.
- Unknown email should return `401`.
- Invalid password should return `401`.
- Inactive admin should return `401`.
- Missing bearer token should return `401`.
- Invalid bearer token should return `401`.
- Inactive admin after token issue should return `401`.

Admin catalog:
- Missing bearer token should return `401`.
- `STAFF` write attempts should return `403`.
- Duplicate category code should return `409`.
- Invalid category parent should return `404`.
- Circular category parent update should return `409`.
- Duplicate brand name should return `409`.
- Invalid product category or brand should return `404`.
- Duplicate product slug should return `409`.
- Active product under inactive category or brand should return `400`.
- Duplicate reference code inside a product should return `409`.
- Duplicate SKU or barcode should return `409`.
- Reserved quantity greater than stock should return `400`.
- Attribute option from the wrong group should return `400`.
- Unknown product or reference IDs should return `404`.

Admin packs:
- Missing bearer token should return `401`.
- `STAFF` write attempts should return `403`.
- Duplicate pack slug should return `409`.
- `minBudget > maxBudget` should return `400`.
- `FIXED` pack without `fixedPrice` should return `400`.
- `SUM_ITEMS_WITH_DISCOUNT` with both `discountAmount` and `discountPercentage` should return `400`.
- Active pack without items should return `400`.
- Duplicate products inside items should return `400`.
- Duplicate pack attributes should return `400`.
- `FIXED_REFERENCE` without `productReferenceId` should return `400`.
- Fixed reference that does not belong to the selected product should return `400`.
- `AUTO_BEST_REFERENCE` or `CUSTOMER_CHOICE` with `productReferenceId` should return `400`.
- Product without references should return `400`.
- Inactive required product when activating should return `400`.
- Invalid attribute group or option should return `400`.
- Unknown pack ID should return `404`.

Admin quiz/attributes/rules:
- Missing bearer token should return `401`.
- `STAFF` write attempts should return `403`.
- Duplicate attribute group code should return `409`.
- Attribute group code update should fail validation.
- Duplicate option code inside the same group should return `409`.
- Option code and group update should fail validation.
- Active option under inactive group should return `400`.
- Active quiz question without options should return `400`.
- Quiz option from the wrong group should return `400`.
- Duplicate quiz option mapping should return `400`.
- A second active quiz question for the same group should return `409`.
- Invalid quiz reorder payload should return `400` or `404`.
- Duplicate recommendation rule code should return `409`.
- Active rule referencing inactive group should return `400`.
- Unknown recommendation rule ID should return `404`.

Admin orders:
- Missing bearer token should return `401`.
- `STAFF` status update attempts should return `403`.
- Unknown order ID in admin detail should return `404`.
- Unknown order ID in status update should return `404`.
- Invalid status transition should return `400`.
- Updating to the current status should return `400`.
- Updating from terminal `CANCELED` or `RETURNED` should return `400`.
- Canceling an already paid COD order should return `400`.
- Invalid date range should return `400`.
- Invalid total amount range should return `400`.
- Simulated stale concurrent transition should return `409`.

Read APIs:
- Unknown attribute group code should return `404`.
- Unknown product ID should return `404`.
- Unknown pack ID should return `404`.

## Known Issue

No active known issue for recommendation score calibration. Task 7B fixed the previous pack-size scoring bias by averaging scored item compatibility instead of summing all selected item scores.

Order stock is still not reserved or deducted. That is intentional for the current backend stage.

## Next Tests After Task 7B

Task 7B acceptance checks:
- Create a medium/warm/oily/natural/medium profile.
- Run `POST /recommendations`.
- Confirm Natural Glow Pack ranks `#1`.
- Confirm Foundation X still selects `RF2 Medium Warm`.
- Confirm reason JSON includes both raw item score and normalized item score.
- Confirm stored recommendation results match the API response.

Task 8 acceptance checks:
- Confirm recommendations can be used as stable input for an order creation flow.
- Confirm selected pack and selected references can be converted into order items.
- Confirm created order can be fetched by ID.
- Confirm status history is ordered by creation time.
- Confirm selected recommendation result is marked selected after order creation.

Next tests after Task 13:
- Add stock reservation/deduction tests only when stock workflow is explicitly requested.
- Test payment provider workflows only after payment integration is explicitly requested.
- Test delivery and WhatsApp workflows only after integrations are explicitly requested.
