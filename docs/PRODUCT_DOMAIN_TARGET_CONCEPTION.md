# Product Domain — Target Conception

> Design-only document. No schema, migration, seed, DTO, endpoint, or configuration was modified while producing it.
> This is the recommended **target domain architecture** for our backend — a concrete adaptation of the Beauty Bay reference (`docs/BEAUTY_BAY_PRODUCT_OBJECT_REFERENCE_ANALYSIS.md`) onto our real current state (`docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md`, `prisma/schema.prisma`).
> Statements that cannot be settled from code or the reference are marked **Assumption requiring business validation**.
> Context: Morocco-based beauty store, MAD, Cash on Delivery, mobile-first storefront + admin dashboard, skincare + makeup, shades/sizes, references/variants, stock, packs, quiz + rule-based recommendations.

---

## 1. Executive Summary

Our backbone is already correct and validated by the Beauty Bay PDP: a **parent `Product`** carrying catalog identity over **`ProductReference`** sellable SKUs that carry price, stock, and the shade/size variation the customer actually buys.

**Evidence**
- `prisma/schema.prisma` — `model Product`, `model ProductReference`
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §1, §3
- `docs/reference/beauty-bay-product-object-sample.json` — `parentProductId`, `variants.inStock[]`

The redesign therefore is **evolutionary, not a rewrite**. It (a) fills product-master gaps (content split, `productType`, SEO, merchandising, compare-at price, a single clear visibility contract); (b) adds **product-level beauty suitability** alongside the existing reference-level attributes so the engine can score general fitness *and* shade fitness; (c) strengthens **order snapshots** and **stock integrity** (the two highest current risks); and (d) reserves clean extension points for promotions, reviews, multi-currency, and rich content — all deferred.

The most important target rule: **the database stays normalized; richness lives in the response layer.** One PDP response is *assembled* from Product + selected ProductReference + all references + price + stock + media + taxonomy + suitability — never flattened into a giant Product table.

---

## 2. Target Design Principles

1. **Product ≠ sellable SKU.** `Product` is catalog identity; `ProductReference` is the purchasable unit. Cart, pack items, recommendation results, and order items resolve to a `ProductReference`. *(Confirmed alignment — `prisma/schema.prisma` `OrderItem.productReferenceId` required.)*
2. **Stock and commercial state are reference-level.** A product stays visible while individual references are out of stock. *(Confirmed — current-state §3.2; Beauty Bay `variants.outOfStock[]`.)*
3. **Suitability is two-tiered.** General suitability (skin type, concern, finish, coverage) can live at **Product** level; shade-specific suitability (skin tone, undertone, shade family) lives at **ProductReference** level. *(New target decision — today suitability is reference-only.)*
4. **Price is numeric MAD, never formatted text.** Display strings, `onSale`, and `% saving` are derived. *(Beauty Bay confirms numeric `itemPrice` + derived `amount`.)*
5. **One currency now, multi-currency-ready later.** Keep `currency` columns; do not block a future price table.
6. **Normalized DB, rich response.** Catalog data is separated across Product, ProductReference, media, attributes, stock, packs; the storefront aggregates.
7. **Catalog is separate from promotions.** No promo engine inside Product; a future promotions domain references products/references.
8. **Orders are historically immutable.** Snapshot enough at purchase time (name, SKU, shade/size, unit price, image, brand) that later catalog edits never corrupt history.
9. **Archive over delete.** Products/references referenced by orders, packs, or recommendations are archived/hidden, never hard-deleted. *(Confirmed — `onDelete: Restrict` from orders/packs/recommendations.)*
10. **One visibility contract.** Replace the ambiguous `status` + `isActive` pair with a single documented lifecycle. *(Confirmed risk — current-state §8 Medium.)*
11. **Recommendation can select a reference where shades matter.** Engine filters/score references and returns a `selectedProductReferenceId`. *(Confirmed — `recommendation-engine.service.ts`.)*
12. **Packs hold a fixed reference *or* a dynamically chosen compatible reference**, with the MVP behaviour explicitly chosen (see §6.8). *(Confirmed — `SelectionMode` enum.)*

---

## 3. Target Domain Map

