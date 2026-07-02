# Frontend Handoff V2

Date: 2026-07-02

This folder contains the latest frontend integration handoff generated from the current backend source and OpenAPI contract.

## Source Of Truth

- Main contract: `frontend-handoff-v2/openapi.json`
- YAML copy: `frontend-handoff-v2/openapi.yaml`
- Original generated files: `docs/openapi.json` and `docs/openapi.yaml`

Use OpenAPI for exact schemas, parameters, status codes, and DTO names. The markdown files are implementation guidance for screens and workflow readiness.

## Backend Base URLs

- Local API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON endpoint while server is running: `http://localhost:3000/api/docs-json`

## Authentication

Admin endpoints require `Authorization: Bearer <accessToken>`. Get the token from `POST /auth/login`, then verify it with `GET /auth/me`.

Customer-facing endpoints are public; some flows require identifiers such as `customerProfileId`, `sessionToken`, `orderId`, `packId`, `productId`, or slugs.

## Integration Order

1. Import `openapi.json` into the frontend API client tooling.
2. Wire public catalog reads: categories, brands, products, packs, product/pack reviews.
3. Wire quiz/profile/recommendation flow.
4. Wire checkout paths and order summary page.
5. Wire admin login, then admin read screens, then admin mutating screens.
6. Keep destructive admin actions behind confirmation UI.

## Verification Snapshot

- `npm run build`: passed.
- `npx prisma validate`: passed.
- `npm run swagger:generate`: passed.
- `npm run swagger:check`: passed.
- `npm test -- --runInBand`: passed, 38 suites / 481 tests.
