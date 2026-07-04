# Backend Store Implementation Steps

Goal: close every normal-store gap **on the backend**, returning data already shaped the way the storefront consumes it (no frontend adapters doing business logic). Everything here is **additive** — no admin, quiz, recommendation, or existing-order behavior changes.

Principles applied to every step:
- New **public** routes and **new response DTOs**; never modify existing admin/quiz/order DTOs or guards.
- Reuse existing helpers: `paginationParams` / `paginatedResponse` (`common/utils/pagination.util`), `optionalTrimmedString` / `optionalBoolean` (`common/transforms/query.transforms`), `MediaUrlService.buildUrls`, and the price logic in `orders.service.ts`.
- Schema changes only widen (nullable), never narrow/drop/rename.
- Each step ends with a manual test (curl) + a service unit test.

Legend: **[CODE]** writes code · **[MIGRATE]** Prisma migration · **[TEST]** verification.

---

## Phase 0 — Prep (no behavior change)

**Step 0.1 — Branch & baseline** `[TEST]`
- Work on `feature/storefront-public-api` (off current branch).
- Run the existing suite to capture a green baseline: `npm run test` and `npm run start:dev` smoke.

**Step 0.2 — Decide route namespace**
- Public store routes are added to existing modules (no new "storefront" module needed). New public read routes live next to the existing public controllers.
- Confirmed convention: public = no guard; admin = `admin/*` + `JwtAuthGuard, RolesGuard`. Keep it.

---

## Phase 1 — Public catalog reads (move browse logic server-side)

### Step 1.1 — Public categories endpoint `GET /categories` `[CODE]`
**Why:** Home tiles, nav, category page, filter — currently admin-only.
**Files:**
- `src/modules/categories/categories.controller.ts` (new public controller, `@Controller('categories')`, no guard).
- `src/modules/categories/categories.service.ts` → add `publicFindAll()` and `publicFindOne(idOrCode)`.
- `src/modules/categories/categories.module.ts` → register the new controller.
- `src/common/swagger/api-response.models.ts` → new `PublicCategoryResponse`.

**Logic (backend, frontend-ready):**
- `publicFindAll()`: reuse `listSelect()`, filter `where: { isActive: true }`, order `[{ sortOrder: 'asc' }, { name: 'asc' }]`, map with a slimmed `toPublicCategoryResponse` → `{ id, code, name, description, image{urls,altText}, sortOrder, productCount, childCategoryCount }`. `productCount` is already computed via `_count.products` — **filter it to active products** by switching `_count` to a counted relation or post-filtering (see note).
- Return a **plain array** (not the admin paginated envelope) — that's what the storefront wants for tiles/nav.

**Note on active product counts:** `_count.products` counts all products regardless of status. If accurate "active product count" matters, count via `products: { where: { isActive: true, status: 'ACTIVE' } }` in a dedicated select, or accept the raw count for MVP and document it.

**No-impact:** existing `admin/categories` controller, `findAll/findOne`, and `AdminCategoryResponse` untouched.

`[TEST]` `curl localhost:3000/categories` → array of active categories with image urls; admin route still requires token.

### Step 1.2 — Public brands endpoint `GET /brands` `[CODE]`
**Why:** Brand strip / brand filter.
**Files:** new `src/modules/brands/brands.controller.ts` (`@Controller('brands')`), `brands.service.ts` → `publicFindAll()`, module registration, `PublicBrandResponse`.
**Logic:** active brands only, `{ id, name, logoUrl?, productCount }`. Brand logo media relationship is **not implemented** (see `KNOWN_LIMITATIONS.md`) — expose `logoUrl` if a plain field exists, else omit and let frontend show names.
`[TEST]` `curl localhost:3000/brands`.

### Step 1.3 — Server-side product query on `GET /products` `[CODE]`
**Why:** Move search/filter/sort/pagination off the client so it scales and logic lives on backend.
**Files:**
- New `src/modules/products/dto/query-public-products.dto.ts` (extends `PaginationQueryDto`): `search?`, `categoryId?`, `categoryCode?`, `brandId?`, `sortBy ∈ {createdAt,name,basePrice}`, `sortOrder ∈ {asc,desc}`, `inStock?` (boolean). Reuse `optionalTrimmedString` / `optionalBoolean`.
- `products.controller.ts` → `findAll(@Query() query)` passes to service.
- `products.service.ts` → extend `findAll(query?)`: build `where` (always `isActive && status=ACTIVE` **+** optional filters), apply `orderBy`, paginate via `paginationParams`/`paginatedResponse`.

