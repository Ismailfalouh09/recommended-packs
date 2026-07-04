# Project Brief

## Product

Recommended Packs is a NestJS backend for a beauty ecommerce recommendation engine. It supports customer quiz profiles, rule-based pack recommendations, Cash on Delivery orders, protected admin operations, and Cloudinary-backed catalog media.

## Backend Goal

Provide a clean backend foundation for beauty product data, customer preference capture, recommendation workflows, ecommerce order creation, and admin operations without introducing frontend code.

## Current Scope

- NestJS application structure with global validation and Swagger/OpenAPI documentation.
- Prisma and PostgreSQL schema, migrations, seed data, and generated client.
- Public read APIs for attributes, quiz, products, packs, recommendations, and safe order lookup.
- Customer quiz profile creation.
- Rule-driven recommendation generation and persisted recommendation sessions/results/items.
- Cash on Delivery order creation and protected admin order status workflow.
- Protected admin authentication and role-based authorization.
- Protected admin CRUD for catalog, packs, quiz, attributes, recommendation rules, and orders.
- Protected media management using Cloudinary behind a storage-provider abstraction.
- Product, pack, category, and product-reference image relationships with optimized URL variants in API responses.

## Explicitly Out Of Scope Until Requested

- Frontend application.
- Customer authentication.
- Admin user CRUD.
- Stock reservation or deduction.
- Payment provider integration.
- Delivery provider integration.
- WhatsApp or messaging workflows.
- Direct browser-to-Cloudinary signed upload.
- ML-based recommendation logic.

## Core Technical Stack

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- class-validator
- class-transformer
- Swagger/OpenAPI
- Cloudinary
