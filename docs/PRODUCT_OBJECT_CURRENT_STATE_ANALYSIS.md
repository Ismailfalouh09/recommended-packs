# Product Object — Current State Analysis

> Analysis-only document. No schema, migration, seed, DTO, endpoint, or configuration was modified while producing it.
> Evidence is labelled as **Confirmed by code**, **Inferred from documentation**, or **Business assumption requiring validation**.

---

## 1. Executive Summary

The `Product` model is a **thin catalog header**. It carries identity (`name`, `slug`), one optional free-text `description`, money (`basePrice`, `costPrice`, `currency`), one legacy `mainImageUrl`, a dual lifecycle flag pair (`status` + `isActive`), a **required** `category`, and an **optional** `brand`. Everything that makes the store "beauty-specific" lives **one level below**, on `ProductReference` (shades/variants): SKU, barcode, stock, per-variant price, swatch image, and **all compatibility attributes** (skin tone, undertone, skin type, style) used by the recommendation engine.

Key structural truths confirmed in code:

- **All quiz/recommendation metadata is attached to `ProductReference`, never to `Product`.** The engine scores references, not products (`recommendation-engine.service.ts`). `Product` itself has no attribute relation.
- **All stock lives at reference level** (`stockQuantity`, `reservedQuantity`, `lowStockThreshold`). There is no product-level stock.
- **Stock is never decremented when an order is placed.** Both order paths validate availability but never write stock back. This is the single most important risk and is also acknowledged in `frontend-handoff/KNOWN_LIMITATIONS.md`.
- **Order snapshots are partial.** `OrderItem` snapshots product name, reference name, and unit price, but **not** image, SKU, or brand — past-order display will degrade if a product/reference is later edited or archived.
- **Products are never hard-deleted.** Only soft archive exists; relational `onDelete: Restrict` from orders/packs/recommendations structurally blocks hard deletion anyway.

The foundation is solid and normalized, but the `Product` row is missing many MVP e-commerce fields (SEO, short/long description split, tags, product type, merchandising flags, display order, promo/compare price) and the schema does not yet decide several beauty-catalog questions (product-vs-reference suitability, finish/coverage/shade-family, fallback-shade behavior).

---

## 2. Scope and Files Inspected

**Database / Prisma**
- `prisma/schema.prisma` — all models (full read)
- `prisma/migrations/20260611194954_init/migration.sql` — baseline DDL
- `prisma/migrations/20260613183847_add_media_assets/`, `20260613185217_add_media_management/`, `20260619202732_order_selected_pack_optional/`
- `prisma/seed.ts` (referenced)

**Backend modules**
- `src/modules/products/` — `products.controller.ts`, `admin-products.controller.ts`, `products.service.ts`, `products.module.ts`, DTOs (`create-product.dto.ts`, `update-product.dto.ts`, `query-products.dto.ts`, `query-public-products.dto.ts`)
- `src/modules/product-references/` — `product-references.service.ts`, `create-product-reference.dto.ts`
- `src/modules/packs/` — `packs.service.ts`
- `src/modules/orders/` — `orders.service.ts`, `order-workflow.service.ts`
- `src/modules/recommendations/` — `recommendation-engine.service.ts`
- `src/modules/media/controllers/product-media.controller.ts`
- `src/main.ts` (global `ValidationPipe`, CORS)

**Documentation / handoff**
- `frontend-handoff/KNOWN_LIMITATIONS.md`, `frontend-handoff/STORE_CATALOG_HANDOFF.md` (referenced)
- `docs/` index, `docs/backend-store-adaptation/*`

---

## 3. Current Database Model

### 3.1 Product Model Fields

**Evidence — Confirmed by code:** `prisma/schema.prisma` — `model Product` (table `products`).

| Field | Type | Null? | Default | DB mapping / notes |
|---|---|---|---|---|
| `id` | `String` UUID | no | `uuid()` | `@db.Uuid` PK |
| `categoryId` | `String` UUID | **no** | — | `category_id`, FK → `categories` |
| `brandId` | `String` UUID | yes | — | `brand_id`, FK → `brands` |
| `name` | `String` | no | — | `@db.VarChar(180)` |
| `slug` | `String` | no | — | `@db.VarChar(200)`, **`@unique`** |
| `description` | `String` | yes | — | `Text` (single field; no short/long split) |
| `basePrice` | `Decimal` | no | — | `base_price` `@db.Decimal(10,2)` |
| `costPrice` | `Decimal` | yes | — | `cost_price` `@db.Decimal(10,2)` (admin-only) |
| `currency` | `String` | no | `"MAD"` | `@db.Char(3)` |
| `mainImageUrl` | `String` | yes | — | `main_image_url` (legacy plain URL; parallel to `ProductImage` join) |
| `status` | `ProductStatus` | no | `DRAFT` | enum `DRAFT/ACTIVE/ARCHIVED` |
| `isActive` | `Boolean` | no | `true` | `is_active` |
| `createdAt` | `DateTime` | no | `now()` | `created_at` |
| `updatedAt` | `DateTime` | no | `@updatedAt` | `updated_at` |

