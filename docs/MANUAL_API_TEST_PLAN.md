# Manual API Test Plan

This plan is usable from Swagger UI, Bruno, or Postman.

Backend status: feature implementation is paused after Admin Order Management. The current focus is full API documentation and manual validation through Swagger, Bruno, or Postman.

## Prerequisites

- PostgreSQL is running.
- `.env` exists with safe local values.
- Migration has been applied.
- Seed has been completed.
- Admin user has been created.
- Backend is running.

Commands:

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma db seed
npm run admin:create
npm run start:dev
```

Documentation commands:

```bash
npm run swagger:generate
npm run swagger:check
```

Swagger UI:
- `http://localhost:3000/api/docs`

OpenAPI JSON:
- `http://localhost:3000/api/docs-json`
- local file: `docs/openapi.json`

OpenAPI YAML:
- local file: `docs/openapi.yaml`

## Test Environment Variables

Use these variables in Swagger notes, Postman environments, or Bruno environments:

| Variable | Purpose |
| --- | --- |
| `baseUrl` | `http://localhost:3000` |
| `adminEmail` | local admin email |
| `adminPassword` | local admin password |
| `accessToken` | token from `POST /auth/login` |
| `customerProfileId` | profile ID from `POST /quiz/profiles` |
| `recommendationSessionId` | session ID from `POST /recommendations` |
| `recommendationResultId` | result ID from `POST /recommendations` |
| `orderId` | order ID from `POST /orders` |
| `categoryId` | admin-created or seeded category ID |
| `brandId` | admin-created or seeded brand ID |
| `productId` | admin-created or seeded product ID |
| `productReferenceId` | product reference ID |
| `packId` | pack ID |
| `attributeGroupId` | attribute group ID |
| `attributeOptionId` | attribute option ID |
| `quizQuestionId` | quiz question ID |
| `recommendationRuleId` | recommendation rule ID |

## Suite A - Health And Documentation

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | GET | `/` | none | none | 200 | root scaffold string | none |  | API reachable |
| A-02 | GET | `/api/docs` | none | browser open | 200 | Swagger UI loads | none |  | Authorize button visible |
| A-03 | GET | `/api/docs-json` | none | none | 200 | valid OpenAPI JSON | none |  | Contains all implemented paths |
| A-04 | CLI | `npm run swagger:generate` | none | command | 0 | JSON/YAML files written | none |  | No secrets printed |
| A-05 | CLI | `npm run swagger:check` | none | command | 0 | OpenAPI checks pass | none |  | Summaries/security/schemas verified |

## Suite B - Authentication

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B-01 | POST | `/auth/login` | none | valid `adminEmail` and `adminPassword` | 201 or 200 | `accessToken`, `tokenType`, `expiresIn`, safe admin data | `lastLoginAt` updated |  | Store `accessToken` |
| B-02 | POST | `/auth/login` | none | invalid email format | 400 | validation error | none |  | |
| B-03 | POST | `/auth/login` | none | unknown email | 401 | unauthorized | none |  | |
| B-04 | POST | `/auth/login` | none | invalid password | 401 | unauthorized | none |  | |
| B-05 | GET | `/auth/me` | Bearer token | none | 200 | current admin data, no `passwordHash` | none |  | |
| B-06 | GET | `/auth/me` | invalid token | none | 401 | unauthorized | none |  | |
| B-07 | GET | `/auth/me` | token for inactive admin | none | 401 | unauthorized | admin is inactive |  | Requires local DB manipulation |

## Suite C - Public Quiz

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | GET | `/attributes` | none | none | 200 | active groups with active options | none |  | |
| C-02 | GET | `/attributes/SKIN_COLOR/options` | none | none | 200 | active skin color options | none |  | |
| C-03 | GET | `/attributes/UNKNOWN/options` | none | none | 404 | not found | none |  | |
| C-04 | GET | `/quiz/questions` | none | none | 200 | active questions ordered by step | none |  | |
| C-05 | POST | `/quiz/profiles` | none | complete valid answers | 201 or 200 | `customerProfileId`, `sessionToken`, normalized answers | profile and answers created |  | Store `customerProfileId` |
| C-06 | POST | `/quiz/profiles` | none | duplicate `attributeGroupCode` | 400 | clear duplicate error | no profile created |  | |
| C-07 | POST | `/quiz/profiles` | none | invalid option for group | 400 | clear invalid option error | no profile created |  | |
| C-08 | POST | `/quiz/profiles` | none | missing required answer | 400 | clear missing answer error | no profile created |  | |