**Backward-compatibility rule:** when **no** query params are sent, behavior must equal today's (all active products, `createdAt desc`). The storefront can opt into the paginated envelope by sending `page`/`size`. Keep the public product **item shape identical** (`toPublicProductResponse`).

**`inStock` / facets:** `inStock=true` → `references: { some: { isActive: true, stockQuantity: { gt: 0 } } }`. Defer shade/attribute facet *counts* to a later step (compute server-side only if the listing needs them).

`[TEST]` `curl "localhost:3000/products?search=foundation&sortBy=basePrice&sortOrder=asc&page=1&size=12"`; and `curl localhost:3000/products` (unchanged default).

### Step 1.4 — Slug lookup for product & pack `[CODE]`
**Why:** SEO URLs; `slug` already exists in payload.
**Files:** `products.controller.ts` add `GET /products/slug/:slug` → `findBySlug`; same for packs.
**Logic:** `findFirst({ where: { slug, isActive: true, status: 'ACTIVE' } })` reusing `productSelect` / `toPublicProductResponse`. Keep existing UUID route.
`[TEST]` `curl localhost:3000/products/slug/<slug>`.

> End of Phase 1: entire browse/catalog half is fully backend-driven and frontend-ready. No checkout yet.

---

## Phase 2 — Unblock checkout (the only Critical gap)

### Step 2.1 — Schema migration: make `Order.selectedPackId` nullable `[MIGRATE]`
**Why:** a product cart has no pack; column is currently `NOT NULL` (`schema.prisma:628`).
**Change:** `selectedPackId String?` and relation `selectedPack Pack? @relation(...)`. (`OrderItem.packId`, `recommendationResultId`, `customerProfileId` are already nullable.)
**Command:** `npx prisma migrate dev --name order_selected_pack_optional`.
**No-impact:** widening NOT NULL→nullable is non-destructive; existing rows keep values; funnel order creation still sets `selectedPackId`. Verify the funnel `POST /orders` still compiles (its `data.selectedPackId` assignment is unaffected).
`[TEST]` `npx prisma validate`; run existing order tests green; create a funnel order via existing flow → still works.

### Step 2.2 — New cart-order DTO `[CODE]`
**File:** `src/modules/orders/dto/create-cart-order.dto.ts`.
**Shape:**
```ts
class CartOrderItemDto { @IsUUID() productId; @IsUUID() referenceId; @IsInt() @Min(1) quantity; }
class CreateCartOrderDto {
  @ValidateNested({each:true}) @ArrayNotEmpty() items: CartOrderItemDto[];
  fullName; phone; whatsappPhone?; city; addressLine; extraInfo?; notes?; // reuse trim transforms from CreateOrderDto
}
```
**No-impact:** existing `CreateOrderDto` (funnel) untouched.

### Step 2.3 — Cart-order service method `createFromCart()` `[CODE]`
**File:** `orders.service.ts` (new method; do not change `create()`).
**Logic — all server-side, reusing existing pieces:**
1. Load each `referenceId` with its product: validate `product.isActive && status=ACTIVE`, `reference.isActive`, reference belongs to product.
2. **Stock validation** per line: `reference.stockQuantity >= quantity` else `BadRequestException` (mirror funnel validation; reservation still deferred).
3. **Price snapshot** per line reusing the same rule as `effectiveReferencePrice`: `priceOverride ?? basePrice + priceDelta`; `totalPrice = unit * qty`. Build `subtotal`; `discount = 0`; `deliveryFee` (Step 2.5); `total`.
4. In a `$transaction`: `upsertCustomer` (reuse existing private method), reset+create default `customerAddress` (reuse existing block), create `Order` with `selectedPackId: null`, `recommendationResultId: null`, `customerProfileId: null`, COD/UNPAID/PENDING_CONFIRMATION; `orderItem.createMany` with `packId: null`; `orderStatusHistory` "Order created".
5. Return via a `toCartOrderResponse` mirroring `toOrderResponse` **minus** the `pack` object (or `pack: null`).

