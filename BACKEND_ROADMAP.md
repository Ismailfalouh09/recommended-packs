# Backend Roadmap

## Current Stopping Point

The backend feature implementation is paused after Admin Order Management. The current focus is full API documentation and manual validation through Swagger, Bruno, or Postman.

## Completed

### Foundation

- NestJS backend foundation created.
- Prisma installed and configured.
- `PrismaModule` and `PrismaService` created.
- Global `ValidationPipe` configured.
- Swagger configured at `/api/docs`.
- Project guidance docs created.

### Prisma Schema

- Real Prisma Schema V1 added.
- Prisma schema validation passed.
- Prisma Client generation passed.
- Prisma 7 datasource configuration is handled through `prisma.config.ts`.

### Migration Setup

- PostgreSQL installed locally on Windows.
- Local `DATABASE_URL` configured.
- Migration setup completed.
- `docker-compose.yml` and `.env.example` exist for local development reference, though the current setup uses direct local PostgreSQL.

### Seed Mock Data

- `prisma/seed.ts` created.
- Seed data created for attributes, quiz, categories, products, references, packs, and recommendation rules.
- `npx prisma db seed` works.

### Read APIs

- `GET /attributes`
- `GET /attributes/:code/options`
- `GET /quiz/questions`
- `GET /products`
- `GET /products/:id`
- `GET /packs`
- `GET /packs/:id`

### Quiz Profile API

- `POST /quiz/profiles`
- Creates `CustomerProfile` and `CustomerProfileAnswer`.
- Validates required quiz answers.
- Uses a Prisma transaction.
- Smoke tests passed.

### Recommendation Engine API

- `POST /recommendations`
- `GET /recommendations/:sessionId`
- Loads customer profile answers.
- Loads active packs, products, and references.
- Selects best references.
- Stores `RecommendationSession`, `RecommendationResult`, and `RecommendationResultItem`.
- Smoke test confirmed Foundation X selects `RF2 Medium Warm`.
- Scoring calibration is complete.

### Task 7B: Recommendation Score Calibration

- Normalizes item scores by average instead of summing all item scores.
- Ignores neutral selected items when calculating the compatibility average.
- Calculates match percentage from a deterministic maximum possible score.
- Sorts by match percentage, total score, priority, then pack name.
- Acceptance result for medium/warm/oily/natural/medium profile: Natural Glow Pack ranks `#1`.
- Acceptance result: Foundation X selects `RF2 Medium Warm`.

### Task 8: Orders API

- `POST /orders`
- `GET /orders/:id`
- Creates Cash on Delivery orders from selected recommendation results.
- Reuses customers by phone or creates new customers.
- Creates a new default delivery address.
- Creates order item snapshots.
- Creates initial order status history.
- Marks the recommendation result as selected.
- Supports `FIXED`, `SUM_ITEMS`, and `SUM_ITEMS_WITH_DISCOUNT` pricing.

### Task 9: Admin Authentication V1

- `POST /auth/login`
- `GET /auth/me`
- `prisma/create-admin.ts`
- Creates or updates one admin user from environment variables.
- Hashes passwords with bcrypt.
- Issues JWT access tokens with `sub`, `email`, and `role`.
- Validates admins are active before allowing authenticated access.
- Adds reusable `JwtAuthGuard`, `RolesGuard`, `@Roles`, and current-admin decorator.
- Adds Swagger bearer auth support.

### Task 10: Protected Admin Catalog CRUD V1

- Protected admin catalog routes with JWT and role guards.
- `OWNER` and `ADMIN` have write access.
- `STAFF` has read-only access.
- Category admin CRUD with pagination, parent data, child counts, product counts, duplicate-code checks, circular-parent prevention, and soft-deactivation.
- Brand admin CRUD with pagination, product counts, duplicate-name checks, and soft-deactivation.
- Product admin CRUD with category/brand validation, slug uniqueness, stock summaries, reference counts, pack usage count, and archive behavior.
- Product archive sets `status = ARCHIVED`, sets `isActive = false`, and deactivates product references in one transaction.
- Product reference admin CRUD with compatibility attributes, SKU/barcode uniqueness, stock validation, default reference unsetting, attribute replacement, stock update, low-stock calculation, and soft-deactivation.
- No Prisma schema change was required.
- No recommendation logic, order logic, pack CRUD, or frontend code was changed.

### Task 11: Protected Admin Pack CRUD V1

- Protected pack admin routes with JWT and role guards.
- `OWNER` and `ADMIN` have write access.
- `STAFF` has read-only access.
- Pack admin list/detail endpoints include pricing, counts, usage counts, items, attributes, and structural validation issues.
- Pack create/update validates pricing modes, budgets, slug uniqueness, duplicate products, duplicate attributes, item selection modes, and activation readiness.
- Supports `FIXED`, `SUM_ITEMS`, and `SUM_ITEMS_WITH_DISCOUNT` pack pricing configuration.
- Supports `FIXED_REFERENCE`, `AUTO_BEST_REFERENCE`, and `CUSTOMER_CHOICE` pack item modes.
- Nested pack item and attribute replacement is transactional.
- Pack archive sets `status = ARCHIVED` and `isActive = false` without deleting historical relations.
- Manual smoke confirmed an admin-created active pack is visible publicly, can be considered by recommendations, and disappears from public/recommendation flows after archive.
- No Prisma schema change was required.
- No recommendation scoring, order logic, quiz administration, or frontend code was changed.