```
                         ┌────────────┐        ┌────────────┐
                         │  Category  │        │   Brand    │
                         │ (+ slug)   │        │ (+ slug)   │
                         └─────┬──────┘        └─────┬──────┘
                               │ 1                   │ 0..1
                               ▼                     ▼
                         ┌──────────────────────────────────┐
                         │             PRODUCT               │  catalog identity
                         │  name, slug, productType,         │
                         │  description/ingredients/         │
                         │  directions, visibility,          │
                         │  basePrice, compareAtPrice?,      │
                         │  SEO?, merchandising flags,        │
                         │  recommendationPriority?           │
                         └───┬───────┬────────┬───────┬──────┘
                  1..* │           │ 1..*   │ 0..*  │ 0..* (suitability — NEW, product-level)
                       ▼           ▼        ▼       ▼
        ┌───────────────────┐  ┌─────────┐ ┌──────────────┐  ┌────────────────────────┐
        │ PRODUCT REFERENCE │  │ Product │ │ ProductAttr  │  │  (future) Promotion,   │
        │  sellable SKU     │  │ Image   │ │ (general     │  │   Review, PDP content  │
        │  refCode, sku,    │  │ (gallery│ │ suitability) │  └────────────────────────┘
        │  measurement,     │  │ /cover) │ └──────────────┘
        │  shadeName/Code,  │  └─────────┘
        │  swatchHex?,      │
        │  price override/  │      ┌───────────────────────────┐
        │  delta, stock,    │─1:1─▶│ ProductReferenceImage     │ (swatch / variant image)
        │  reserved,        │      └───────────────────────────┘
        │  visibility,      │
        │  recPriority?     │      ┌───────────────────────────┐
        │                   │─0..*▶│ ProductReferenceAttribute │ shade-specific suitability
        └───┬───────┬───────┘      │ (tone, undertone, family) │
            │       │              └───────────────────────────┘
            │       │  AttributeGroup / AttributeOption  ◀── shared with Quiz
            │       │
            │       └────────────┐
            ▼                    ▼
   ┌─────────────┐        ┌──────────────────────┐         ┌────────────────────┐
   │  PackItem   │        │ RecommendationResult │         │     OrderItem      │
   │ product +   │        │ Item                 │         │ product + reference│
   │ reference?  │        │ product + selected   │         │ + SNAPSHOTS        │
   │ selectionMode│       │ reference            │         │ (name, sku, shade, │
   └──────┬──────┘        └──────────┬───────────┘         │  unitPrice, image, │
          │ *..1                     │ *..1                │  brand)            │
          ▼                          ▼                     └─────────┬──────────┘
      ┌───────┐               ┌──────────────┐                       │ *..1
      │ Pack  │               │ Recommendation│                      ▼
      └───────┘               │ Session/Result│                  ┌───────┐
                              └──────────────┘                   │ Order │
                                                                 └───────┘
```

All relations above except the four marked **NEW** (product-level suitability, Product slug-on-Brand/Category, shade structured fields, richer order snapshots) already exist in `prisma/schema.prisma`.

---

## 4. Product Master Domain

### 4.1 Product Responsibility
`Product` owns the **catalog identity and shared content** of a sellable item family — never price-bearing stock or shade-specific data. It answers "what is this product, what is it made of, how is it used, where does it sit in the catalog, and is it visible/recommendable."

**Evidence**
- `prisma/schema.prisma` — `model Product` (name, slug, description, basePrice, category, brand, status, isActive)
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §1 ("thin catalog header")

### 4.2 Recommended Product Information Groups
- **Identity:** `name`, `slug`, `productType` *(new)*, `brandId`, `categoryId`.
- **Content:** `description` (long), `ingredients` *(new, nullable)*, `directions` *(new, nullable)*, optional `shortDescription` *(new)*. *(Beauty Bay confirms split `description`/`ingredients`/`directions`.)*
- **Commercial baseline:** `basePrice` (MAD, numeric), optional `compareAtPrice` *(new)*, `costPrice` (admin-only), `currency`.
- **Merchandising:** `isFeatured` / `sortOrder` / badge flags *(new, optional)*. *(Assumption requiring business validation — which flags are needed for MVP.)*
- **Discovery/SEO:** `metaTitle`, `metaDescription` *(new, optional, distinct from slug)*.
- **Recommendation:** optional product-level `recommendationPriority` *(new)*.