**Observations (Confirmed by code):**
- **Dual lifecycle flags.** `status` *and* `isActive` both exist; public reads require **both** `status = ACTIVE` **and** `isActive = true` (`products.service.ts` `publicProductWhere`, `findOne`, `findBySlug`). The two can drift independently and their combined semantics are not enforced at the DB level.
- **Two image mechanisms coexist:** scalar `mainImageUrl` and the `ProductImage` → `MediaAsset` relation. `mainImageUrl` is write-accepted by the DTO but is **not** the source of the cover in responses (cover comes from `images` where `role = COVER`). It is effectively redundant/legacy.
- **No product-level:** SKU, barcode, tags, product type, SEO meta title/description, short description, weight/dimensions, compare-at/promotional price, tax, featured/bestseller/new flags, display/sort order, suitability attributes.

### 3.2 Related Prisma Models

**Evidence — Confirmed by code:** `prisma/schema.prisma`.

- **`Category`** (`categories`): self-referential hierarchy via `parentId` (`CategoryHierarchy`, `onDelete: SetNull`) → supports subcategories. Identified by `code` (`@unique`), **not** a slug. Has optional `CategoryImage` (1:1).
- **`Brand`** (`brands`): `name` `@unique`, `logoUrl` plain URL (no media-join endpoint per `KNOWN_LIMITATIONS.md`). `products Product[]`.
- **`ProductReference`** (`product_references`): the variant/shade row. Fields: `referenceCode`, `referenceName`, `barcode?` `@unique`, `sku?` `@unique`, `priceOverride?`, `priceDelta` (default 0), `imageUrl?` (legacy), `stockQuantity` (default 0), `reservedQuantity` (default 0), `lowStockThreshold` (default 5), `isDefault`, `isActive`. `@@unique([productId, referenceCode])`. `onDelete: Cascade` from `Product`.
- **`ProductReferenceAttribute`** (`product_reference_attributes`): links a reference to an `AttributeGroup` + `AttributeOption` with `matchType` (`COMPATIBLE/NOT_COMPATIBLE/BOOST`), `scoreValue`, `isHardFilter`. `@@unique([productReferenceId, attributeGroupId, attributeOptionId])`. **This is where beauty suitability lives.**
- **`ProductImage`** (`product_images`): join Product↔MediaAsset, `role` (`MediaRole`), `position`, `altText`. `@@unique([productId, mediaId])`. Both FKs `onDelete: Cascade`.
- **`ProductReferenceImage`** (`product_reference_images`): **1:1** Reference↔MediaAsset (`productReferenceId @unique`, `mediaId @unique`), `role` default `SWATCH`.
- **`PackItem`** (`pack_items`): `productId` (required) + `productReferenceId?` (optional), `quantity`, `selectionMode`, `isRequired`, `sortOrder`.
- **`OrderItem`** (`order_items`): `productId` (required), `productReferenceId` (required), plus snapshot columns (§6).
- **`RecommendationResultItem`**: `productId` + `selectedProductReferenceId` (both required, `onDelete: Restrict`).
- **`MediaAsset`** (`media_assets`): Cloudinary-backed; has both explicit join tables and a generic `relatedEntity` / `relatedEntityId` pair, plus soft-delete (`isDeleted`, `deletedAt`).

### 3.3 Relations and Cardinality

