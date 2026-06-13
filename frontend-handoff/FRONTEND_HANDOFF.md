# Frontend Handoff

This folder contains the backend contract needed by a separate admin-dashboard frontend.

## Backend Start

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run admin:create
npm run start:dev
```

## URLs

- API base URL: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON endpoint: `http://localhost:3000/api/docs-json`
- Local admin dashboard origin: `http://localhost:5173`

## Environment

Set this in backend `.env` for local dashboard development:

```env
ADMIN_DASHBOARD_ORIGIN="http://localhost:5173"
```

Do not use unrestricted production CORS. Production should set this to the exact deployed dashboard origin.

## Login Flow

1. Create a local admin user:

```bash
npm run admin:create
```

2. Call:

```http
POST /auth/login
```

Body:

```json
{
  "email": "admin@example.com",
  "password": "change-this-password"
}
```

3. Read `accessToken` from the response.

## JWT Bearer Usage

Send the token on every protected admin request:

```http
Authorization: Bearer <accessToken>
```

Protected endpoints are all under `/admin/*` plus `GET /auth/me`.

## Pagination Format

Admin list endpoints generally accept:

```text
page=1&pageSize=20&search=value&sortBy=createdAt&sortOrder=desc
```

Paginated responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

## Error Response Format

The backend currently uses Nest's default exception response shape:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Validation errors may return `message` as an array of strings.

## Local Test Account Creation

Configure safe local values in `.env`:

```env
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="change-this-password"
ADMIN_FULL_NAME="Store Owner"
JWT_SECRET="replace-with-a-long-random-secret"
JWT_EXPIRES_IN="8h"
```

Then run:

```bash
npm run admin:create
```

Use a non-placeholder `JWT_SECRET` in any shared or deployed environment.

## Seed Development Data

```bash
npx prisma db seed
```

Seeded data includes quiz attributes/questions, products, product references, packs, and recommendation rules.

## Media Upload Notes

Cloudinary-backed catalog media is available for:

- Product cover and gallery
- Pack cover and gallery
- Category image
- Product-reference swatch

Configure Cloudinary in backend `.env` before testing real uploads:

```env
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
CLOUDINARY_FOLDER_PREFIX="beauty-app"
MEDIA_MAX_FILE_SIZE_MB=5
```

The frontend must upload files using `multipart/form-data` field name `file`.