### Task 12: Protected Admin Quiz, Attributes, and Recommendation Rules CRUD V1

- Protected admin routes for attribute groups and options.
- Protected admin routes for quiz questions, quiz options, and quiz reorder.
- Protected admin routes for recommendation rules.
- Protected non-persistent recommendation preview endpoint.
- `OWNER` and `ADMIN` have write access.
- `STAFF` has read and preview access only.
- Attribute group, attribute option, and recommendation rule codes are immutable after creation.
- Soft-deactivation preserves historical answers, compatibility rows, recommendations, and rules.
- Public attributes and quiz endpoints only expose active configuration.
- Customer profile creation continues to validate active groups, active options, active questions, required answers, and duplicates.
- Recommendation rules are read dynamically from active rows using `scoreValue * weight`.
- Missing or inactive known rules continue to use V1 fallback scores.
- Dynamic rule keys such as `COVERAGE_MATCH` are supported for new attribute groups.
- Preview reuses the same recommendation calculation path as `POST /recommendations` without persisting recommendation sessions/results/items.
- No Prisma schema change was required.
- No order logic, frontend, order administration, payment, delivery, or WhatsApp work was added.

### Task 13: Protected Admin Order Management and Status Workflow V1

- Protected admin order routes with JWT and role guards.
- `OWNER`, `ADMIN`, and `STAFF` have read access.
- `OWNER` and `ADMIN` have status update access.
- `GET /admin/orders` supports pagination, search, sorting, status filters, payment filters, source-channel filters, selected-pack filters, date range filters, and total range filters.
- `GET /admin/orders/:id` returns full admin order detail, including customer, address, selected pack, recommendation result summary, items, status history, and changed-by admin data.
- `PATCH /admin/orders/:id/status` enforces the approved status workflow.
- Allowed transitions:
  - `PENDING_CONFIRMATION -> CONFIRMED | CANCELED`
  - `CONFIRMED -> PREPARING | CANCELED`
  - `PREPARING -> SHIPPED | CANCELED`
  - `SHIPPED -> DELIVERED | RETURNED`
  - `DELIVERED -> RETURNED`
  - `CANCELED` and `RETURNED` are terminal.
- Cash on Delivery payment automation:
  - `DELIVERED` marks COD orders as `PAID`.
  - `RETURNED` marks paid COD orders as `REFUNDED`.
  - `CANCELED` keeps unpaid COD orders unpaid.
  - canceling an already paid order is rejected.
- Public `GET /orders/:id` now returns a safe summary only.
- Status updates use a transaction and conditional update to protect against stale concurrent transitions.
- No delete order endpoint was added.
- No Prisma schema change was required.
- No recommendation scoring, stock reservation/deduction, delivery integration, WhatsApp integration, or frontend code was changed.

### Task 14-DOC: Complete Domain Documentation, Swagger/OpenAPI Documentation, and Manual API Test Preparation

- Domain model documentation created for every Prisma entity and enum.
- API audit report created for implemented modules, endpoints, auth requirements, documentation gaps, sensitive-data review, limitations, and schema entities without APIs.
- Swagger/OpenAPI metadata improved with project title, description, version, bearer auth, server example, tags, operation summaries, request DTO metadata, and response models.
- Swagger UI remains available at `GET /api/docs`.
- OpenAPI JSON is available at `GET /api/docs-json`.
- Deterministic OpenAPI generation script added.
- Generated OpenAPI files:
  - `docs/openapi.json`
  - `docs/openapi.yaml`
- Manual API test plan created for Swagger, Bruno, and Postman.
- API client import guide created for Swagger UI, Postman, and Bruno.
- Documentation index created under `docs/README.md`.
- No Prisma schema change was required.
- No recommendation logic, order workflow, stock reservation/deduction, WhatsApp, delivery integration, or frontend code was changed.

## Pending

### Stock Workflow Later

- Do not reserve or deduct stock until explicitly requested.
- Define stock rules before connecting order status changes to inventory changes.

### Admin User Management Later

- Do not create admin user CRUD endpoints until explicitly requested.

### Delivery, Payment, and WhatsApp Later

- Delivery workflows are future work.
- External payment provider workflows are future work.
- WhatsApp workflows are future work.
- Do not add integrations until explicitly requested.

## Ongoing Quality Gates

- Keep controllers thin.
- Keep business logic inside services.
- Keep database access behind `PrismaService`.
- Run `npx prisma validate` after schema-related work.
- Run `npx prisma generate` after Prisma schema changes.
- Run `npm run build` before handoff.
- Run `npm test -- --runInBand` when tests exist.
- Avoid unrelated refactors.
