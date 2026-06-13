# Beauty Pack Recommendation Backend

NestJS backend for beauty-pack personalization, recommendations, Cash on Delivery orders, and protected administration.

Current status:

Task 14 Media Management and Image Upload API is implemented on `feature/task-14-media-management`. The backend now supports protected Cloudinary image uploads, product/pack/category/product-reference image relationships, optimized delivery URLs, and image fields in public catalog and recommendation responses.

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
- Media Management and Image Upload API
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

## Media Upload Environment

Task 14 uses Cloudinary for image storage. Configure these values in local `.env` only:

```env
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_FOLDER_PREFIX="beauty-app"
MEDIA_MAX_FILE_SIZE_MB=5
```

Never commit real Cloudinary credentials.

Uploads currently flow through the backend: admin client to NestJS multipart endpoint to Cloudinary. Direct signed browser-to-Cloudinary upload is intentionally left as a future optimization.

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
