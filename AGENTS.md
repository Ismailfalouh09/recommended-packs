# Backend Agent Rules

This repository is the NestJS backend for a beauty ecommerce recommendation engine.

## Scope

- Build the backend only.
- Do not build a frontend.
- Do not add recommendation logic until explicitly requested.
- Do not add order flows until explicitly requested.
- Do not add admin CRUD until explicitly requested.
- Do not invent features outside the current task.

## Architecture

- Use NestJS modules, controllers, services, and DTOs.
- Keep controllers thin: request parsing, response shaping, and delegation only.
- Keep business logic inside services.
- Keep validation rules in DTOs with `class-validator` and `class-transformer`.
- Keep database access behind `PrismaService`.
- Do not instantiate `PrismaClient` directly in feature services.
- Add feature modules only when the feature is explicitly requested.

## Prisma

- Prisma schema lives in `prisma/schema.prisma`.
- Do not add database models until the task explicitly asks for them.
- Generate the Prisma client after schema changes.
- Keep migrations intentional and tied to approved schema changes.

## Media

- Store image metadata in PostgreSQL and image binaries in the configured media provider only.
- Do not store permanent uploads, Base64 image payloads, or generated thumbnails on the backend server.
- Keep Cloudinary SDK usage inside the media storage provider layer.
- Feature services must use `MediaService`, `MediaUrlService`, or the provider abstraction; they must not call Cloudinary directly.
- Do not let clients choose provider IDs, Cloudinary folders, public IDs, secure URLs, or transformations.

## Code Quality

- Use clean TypeScript with explicit public APIs.
- Prefer dependency injection over manual construction.
- Keep files focused and small.
- Avoid unrelated refactors.
- Run build and relevant tests before handing off changes.