| From | To | Cardinality | Required? | onDelete |
|---|---|---|---|---|
| Product → Category | `category` | many-to-one | **required** | `Restrict` |
| Product → Brand | `brand` | many-to-one | optional | `SetNull` |
| Product → ProductReference | `references` | one-to-many | — | child `Cascade` on Product delete |
| Product → ProductImage | `images` | one-to-many | — | `Cascade` |
| Product → PackItem | `packItems` | one-to-many | — | PackItem→Product `Restrict` |
| Product → OrderItem | `orderItems` | one-to-many | — | OrderItem→Product `Restrict` |
| Product → RecommendationResultItem | `recommendationResultItems` | one-to-many | — | RRI→Product `Restrict` |
| ProductReference → ProductReferenceAttribute | `attributes` | one-to-many | — | `Cascade` |
| ProductReference → ProductReferenceImage | `image` | **one-to-one** | optional | `Cascade` |
| ProductReference → PackItem | `packItems` | one-to-many | — | PackItem→Reference `SetNull` |
| ProductReference → OrderItem | `orderItems` | one-to-many | — | OrderItem→Reference `Restrict` |

**Net effect (Confirmed by code):** A Product cannot be hard-deleted while referenced by any order, pack item, or recommendation result (`Restrict`). Deleting a Product *would* cascade-delete its references, images, and reference-attributes — but that path is unreachable while orders/packs hold it. No delete endpoint exists regardless (§4.3).

### 3.4 Constraints, Indexes, and Deletion Behavior

**Unique constraints (Confirmed by code):**
- `Product.slug` unique.
- `ProductReference.sku` unique (global), `ProductReference.barcode` unique (global), `@@unique([productId, referenceCode])`.
- `ProductReferenceImage`: `productReferenceId` and `mediaId` each unique (enforces 1:1).
- No product-level SKU/barcode constraint (none exist).

**Indexes on Product:** `categoryId`, `brandId`, `status`, `isActive` (plus implicit unique index on `slug`).
**Indexes on ProductReference:** `productId`, `isActive`, `stockQuantity`.

**Deletion behavior:** soft only. `adminArchive` sets `status = ARCHIVED`, `isActive = false`, and deactivates all references in a transaction (`products.service.ts` `adminArchive`). There is **no hard delete**.

**Gap (Confirmed by code):** Catalog search filters on `name`, `slug`, `description`, `category.name/code`, `brand.name` via Prisma `contains` (`mode: 'insensitive'`) — there is **no full-text / trigram index** backing these, so search is a sequential `ILIKE` scan.

### 3.5 Migration History Findings

**Evidence — Confirmed by code:** `prisma/migrations/`.

1. `20260611194954_init` — full baseline including `products`, `product_references`, `product_reference_attributes`, packs, orders, recommendations. The Product shape has not changed since baseline.
2. `20260613183847_add_media_assets` — introduced `media_assets`.
3. `20260613185217_add_media_management` — introduced join tables (`product_images`, `pack_images`, `category_images`, `product_reference_images`) layering structured media over the older scalar `mainImageUrl` / `imageUrl` fields, which were **kept** rather than removed → explains the present duplication.
4. `20260619202732_order_selected_pack_optional` — made `Order.selectedPackId` nullable, enabling cart/direct checkout that is not tied to a pack/recommendation.

**Conclusion:** The Prisma model accurately reflects the migrated DB; the only "history smell" is the retained legacy URL fields after media-management was added.

---

## 4. Current Backend Implementation

### 4.1 Product Module Structure

**Evidence — Confirmed by code:** `products.module.ts` imports `PrismaModule`, `MediaModule`; declares `ProductsController` (public) + `AdminProductsController`; provides `ProductsService`. There is **no repository layer** — `ProductsService` talks to `PrismaService` directly with reusable `select` builders (`productSelect`, `adminListSelect`, `adminDetailSelect`).

### 4.2 DTOs and Validation

**Evidence — Confirmed by code:** `create-product.dto.ts`, `update-product.dto.ts`, `query-products.dto.ts`, `query-public-products.dto.ts`. Global `ValidationPipe` with `whitelist + forbidNonWhitelisted + transform` (`main.ts`).

