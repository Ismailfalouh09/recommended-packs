# Backend Store Baseline Check

## 1. Documents Reviewed

* docs/backend-store-gap-confirmation.md
* docs/backend-store-implementation-steps.md

## 2. Current Backend State

| Area | Current Status | Source/File | Notes |
| ---- | -------------- | ----------- | ----- |
| Products | Public listing exists through `GET /products`. | `src/modules/products/products.controller.ts`, `src/modules/products/products.service.ts` | Returns active products only (`isActive: true`, `status: ACTIVE`) ordered by `createdAt desc`. No public query/filter/pagination parameters yet. |
| Product details | Public detail exists through `GET /products/:id`. | `src/modules/products/products.controller.ts`, `src/modules/products/products.service.ts` | Looks up active products by UUID only. No slug lookup route yet. |
| Categories | Admin routes exist only under guarded `admin/categories`. | `src/modules/categories/admin-categories.controller.ts`, `src/modules/categories/categories.service.ts` | No public category route yet. Category data is exposed indirectly in product responses. Admin routes use `JwtAuthGuard`, `RolesGuard`, and role decorators. |
| Brands | Admin routes exist only under guarded `admin/brands`. | `src/modules/brands/admin-brands.controller.ts`, `src/modules/brands/brands.service.ts` | No public brand route yet. Brand data is exposed indirectly in product responses as `id` and `name`; admin service also has `logoUrl`. |
| Packs | Public listing and detail exist through `GET /packs` and `GET /packs/:id`. | `src/modules/packs/packs.controller.ts`, `src/modules/packs/packs.service.ts` | Returns active packs only (`isActive: true`, `status: ACTIVE`) with items, pricing fields, attributes, and media. Display-only for normal store checkout today. |
| Orders | Public funnel order creation exists through `POST /orders`; public safe summary exists through `GET /orders/:id`. | `src/modules/orders/orders.controller.ts`, `src/modules/orders/orders.service.ts`, `src/modules/orders/dto/create-order.dto.ts` | `POST /orders` delegates to `orders.service.create()` and requires `recommendationResultId`. It does not accept cart line items. |
| COD payment | Existing order creation is Cash on Delivery only. | `src/modules/orders/orders.service.ts`, `prisma/schema.prisma` | Created orders use `paymentMethod: CASH_ON_DELIVERY`, `paymentStatus: UNPAID`, `orderStatus: PENDING_CONFIRMATION`, and `deliveryFee: 0`. |
| Product references | Product variants/references are supported in public product and pack responses. | `src/modules/products/products.service.ts`, `src/modules/packs/packs.service.ts`, `prisma/schema.prisma` | Public product responses include active references with reference code/name, price override/delta, image, stock quantity, default flag, and attributes. |
| Media/images | Public product and pack responses include media objects and generated URL sets. | `src/modules/products/products.service.ts`, `src/modules/packs/packs.service.ts`, `src/modules/categories/categories.service.ts` | Image responses use `MediaUrlService.buildUrls()` when available, with fallback URL sets. Product reference images include swatch URLs. |
| Stock | Stock is exposed for display and validated in the funnel order path. | `src/modules/products/products.service.ts`, `src/modules/orders/orders.service.ts`, `prisma/schema.prisma` | Public references expose raw `stockQuantity`. Funnel order validation checks required reference stock against `reservedQuantity`; no cart stock validation path exists yet. |
| Prisma Order schema | `Order.selectedPackId` is currently required. | `prisma/schema.prisma` | `selectedPackId String @map("selected_pack_id") @db.Uuid` and `selectedPack Pack @relation(...)` are non-null. This blocks true no-pack cart orders until widened to nullable. |

## 3. Baseline Commands

| Command | Result | Notes |
| ------- | ------ | ----- |
| `npm run test` | Passed | 16 test suites passed; 169 tests passed. |
| `npm run build` | Passed | `nest build` completed successfully. |
| `npx prisma validate` | Passed | Prisma reported `prisma/schema.prisma` is valid. |

## 4. Confirmed First Real Backend Changes

Based on the reviewed documentation, the first real backend changes after this baseline should be:

1. Make `Order.selectedPackId` nullable using a safe additive migration.
2. Add a new cart checkout DTO.
3. Add a new cart-based COD order creation path.
4. Keep existing `POST /orders` funnel behavior untouched.

## 5. Safety Rules For Next Step

* Existing admin routes must not be changed.
* Existing quiz/recommendation flow must not be changed.
* Existing `CreateOrderDto` must not be changed.
* Existing `orders.service.create()` must not be changed.
* New cart checkout logic must be additive.
* Prisma migration must only widen nullable behavior, not remove or rename fields.

## Final Decision

The backend baseline is ready for the next implementation step.

Tests are passing.

Prisma schema is valid.

The first real code change to do next is to make `Order.selectedPackId` nullable with a safe additive Prisma migration, then add the new cart checkout DTO and additive cart-based COD order creation path while leaving the existing `POST /orders` funnel untouched.