### 4.3 Product Lifecycle and Visibility States
**Target decision:** collapse the ambiguous `status` (`DRAFT/ACTIVE/ARCHIVED`) + `isActive` pair into **one** documented contract. Target states:
- `DRAFT` — being authored, never store-visible.
- `ACTIVE` — store-visible (requires at least one active, optionally in-stock reference).
- `HIDDEN` — intentionally not listed but not archived (fills today's missing "hidden" state). *(Beauty Bay has no equivalent; this resolves current-state §10 Q4.)*
- `ARCHIVED` — retired; retained for order/pack/recommendation history, never hard-deleted.

**Evidence**
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §8 ("Dual lifecycle flags … no DB-level coupling")
- `src/modules/products/products.service.ts` — `publicProductWhere` (requires both `status=ACTIVE` and `isActive=true`)

**Migration nuance:** the redesign may keep `isActive` physically during transition and treat `status` as the source of truth, or merge into one enum — decided in the Master Plan Phase 2/3, not here.

### 4.4 Product-Level Beauty Suitability
**Target decision (NEW):** introduce general, non-shade suitability at Product level — skin type, concern, finish, coverage, formulation — so a serum can declare "suits oily/combination, targets hyperpigmentation" once, rather than repeating it on every reference. Reuse the existing `AttributeGroup`/`AttributeOption` foundation via a new product-level assignment concept mirroring `ProductReferenceAttribute`.

**Evidence**
- `docs/reference/beauty-bay-product-object-sample.json` — `attraqt.facets[]` (`skinType`, `concern`, `formulation` are clearly product-general, not per-size)
- `prisma/schema.prisma` — `ProductReferenceAttribute` (today the only suitability owner); `AttributeGroup.isProductAttribute` flag **already exists** and is currently unused at product level
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §10 Q1 (suitability ownership unresolved)

*Assumption requiring business validation:* exact split of which attribute groups are product-general vs reference-specific.

### 4.5 Product-Level SEO and Catalog Discovery
Optional `metaTitle`/`metaDescription` distinct from `slug`; `productType` for sub-classification under `Category`; brand/category **slugs** for clean storefront URLs and slug-lookup parity. *(Beauty Bay confirms `seoData`, `productType`, `brand.slug`.)* All Phase-two unless trivially cheap.

**Evidence**
- `docs/reference/...json` — `seoData.metaTitle`, `productType`, `brand.slug`
- `frontend-handoff/KNOWN_LIMITATIONS.md` — public slug lookup recently added; brand/category slug parity still partial

### 4.6 Product-Level Content
Structured content sections (`description`, `ingredients`, `directions`, optional `shortDescription`), plus **product media** (cover + gallery) via the existing `ProductImage`→`MediaAsset` join. Legacy scalar `mainImageUrl` is retired in favour of the join (decided in Master Plan). Rich enhanced media zones and video are **deferred** (§6.13).

---

## 5. ProductReference / Sellable SKU Domain

### 5.1 ProductReference Responsibility
A `ProductReference` is the **purchasable SKU**: one shade, one size, or one bundle quantity of its parent Product. It owns commercial identity (SKU/barcode), price resolution, stock, its own image/swatch, and shade-specific suitability.

**Evidence**
- `prisma/schema.prisma` — `model ProductReference`
- `docs/reference/...json` — `variants.inStock[]` (each variant has own `sku`, `measurement`, `price`, `imageUrl`)

### 5.2 Variation Types
Mirror Beauty Bay's `variationType` concept: a reference participates in a **size**, **shade**, or **bundle** axis. *Assumption requiring business validation:* whether one Product may mix axes (e.g. shade × size) — see §12. Today the model does not declare an axis; adding an explicit `variationType` (or per-reference descriptor) clarifies storefront rendering (`showSwatch` analogue).

**Evidence**
- `docs/reference/...json` — `variationType: "size"`, `variants.showSwatch`

### 5.3 Shade, Swatch, Size, and Measurement Handling
**Target decision (NEW fields):** add structured shade identity — `shadeName` (today only free-text `referenceName`), optional `shadeCode`/`shadeFamily`, optional `swatchHex` for swatch UI — and a `measurement` field for sizes (`45ml`). Keep the 1:1 `ProductReferenceImage` swatch; a multi-image shade gallery is deferred.

**Evidence**
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §9.2 ("shade identity is just `referenceName`"), §5 (no hex/family)
- `docs/reference/...json` — `swatch`, `shadeDescription`, `measurement`

### 5.4 SKU and Commercial Identity
Keep `referenceCode` (`@@unique([productId, referenceCode])`), optional global-unique `sku` and `barcode`. Price resolves as today: `priceOverride` if set, else `basePrice + priceDelta`. **Target decision:** add optional reference-level compare-at handling only if business needs per-shade sale pricing (else inherit product `compareAtPrice`).

**Evidence**
- `prisma/schema.prisma` — `ProductReference.sku/barcode/priceOverride/priceDelta`
- `src/modules/orders/orders.service.ts` — `effectiveProductReferencePrice`

### 5.5 Reference-Level Beauty Matching
Keep `ProductReferenceAttribute` for **shade-specific** matching (skin tone, undertone, shade family) with `matchType` (`COMPATIBLE/NOT_COMPATIBLE/BOOST`), `scoreValue`, `isHardFilter`. This is where the engine selects the right shade per customer profile.

**Evidence**
- `prisma/schema.prisma` — `ProductReferenceAttribute`
- `src/modules/recommendations/recommendation-engine.service.ts` — `isHardFilter`, `scoreReference`, `isReferenceAvailable`

### 5.6 Reference-Level Visibility and Availability
Each reference has its own active flag and stock. Availability rule (from engine) = `isActive && stockQuantity > reservedQuantity`. A reference can be hidden/out-of-stock while the parent Product stays `ACTIVE`. *(Confirmed — Beauty Bay `variants.outOfStock[]` rendered alongside in-stock.)*

**Evidence**
- `src/modules/recommendations/recommendation-engine.service.ts` — `isReferenceAvailable`

---

## 6. Related Domain Objects

### 6.1 Brand
Many products → 0..1 brand (`onDelete: SetNull`). **Target:** add `slug` for storefront URLs/brand pages and optional media-join logo (today plain `logoUrl`). *(Beauty Bay `brand.slug`.)*
**Evidence:** `prisma/schema.prisma` — `model Brand`; `frontend-handoff/KNOWN_LIMITATIONS.md` — brand logo upload relationship not implemented.

### 6.2 Category and Product Type
Required `categoryId` with self-referential hierarchy (`parentId`). **Target:** add a category `slug` (today identified by `code`) and a `productType` on Product as a finer classification under category. *(Beauty Bay `category` + `productType: "Face Serums"`.)*
**Evidence:** `prisma/schema.prisma` — `model Category`; `docs/...CURRENT_STATE...` — §5 (category has `code`, not slug).

### 6.3 Product Media
`Product` → many `ProductImage` (`role` COVER/GALLERY, `position`, `altText`) → `MediaAsset` (Cloudinary). **Target:** retire scalar `mainImageUrl`; cover = `role=COVER`. Video deferred (`MediaAssetType` is IMAGE-only).
**Evidence:** `prisma/schema.prisma` — `ProductImage`, `MediaAsset`; `docs/...CURRENT_STATE...` — §3.2, §8 (two parallel image systems).

### 6.4 ProductReference Media
1:1 `ProductReferenceImage` (default `role=SWATCH`). Keep 1:1 for MVP; multi-image shade gallery deferred.
**Evidence:** `prisma/schema.prisma` — `ProductReferenceImage` (`productReferenceId @unique`).

### 6.5 Product Attribute Assignments
Two assignment layers using the shared `AttributeGroup`/`AttributeOption`:
- **NEW** product-level assignments (general suitability) — leveraging the unused `AttributeGroup.isProductAttribute` flag.
- Existing `ProductReferenceAttribute` (shade-specific).
**Evidence:** `prisma/schema.prisma` — `AttributeGroup.isProductAttribute`, `ProductReferenceAttribute`.

### 6.6 Stock and Reservation
Reference-level `stockQuantity`, `reservedQuantity`, `lowStockThreshold`. **Target (critical fix):** order placement must atomically decrement stock / write `reservedQuantity` under a conditional guard (today neither happens — overselling risk).
**Evidence:** `docs/...CURRENT_STATE...` — §8 Critical; `frontend-handoff/KNOWN_LIMITATIONS.md` — "Stock reservation and automatic stock deduction" not implemented.

### 6.7 Price and Sale Price
Numeric MAD `basePrice` (Product) + reference `priceOverride`/`priceDelta`. **Target:** optional numeric `compareAtPrice`; derive `onSale`/`% saving`. Single currency now; multi-currency price table deferred.
**Evidence:** `prisma/schema.prisma` — `Product.basePrice/currency`; `docs/reference/...json` — `originalItemPrice`, `onSale`, `percentageSaving`, `prices[]`.

### 6.8 Packs and Pack Items
`PackItem` = `productId` (required) + `productReferenceId?` (optional) + `selectionMode` (`FIXED_REFERENCE` / `AUTO_BEST_REFERENCE` / `CUSTOMER_CHOICE`) + `quantity` + `isRequired`.
**Target MVP decision:** support both fixed and dynamically-selected compatible references, but ship **`FIXED_REFERENCE` + `AUTO_BEST_REFERENCE` for MVP**; treat `CUSTOMER_CHOICE` override at checkout as Phase-two (it is listed as not-implemented). *Assumption requiring business validation.*
**Evidence:** `prisma/schema.prisma` — `PackItem`, `SelectionMode`; `recommendation-engine.service.ts` — `FIXED_REFERENCE`/`AUTO_BEST_REFERENCE` handling; `frontend-handoff/KNOWN_LIMITATIONS.md` — "Customer-selected reference override during recommendation checkout" not implemented.

### 6.9 Recommendation Eligibility and Rules
Engine scores packs/references from `ProductReferenceAttribute` + `PackAttribute` + `RecommendationRule`; hard filters exclude incompatible references; `AUTO_BEST_REFERENCE` picks best **available** reference; `RecommendationResultItem` stores the chosen `selectedProductReferenceId`. **Target:** add product-level suitability + optional product/reference `recommendationPriority`; define fallback when no reference matches.
**Evidence:** `recommendation-engine.service.ts` — `scoreReference`, `isReferenceAvailable`, pack `priority`; `prisma/schema.prisma` — `RecommendationResultItem`.

### 6.10 Order Items and Historical Snapshots
`OrderItem` requires `productId` + `productReferenceId` + snapshots of **name, reference name, unit price** only. **Target:** extend snapshot to **SKU, shade/size descriptor, product image URL, brand name** so receipts/history survive later edits/archival.
**Evidence:** `prisma/schema.prisma` — `OrderItem` (only name/refName/unitPrice); `docs/...CURRENT_STATE...` — §8 High; `src/modules/orders/orders.service.ts` — snapshot mapping (lines ~696–698).

### 6.11 Future Promotion Domain
A separate domain referencing products/references (sale campaigns, codes, banners, stickers). **Deferred.** Catalog stays promotion-free except the simple `compareAtPrice`.
**Evidence:** `docs/reference/...json` — `promoText[]`, `sticker`, `onSale`.

### 6.12 Future Reviews Domain
`Review`/`ReviewSummary` keyed by product/reference. **Deferred.** Reserve a relation point.
**Evidence:** `docs/reference/...json` — `reviewSummary`, `supplement.reviewProductInfo`.

### 6.13 Future Enhanced Product Content Zones
CMS-style rich PDP blocks + product video. **Deferred** (`MediaAssetType` IMAGE-only today).
**Evidence:** `docs/reference/...json` — `enhancedMediaZones[]`, `media.video`.

---

## 7. Target Ownership Matrix

| Information / Capability | Target Owner | Why It Belongs There | MVP / Later | Notes |
|---|---|---|---|---|
| Product name | Product | Shared identity | MVP | Exists |
| Slug | Product | One canonical URL per product | MVP | Exists (`@unique`) |
| Brand | Product → Brand | Brand owns many products | MVP | Optional FK exists |
| Category | Product → Category | Required taxonomy | MVP | Required FK exists |
| Product type | Product | Sub-classification under category | Later | NEW field |
| Short description | Product | PDP teaser | Later | NEW optional |
| Full description | Product | Marketing body | MVP | Exists (`description`) |
| Ingredients | Product | Shared across all variants | MVP (skincare) | NEW field |
| Directions | Product | Shared usage/warnings | MVP (skincare) | NEW field |
| SKU | ProductReference | Sellable unit identity | MVP | Exists (unique) |
| Size / measurement | ProductReference | Varies per sellable unit | MVP | NEW structured field |
| Shade name | ProductReference | Per-shade identity | MVP (makeup) | Today free-text `referenceName` |
| Shade code | ProductReference | Stable shade key | Later | NEW optional |
| Swatch (image/hex) | ProductReference (image 1:1) / `swatchHex` field | Per-shade visual | MVP image / Later hex | Image exists; hex NEW |
| Product gallery | ProductImage → MediaAsset | Shared visuals | MVP | Exists |
| Reference image | ProductReferenceImage (1:1) | Per-variant visual | MVP | Exists |
| Current price | Product `basePrice` (+ ref delta/override) | Numeric MAD baseline | MVP | Exists |
| Original price | Product `compareAtPrice` (opt ref override) | Drives onSale/% saving | Later | NEW optional |
| Stock quantity | ProductReference | Availability is per-SKU | MVP | Exists |
| Reserved stock quantity | ProductReference | Concurrency/holds | MVP (fix needed) | Exists but never written |
| Stock status | Derived from reference | `active && stock>reserved` | MVP | Computed |
| Active / hidden / archived state | Product (single contract) + reference active flag | One visibility source of truth | MVP | Collapse `status`+`isActive` |
| Product-level skin-type suitability | Product attribute assignment (NEW) | General, not per-shade | MVP/Phase-two | Uses `isProductAttribute` |
| Product-level concern suitability | Product attribute assignment (NEW) | General | MVP/Phase-two | NEW |
| ProductReference skin-tone matching | ProductReferenceAttribute | Shade-specific | MVP | Exists |
| ProductReference undertone matching | ProductReferenceAttribute | Shade-specific | MVP | Exists |
| Product recommendation priority | Product (NEW) | Tie-break/boost at product level | Later | Today only `Pack.priority` |
| ProductReference recommendation priority | ProductReference (NEW) | Prefer a shade | Later | NEW optional |
| Pack quantity | PackItem | Per bundle line | MVP | Exists |
| Pack fixed vs dynamic compatible reference | PackItem `selectionMode` | Bundle behaviour | MVP (fixed+auto) / Later (customer choice) | Exists |
| Product order snapshot | OrderItem (NEW fields) | History immutability | MVP | Extend snapshot |
| Reference order snapshot | OrderItem (NEW fields) | History immutability | MVP | Extend snapshot |
| Maximum quantity per customer | Product or ProductReference | Purchase cap | Later | NEW (`maxPerCustomer`) — *business validation* |
| SEO metadata | Product | Distinct from slug | Later | NEW optional |
| Reviews | Future Reviews domain | Separate concern | Future | Reserve relation |
| Promotion data | Future Promotion domain | Keep catalog clean | Future | Except simple `compareAtPrice` |
| Back-in-stock alerts | Future (subscription) | Notification concern | Future | Defer |
| Rich PDP content zones | Future content domain | CMS concern | Future | Defer |

---

## 8. Product and ProductReference Lifecycle

Target lifecycle (each step gated, archive-safe):

```
Product DRAFT
  → Product content + taxonomy authored (name, slug, category, brand, productType, content)
  → ProductReferences created (refCode, sku, measurement/shade, price delta/override)
  → Media assigned (product cover/gallery, reference swatch)
  → Attributes assigned (product-level general suitability + reference-level shade suitability)
  → Stock & price configured per reference
  → Product PUBLISHED/ACTIVE  (requires ≥1 active reference)
  → Product becomes store-visible (catalog + PDP)
  → Product becomes recommendation-eligible (has suitability/attributes)
  → ProductReference used in pack (FIXED or AUTO_BEST)
  → ProductReference purchased → stock decremented/reserved (target fix)
  → OrderItem snapshot preserved (name, sku, shade/size, unit price, image, brand)
  → Product or reference HIDDEN / ARCHIVED safely (orders/packs/recs retain via Restrict + snapshots)
```

**Evidence**
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` — §6 (current lifecycle)
- `src/modules/products/products.service.ts` — `adminArchive` (cascades reference deactivation)

---

## 9. Target Storefront Product Detail Page Response

Conceptual aggregation (no final TypeScript yet) — assembled per request, mirroring Beauty Bay's read model but MAD/COD-adapted:

```
PDP response =
  Product master data        → name, slug, productType, description, ingredients, directions, brand, category
  Selected ProductReference  → sku, measurement/shade, price (numeric MAD + derived display), image, stock state
  Selectable references      → all active references with own price + stock bucket (in/out) + swatch
  Reference-level price       → effective unit price (override or base+delta), optional compareAt → onSale/% saving (derived)
  Reference-level stock state → derived available/out-of-stock per reference; product visible if any reference active
  Product and reference media → cover + gallery + per-reference swatch
  Brand and category          → names + slugs (+ breadcrumb)
  Product + reference suitability → general (skin type/concern/finish) + shade (tone/undertone) facets
  Add-to-cart constraints     → in-stock check, maxPerCustomer (later)
  Pack / recommendation compat → eligibility flags / recommended reference where applicable
  Product content sections    → showable description/ingredients/directions
```

Storefront-safe projection (today's rule kept): omit `costPrice`, reference `barcode`, `reservedQuantity`, `lowStockThreshold`. Whether exact `stockQuantity` is exposed vs a boolean/low-stock badge is a **business decision** (§12).
**Evidence:** `src/modules/products/products.service.ts` — `productSelect` (storefront-safe); `docs/reference/...json` — overall PDP shape.

---

## 10. Target Admin Management Capabilities

The admin dashboard must eventually let an administrator manage:
- **Product core details** — name, slug, productType, content (description/ingredients/directions), brand, category.
- **Visibility/status** — single lifecycle (DRAFT/ACTIVE/HIDDEN/ARCHIVED).
- **Brand, category, product type** — assignment + slug management.
- **Product references** — full CRUD (refCode, sku, barcode).
- **Shades and swatches** — shadeName/code/family, swatchHex, swatch image.
- **Sizes and measurements** — measurement per reference, variation axis.
- **Product and reference media** — cover/gallery ordering, swatch image (existing endpoints).
- **Pricing and sale prices** — basePrice, priceOverride/delta, optional compareAtPrice; `cost ≤ base` guard.
- **Stock** — per-reference quantity, threshold, reserved (read), low-stock alerts.
- **Suitability attributes** — product-level + reference-level assignments.
- **Recommendation eligibility** — attribute match types, hard filters, priorities.
- **Pack usage** — visibility of where a reference is used; safe-change warnings.
- **Deletion/archive safeguards** — archive over delete when referenced by orders/packs/recommendations.

**Evidence**
- `frontend-handoff/PAGE_ENDPOINT_MAPPING.md` — existing admin product/reference/media endpoints
- `frontend-handoff/ROLE_PERMISSION_MATRIX.md` — OWNER/ADMIN write, STAFF read-only

---

## 11. Current-State-to-Target Gap Matrix

| Target Capability | Current State | Gap Type | Required Decision | Expected Implementation Phase |
|---|---|---|---|---|
| Parent/SKU split | Present (`Product`/`ProductReference`) | None | — | n/a (validated) |
| Content split (ingredients/directions) | Single `description` | Schema add | Required per category? | Phase 4 |
| Product type | Missing | Schema add | Taxonomy depth | Phase 4/5 |
| Single visibility contract | `status` + `isActive` ambiguity | Refactor | Collapse vs document both | Phase 2–4 |
| Product-level suitability | Reference-only | Schema + engine | Which groups are product-level | Phase 5–6 |
| Structured shade (code/family/hex) | Free-text `referenceName` | Schema add | Need hex/family for swatch UI? | Phase 4–5 |
| Compare-at / sale price | None at product level | Schema add | Simple sale price now? | Phase 4 |
| Stock decrement on order | **Not implemented** | Critical logic | Decrement vs reserve, which step | Phase 7 |
| Atomic stock guard | Read-then-write (TOCTOU) | Concurrency fix | Locking strategy | Phase 7 |
| Richer order snapshot | name/refName/price only | Schema + logic | Which fields to freeze | Phase 7 |
| SEO metadata | None | Schema add | Needed for MVP? | Phase 5 |
| Brand/category slug parity | Brand/category by name/code | Schema add | URL strategy | Phase 5 |
| Recommendation priority (product/ref) | Pack-level only | Schema + engine | Need product boost? | Phase 6 |
| Fallback when no shade matches | Required item disqualifies pack | Policy + logic | Drop/substitute/flag | Phase 6 |
| Customer reference override (packs) | Not implemented | Feature | MVP or later | Phase 6/8 |
| Multi-currency | Single MAD columns | Reserve | Defer confirmed | Future |
| Reviews / promotions / video | None | Reserve | Defer confirmed | Future |
| Full-text search | `ILIKE` scans | Perf | Index strategy | Phase 5/9 |

**Evidence:** consolidated from `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` §7–§9, `prisma/schema.prisma`, `frontend-handoff/KNOWN_LIMITATIONS.md`.

---

## 12. Business Decisions Required Before Implementation

Each below is an **Assumption requiring business validation** — cannot be settled from code or the Beauty Bay reference:

1. **Can one Product have both shade and size variants?** (e.g. foundation in 3 shades × 2 sizes.) Determines whether references need a structured multi-axis model or a single descriptor.
2. **Is one ProductReference always exactly one SKU?** (Affects uniqueness/bundle modelling.)
3. **Should ProductReference prices always override Product prices**, or remain delta-based with override only when needed? (Keep current dual model or simplify.)
4. **Can a pack contain a fixed ProductReference?** (Yes today via `FIXED_REFERENCE` — confirm it stays MVP.)
5. **Can a pack dynamically choose a compatible reference using quiz answers?** (Yes today via `AUTO_BEST_REFERENCE` — confirm; and is customer-choice override MVP or later?)
6. **How should products with ALL references out of stock behave?** Hidden, shown as "sold out," or shown with disabled CTA + back-in-stock?
7. **Will stock be manually managed in the MVP?** (No supplier integration — confirm manual admin stock + decrement on order.)
8. **Do we need a simple sale price now** (`compareAtPrice`/`onSale`) or are pack discounts enough for MVP?
9. **Is deleting a Product ever allowed, or is archiving mandatory?** (Code already blocks hard delete via `Restrict`; confirm archive-only policy.)
10. **Are ingredients and directions required for every product category?** (Likely skincare-required, makeup-optional.)
11. **Which beauty attributes are mandatory by product type?** (e.g. foundation must have tone+undertone; serum must have skin type+concern.)
12. **Which fields are public to storefront vs admin-only?** Specifically: expose exact `stockQuantity` or only a boolean/low-stock badge; expose full suitability attributes or a curated subset.

---

## 13. Explicitly Deferred Features

Confirmed deferrable (reserve extension points, do not build for MVP):
- Multi-currency pricing (`prices[]`) — keep single MAD.
- International localization / language fallback.
- Promotions engine (`promoText`, `sticker`, codes) — only simple `compareAtPrice` in catalog.
- Reviews / ratings (`reviewSummary`).
- Back-in-stock subscriptions.
- Loyalty / tribe / exclusivity.
- Enhanced media zones + product video.
- Advanced SEO structured data (JSON-LD) beyond meta title/description.
- Platform-specific saleability.
- Next-day delivery countdown (irrelevant to Morocco COD).
- Restricted-item / coming-soon handling.

**Evidence:** `docs/reference/...json` — corresponding fields; `docs/BEAUTY_BAY_PRODUCT_OBJECT_REFERENCE_ANALYSIS.md` §7.

---

## 14. Recommended Design Baseline for MVP

The smallest target that is coherent, safe, and beauty-credible:

- **Keep** `Product` → `ProductReference` parent/SKU split (unchanged backbone).
- **Add to Product:** `productType`, `ingredients`, `directions`, optional `shortDescription`, optional `compareAtPrice`, optional SEO meta — additive, nullable.
- **Resolve visibility** into one documented lifecycle (DRAFT/ACTIVE/HIDDEN/ARCHIVED).
- **Add to ProductReference:** structured `measurement` + `shadeName` (+ optional `shadeCode`/`swatchHex`/variation axis) — additive.
- **Add product-level suitability** assignments (reuse `AttributeGroup.isProductAttribute`); keep reference-level attributes for shades.
- **Fix the two critical risks:** atomic stock decrement/reservation on order, and richer `OrderItem` snapshot (sku, shade/size, image, brand).
- **Packs:** ship `FIXED_REFERENCE` + `AUTO_BEST_REFERENCE`; defer `CUSTOMER_CHOICE` override.
- **Keep** price numeric MAD; derive display/onSale; reserve multi-currency, promotions, reviews, video, enhanced content for later.
- **Archive over delete** everywhere referenced by orders/packs/recommendations.

This baseline is **additive and backward-compatible** except the two deliberate fixes (visibility contract, stock decrement), which are sequenced safely in `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md`.
