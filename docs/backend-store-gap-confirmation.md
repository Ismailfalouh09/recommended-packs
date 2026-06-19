# Backend Store Gap Confirmation

> Analysis only. No code, endpoints, schema, DTOs, controllers, or services were changed.
> Scope: the **normal ecommerce store** (browse → cart → COD checkout). Quiz, recommendation engine, wishlist, compare, blog, online payment, customer accounts, and advanced analytics are out of scope.
> Source of truth: backend source code in `src/`, `prisma/schema.prisma`, and the published handoff docs. Where the frontend store-readiness docs and the backend disagree, the backend source wins.

---

## 1. Documents Reviewed

### `C:\Users\asus\Desktop\Phinix\docs`
- `store-readiness/01_BACKEND_HANDOFF_REVIEW.md`
- `store-readiness/02_NORMAL_STORE_PAGE_MAPPING.md`
- `store-readiness/04_BACKEND_GAP_ANALYSIS.md`
- (cross-referenced) `template-analysis/03_PAGE_INVENTORY.md`, `04_COMPONENT_INVENTORY.md`, `06_CART_CHECKOUT_ANALYSIS.md`, `07_BACKEND_DATA_NEEDS.md`

### `C:\Users\asus\Desktop\recommended packs\docs`
- `DOMAIN_MODEL.md`, `API_AUDIT_REPORT.md`, `README.md` (catalog/context)
- Test/plan docs referenced for endpoint shapes (`MANUAL_API_TEST_PLAN.md`, `API_CURL_TESTS.md`, `TEST_PLAN_CURRENT_BACKEND.md`)

### `C:\Users\asus\Desktop\recommended packs\frontend-handoff`
- `CUSTOMER_FRONTEND_HANDOFF.md`
- `CUSTOMER_PAGE_ENDPOINT_MAPPING.md`
- `KNOWN_LIMITATIONS.md`
- `PAGE_ENDPOINT_MAPPING.md`, `ROLE_PERMISSION_MATRIX.md`, `backend-version.txt`, `openapi.json` / `openapi.yaml`

### Backend source verified directly (ground truth)
- `src/modules/orders/orders.controller.ts`, `dto/create-order.dto.ts`, `orders.service.ts`
- `src/modules/products/products.controller.ts`, `products.service.ts` (public `productSelect`, `toPublicProductResponse`)
- `src/modules/categories/admin-categories.controller.ts`
- `prisma/schema.prisma` (`Order`, `OrderItem` models)

---

## 2. Confirmed Backend Capabilities