## Suite D - Public Catalog

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| D-01 | GET | `/products` | none | none | 200 | active products with category, brand, references | none |  | |
| D-02 | GET | `/products/:id` | none | seeded product ID | 200 | product detail | none |  | |
| D-03 | GET | `/products/:id` | none | unknown UUID | 404 | not found | none |  | |
| D-04 | GET | `/packs` | none | none | 200 | active packs | none |  | |
| D-05 | GET | `/packs/:id` | none | seeded pack ID | 200 | pack detail | none |  | |
| D-06 | GET | `/packs/:id` | none | archived/inactive pack ID | 404 | hidden from public API | none |  | |

## Suite E - Recommendations

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E-01 | POST | `/recommendations` | none | valid `customerProfileId` | 201 or 200 | ranked `recommendedPacks` | session/results/items created |  | Store IDs |
| E-02 | POST | `/recommendations` | none | unknown profile ID | 404 | not found | none |  | |
| E-03 | POST | `/recommendations` | none | profile with no answers | 400 | no-answer error | no results created |  | Requires local fixture |
| E-04 | POST | `/recommendations` | none | medium/warm/oily/natural/medium profile | 201 or 200 | Foundation X selects `RF2 Medium Warm` | item stored |  | Acceptance check |
| E-05 | GET | `/recommendations/:sessionId` | none | stored session ID | 200 | stored results | none |  | |
| E-06 | GET | `/recommendations/:sessionId` | none | unknown UUID | 404 | not found | none |  | |
| E-07 | POST | `/recommendations` | none | same deterministic profile | 201 or 200 | Natural Glow ranks first | results stored |  | Score calibration check |

## Suite F - Orders

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | POST | `/orders` | none | valid `recommendationResultId` and delivery fields | 201 or 200 | order summary/items | customer/address/order/items/history created |  | Store `orderId` |
| F-02 | POST | `/orders` | none | invalid recommendation result | 404 or 400 | error | no order created |  | |
| F-03 | GET | `/orders/:id` | none | valid `orderId` | 200 | safe public summary | none |  | No phone/address/notes/history |
| F-04 | GET | `/orders/:id` | none | unknown UUID | 404 | not found | none |  | |

## Suite G - Admin Catalog

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G-01 | GET | `/admin/categories` | Bearer | pagination query | 200 | paginated categories | none |  | STAFF allowed |
| G-02 | POST | `/admin/categories` | OWNER/ADMIN | valid category | 201 or 200 | category | category exists |  | Store `categoryId` |
| G-03 | POST | `/admin/categories` | OWNER/ADMIN | duplicate code | 409 | conflict | no duplicate |  | |
| G-04 | GET | `/admin/brands` | Bearer | pagination query | 200 | paginated brands | none |  | |
| G-05 | POST | `/admin/brands` | OWNER/ADMIN | valid brand | 201 or 200 | brand | brand exists |  | Store `brandId` |
| G-06 | POST | `/admin/products` | OWNER/ADMIN | valid product | 201 or 200 | product | product exists |  | Store `productId` |
| G-07 | POST | `/admin/products/:productId/references` | OWNER/ADMIN | valid reference | 201 or 200 | reference | reference/attributes exist |  | Store `productReferenceId` |
| G-08 | PATCH | `/admin/product-references/:id/stock` | OWNER/ADMIN | valid stock counts | 200 | updated stock data | stock fields updated |  | No reservation behavior |
| G-09 | DELETE | `/admin/products/:id` | OWNER/ADMIN | none | 200 | archived product | product archived, references inactive |  | |
| G-10 | POST | admin write endpoint | STAFF token | valid body | 403 | forbidden | no change |  | |

