# Postman Manual Test Guide

## Start The Backend

1. Install dependencies with `npm install` if needed.
2. Validate and prepare Prisma as appropriate for your environment: `npx prisma validate`, `npx prisma generate`, migrations/seed if needed.
3. Start the backend with `npm run start:dev`.
4. Confirm `GET http://localhost:3000/` responds.

## Import Contracts And Test Files

1. Import `frontend-handoff-v2/openapi.json` into Postman if you want schema browsing. OpenAPI is the main source of truth.
2. Import `docs/postman/PHINIX_BACKEND_API.postman_collection.json`.
3. Import `docs/postman/PHINIX_BACKEND_LOCAL.postman_environment.template.json`.
4. Select the imported environment and confirm `baseUrl` is `http://localhost:3000`.

## Login And Save Token

1. Fill `adminEmail` and `adminPassword` in the environment.
2. Run `02 - Authentication / POST /auth/login`.
3. Copy the returned access token into `adminAccessToken`.
4. Run `GET /auth/me` to confirm the token works.

## Recommended Safe Test Order

1. Run health and public read endpoints first.
2. Create or identify category, brand, product, product reference, pack, quiz, and recommendation-rule test IDs.
3. Test admin read endpoints before mutating endpoints.
4. Test create/update/delete flows only with disposable test data.
5. Test checkout/order flows last because they create operational records.
6. Test media uploads only with small safe image files and valid Cloudinary configuration.

## Public Before Admin

Public APIs can be tested without bearer auth. Admin APIs require `{{adminAccessToken}}` and may return `403` if the logged-in admin role lacks permission.

## Common Failures

- `401 Unauthorized`: missing/expired/invalid bearer token.
- `403 Forbidden`: authenticated admin role does not satisfy the endpoint role requirement.
- `400 Bad Request`: DTO validation failed, unknown properties were sent, or required fields are missing.
- Database unavailable: PostgreSQL connection/configuration issue.
- Missing media configuration: Cloudinary credentials or upload limits are not configured.
- `404 Not Found`: placeholder ID/slug does not exist in the current database.