| Area | Existing Support | Source | Notes |
| ---- | ---------------- | ------ | ----- |
| Categories | Partial (admin only) | `admin-categories.controller.ts` (JWT + Roles); public `product.category {id, code, name, image}` | No public category-list endpoint. Storefront must derive categories from products. Public category identity is **`code`**, not `slug`. |
| Brands | Partial (admin only) | `admin-brands.controller.ts`; public `product.brand {id, name}` | No public brand-list endpoint. Public brand carries **name only, no logo**. |
| Products (listing) | ✅ Yes | `GET /products` → `ProductsService.findAll` | Returns **all** active products (`isActive && status=ACTIVE`), ordered by `createdAt desc`. No paging/filter/sort/search params. |
| Product details | ✅ Yes | `GET /products/:id` → `findOne` | By **UUID only** (no slug route). Returns full public product shape. |
| Media / images | ✅ Yes | `productSelect` → `coverImage`, `images[]`, `category.image`, `references[].image` | URLs built via `MediaUrlService`: `urls.{card,detail,thumbnail,original}` and `urls.swatch` for references. `altText` provided. Frontend only consumes URLs; never uploads. |
| Variants / references | ✅ Yes | `productSelect.references` (active only, default-first) | `id, referenceCode, referenceName, priceOverride, priceDelta, imageUrl, image{swatch}, stockQuantity, isDefault, attributes[]`. |
| Stock | ✅ Yes (display) | `references[].stockQuantity` (public) | Public exposes raw `stockQuantity` only (`reservedQuantity`/`availableStock` are admin-only). No reservation/deduction implemented → treat `stockQuantity > 0` as in-stock. |
| Packs (listing/details) | ✅ Yes (display) | `GET /packs`, `GET /packs/:id` | `priceMode (FIXED / SUM_ITEMS / SUM_ITEMS_WITH_DISCOUNT)`, `fixedPrice`, discounts, `items[]`, media. Display-only; cannot be purchased directly. |
| Orders (create) | ⚠️ Partial / funnel-only | `orders.controller.ts` + `create-order.dto.ts` + `orders.service.create` | `POST /orders` **requires `recommendationResultId` (UUID)** and accepts **no items array**. Items are derived server-side from the recommendation result. Not usable for a normal cart. |
| Order confirmation (read) | ✅ Yes (summary) | `GET /orders/:id` → `findOne` | Safe public summary: `orderId, orderNumber, orderStatus, paymentStatus, totalAmount, currency, packName, createdAt, updatedAt`. **No line items**, no customer/address by design. |
| Delivery info capture | ✅ Yes | `create-order.dto.ts` + `orders.service` (creates `CustomerAddress`) | Captures `fullName, phone, whatsappPhone?, city, addressLine, extraInfo?, notes?`. |
| Cash on delivery | ✅ Yes | `orders.service.create` | Always `paymentMethod=CASH_ON_DELIVERY`, `paymentStatus=UNPAID`, `orderStatus=PENDING_CONFIRMATION`. `deliveryFee` always `0`. |
| Price snapshotting | ✅ Yes (reusable) | `orders.service` `calculateOrderPrice` / `effectiveReferencePrice` | Snapshots product/reference names + unit price into `OrderItem`. Effective price = `priceOverride ?? basePrice + priceDelta`. Reusable for a future cart path. |
| Attributes helper | ✅ Yes | `GET /attributes`, `GET /attributes/:code/options` | Optional for shade/filter helpers. |

---

## 3. Confirmed Backend Gaps