## Suite H - Admin Packs

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-01 | POST | `/admin/packs` | OWNER/ADMIN | draft pack | 201 or 200 | pack | pack exists |  | Store `packId` |
| H-02 | PATCH | `/admin/packs/:id` | OWNER/ADMIN | invalid active pack without items | 400 | validation error | no partial replacement |  | |
| H-03 | PATCH | `/admin/packs/:id` | OWNER/ADMIN | valid items/attributes and active status | 200 | updated pack | items/attributes exist |  | |
| H-04 | GET | `/packs/:id` | none | active pack ID | 200 | public pack visible | none |  | |
| H-05 | DELETE | `/admin/packs/:id` | OWNER/ADMIN | none | 200 | archived pack | archived and inactive |  | |
| H-06 | GET | `/packs/:id` | none | archived pack ID | 404 | hidden publicly | none |  | |

## Suite I - Admin Quiz And Rules

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| I-01 | POST | `/admin/attributes` | OWNER/ADMIN | valid group | 201 or 200 | attribute group | group exists |  | Store `attributeGroupId` |
| I-02 | POST | `/admin/attributes/:attributeGroupId/options` | OWNER/ADMIN | valid option | 201 or 200 | attribute option | option exists |  | Store `attributeOptionId` |
| I-03 | POST | `/admin/quiz/questions` | OWNER/ADMIN | inactive question with options | 201 or 200 | quiz question | mappings exist |  | Store `quizQuestionId` |
| I-04 | PATCH | `/admin/quiz/questions/:id` | OWNER/ADMIN | activate question | 200 | active question | active row |  | |
| I-05 | POST | `/admin/recommendation-rules` | OWNER/ADMIN | valid rule | 201 or 200 | rule | rule exists |  | Store `recommendationRuleId` |
| I-06 | POST | `/admin/recommendation-rules/preview` | Bearer | `customerProfileId` | 200 | recommendation preview | no sessions/results/items created |  | STAFF allowed |
| I-07 | DELETE | `/admin/recommendation-rules/:id` | OWNER/ADMIN | none | 200 | inactive rule | rule inactive |  | |
| I-08 | DELETE | `/admin/quiz/questions/:id` | OWNER/ADMIN | none | 200 | inactive question | question inactive |  | |

## Suite J - Admin Order Workflow

| Test ID | Method | Endpoint | Auth | Request | Expected status | Expected response | DB check | Pass/Fail | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| J-01 | GET | `/admin/orders` | Bearer | search/filter query | 200 | paginated orders | none |  | STAFF allowed |
| J-02 | GET | `/admin/orders/:id` | Bearer | valid order ID | 200 | full admin detail and history | none |  | No admin `passwordHash` |
| J-03 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | `CONFIRMED` | 200 | status updated | history row created |  | |
| J-04 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | `PREPARING` | 200 | status updated | history row created |  | |
| J-05 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | `SHIPPED` | 200 | status updated | history row created |  | |
| J-06 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | `DELIVERED` | 200 | status updated, payment `PAID` | history row created |  | COD behavior |
| J-07 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | invalid `PREPARING` after delivered | 400 | invalid transition error | no history row |  | |
| J-08 | PATCH | `/admin/orders/:id/status` | OWNER/ADMIN | `RETURNED` after delivered | 200 | status updated, payment `REFUNDED` | history row created |  | |
| J-09 | PATCH | `/admin/orders/:id/status` | STAFF token | any write status | 403 | forbidden | no change |  | |

## Order Status Workflow Reference

- `PENDING_CONFIRMATION` can move to `CONFIRMED` or `CANCELED`.
- `CONFIRMED` can move to `PREPARING` or `CANCELED`.
- `PREPARING` can move to `SHIPPED` or `CANCELED`.
- `SHIPPED` can move to `DELIVERED` or `RETURNED`.
- `DELIVERED` can move to `RETURNED`.
- `CANCELED` is terminal.
- `RETURNED` is terminal.

COD payment behavior:
- `DELIVERED` marks payment `PAID`.
- `CANCELED` while unpaid remains `UNPAID`.
- `RETURNED` after paid marks payment `REFUNDED`.
- `RETURNED` while unpaid remains `UNPAID`.