- **Create:** `categoryId` (UUID, required), `brandId?` (UUID), `name` (trimmed, non-empty), `slug` (lowercased, regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`), `description?`, `basePrice` (≥0), `costPrice?` (≥0), `currency` (uppercased, `^[A-Z]{3}$`), `mainImageUrl?` (`IsUrl`), `status?`, `isActive?`.
- **Update:** `PartialType(CreateProductDto)` — every field optional.
- **Admin query:** `search`, `categoryId`, `brandId`, `status`, `isActive`, `sortBy ∈ {createdAt,name,basePrice}`, `sortOrder`, pagination.
- **Public query:** `search`, `categoryId`, `categoryCode`, `brandId`, `sortBy`, `sortOrder`, `inStock`, `page`, `size`.

**Validation gaps (Confirmed by code):**
- No validation that `costPrice ≤ basePrice`.
- No validation that `currency` is a member of a supported set (any 3 uppercase letters pass).
- Slug uniqueness is enforced in the **service** (`ensureUniqueSlug`), not by the DTO — correct, but it is a read-then-write check (race-prone, see §8).

### 4.3 Controllers and API Endpoints

**Public (`@Controller('products')`, no guard) — Confirmed by code (`products.controller.ts`):**
| Method | Path | Purpose |
|---|---|---|
| GET | `/products` | List ACTIVE+isActive products; search/filter/sort/`inStock`/pagination. Returns bare array when no pagination params, paginated envelope otherwise. |
| GET | `/products/slug/:slug` | Active product by slug. |
| GET | `/products/:id` | Active product by id. |

**Admin (`@Controller('admin/products')`, `JwtAuthGuard + RolesGuard`) — Confirmed by code (`admin-products.controller.ts`):**
| Method | Path | Roles | Purpose |
|---|---|---|---|
| GET | `/admin/products` | OWNER, ADMIN, STAFF | Paginated list with stock/reference summaries. |
| GET | `/admin/products/:id` | OWNER, ADMIN, STAFF | Full detail incl. cost price, SKU, pack-usage count. |
| POST | `/admin/products` | OWNER, ADMIN | Create. |
| PATCH | `/admin/products/:id` | OWNER, ADMIN | Update mutable fields. |
| DELETE | `/admin/products/:id` | OWNER, ADMIN | **Archive** (soft), not delete. |

Product media lives on a separate controller: `@Controller('admin/products/:productId/images')` (`product-media.controller.ts`) — upload/reorder/update/delete, OWNER+ADMIN only.

**Notable absences (Confirmed by code):** no hard-delete; no bulk operations; no product-level stock or attribute endpoints (attributes are managed under the references module).

### 4.4 Services and Business Logic

**Evidence — Confirmed by code:** `products.service.ts`.

- **Public read** (`findAll/findOne/findBySlug`) projects a **storefront-safe** `productSelect`: omits `costPrice`, reference `sku`/`barcode`/`reservedQuantity`/`lowStockThreshold`; includes only active references; surfaces reference `attributes` (compatibility metadata) and `stockQuantity`.
- **Admin read** projects `costPrice`, `sku`, `barcode`, reserved/threshold stock, computed `totalStock`, `availableStock` (= `stock − reserved`), `referenceCount`, `activeReferenceCount`, `packUsageCount`.
- **Create/update** validate slug uniqueness and category/brand existence + **active-compatibility** rule: an active product cannot be attached to an inactive category/brand (`validateCategoryForProduct`, `validateBrandForProduct`).
- **Archive** cascades deactivation to references inside a `$transaction`.
- **Pricing convention** (cross-module, Confirmed in `orders.service.ts` `effectiveProductReferencePrice`): effective unit price = `reference.priceOverride` if set, else `product.basePrice + reference.priceDelta`.

### 4.5 Swagger / OpenAPI Contract

**Evidence — Confirmed by code:** controllers decorated with `@ApiTags`, `@ApiOperation`, `@ApiOkResponse({ type: ProductResponse })`, `@ApiBearerAuth('bearer')`. A shared `ProductResponse` model (`src/common/swagger/api-response.models.ts`) types responses. `docs/openapi.json` / `docs/openapi.yaml` are generated artifacts.

**Contract mismatch (Confirmed by code):** the admin POST/PATCH use `@ApiOkResponse` but the create response is a freshly built detail object, and several admin list responses use a **generic** paginated shape rather than a per-resource OpenAPI class — already flagged in `KNOWN_LIMITATIONS.md` ("API Shape Notes"). The single `ProductResponse` Swagger type does not fully capture the divergence between public vs admin projections.

### 4.6 Authentication and Authorization

**Evidence — Confirmed by code:** `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` on all `admin/products*` routes; public `products` routes are unguarded. Read = OWNER/ADMIN/STAFF; write/archive = OWNER/ADMIN only. CORS restricted to `ADMIN_DASHBOARD_ORIGIN` / `STORE_FRONTEND_ORIGIN` (`main.ts`).

**Confirmed safe:** storefront projection hides `costPrice` and reference SKU/barcode/reserved/threshold. **Minor exposure to validate:** public responses include reference `stockQuantity` (exact on-hand count) and full compatibility `attributes` — acceptable for now but a business decision (§10).

---

## 5. Product Dependency Map

| Area | Real current relation (Confirmed by code) | Intended/implied (docs) | Gap / contradiction |
|---|---|---|---|
| **Categories** | `Product.categoryId` **required**, `onDelete: Restrict`. Category hierarchy via `parentId`. | Catalog browse by category/subcategory. | Category identified by `code`, not slug; public query exposes `categoryCode` filter but there is no category-slug parity with products/packs. |
| **Brands** | `Product.brandId` **optional**, `onDelete: SetNull`. | Brand ownership + brand filter. | Brand logo is a plain `logoUrl`, no media-join endpoint (`KNOWN_LIMITATIONS.md`). |
| **Product References** | Variants/shades hold SKU, barcode, stock, price delta/override, swatch, **and all compatibility attributes**. `@@unique([productId, referenceCode])`. | Makeup shades by skin tone. | Reference has **no `currency`** (inherits product); no explicit shade hex/family field — shade identity is just `referenceName`. |
| **Stock** | **Reference-level only** (`stockQuantity`, `reservedQuantity`, `lowStockThreshold`). No product-level stock. | Stock per product reference. | **Stock never decremented on order** (§8 Critical). `reservedQuantity` exists but is never written by order flow. |
| **Media** | Product→`ProductImage` (many, COVER/GALLERY, `position`); Reference→`ProductReferenceImage` (1:1, SWATCH). Legacy `mainImageUrl`/`imageUrl` retained. | Cover/gallery/swatch with ordering + cleanup. | Two parallel image systems (scalar URL vs join). Reference image is strictly 1:1 — no multi-image/shade gallery. |
| **Packs** | `PackItem.productId` required + `productReferenceId?` optional, `selectionMode`, `quantity`, `isRequired`, `sortOrder`. | Packs contain products or specific references. | A pack item always points at a **Product**; a specific reference is optional and only used when `selectionMode = FIXED_REFERENCE`. Same product cannot appear twice in a pack (service rule). |
| **Recommendations** | Engine scores **references** by `ProductReferenceAttribute`; also pack-level `PackAttribute`. `Product` has no attributes. | Quiz-driven scoring/filtering. | All scoring inputs are reference/pack-level; **no product-level suitability or priority** field exists (only `Pack.priority`). |
| **Orders** | `OrderItem.productId` + `productReferenceId` (both required, `Restrict`) + name/refName/unitPrice snapshots. | Snapshot of selection at order time. | Snapshot **omits image, SKU, brand**; relies on live Product/Reference for those (§8 High). |
| **Attributes / Quiz** | `AttributeGroup`/`AttributeOption` shared by quiz answers and reference/pack attributes. | Suitability + matching criteria. | Suitability is reference-only; products that should be "universally suitable" must encode it on every reference. |
| **Admin Dashboard** | Full CRUD-minus-delete; stock & usage summaries; media management. | Manage catalog. | No merchandising fields (featured/sort/tags) to drive curated storefront. |
| **Storefront** | Public list/detail/slug, search, filters, `inStock`, pagination. | Mobile-first catalog. | Missing fields for rich PDP (short desc, SEO, badges, promo price). `KNOWN_LIMITATIONS.md` still lists several of these as "not implemented" though recent commits (Tasks 6–8) added public search/brands/slug — **doc is partly stale**. |

---

## 6. Current Product Lifecycle

**Confirmed by code unless marked.**

1. **Product creation** — `POST /admin/products` (OWNER/ADMIN). Validates unique slug, category exists & active-compatible, brand exists & active-compatible. Row created `status = DRAFT` (default) with no references, no images, no attributes.
2. **Reference creation** — `POST` under the references module (`product-references.service.ts` `create`). Validates the product can receive an active reference (not archived/inactive), unique `referenceCode`/`sku`/`barcode`, stock invariants (`reserved ≤ stock`, all ≥ 0), resolves compatibility attributes, and (if `isDefault`) demotes other defaults in a transaction. **Beauty suitability is attached here.**
3. **Stock / media association** — stock set on the reference (`updateStock`); product images via `admin/products/:productId/images` (cover auto-demotes prior cover); reference swatch via the reference-media controller. Cleanup: deleting a `ProductImage` removes the Cloudinary asset only when no other relationship references it (`product-media.controller.ts` delete description).
4. **Pack / recommendation usage** — `PackItem` points at the product (+ optional fixed reference). The engine, given quiz answers, filters hard-incompatible references, picks the best available reference per pack item (`AUTO_BEST_REFERENCE`) or honors a fixed one, and scores the pack. `isReferenceAvailable` = `isActive && stockQuantity > reservedQuantity`.
5. **Order usage** — two paths in `orders.service.ts`: (a) `create` from a `recommendationResultId` (pack funnel); (b) `createFromCart` for arbitrary product/reference selections. Both **snapshot** `productNameSnapshot`, `referenceNameSnapshot`, `unitPriceSnapshot`, `quantity`, `totalPrice` into `OrderItem`, validate active status + stock availability, then create the order in a `$transaction`. **Neither path decrements stock or writes `reservedQuantity`** (Confirmed by code; corroborated by `KNOWN_LIMITATIONS.md`).
6. **Archive** — `DELETE /admin/products/:id` soft-archives the product and deactivates references. Existing orders keep working via FKs (`Restrict`) and snapshots.

---

## 7. Capability Assessment

| Capability | Current Status | Existing Implementation | Gap / Risk | Notes |
|---|---|---|---|---|
| Product name | Supported | `Product.name` VarChar(180) | — | |
| Slug / SEO id | Partially supported | `Product.slug` unique + regex | No SEO meta title/description | Slug ≠ SEO metadata |
| Short description | Missing | — | Only one `description` field | No short/long split |
| Full description | Partially supported | `Product.description` Text | Plain text only, no rich content | |
| Brand | Supported | `brandId` optional, `SetNull` | — | |
| Category + subcategory | Supported | `categoryId` required + `Category.parentId` hierarchy | Category has `code`, not slug | |
| Product type | Missing | — | No `productType` field | Type only implied by category |
| Tags / labels | Missing | — | No tag model/field | |
| Active/draft/archived/hidden | Partially supported | `status` (DRAFT/ACTIVE/ARCHIVED) + `isActive` | Two overlapping flags; no distinct "hidden" | Ambiguous combined semantics |
| Featured / bestseller / new | Missing | — | No merchandising flags | |
| Display ordering | Missing | — | No `sortOrder` on Product (exists on Category/PackItem/images) | |
| Created/updated timestamps | Supported | `createdAt`, `updatedAt` | — | |
| Base selling price | Supported | `basePrice` Decimal(10,2) | — | |
| Promo / compare-at price | Missing | — | No `compareAtPrice`/sale price on product | Pack-level discounts exist, not product-level |
| Currency | Partially supported | `currency` Char(3) default MAD (Product/Pack/Order) | No allowed-set validation; reference has no currency | |
| Cost price | Supported | `costPrice` (admin-only projection) | No `cost ≤ base` check | |
| Tax info | Missing | — | No tax fields | |
| Cash-on-delivery | Supported | `PaymentMethod.CASH_ON_DELIVERY` only | Single method by design | |
| SKU / barcode | Partially supported | On `ProductReference` (unique) | None at product level | Correct for variants; product-level absent |
| Weight / dimensions | Missing | — | No shipping dims | Needed if delivery requires it |
| Product vs reference price | Supported | `basePrice + priceDelta` or `priceOverride` | — | Resolution centralized in orders service |
| Product vs reference stock | Supported (reference) | Reference-level only | No product-level stock | Intentional |
| Suitable skin tones/undertones/types/styles | Partially supported | `ProductReferenceAttribute` (reference-level) | No product-level suitability | Engine reads references only |
| Finish/coverage/texture/shade family/concern | Unclear | Could be modeled as more `AttributeGroup`s | Not explicitly present in seed/enum | Needs business decision |
| Shade/color variants | Supported | `ProductReference` rows | No hex/swatch-color field | Shade = `referenceName` text |
| Reference swatches / images | Partially supported | `ProductReferenceImage` 1:1 SWATCH | Only one image per reference | No shade gallery |
| Recommendation metadata owner | Supported (reference) | reference + pack attributes | Product-level scoring absent | Confirmed in engine |
| Product priority / scoring inputs | Partially supported | `Pack.priority`, attribute `scoreValue` | No `Product.priority` | |
| Product cover image | Supported | `ProductImage role=COVER` | Parallel legacy `mainImageUrl` | |
| Product gallery | Supported | `ProductImage role=GALLERY` + `position` | — | |
| Product videos | Missing | `MediaAssetType` = IMAGE only | No video type | |
| Reference/shade images, swatches | Partially supported | 1:1 swatch | Single image only | |
| Alt text & media ordering | Supported | `altText`, `position` | Reference image has no `position` (1:1) | |
| Media ownership/cleanup | Supported | delete removes asset if unreferenced | — | |
| Pack selects product or reference | Supported | `PackItem` + `selectionMode` | — | |
| Pack quantity | Supported | `PackItem.quantity` | — | |
| Pack price/discount | Supported | `priceMode` FIXED/SUM_ITEMS/SUM_ITEMS_WITH_DISCOUNT | — | |
| Recommendation eligibility / exclusion | Supported | `matchType`, `isHardFilter` | — | |
| Out-of-stock behavior (engine) | Supported | `isReferenceAvailable` skips no-stock refs | Engine ≠ checkout stock write | |
| Fallback shade when match unavailable | Partially supported | `AUTO_BEST_REFERENCE` picks best available | No explicit fallback policy when none match | Required items fail the pack |
| Order snapshot (name/price/ref) | Partially supported | name/refName/unitPrice snapshots | **No image/SKU/brand snapshot** | §8 High |
| Editing product corrupts history | Risk present | Snapshots cover name/price only | Image/SKU read live → can drift | §8 High |
| Display deleted/hidden products in past orders | Supported | `onDelete: Restrict` + snapshots | Archived products still resolvable | |
| Stock decrement on order | Missing | — | **Overselling possible** | §8 Critical |

---

## 8. Data Integrity and Technical Risks

| Severity | Finding | Affected Areas | Evidence | Why It Matters |
|---|---|---|---|---|
| **Critical** | Order placement never decrements `stockQuantity` nor writes `reservedQuantity`. Both order paths only *read* stock to validate. | Stock, Orders, Recommendations | `orders.service.ts` `create`, `createFromCart`, `calculateCartOrderPrice` (no stock write); `KNOWN_LIMITATIONS.md` "Stock reservation and automatic stock deduction" | Concurrent or repeat orders can oversell; on-hand counts shown to storefront are never reduced. |
| **High** | `OrderItem` snapshot omits image, SKU, and brand. | Orders, Storefront/admin order display | `prisma/schema.prisma` `OrderItem` (only name/refName/unitPrice); `orders.service.ts` `toAdminDetailResponse` | Editing/archiving a product later changes how historical orders render; receipts can't show the SKU/image as sold. |
| **High** | Stock validation → order create is read-then-write without row locking or atomic conditional decrement. | Stock, Orders | `orders.service.ts` (`findUnique` stock check, then `order.create` in tx, no `updateMany` guard on stock) | Even once decrement is added, the current pattern is race-prone (TOCTOU). |
| **Medium** | Slug/SKU/barcode uniqueness enforced by service-level read-then-write, not just DB. | Products, References | `products.service.ts` `ensureUniqueSlug`; `product-references.service.ts` `ensureUniqueSku/Barcode` | DB unique index is the real backstop (good), but concurrent creates surface as raw `P2002` instead of the friendly `ConflictException`. |
| **Medium** | Catalog search uses `contains`/`ILIKE` over name/slug/description/category/brand with no full-text or trigram index. | Storefront search, performance | `products.service.ts` `publicProductWhere`; indexes in `schema.prisma` | Sequential scans degrade as the catalog grows. |
| **Medium** | Dual lifecycle flags (`status` + `isActive`) with no DB-level coupling. | Catalog visibility | `Product` model; public reads require both true | Drift (e.g. `ACTIVE` + `isActive=false`) silently hides a product; ambiguous source of truth. |
| **Medium** | Two parallel image systems: scalar `mainImageUrl`/`imageUrl` vs `ProductImage`/`ProductReferenceImage` joins. | Media | `schema.prisma`; `products.service.ts` (cover comes from join, not scalar) | Stale/duplicate image data; unclear which is authoritative. |
| **Low** | Cart pricing loops per item issuing separate `findUnique` for product then reference (≈2N queries for N items). | Orders performance | `orders.service.ts` `calculateCartOrderPrice` (sequential awaits) | Fine at small cart sizes; not batched. |
| **Low** | Public responses expose exact reference `stockQuantity` and full compatibility attributes. | Storefront exposure | `products.service.ts` `productSelect` | Reveals inventory levels and internal scoring metadata; may be a business preference. |
| **Low** | No `costPrice ≤ basePrice` or currency-allowed-set validation. | Pricing integrity | `create-product.dto.ts` | Permits inconsistent/typo'd financial data. |
| **Low** | `ProductReference` has no `currency`; cart enforces single currency across items at runtime only. | Pricing | `schema.prisma`; `orders.service.ts` `calculateCartOrderPrice` | Multi-currency catalog not modeled; relies on product currency. |

---

## 9. Product Model Gaps to Resolve Later

> Decisions/capabilities to address in a later (separate) task. No schema proposed here.

### 9.1 Must Have for MVP Store
- Short description vs full description separation; rich/long-form content decision.
- SEO metadata (meta title/description) distinct from slug.
- Merchandising flags (featured / bestseller / new arrival) and a product-level `sortOrder`.
- Tags / labels for filtering and badges.
- Product type field (vs relying solely on category).
- Promotional / compare-at price at product level (today only packs discount).
- Currency allowed-set validation and `cost ≤ base` guard.
- Resolve the `status` vs `isActive` duality into one clear visibility contract.
- Decide the fate of legacy `mainImageUrl` / `imageUrl` (keep as authoritative, or retire in favor of join tables).

### 9.2 Must Have for Product References / Shades
- Explicit shade identity: shade hex/color and shade family (currently only free-text `referenceName`).
- Whether a reference needs its own `currency` or multi-image shade gallery (today 1:1 swatch).
- Whether reference-level promo price is needed alongside `priceOverride`/`priceDelta`.

### 9.3 Must Have for Recommendation Engine
- Decide whether suitability (skin tone/undertone/type/style/finish/coverage/concern) belongs on `Product`, `ProductReference`, or both — today it is reference-only.
- Product-level priority / boost input (only `Pack.priority` exists).
- Explicit fallback policy when no reference matches a profile (required items currently disqualify the whole pack).
- Whether finish/coverage/texture/shade-family/concern become new `AttributeGroup`s.

### 9.4 Must Have for Packs
- Confirm pack-item granularity (product vs forced reference) is sufficient for beauty bundles.
- Pack-item-level pricing/discount overrides if bundles need per-item promo behavior.
- Out-of-stock / fallback behavior for `AUTO_BEST_REFERENCE` and `CUSTOMER_CHOICE` at checkout time.

### 9.5 Important for Future Scale
- Atomic stock reservation/decrement with row locking or conditional `updateMany` at checkout.
- Full-text / trigram (or external) search indexing for catalog.
- Richer `OrderItem` snapshot (image, SKU, brand, possibly pack context) for durable order history.
- Product video media type (current `MediaAssetType` is IMAGE only).
- Weight/dimensions/tax fields if delivery/fiscal requirements appear.

---

## 10. Questions Requiring Business Decisions

1. **Suitability ownership:** Should beauty suitability live on `Product` (e.g. "this serum suits all tones") or stay strictly per-reference? This drives whether the recommendation engine should also score products.
2. **Stock semantics:** On order placement, should the system decrement `stockQuantity`, increment `reservedQuantity`, or both — and at which lifecycle step (order create vs confirm)?
3. **Inventory exposure:** Should the storefront see exact stock counts, or only a boolean/"low stock" badge?
4. **Visibility model:** Collapse `status` + `isActive` into one field, or keep both with a documented contract (and an explicit "hidden but not archived" state)?
5. **Order snapshot depth:** Which fields must be frozen at order time (image, SKU, brand, pack name) for receipts/disputes?
6. **Fallback shade policy:** When no shade matches a customer profile, should the pack be dropped, substituted with a default reference, or shown with a "no match" flag?
7. **Pricing model:** Is product-level promotional/compare-at pricing required for MVP, or are pack discounts sufficient?
8. **Currency scope:** Single-currency (MAD) catalog confirmed, or must references/products support multiple currencies?
9. **Shade representation:** Do shades need structured color (hex/family) for swatch UI, or is `referenceName` enough?

---

## 11. Recommended Next Analysis Task

**Recommended next task (documentation-only):**
**"Target Product & ProductReference Model Design — Gap-to-Schema Mapping for MVP Beauty Catalog."**

It should take each gap and open question from §9–§10 of this document and, **without yet writing migrations**, produce: (a) the proposed target field set for `Product` vs `ProductReference` (settling the suitability-ownership and visibility-flag decisions), (b) the required `OrderItem` snapshot extension, and (c) the stock-reservation/decrement strategy — each tied back to the affected modules here. That design doc becomes the basis for the first implementation task.

A logical companion before implementation is a focused **"Checkout Stock Integrity & Order Snapshot Design"** note, since the Critical/High risks in §8 (no stock decrement, thin snapshot, TOCTOU) cut across orders, references, and the recommendation engine and should be resolved together.
```