| Gap | Needed For | Current Support | Decision | Risk | Notes |
| --- | ---------- | --------------- | -------- | ---- | ----- |
| Direct cart-based COD order endpoint | Checkout, Order confirmation | `POST /orders` requires `recommendationResultId`; no items array | **Create later** | High | The single hard blocker. Cart lines `{productId, referenceId, quantity}` cannot be ordered today. |
| `Order.selectedPackId` is NOT NULL | Storing a non-pack (pure-product) order | Schema: `selectedPackId String` (required); `recommendationResultId`/`customerProfileId` are nullable, `OrderItem.packId` is nullable | **Create later (needs additive migration)** | Medium | **Newly confirmed from `schema.prisma:628`.** A true product-cart order has no pack. Supporting it requires making `selectedPackId` nullable — a backward-compatible migration, but it IS a schema change. Prior frontend docs missed this. |
| Public category list endpoint | Home tiles, nav, category page, filter | `admin/categories` only; derivable from `product.category` | **Frontend adapter** (Create later, low effort) | Low | Derived list lacks ordering, descriptions, counts, and zero-product categories. Acceptable for MVP. |
| Public brand list endpoint | Home brand strip, brand filter | `admin/brands` only; public brand = name only | **Frontend adapter** | Low | No brand logos in public payload — hide logo strip or show names. |
| Public order summary with line items | Confirmation page on reload | `GET /orders/:id` has no items (by design) | **Frontend adapter** | Low | Hold the richer `POST /orders` response in local/session state; fall back to summary on reload. |
| Product search | Header search, listing | `GET /products` returns all, no `q` | **Frontend adapter** | Low | Client-side filter over full list; fine for small catalog. |
| Product filter (shade/price/brand/availability) | Listing, category | None on public products | **Frontend adapter** | Low | Client-side over full list; facet counts computed client-side. |
| Product sort | Listing | None | **Frontend adapter** | Low | Client-side sort. |
| Pagination | Listing, packs | None | **Frontend adapter** (won't scale) | Medium | Client-side paginate the full array; add server params once catalog grows. |
| Slug lookup (product/pack) | SEO URLs | UUID routes only; `slug` present in payload | **Postpone** | Low | Template links by id; route by UUID for now. |
| Cart validation endpoint | Cart, checkout | None; order-time validation only | **Frontend adapter** | Low | Re-fetch `GET /products/:id` per line at checkout; order creation is the backstop. |
| Delivery fee by city | Cart/checkout total | `deliveryFee` hardcoded `0` | **Postpone** | Low | Ship as `0`/Free; add rules inside the future order endpoint. |
| Homepage featured/curated sections | Home merchandising | No featured flag/endpoint | **Frontend adapter** | Low | Slice/sort `/products`; keep hero/testimonials/features static. |
| `CUSTOMER_CHOICE` reference override | Pack customization at order | No order API accepts an alternate reference | **Not needed** (for normal store this phase) | Low | Out of scope; tied to recommendation flow. |
| Product media URLs | All product pages | `coverImage`, `images[]`, swatch — provided | **Already supported** | — | No gap. |
| References / variants | Details, cart | `references[]` — provided | **Already supported** | — | Adapter mapping only. |
| Stock visibility | Details, cart | `references[].stockQuantity` — provided | **Already supported** | — | Treat `>0` as in-stock. |
| Packs display | Packs pages | `GET /packs`, `GET /packs/:id` — provided | **Already supported** | — | Display only; compute `SUM_ITEMS` price client-side. |
| COD payment status | Checkout, confirmation | Returned by order endpoints | **Already supported** | — | No gap. |

---

## 4. No-Impact Strategy

How to deliver the needed backend changes later **without breaking existing admin/dashboard/quiz/recommendation/order behavior**:

- **Reuse existing modules.** A future cart-based order path should live in the existing `orders` module and reuse `upsertCustomer`, the address-creation block, `effectiveReferencePrice`, and `OrderItem` snapshotting from `orders.service.ts`. Do not duplicate order/customer logic.
- **Add public store endpoints only where derivation is insufficient.** Categories/brands/search/filter/sort can be handled by frontend adapters for MVP. Only add `GET /categories` / `GET /brands` (public, active-only, new response DTOs) when correctness (ordering, counts, logos) actually matters at launch.
- **Do not touch admin/dashboard endpoints.** All `admin/*` controllers (categories, brands, products, product-references, orders, media) keep their JWT + Roles guards and current DTOs unchanged. New public endpoints are additive, separate routes — never relax guards on admin routes.
- **Keep existing DTOs stable.** Do not modify `CreateOrderDto`. For a cart path, introduce a **new** DTO (e.g. `CreateCartOrderDto` with `items[]`) on a **new** route (e.g. `POST /orders/checkout`) rather than making `recommendationResultId` optional on the existing one — this keeps the quiz-funnel contract and its validation byte-for-byte unchanged.
- **Add new response DTOs instead of changing existing ones.** If the public order summary later needs items, expose a new field/DTO; do not alter the current `GET /orders/:id` safe-summary shape that the funnel already relies on.
- **Schema changes must be additive/backward-compatible.** The one unavoidable schema touch for a pure-product cart order is making **`Order.selectedPackId` nullable** (`prisma/schema.prisma:628`). Widening NOT NULL → nullable is non-destructive: existing rows keep their values, existing reads/writes (which always set it) still work, and quiz-funnel orders continue to populate it. `OrderItem.packId` is already nullable, and `recommendationResultId`/`customerProfileId` are already nullable — so order items and order metadata already tolerate a no-pack order. No existing column is dropped, renamed, or narrowed.
- **Keep quiz/recommendation untouched.** No changes to quiz or recommendation modules, their DTOs, or their flow. The recommendation-funnel order path stays exactly as is; the cart path is a parallel addition.
- **Keep existing order behavior safe.** COD-only, `UNPAID`, `PENDING_CONFIRMATION`, `deliveryFee=0`, stock validated-not-reserved — all preserved. The cart path reuses the same status/history creation so admin order management and analytics keep working identically.

---

## 5. Recommended Backend Actions Later

| Priority | Action | Why Needed | Impact Risk | Safe Approach |
| -------- | ------ | ---------- | ----------- | ------------- |
| Critical | Add cart-based COD order path (`POST /orders/checkout` accepting `items[]` + customer/address fields) | Only way to complete a normal-store purchase | Medium | New route + new `CreateCartOrderDto`; reuse customer/address/price-snapshot logic; do not touch existing `POST /orders`. |
| Critical | Make `Order.selectedPackId` nullable (additive migration) | A product cart has no pack; column is currently NOT NULL | Medium | Backward-compatible widening; existing rows/writes unaffected; funnel orders still set it. |
| High | Add stock validation + (optional) reservation in the cart path | Prevent overselling at checkout | Medium | Validate `stockQuantity` per line at order time (mirror existing funnel validation); defer true reservation. |
| High | Add `GET /categories` (public, active-only) returning `{id, code, name, image, productCount}` | Correct nav/tiles incl. zero-product & ordering | Low | New public read endpoint + new response DTO; admin categories untouched. |
| Medium | Add `GET /brands` (public) with logo URLs | Brand strip/filter with branding | Low | New public read endpoint; requires brand-logo media relationship (currently not implemented). |
| Medium | Add server-side product query params (`q`, `category`, `sort`, `page`, `size`, facets) | Scale beyond client-side filtering | Low | Extend `GET /products` with optional params; default behavior (return all active) preserved when no params. |
| Medium | Add line items to public order summary (or document local-state pattern) | Confirmation on reload/share | Low | New optional field/DTO; keep current safe summary shape stable. |
| Later | Public slug lookup for product/pack | SEO-friendly URLs | Low | Additive route alongside UUID routes. |
| Later | Delivery-fee-by-city rule | Accurate COD totals | Low | Compute inside the cart-order path; expose for display. |

---

## 6. Final Decision

**Can frontend normal-store implementation start with the current backend?**
Yes — **partially, and immediately for the entire browse/catalog half.** Home, category, product listing, product details, packs listing, and pack details can all be built now against `GET /products`, `GET /products/:id`, `GET /packs`, `GET /packs/:id`, `GET /attributes`, plus frontend adapters. The cart can be built and filled client-side (localStorage).

**What blocks implementation?**
Exactly one flow: **checkout and order confirmation.** `POST /orders` only accepts a `recommendationResultId` (quiz-funnel) and no cart items, and the `Order.selectedPackId` column is NOT NULL. A normal cart of arbitrary products therefore **cannot be turned into an order today.** Everything downstream of "place order" is blocked until a cart-based order path (and the `selectedPackId`-nullable migration) is added.

**What can be handled by frontend adapters (no backend change)?**
Category list (derive from `product.category.code`), brand list/names (derive from `product.brand`), search, filter, sort, pagination, homepage curation, cart display/validation (re-fetch product at checkout), and showing order line items from the immediate `POST /orders` response. Media, references, stock display, and pack display need **adapters only** — the data is already there.

**What backend changes should be done first (later)?**
1. Cart-based COD order endpoint (new route + new DTO, reusing existing order logic).
2. The backward-compatible `Order.selectedPackId` → nullable migration that unblocks it.
3. Per-line stock validation in that path.
These three together unblock the only broken flow. Public `GET /categories`/`GET /brands` and server-side query params are valuable but not launch-blocking.

**What should NOT be touched?**
The quiz and recommendation modules and their flow; the existing `POST /orders` + `CreateOrderDto` funnel contract; the safe `GET /orders/:id` summary shape; all `admin/*` endpoints, their guards, and their DTOs. New store capability must be **additive** (new routes, new response DTOs, backward-compatible migrations) — never a modification of existing admin/quiz/order contracts.
