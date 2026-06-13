# Beauty Pack Recommendation Backend

NestJS backend for beauty-pack personalization, recommendations, Cash on Delivery orders, and protected administration.

Current status:

The backend feature implementation is paused after Admin Order Management. The current focus is full API documentation and manual validation through Swagger, Bruno, or Postman.

## Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- class-validator
- class-transformer
- Swagger/OpenAPI

## Implemented Scope

- NestJS backend foundation
- Prisma Schema V1
- PostgreSQL migration setup
- Mock seed data
- Public read APIs
- Quiz Profile API
- Recommendation Engine API
- Recommendation Score Calibration
- Orders API
- Admin Authentication
- Admin Catalog CRUD
- Admin Pack CRUD
- Admin Quiz, Attributes, and Recommendation Rules CRUD
- Admin Order Management and Status Workflow
- Swagger/OpenAPI documentation generation
- Manual API test documentation

## Setup

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma db seed
npm run admin:create
npm run start:dev
```

The backend runs at:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/api/docs
```

OpenAPI JSON endpoint:

```text
http://localhost:3000/api/docs-json
```

## Documentation

Start here:

- [docs/README.md](./docs/README.md)
- [docs/API_AUDIT_REPORT.md](./docs/API_AUDIT_REPORT.md)
- [docs/DOMAIN_MODEL.md](./docs/DOMAIN_MODEL.md)
- [docs/MANUAL_API_TEST_PLAN.md](./docs/MANUAL_API_TEST_PLAN.md)
- [docs/API_CLIENT_IMPORT_GUIDE.md](./docs/API_CLIENT_IMPORT_GUIDE.md)
- [docs/API_CURL_TESTS.md](./docs/API_CURL_TESTS.md)
- [BACKEND_ROADMAP.md](./BACKEND_ROADMAP.md)

## OpenAPI Generation

Generate local OpenAPI artifacts:

```bash
npm run swagger:generate
```

Output:

- `docs/openapi.json`
- `docs/openapi.yaml`

Run documentation quality checks:

```bash
npm run swagger:check
```

The checker verifies:

- OpenAPI operations have summaries.
- Protected admin routes declare bearer authentication.
- important request/response schemas exist.
- `passwordHash`, `JWT_SECRET`, and `DATABASE_URL` do not appear in the generated OpenAPI document.

## Verification

```bash
npx prisma validate
npx prisma generate
npm run build
npm test -- --runInBand
npm run swagger:generate
npm run swagger:check
```

## Boundaries

Do not add the following until explicitly requested:

- new business features
- Prisma schema changes
- recommendation scoring changes
- order workflow changes
- stock reservation or stock deduction
- payment provider integration
- delivery integration
- WhatsApp integration
- frontend code
