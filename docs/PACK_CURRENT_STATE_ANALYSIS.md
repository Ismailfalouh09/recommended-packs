# Pack — Current State Analysis

> **Scope:** Documentation and analysis only. No source code, schema, migrations, APIs, tests, or seed data were changed.
> **Source of truth:** the backend source in `src/`, `prisma/schema.prisma`, and the controllers/services/DTOs cited inline. Where existing docs disagree with the code, the code wins (several store-readiness docs are now stale — noted where relevant).
> **Focus:** the Pack object only. Product catalog internals are referenced only where they affect Packs.

---

## A. Executive summary

### What the Pack object currently represents

Today a Pack is an **admin-curated, fixed bundle of catalog products** with a sellable price and a set of compatibility attributes used by the quiz recommendation engine. It is defined by:

- A `Pack` row ([prisma/schema.prisma:450](../prisma/schema.prisma#L450)) holding marketing fields (name, slug, description, image), a pricing definition (`priceMode`, `fixedPrice`, `discountAmount`/`discountPercentage`, `minBudget`/`maxBudget`), a `priority`, and a `status` (`DRAFT` / `ACTIVE` / `ARCHIVED`).
- A list of `PackItem` rows ([prisma/schema.prisma:483](../prisma/schema.prisma#L483)), each pointing to one `Product`, optionally to one fixed `ProductReference`, with a `quantity`, a `selectionMode`, and an `isRequired` flag.
- A list of `PackAttribute` rows ([prisma/schema.prisma:508](../prisma/schema.prisma#L508)) describing compatibility (e.g. skin tone, style) for the recommendation engine.
- A list of `PackImage` rows for the gallery.

### What it can do today

- Be created, updated, listed, fetched, and archived by admins ([admin-packs.controller.ts](../src/modules/packs/admin-packs.controller.ts)).
- Be displayed publicly as read-only catalog content via `GET /packs`, `GET /packs/:id`, `GET /packs/slug/:slug` ([packs.controller.ts](../src/modules/packs/packs.controller.ts)).
- Carry a price in one of three modes: a flat `FIXED` price, the `SUM_ITEMS` of its items, or `SUM_ITEMS_WITH_DISCOUNT` ([schema PriceMode enum:48](../prisma/schema.prisma#L48)).
- Be matched and ranked against a quiz `CustomerProfile` by the recommendation engine, which also auto-selects a concrete reference per item ([recommendation-engine.service.ts](../src/modules/recommendations/recommendation-engine.service.ts)).
- Be turned into an order **only** through the recommendation funnel: `POST /orders` consumes a `recommendationResultId`, never a Pack id directly ([orders.service.ts:74](../src/modules/orders/orders.service.ts#L74)).

### What it cannot do today

- **It cannot be customized by the customer.** There is no concept of a customer-selected shade, removable optional item, added add-on, quantity change, or replacement. The `CUSTOMER_CHOICE` selection mode exists in the enum but is **explicitly rejected** at admin write time ([packs.service.ts:966-970](../src/modules/packs/packs.service.ts#L966-L970)) and **returns null** (i.e. silently disables item selection) in the engine ([recommendation-engine.service.ts:309-311](../src/modules/recommendations/recommendation-engine.service.ts#L309-L311)).
- **It cannot be added to a cart as a Pack.** The only cart-based checkout (`POST /orders/checkout`) accepts a flat list of `{productId, referenceId, quantity}` lines with **no pack linkage** ([orders.service.ts:187](../src/modules/orders/orders.service.ts#L187), [create-cart-order.dto.ts](../src/modules/orders/dto/create-cart-order.dto.ts)). A "fixed Pack" cannot be purchased as a unit through the normal store.
- **It has no public discovery surface.** `GET /packs` returns *all* active packs ordered by priority, with **no query params** for category, price, tier, style, occasion, availability, search, or pagination ([packs.controller.ts:24](../src/modules/packs/packs.controller.ts#L24), [packs.service.ts:209](../src/modules/packs/packs.service.ts#L209)).
- **It has no category, tier, occasion, experience-level, "featured/new/best-seller", or tag fields.** Those discovery dimensions exist only indirectly as `PackAttribute` compatibility rows, and none are exposed for filtering.
- **It has no minimum-allowed-price / margin-protection field.** `minBudget`/`maxBudget` exist but are only a recommendation budget hint (and are not even consumed by the current engine — see section F).
- **It has no wishlist, sharing, related/similar, recently-viewed, or review support.** No models, no endpoints.
- **There is no persisted customer Pack configuration entity.** A "configured pack" exists transiently only as a `RecommendationResult` + `RecommendationResultItem` set, which is engine-chosen, not customer-chosen.

### Maturity verdict

The current Pack is **a static, admin-fixed bundle with a quiz-compatibility layer** — closer to a "curated template that the engine resolves into concrete references" than to a configurable commercial offer. It is **not** a configurable Pack, and it is **not** yet a standalone sellable storefront product. The data model has several useful foundations (item roles via `selectionMode`/`isRequired`, reference-level stock, order snapshots), but the customization, discovery, persistence, and direct-purchase layers required by the Pack Core conception do not exist.

---

## B. Existing Pack domain map

### Core entities and relationships (as in `prisma/schema.prisma`)

```text
Pack (packs)                                         schema.prisma:450
 ├─ items        → PackItem[]        (1..n)           schema.prisma:469
 ├─ attributes   → PackAttribute[]   (0..n)           schema.prisma:470
 ├─ images       → PackImage[]       (0..n)           schema.prisma:471
 ├─ recommendationResults → RecommendationResult[]    schema.prisma:472
 ├─ orders       → Order[]  "SelectedPackOrders"      schema.prisma:473  (Order.selectedPackId)
 └─ orderItems   → OrderItem[] "PackOrderItems"       schema.prisma:474  (OrderItem.packId)

PackItem (pack_items)                                 schema.prisma:483
 ├─ packId            → Pack
 ├─ productId         → Product            (Restrict) schema.prisma:496
 ├─ productReferenceId→ ProductReference?  (Restrict) schema.prisma:497  (only set when FIXED_REFERENCE)
 ├─ quantity          Int  default 1
 ├─ selectionMode     SelectionMode  default AUTO_BEST_REFERENCE
 ├─ isRequired        Boolean default true
 └─ sortOrder         Int

PackAttribute (pack_attributes)                       schema.prisma:508
 ├─ packId            → Pack
 ├─ attributeGroupId  → AttributeGroup
 ├─ attributeOptionId → AttributeOption
 ├─ matchType         COMPATIBLE | NOT_COMPATIBLE | BOOST
 ├─ scoreValue        Int
 └─ isHardFilter      Boolean

PackImage (pack_images)                               schema.prisma:856
 ├─ packId  → Pack
 ├─ mediaId → MediaAsset
 ├─ role    COVER | GALLERY | THUMBNAIL | SWATCH | ICON
 └─ position
```

### Adjacent entities the Pack depends on

```text
Product (products)                 schema.prisma:319  basePrice, compareAtPrice, costPrice, status, isActive, categoryId, brandId
ProductReference (product_references) schema.prisma:361  shade/size, priceOverride, priceDelta,
                                                          stockQuantity, reservedQuantity, isActive, isDefault
ProductReferenceAttribute          schema.prisma:400   reference-level compatibility (e.g. shade ↔ skin tone)
Category (categories)              schema.prisma:282   ← Product has a category; PACK HAS NONE
Brand (brands)                     schema.prisma:305
AttributeGroup / AttributeOption   schema.prisma:145 / 168  shared taxonomy (quiz + product + pack)
```

### Quiz / recommendation entities

```text
CustomerProfile (customer_profiles)        schema.prisma:237  sessionToken, sourceChannel
CustomerProfileAnswer                      schema.prisma:255  one answer = group + option
RecommendationSession                      schema.prisma:558
RecommendationResult                       schema.prisma:577  packId, rank, totalScore, matchPercentage, isSelected, reasonJson
RecommendationResultItem                   schema.prisma:602  packItemId, productId, selectedProductReferenceId, quantity, itemScore
RecommendationRule                         schema.prisma:536  admin-tunable scoring weights
```

### Order entities

```text
Order (orders)                  schema.prisma:669
 ├─ selectedPackId        Pack?   (NULLABLE — schema.prisma:675)   ← stale docs claim NOT NULL; it is optional
 ├─ recommendationResultId RecommendationResult?  (nullable)
 ├─ customerProfileId      CustomerProfile?       (nullable)
 └─ items → OrderItem[]
OrderItem (order_items)         schema.prisma:710
 ├─ packId            Pack?   (nullable, SetNull)
 ├─ productId / productReferenceId  (Restrict)
 └─ *Snapshot fields  (name, reference name, sku, variation, image, brand, unit price, original unit price)
```

### Notable structural observations

1. **A Pack is not connected to a `Category`.** Product is (`Product.categoryId`), but `Pack` has no category, subcategory, tier, occasion, experience-level, tag, or featured field. All "discovery" semantics live only in `PackAttribute` and are not query-exposed.
2. **`PackItem.productReferenceId` is single-purpose.** It is only populated for `FIXED_REFERENCE` items; for `AUTO_BEST_REFERENCE` it is null and the reference is chosen at recommendation time. There is no table of "allowed references", "allowed add-ons", or "allowed replacements".
3. **The only structural item-role signals are `selectionMode` (3 values) + `isRequired` (boolean).** There is no first-class "fixed / required-selectable / optional-included / optional-add-on" role taxonomy.
4. **No customer-configuration entity exists.** The closest persisted artifact is `RecommendationResult` (engine output), not a customer choice.

---

## C. Existing Pack lifecycle

| Stage | What happens today | Code responsible |
| --- | --- | --- |
| **Admin creates Pack** | `POST /admin/packs` (OWNER/ADMIN). Validates slug uniqueness, pricing, resolves items and attributes, enforces "active pack must have ≥1 item", rejects `CUSTOMER_CHOICE`. Items/attributes created via `createMany` in a transaction. | [admin-packs.controller.ts:74](../src/modules/packs/admin-packs.controller.ts#L74) → [packs.service.ts:312 `adminCreate`](../src/modules/packs/packs.service.ts#L312); validation at [`resolveItems`:917](../src/modules/packs/packs.service.ts#L917), [`validatePricing`:868](../src/modules/packs/packs.service.ts#L868) |
| **Admin updates / activates** | `PATCH /admin/packs/:id`. Items/attributes are **fully replaced** (deleteMany + recreate) when provided. Activation re-runs item/stock/pricing validation. Archived→active is blocked unless status is explicitly set. | [packs.service.ts:347 `adminUpdate`](../src/modules/packs/packs.service.ts#L347) |
| **Pack is published** | Pack becomes visible publicly when `status = ACTIVE` AND `isActive = true`. There is no separate "publish" action — it is the `status`/`isActive` combination. | [packs.service.ts:209 `findAll`](../src/modules/packs/packs.service.ts#L209) (`where: { isActive:true, status:'ACTIVE' }`) |
| **Customer sees Pack** | `GET /packs` (all active, priority-ordered), `GET /packs/:id`, `GET /packs/slug/:slug`. Detail view includes items, the fixed reference (if any), and — for `AUTO`/`CUSTOMER_CHOICE` items — the product's active references (so the UI *could* show options, but the API offers no way to choose them). | [packs.controller.ts](../src/modules/packs/packs.controller.ts) → [packs.service.ts:222/239](../src/modules/packs/packs.service.ts#L222) |
| **Recommendation uses Pack** | `POST /recommendations` loads all active packs (with items, references, attributes), scores each against the profile, auto-selects one reference per item, and persists a `RecommendationSession` + ranked `RecommendationResult`s + `RecommendationResultItem`s (the engine-chosen references). | [recommendations.service.ts:41 `create`](../src/modules/recommendations/recommendations.service.ts#L41) + [`loadActivePacks`:321](../src/modules/recommendations/recommendations.service.ts#L321) + [recommendation-engine.service.ts:124](../src/modules/recommendations/recommendation-engine.service.ts#L124) |
| **Customer adds Pack to cart** | **No pack-to-cart path exists.** The funnel order skips a cart entirely. The normal-store cart (`POST /orders/checkout`) carries only product+reference lines with no `packId`. | Gap — see section E |
| **Checkout** | Two disjoint paths: (1) funnel `POST /orders` from a `recommendationResultId`; (2) store `POST /orders/checkout` from raw cart lines. Both reserve stock, create/reuse a customer + address, snapshot items, and write initial status history. | [orders.service.ts:74 `create`](../src/modules/orders/orders.service.ts#L74), [orders.service.ts:187 `createFromCart`](../src/modules/orders/orders.service.ts#L187) |
| **Order creation** | `OrderItem` rows are written with full snapshots (name, reference name, sku, variation, image url, brand, unit price, original unit price, quantity, total). Funnel orders set `selectedPackId` + `recommendationResultId`; cart orders set both to null and `OrderItem.packId` to null. | [orders.service.ts:136/236](../src/modules/orders/orders.service.ts#L136) |
| **Post-order status** | `PATCH /admin/orders/:id/status` drives transitions; delivered/canceled transitions finalize or release reserved stock. | [order-workflow.service.ts](../src/modules/orders/order-workflow.service.ts), [order-stock.service.ts](../src/modules/orders/order-stock.service.ts) |

**Key lifecycle truth:** the funnel path (quiz → recommendation → order) and the store path (cart → checkout) are **two separate flows** that never meet. The Pack participates fully only in the funnel path, and even there the customer never *chooses* anything — the engine does.

---

## D. Existing API inventory (Pack-related)

### Public

| Method | Route | Purpose | Request | Response shape | Auth | Missing behavior |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/packs` | List all active packs | none (no query params) | array of public pack objects (price fields, items, attributes, images, cover) | Public | No filter/search/sort/pagination; no category/tier/occasion facets; no availability flag |
| GET | `/packs/:id` | Get one active pack by UUID | path `id` | public pack detail incl. items + product references | Public | No way to submit a customer configuration; references shown but not selectable |
| GET | `/packs/slug/:slug` | Same detail by slug | path `slug` | public pack detail | Public | Same as above |

### Admin (`@UseGuards(JwtAuthGuard, RolesGuard)`)

| Method | Route | Purpose | Request DTO | Response | Auth roles | Missing behavior |
| --- | --- | --- | --- | --- | --- | --- |
| GET | `/admin/packs` | Paginated admin list | `QueryPacksDto` (status, isActive, priceMode, minPrice, maxPrice, search, sort, page) | paginated admin pack summaries (+ item/attribute counts, cover) | OWNER/ADMIN/STAFF | Filters limited to status/price/priceMode/search; no attribute/availability filter |
| GET | `/admin/packs/:id` | Full admin detail | path `id` | admin detail incl. items, references (w/ availableStock), `validationIssues`, usage counts | OWNER/ADMIN/STAFF | — |
| POST | `/admin/packs` | Create pack | `CreatePackDto` (+ `PackItemInputDto[]`, `PackAttributeInputDto[]`) | admin detail | OWNER/ADMIN | Cannot define customization rules, min price, category/tier/tags; rejects `CUSTOMER_CHOICE` |
| PATCH | `/admin/packs/:id` | Update pack | `UpdatePackDto` | admin detail | OWNER/ADMIN | Same gaps; items/attributes replaced wholesale |
| DELETE | `/admin/packs/:id` | Archive (soft) | path `id` | admin detail | OWNER/ADMIN | Hard delete intentionally unavailable |

### Funnel / order endpoints that consume Packs

| Method | Route | Purpose | Request | Pack linkage | Auth |
| --- | --- | --- | --- | --- | --- |
| POST | `/recommendations` | Generate & store recommendations | `CreateRecommendationDto` (`customerProfileId`) | reads all active Packs; writes `RecommendationResult.packId` | Public |
| GET | `/recommendations/:sessionId` | Read stored session | path | returns ranked packs + engine-selected items | Public |
| POST | `/admin/recommendation-rules/preview` | Preview scoring without persisting | `CreateRecommendationDto` | same engine, no writes | Admin |
| POST | `/orders` | Create COD order from a recommendation result | `CreateOrderDto` (`recommendationResultId`) | sets `Order.selectedPackId`, `OrderItem.packId` | Public |
| POST | `/orders/checkout` | Create COD order from cart lines | `CreateCartOrderDto` (`items[]`) | **no pack linkage** (`packId = null`) | Public |
| GET | `/orders/:id` | Safe public order summary | path | returns `packName` only | Public |
| GET | `/admin/orders` , `/admin/orders/:id` | Admin order list/detail | query / path | includes `selectedPack`, item snapshots | Admin |

**No endpoints exist for:** add-pack-to-cart, configure-pack, validate-pack-configuration, wishlist, share, related/similar packs, recently-viewed, or pack reviews.

---

## E. Current pricing, stock, and order-safety behavior

### Pricing

- **How a Pack price is defined:** by `priceMode` ([schema:48](../prisma/schema.prisma#L48)):
  - `FIXED` → uses `Pack.fixedPrice` as the subtotal directly ([orders.service.ts:879](../src/modules/orders/orders.service.ts#L879)).
  - `SUM_ITEMS` → sums the effective price of each selected reference ([orders.service.ts:895](../src/modules/orders/orders.service.ts#L895)).
  - `SUM_ITEMS_WITH_DISCOUNT` → sum of items minus `discountAmount` **or** `discountPercentage` (mutually exclusive, validated at [packs.service.ts:899](../src/modules/packs/packs.service.ts#L899)) ([orders.service.ts:905](../src/modules/orders/orders.service.ts#L905)).
- **Effective per-reference price:** `priceOverride ?? (product.basePrice + reference.priceDelta)` ([orders.service.ts:951 `effectiveProductReferencePrice`](../src/modules/orders/orders.service.ts#L951)).
- **Are individual Pack item prices stored on the Pack?** No. `PackItem` has no price column. Item prices are always derived from the product/reference at order time.
- **Are original item values retained?** Only at order time: `OrderItem.originalUnitPriceSnapshot` is set from `product.compareAtPrice` when it is higher than the charged price ([orders.service.ts:965](../src/modules/orders/orders.service.ts#L965)). There is no "original total pack value" concept.
- **Minimum allowed price / margin protection:** **does not exist.** `minBudget`/`maxBudget` are budget *hints*, not enforced floors, and `costPrice` exists on `Product` but is never used in any pack/order calculation. There is no validation that a configured pack price stays above a floor (there is no configuration to validate).

### Stock

- **Stock lives at the reference level only:** `ProductReference.stockQuantity` and `reservedQuantity` ([schema:376-377](../prisma/schema.prisma#L376-L377)). Products and Packs have no stock counter.
- **Available stock** = `stockQuantity − reservedQuantity` (floored at 0), computed in [packs.service.ts:1181](../src/modules/packs/packs.service.ts#L1181) and in raw SQL during reservation.
- **When is stock checked?**
  - At **pack activation**: required items must have an active, in-stock reference (fixed) or at least one active in-stock reference (auto) ([packs.service.ts:989-1023](../src/modules/packs/packs.service.ts#L989-L1023)).
  - At **recommendation time**: `loadActivePacks` only loads references with `isActive && stockQuantity > 0` ([recommendations.service.ts:390-395](../src/modules/recommendations/recommendations.service.ts#L390-L395)); the engine further checks `stockQuantity > reservedQuantity` ([recommendation-engine.service.ts:548](../src/modules/recommendations/recommendation-engine.service.ts#L548)).
  - At **order time**: `reserveForNewOrder` atomically increments `reservedQuantity` with a guard `(stock − reserved) >= qty` and product-active check ([order-stock.service.ts:16](../src/modules/orders/order-stock.service.ts#L16)). Delivered → decrement stock; canceled → release reservation ([order-stock.service.ts:63/45](../src/modules/orders/order-stock.service.ts#L63)).
- **Pack-level availability** = derived implicitly from item availability; there is no stored "pack is available" flag and no public availability indicator.

### Cart and order persistence

- **Cart:** there is **no server-side cart entity**. The store cart is purely client-side; `POST /orders/checkout` receives raw lines. The funnel has no cart at all.
- **Order storage:** `OrderItem` carries a rich snapshot (product name, reference name, sku, variation, image, brand, unit price, original unit price, qty, total) — see [schema:710](../prisma/schema.prisma#L710) and [orders.service.ts:136](../src/modules/orders/orders.service.ts#L136). This is historically safe at the line level: prices and names are frozen at order time and survive later catalog edits.
- **Is a Pack configuration snapshot stored?** **No.** `Order.selectedPackId` records *which* pack was chosen (by name reference), but there is no snapshot of the pack's composition, removed items, added add-ons, selected shades, discount rationale, or a "final configured price" record beyond the order totals. The order is reconstructable as a flat list of lines, not as a configured Pack.

---

## F. Current recommendation behavior

### How Packs are filtered and scored

1. **Candidate set:** all packs with `status = ACTIVE && isActive = true` ([recommendations.service.ts:321](../src/modules/recommendations/recommendations.service.ts#L321)).
2. **Pack-attribute scoring** ([recommendation-engine.service.ts:174-216](../src/modules/recommendations/recommendation-engine.service.ts#L174)): each `PackAttribute` is compared to the customer's answer for that group. `NOT_COMPATIBLE` + `isHardFilter` ⇒ pack excluded; a non-matching `isHardFilter` ⇒ excluded; matching `COMPATIBLE`/`BOOST` ⇒ score added.
3. **Per-item reference selection** ([`selectReference`:304](../src/modules/recommendations/recommendation-engine.service.ts#L304)):
   - `FIXED_REFERENCE` → the configured reference, if available.
   - `AUTO_BEST_REFERENCE` → best available reference, filtered by `SKIN_COLOR`/`UNDERTONE` compatibility ([`referenceFilterGroups`:114](../src/modules/recommendations/recommendation-engine.service.ts#L114)), scored, highest wins.
   - `CUSTOMER_CHOICE` → **returns `null`** immediately ([line 309-311](../src/modules/recommendations/recommendation-engine.service.ts#L309)).
4. **Item gating** ([scorePack:220-249](../src/modules/recommendations/recommendation-engine.service.ts#L220)): if `selectReference` returns null **and the item is required**, the **entire pack is dropped** (`return null`). Optional items are skipped with an exclusion note.
5. **Ranking:** by match percentage, then total score, then priority, then name; top 10 ([line 140-159](../src/modules/recommendations/recommendation-engine.service.ts#L140)).

### Why `CUSTOMER_CHOICE` produces no recommendations

A `CUSTOMER_CHOICE` item always yields `null` from `selectReference`. If that item is `isRequired = true` (the default), `scorePack` hits `return null` and the **whole pack is excluded from recommendations** ([recommendation-engine.service.ts:235-237](../src/modules/recommendations/recommendation-engine.service.ts#L235)). Because admin creation also forbids `CUSTOMER_CHOICE` entirely ([packs.service.ts:966](../src/modules/packs/packs.service.ts#L966)), this combination is currently unreachable in practice — but the moment customer-choice items become allowed, **any pack containing a required customer-choice item would silently vanish from recommendations** unless this path is changed. This is the exact failure the Pack Core conception (§2.7) warns about. The intended business rule — "a pack stays recommendable when at least one compatible selectable option exists" — is **not implemented**; the engine treats customer-choice as "no selection possible" rather than "selection deferred to the customer". This is confirmed by an explicit test: *"does not implement CUSTOMER_CHOICE selection"* ([recommendation-engine.service.spec.ts:558](../src/modules/recommendations/recommendation-engine.service.spec.ts#L558)).

### Does the system already support compatible selectable references?

**Partially, and only engine-side.** The machinery to find *compatible available references* for a product already exists (`AUTO_BEST_REFERENCE` filtering + `isReferenceCompatibleWithAnswers` at [line 492](../src/modules/recommendations/recommendation-engine.service.ts#L492), backed by `ProductReferenceAttribute`). This is reusable for "does this pack have at least one valid option?" eligibility logic. What is missing is (a) surfacing those compatible options to the customer, and (b) letting eligibility succeed without auto-committing to one reference.

### Note on `minBudget`/`maxBudget`

These Pack fields are **not consumed by the engine** — there is no budget-band scoring in `recommendation-engine.service.ts`. `BUDGET_MATCH` is a `scoreForGroup` key tied to a `BUDGET` *attribute group*, not to `min/maxBudget`. So the numeric budget range is currently dead data for recommendations.

---

## G. Current admin capability matrix

| Capability | Supported today? | Where / Notes |
| --- | --- | --- |
| Pack public content (name, slug, description, main image) | ✅ Yes | `CreatePackDto`/`UpdatePackDto`, [packs.service.ts](../src/modules/packs/packs.service.ts) |
| Pack composition (add/remove/reorder items) | ✅ Yes (full replace on update) | `PackItemInputDto[]`; update does deleteMany + recreate ([packs.service.ts:407](../src/modules/packs/packs.service.ts#L407)) |
| Item types | ⚠️ Limited | Only `selectionMode` (FIXED_REFERENCE / AUTO_BEST_REFERENCE; **CUSTOMER_CHOICE blocked**) + `isRequired`. No optional-add-on or required-selectable role. |
| Product references (per item) | ⚠️ Partial | Can pin ONE fixed reference per item. Cannot define "allowed references", "allowed replacements", or "allowed add-ons". |
| Pricing | ✅ Yes | `priceMode` + fixed/discount fields, validated ([packs.service.ts:868](../src/modules/packs/packs.service.ts#L868)) |
| Discount | ✅ Yes (pack-level) | `discountAmount` XOR `discountPercentage` in `SUM_ITEMS_WITH_DISCOUNT` mode |
| Compatibility (attributes for quiz) | ✅ Yes | `PackAttributeInputDto[]` → `PackAttribute` rows |
| Recommendation rules | ✅ Yes (global, not per-pack) | `/admin/recommendation-rules` CRUD; scores are global weights, not pack-specific |
| Stock | ⚠️ Indirect | Managed on product references (product-references module), not on packs |
| Images | ✅ Yes | `PackImage` via media module; `mainImageUrl` on Pack |
| Status | ✅ Yes | DRAFT/ACTIVE/ARCHIVED + `isActive`; activation validation |
| Customization rules | ❌ No | No fields for removal/quantity/replacement permissions, min items, max items, min price, allowed add-ons |
| Category / subcategory / tier / occasion / tags / featured | ❌ No | No such fields on `Pack` |
| Min allowed price / margin protection | ❌ No | No field; `costPrice` unused |

---

## H. Frontend / backend readiness notes (backend facts only)

- **Pack detail already ships the data a customization UI would read** (items, each item's product, the fixed reference, and — for non-fixed items — the product's active references with prices, stock, swatch images). What is missing is *write* surface (submit a configuration) and *rules* (what may be changed).
- **Public identity is mixed:** packs are addressable by both `:id` (UUID) and `slug`; products are UUID-only. SEO/share links by slug are possible for packs already.
- **No availability flag** is exposed publicly for packs; a storefront must infer "buyable" from item/reference stock itself, which it cannot fully do because the public payload does not include `reservedQuantity` (admin-only).
- **No category/brand list endpoints** exist publicly (confirmed in [backend-store-gap-confirmation.md](./backend-store-gap-confirmation.md)); pack discovery facets would have to be derived or newly built.
- **Stale-doc warning:** [backend-store-gap-confirmation.md](./backend-store-gap-confirmation.md) states `Order.selectedPackId` is NOT NULL and that a cart endpoint does not exist. Both are now false in the current code: `selectedPackId` is `String?` ([schema:675](../prisma/schema.prisma#L675)) and `POST /orders/checkout` exists with stock reservation ([orders.service.ts:187](../src/modules/orders/orders.service.ts#L187), [order-stock.service.ts](../src/modules/orders/order-stock.service.ts)). Treat that doc as historical.
- **Order snapshots are robust at the line level**, which means the hardest part of "historical safety" (price/name freezing) is already solved and reusable; the gap is snapshotting the *pack-level configuration*, not the line data.