**Refactor safely:** extract `upsertCustomer`, address creation, and order-number generation are already private/reusable — call them; don't duplicate.

### Step 2.4 — Cart-order route `POST /orders/checkout` `[CODE]`
**File:** `orders.controller.ts` add `@Post('checkout')` → `createFromCart`. New Swagger `CartOrderCreateResponse`.
`[TEST]` curl with 2 items → 201 with items, totals, COD/UNPAID; out-of-stock line → 400; inactive product → 400.

### Step 2.5 — Delivery fee (start flat, structured) `[CODE]`
**Why:** accurate COD total, kept on backend.
**Logic:** compute `deliveryFee` inside `createFromCart` (and optionally expose for display). MVP = flat `0` constant in one place (`getDeliveryFee(city): 0`), so later per-city rules slot in without touching callers.
**No-impact:** funnel order keeps `deliveryFee=0` exactly as today.

### Step 2.6 — Confirmation line items `[CODE]`
**Why:** confirmation page on reload/share.
**Option A (recommended, no schema/contract change):** frontend holds the `POST /orders/checkout` response (already includes items) in session; `GET /orders/:id` stays the safe summary.
**Option B (backend):** add a **new** public route `GET /orders/:id/items` returning non-sensitive lines `{ productName, referenceName, quantity, unitPrice, totalPrice }` — does NOT alter the existing `GET /orders/:id` shape.
Pick A for launch; B is a small additive follow-up.
`[TEST]` reload confirmation shows items (A); or `curl /orders/:id/items` (B).

> End of Phase 2: the normal store can complete a COD purchase end-to-end.

---

## Phase 3 — Merchandising polish (optional, additive)

### Step 3.1 — Homepage feed `GET /storefront/home` (optional aggregator) `[CODE]`
**Why:** one call returns frontend-ready home sections instead of the client slicing.
**Logic:** aggregate `{ featuredProducts: products[0..N], newArrivals, categories, packs }` from existing services. Pure read composition; no new tables.
**Alternative (if "featured" must be curated):** add `Product.isFeatured Boolean @default(false)` (additive nullable-safe column) + admin toggle later; for now derive by recency.

### Step 3.2 — Facet counts (only if listing needs them) `[CODE]`
Compute brand/shade/price-bucket counts server-side over the active product set and return alongside the product page. Defer until the catalog/UX actually requires it.

---

## Execution Order (dependency-sorted)

| # | Step | Priority | Blocks |
| - | ---- | -------- | ------ |
| 1 | 0.1–0.2 Prep | — | all |
| 2 | 1.3 Product query params | High | listing scale |
| 3 | 1.1 Public categories | High | nav/tiles |
| 4 | 1.2 Public brands | Medium | brand strip |
| 5 | 1.4 Slug lookup | Later | SEO |
| 6 | 2.1 Migration (selectedPackId nullable) | **Critical** | 2.3 |
| 7 | 2.2 Cart DTO | **Critical** | 2.3 |
| 8 | 2.3 `createFromCart` | **Critical** | 2.4 |
| 9 | 2.4 `POST /orders/checkout` | **Critical** | checkout |
| 10 | 2.5 Delivery fee | High | totals |
| 11 | 2.6 Confirmation items | High | confirmation |
| 12 | 3.x Polish | Later | — |

**Minimum to unblock the store:** Steps 2.1 → 2.4 (+1.1, 1.3 for a usable catalog). Everything else is incremental and safe to ship later.

---

## Guardrails (apply to every step)
- Do **not** modify: `CreateOrderDto`, `orders.service.create()` funnel path, `GET /orders/:id` shape, any `admin/*` controller/guard/DTO, quiz/recommendation modules.
- Public product/pack **item shapes stay byte-identical** (`toPublicProductResponse`, pack mapper) so existing consumers don't break.
- Every new endpoint is **public, read-or-create-only, additive**.
- Each merged step: existing test suite stays green + new unit test for the added service method.
