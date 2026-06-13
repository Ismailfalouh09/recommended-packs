# API Client Import Guide

Use this guide after generating the OpenAPI files:

```bash
npm run swagger:generate
```

Generated files:
- `docs/openapi.json`
- `docs/openapi.yaml`

Runtime docs:
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

## Swagger UI

1. Start the backend:

```bash
npm run start:dev
```

2. Open:

```text
http://localhost:3000/api/docs
```

3. For public endpoints, run requests directly.
4. For protected endpoints:
   - call `POST /auth/login`
   - copy `accessToken`
   - click `Authorize`
   - paste the token as a bearer token
   - run protected `/admin/*` requests

Notes:
- Swagger UI is generated from the current NestJS controllers and DTOs.
- Protected endpoints should show bearer authorization.
- The safe public order endpoint is `GET /orders/:id`; full customer/address/order history is admin-only.

## Postman

1. Open Postman.
2. Choose Import.
3. Import `docs/openapi.json`.
4. Create an environment named something like `Beauty Pack Local`.
5. Add variables:

| Variable | Initial value |
| --- | --- |
| `baseUrl` | `http://localhost:3000` |
| `adminEmail` | local admin email |
| `adminPassword` | local admin password |
| `accessToken` | empty |
| `customerProfileId` | empty |
| `recommendationSessionId` | empty |
| `recommendationResultId` | empty |
| `orderId` | empty |
| `categoryId` | empty |
| `brandId` | empty |
| `productId` | empty |
| `productReferenceId` | empty |
| `packId` | empty |
| `attributeGroupId` | empty |
| `attributeOptionId` | empty |
| `quizQuestionId` | empty |
| `recommendationRuleId` | empty |

6. Log in with `POST /auth/login`.
7. Store the returned `accessToken`.
8. Configure protected requests to use Bearer Token auth with `{{accessToken}}`.
9. Run tests in the order shown in `docs/MANUAL_API_TEST_PLAN.md`.

Postman request sequence:
1. `POST /auth/login`
2. public quiz/profile flow
3. `POST /recommendations`
4. `POST /orders`
5. admin order workflow
6. admin catalog/configuration flows

## Bruno

Bruno documentation says OpenAPI import supports OpenAPI 2.0 and 3.x in JSON or YAML, from file or URL.

Recommended file import:
1. Open Bruno.
2. Create or open a workspace.
3. Import an OpenAPI specification.
4. Select `docs/openapi.yaml` or `docs/openapi.json`.
5. Use tag-based grouping if available.
6. Create a local environment with:

```text
baseUrl=http://localhost:3000
adminEmail=admin@example.com
adminPassword=change-this-password
accessToken=
customerProfileId=
recommendationSessionId=
recommendationResultId=
orderId=
categoryId=
brandId=
productId=
productReferenceId=
packId=
attributeGroupId=
attributeOptionId=
quizQuestionId=
recommendationRuleId=
```

7. Start with `POST /auth/login`.
8. Store the `accessToken`.
9. Configure protected requests with Bearer token auth.
10. Run the ordered suites in `docs/MANUAL_API_TEST_PLAN.md`.

URL import option:
- Start the backend.
- Use `http://localhost:3000/api/docs-json` as the import URL if the installed Bruno version supports URL import in your local setup.

Fallback:
- If the local Bruno version cannot import the OpenAPI file or URL, create a collection manually from `docs/API_CURL_TESTS.md` and `docs/MANUAL_API_TEST_PLAN.md`.

## Safe Data Rules

- Do not commit real `.env` credentials.
- Do not store real customer data in shared Postman or Bruno collections.
- Do not paste real JWT secrets or database URLs into client documentation.
- Use placeholder UUIDs in examples unless copying values from your local test database during a manual test.
