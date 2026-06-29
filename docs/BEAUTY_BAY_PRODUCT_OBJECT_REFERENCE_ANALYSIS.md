# Beauty Bay Product Object — Reference Analysis

> Analysis-only document. No schema, migration, seed, DTO, endpoint, or configuration was modified while producing it.
> The Beauty Bay JSON is an **observed frontend Product Detail Page (PDP) response object**, not proof of Beauty Bay's internal database structure.
> Every finding is tagged as **Confirmed** (directly visible in the sample), **Inferred** (reasonable architectural inference), or **Target decision** (recommendation for our backend).
>
> Label convention used below:
> - **Confirmed from Beauty Bay response** = directly visible in `docs/reference/beauty-bay-product-object-sample.json`.
> - **Reasonable architectural inference** = a logical backend/read-model implication, not proof of Beauty Bay internals.
> - **Our target design decision** = how this project should adapt the pattern, validated against the local NestJS/Prisma backend.

**Primary evidence file**
- `docs/reference/beauty-bay-product-object-sample.json` — single observed PDP response for `sku: BFBB0426F` ("Renew + Smooth Serum", `parentProductId: 6r3KBSErcZMMAKFLv6BNNN`).

---

## 1. Scope and Interpretation Limits

**What this document is.** A structured reading of one captured PDP response, used as a **maturity reference** for a beauty e-commerce product experience. It tells us what a polished beauty PDP exposes to the frontend and, by inference, what logical layers a backend must combine to produce it.

**What this document is not.**
- It is **not** evidence of Beauty Bay's tables, services, or relations. The JSON is a denormalized read model. A flat field such as `category: "skincare"` says nothing about whether Beauty Bay stores categories in a table, a CMS, or a search index.
- It is **not** a target schema. Our adaptation lives in `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md`.
- It is a **single sample** of a *size-variant* product. We see `variationType: "size"`; we do **not** see a shade/swatch example in this capture (`showSwatch: false`, every `swatch: null`). Shade behaviour is therefore **inferred** from the presence of `swatch`, `shadeDescription`, and `showSwatch` fields, not directly observed in action.

**Key interpretation rule applied throughout.** A field being present in the response only proves the *frontend consumes it*. Where the field clearly originates from a different concern (price, stock, SEO, merchandising, third-party search via `attraqt`), we label the **logical** layer and never assert it is a physical Beauty Bay table.

---

## 2. High-Level Product Detail Page Response Structure

**Confirmed** — the sample is a single JSON object that blends at least eight distinct concerns into one read model:

1. **Parent product identity & content** — `name`, `description`, `ingredients`, `directions`, `measurement`, `variationType`, `parentProductId`.
2. **Selected SKU context** — top-level `sku` (`BFBB0426F`), top-level `price`, top-level `inStock`. The response is rendered *for one selected sellable variant* while still carrying its siblings.
3. **Variant set** — `variants.inStock[]`, `variants.outOfStock[]`, each a fully-priced sellable SKU; plus `variants.showSwatch` and `supplement.skus`.
4. **Pricing** — `price`, `prices[]` (multi-currency), `priceRange`, `displayPriceRange`, `onSale`, `percentageSaving`.
5. **Availability & purchase rules** — `inStock`, `showBackInStock`, `outOfStockMessage`, `maxPerCustomer`, `isRestricted`, `saleablePlatform`, `newStock`, `backInStock`, `comingSoon`.
6. **Media & rich content** — `media.images[]`, `media.video`, `enhancedMediaZones[]`, `accentColour`.
7. **Discovery / beauty facets** — `attraqt.category`, `attraqt.productType`, `attraqt.facets[]` (third-party search/merchandising payload).
8. **Commerce surface concerns** — `reviewSummary`, `promoText[]`, `sticker`, `seoData`, `showOptions`, `deliveryCountdown`, plus loyalty (`tribe*`) and localization (`languagesUsingFallback`).

**Inferred.** This is an **aggregation/read-model** shape: one HTTP response assembled from several backend concerns so the PDP renders in a single round-trip. The third-party `attraqt` block strongly suggests catalog search/merchandising is served by a separate system (Attraqt/Fredhopper) and merged into the response — i.e. discovery facets are **not** necessarily stored on the product record itself.

---

## 3. Observed Product Hierarchy

**Confirmed** two-level hierarchy:

```
Parent Product  (parentProductId: 6r3KBSErcZMMAKFLv6BNNN, name "Renew + Smooth Serum")
│   shared identity: name, description, ingredients, directions, brand,
│   category, productType, media gallery, SEO, facets
│
├─ Sellable Variant / SKU  BFBB0426F   "45ml"      price £3.95 (was £10.00)  inStock
└─ Sellable Variant / SKU  BFBB0806F   "2 x 45ml"  price £16.00              outOfStock
```

Per-variant the response carries: `sku`, `url` (slug fragment `"45"` / `"2-x-45ml"`), `measurement`, `shadeDescription`, `swatch`, `imageUrl`, and a full nested `price` object with its own `originalAmount`/`itemPrice`/`displayPrice`.

**Confirmed observations:**
- **Price, availability, image, and variation details (size/shade) are variant-level**, not parent-level. The two variants differ in price (£3.95 vs £16.00), stock bucket (in vs out), measurement, and image.
- The **top-level** `sku`, `price`, and `inStock` mirror the *selected/default* variant (`BFBB0426F`). The PDP picks a default sellable SKU and elevates its commercial fields to the root.
- `variationType: "size"` declares **how** this product varies. A shade product would presumably carry `variationType: "shade"` with populated `swatch`/`shadeDescription` (**inferred** — not observed here).
- `supplement.skus: ["BFBB0426F"]` and `supplement.reviewProductInfo` key data by SKU — **inferred** that reviews and related data attach at SKU/variant level keyed by SKU.

**Inferred architecture needed to support this response:**
- A **parent product** entity owning shared content.
- A **sellable variant/SKU** entity owning price, stock state, measurement, shade, and its own image.
- A **variant→parent** relation (`parentProductId`).
- This maps cleanly onto our existing `Product` → `ProductReference` split (**Target decision**: keep that split; it is the right backbone).

---

## 4. Field-by-Field Structure Analysis

`Logical Domain Layer` values are restricted to the allowed list. `Confirmed / Inferred` reflects whether the field's *purpose* is directly visible or reasoned.

| JSON Path | Observed Purpose | Confirmed / Inferred | Logical Domain Layer | Relevance to Our Store | Recommended Scope |
|---|---|---|---|---|---|
| `sku` | Selected sellable variant identity (root) | Confirmed | ProductReference / sellable SKU | High — our `ProductReference.sku` exists | MVP adoption |
| `parentProductId` | Links variant to catalog parent | Confirmed | Product master data | High — our `Product.id` ↔ `ProductReference.productId` | MVP adoption |
| `name` | Product display name | Confirmed | Product master data | High — `Product.name` | MVP adoption |
| `description` | Long marketing/markdown body | Confirmed | Product-level content | High — `Product.description` (single field today) | MVP adoption |
| `ingredients` | Skincare/makeup ingredient list | Confirmed | Product-level content | High for skincare | MVP adoption |
| `directions` | Usage / warnings text | Confirmed | Product-level content | High for skincare | MVP adoption |
| `measurement` (root) | Size of selected variant (`45ml`) | Confirmed | ProductReference / sellable SKU | High — size variants | MVP adoption |
| `shadeDescription` (root) | Shade descriptor of selected variant (null here) | Confirmed (field) / Inferred (shade use) | ProductReference / sellable SKU | High for makeup | MVP adoption |
| `variationType` | Declares variant axis: `"size"` | Confirmed | ProductReference / sellable SKU | High — size vs shade | MVP adoption |
| `accentColour` | PDP theming hex (`#FFFFFF`) | Confirmed | Frontend display configuration | Low | Not needed |
| `comingSoon` | Pre-launch flag (null) | Confirmed | Stock and availability | Low for MVP | Future adoption |
| `outOfStockMessage` | Custom OOS copy (null) | Confirmed | Stock and availability | Medium | Phase-two adoption |
| `brand.name` / `brand.slug` / `brand.lookupName` | Brand identity + slug | Confirmed | Catalog taxonomy | High — `Brand` (needs slug) | MVP adoption |
| `category` / `categoryName` | Category code/label (`skincare`) | Confirmed | Catalog taxonomy | High — `Category` | MVP adoption |
| `productType` | Sub-classification (`Face Serums`) | Confirmed | Catalog taxonomy | High — we lack this | Phase-two adoption |
| `media.images[]` | Ordered product gallery | Confirmed | Product media | High — `ProductImage` | MVP adoption |
| `media.video` | Product video (null) | Confirmed | Product media | Low — `MediaAssetType` is IMAGE-only | Future adoption |
| `variants.inStock[]` | Purchasable variants in stock | Confirmed | ProductReference / sellable SKU | High | MVP adoption |
| `variants.outOfStock[]` | Variants out of stock (still shown) | Confirmed | Stock and availability | High | MVP adoption |
| `variants[].swatch` | Shade swatch (null here) | Confirmed (field) | ProductReference media | High for makeup | MVP adoption |
| `variants[].url` | Variant slug fragment | Confirmed | Derived response value | Medium | Phase-two adoption |
| `variants[].imageUrl` | Per-variant image | Confirmed | ProductReference media | High | MVP adoption |
| `variants[].price.*` | Per-variant price object | Confirmed | Price | High | MVP adoption |
| `variants.showSwatch` | Whether to render swatches | Confirmed | Frontend display configuration | Medium (derivable) | Phase-two adoption |
| `supplement.skus[]` | SKUs relevant to this PDP | Confirmed | Derived response value | Low | Not needed |
| `supplement.reviewProductInfo` | Per-SKU review metadata | Confirmed | Reviews | Low for MVP | Future adoption |
| `price.itemPrice` | Numeric selected price (3.95) | Confirmed | Price | High — keep numeric | MVP adoption |
| `price.originalItemPrice` | Numeric pre-sale price (10) | Confirmed | Price | High — compare-at | Phase-two adoption |
| `price.amount` / `displayPrice` | Pre-formatted strings | Confirmed | Derived response value | Medium — derive, don't store | MVP adoption (derived) |
| `price.itemCurrency` | Currency of price (GBP) | Confirmed | Price | High — ours is MAD | MVP adoption |
| `prices[]` | Full multi-currency price list | Confirmed | Price | Low — single MAD for MVP | Future adoption |
| `priceRange` / `displayPriceRange` | Range when variants differ (null) | Confirmed | Price | Medium — useful for size sets | Phase-two adoption |
| `onSale` | Boolean sale flag | Confirmed | Promotion | Medium | Phase-two adoption |
| `percentageSaving` | Computed % saved (60) | Confirmed | Derived response value | Medium | Phase-two adoption |
| `inStock` (root) | Selected-variant availability | Confirmed | Stock and availability | High | MVP adoption |
| `showBackInStock` | Render back-in-stock CTA | Confirmed | Stock and availability | Low for MVP | Future adoption |
| `backInStock` / `newStock` | Restock / new flags | Confirmed | Stock and availability | Low | Future adoption |
| `maxPerCustomer` | Purchase cap (5) | Confirmed | Delivery / operations | Medium | Phase-two adoption |
| `isRestricted` | Restricted-item flag | Confirmed | Delivery / operations | Low for MVP | Future adoption |
| `saleablePlatform` | Web/app saleability (`both`) | Confirmed | Frontend display configuration | Not needed (single web) | Not needed |
| `reviewSummary.count` / `overallRating` | Aggregate rating (189 / 4.7) | Confirmed | Reviews | Medium long-term | Future adoption |
| `attraqt.category` / `productType` | Search-index taxonomy | Confirmed | Analytics / external integration | Medium — informs our facets | Phase-two adoption |
| `attraqt.facets[]` | Beauty facets: concern, skinType, formulation, preference, ingredients-conscious, feature | Confirmed | Beauty attributes and facets | **Very High** — maps to our attributes/quiz | MVP adoption (subset) |
| `attraqt.currency` | Search-index currency tag | Confirmed | Analytics / external integration | Low | Not needed |
| `seoData.metaTitle` / `metaDescription` | SEO meta | Confirmed | SEO | High — we lack it | Phase-two adoption |
| `seoData.canonical` | Canonical URL | Confirmed | SEO | Medium | Phase-two adoption |
| `seoData.structuredMarkup.breadcrumbs` | JSON-LD breadcrumb | Confirmed | SEO | Low for MVP | Future adoption |
| `sticker` | Badge/sticker (null) | Confirmed | Promotion | Low | Future adoption |
| `promoText[]` | Promo banners w/ locale, T&Cs | Confirmed | Promotion | Medium long-term | Future adoption |
| `calloutAnimation` | Animated callout (null) | Confirmed | Frontend display configuration | Not needed | Not needed |
| `languagesUsingFallback[]` | i18n fallback markers | Confirmed | Frontend display configuration | Not needed (single locale) | Not needed |
| `exclusive` / `tribeExclusive` / `tribe*` | Loyalty/exclusivity | Confirmed | Promotion | Not needed | Not needed |
| `hideDescription` | Suppress description block | Confirmed | Frontend display configuration | Low | Not needed |
| `enhancedMediaZones[]` | Rich CMS content blocks | Confirmed | Product media | Low for MVP | Future adoption |
| `showOptions.*` | Toggle PDP sections | Confirmed | Frontend display configuration | Low — derivable | Future adoption |
| `deliveryCountdown.*` | Next-day cutoff messaging | Confirmed | Delivery / operations | Not needed (COD/Morocco) | Not needed |

**Unclear / requires business decision:** none of the observed fields are semantically opaque, but the *shade* fields (`swatch`, `shadeDescription`, `showSwatch`, `variationType: "shade"`) are only **inferred** in behaviour because the captured product is size-only.

---

## 5. How the Beauty Bay Product Experience Likely Works

Steps labelled **Confirmed** are directly supported by the sample; **Inferred** are architecture-level reasoning.

1. **Customer opens a product URL.** *(Inferred)* The canonical form `/p/beauty-bay/renew-smooth-serum/` (**Confirmed** in `seoData.canonical`) resolves to a parent product, and the variant `url` fragments (`"45"`, `"2-x-45ml"`) select a SKU.
2. **Backend resolves a selected sellable SKU + parent context.** *(Confirmed)* The root carries one `sku` plus `parentProductId`; the selected SKU's commercial fields are elevated to the root while siblings remain in `variants`.
3. **Frontend receives one aggregated PDP response.** *(Confirmed)* All eight concerns (§2) arrive together; *(Inferred)* assembled server-side from catalog + pricing + stock + a third-party search/facet system (`attraqt`).
4. **Customer changes size/shade/bundle.** *(Inferred)* The frontend swaps the selected entry from `variants.inStock`/`variants.outOfStock`, re-reading that variant's `price`, `imageUrl`, `measurement`, `swatch`, and stock bucket — no second network call required because all variants are pre-loaded.
5. **Frontend updates SKU, image, price, availability, add-to-cart.** *(Confirmed structurally)* Each variant object is self-sufficient (own price + image + stock bucket), so the UI can re-render purely client-side. Out-of-stock variants are still rendered (present in `variants.outOfStock`) but presumably disable add-to-cart and may show `showBackInStock`.
6. **Cart receives the selected SKU, not the parent.** *(Inferred)* Because price/stock are SKU-level and the root identity is a SKU, the add-to-cart unit must be the SKU/variant. *(Confirms our design principle: the customer adds a `ProductReference`.)*
7. **Order preserves a historical snapshot of the SKU + commercial details.** *(Inferred — not in this PDP sample, but architecturally required)* Prices change (`onSale`, `percentageSaving`) and variants go out of stock, so an order must freeze name, SKU, measurement/shade, and unit price at purchase time to remain readable later.

---

## 6. Most Important Patterns Worth Reusing

1. **Parent product vs sellable SKU separation** *(Confirmed)* — exactly our `Product` → `ProductReference` model. Keep it; it is the single most validated decision.
2. **Variant-level price, stock bucket, image, and measurement/shade** *(Confirmed)* — each sellable unit is self-describing. Our references already hold price override/delta, stock, swatch image; we should ensure the storefront response carries the full per-reference commercial object like Beauty Bay's `variants[].price`.
3. **Numeric price + separately derived display strings** *(Confirmed)* — `itemPrice: 3.95` (numeric) alongside `amount: "£3.95"` (formatted). **Target decision:** store numeric MAD only; format in the response layer, never persist formatted text.
4. **Compare-at / original price + on-sale derivation** *(Confirmed)* — `originalItemPrice`, `onSale`, `percentageSaving` are computed from a numeric original price. **Target decision:** model an optional original/compare-at price; derive `onSale` and `% saving`.
5. **Beauty facets as a structured, multi-group set** *(Confirmed)* — `attraqt.facets[]` groups by `concern`, `skinType`, `formulation`, `preference`, `ingredients-conscious`, `feature`. This is conceptually our `AttributeGroup` + `AttributeOption` model. **Target decision:** treat these facet groups as the catalog-side mirror of our quiz attributes for filtering and recommendation.
6. **Out-of-stock variants stay visible** *(Confirmed)* — product remains browsable with one variant OOS. Matches our principle that a Product stays visible when a single reference is unavailable.
7. **Split content sections** *(Confirmed)* — `description`, `ingredients`, `directions` are distinct fields with `showOptions` toggles. **Target decision:** split our single `Product.description` into structured content fields.
8. **SEO metadata distinct from slug** *(Confirmed)* — `seoData.metaTitle`/`metaDescription`/`canonical` separate from the URL. **Target decision:** add SEO fields later, distinct from `slug`.
9. **Purchase caps** *(Confirmed)* — `maxPerCustomer: 5`. Cheap to model; useful against COD abuse.

---

## 7. Beauty Bay Features We Should Not Copy Yet

All **Confirmed** present in the sample but **deferred** for our MVP:

- **Multi-currency pricing** (`prices[]` lists ~30 currencies). We are single-currency MAD.
- **International localization / fallback** (`languagesUsingFallback`, locale-scoped `promoText`).
- **Complex promotion engine** (`promoText[]` with header/T&Cs/locale/destination, `sticker`).
- **Review system** (`reviewSummary`, `supplement.reviewProductInfo`).
- **Back-in-stock subscriptions** (`showBackInStock`, `backInStock`).
- **Loyalty / tribe** (`tribe`, `tribePoints`, `tribeExclusive`, `exclusive`).
- **Rich enhanced media zones** (`enhancedMediaZones[]` CMS blocks).
- **Product video** (`media.video`) — our `MediaAssetType` is IMAGE-only.
- **Advanced SEO structured data** (`structuredMarkup` JSON-LD breadcrumbs).
- **Platform-specific saleability** (`saleablePlatform: "both"`).
- **Next-day delivery countdown** (`deliveryCountdown`) — irrelevant to Morocco COD.
- **Restricted-item handling** (`isRestricted`).
- **Coming-soon pre-launch** (`comingSoon`).

**Target decision:** reserve clean extension points (a promotions domain, a reviews domain, SEO fields, a multi-currency price table, a media `assetType` already in place) so these can be added without reshaping the core product model.

---

## 8. Constraints and Risks of Using This Reference

1. **Single sample, single variant axis.** Only `variationType: "size"` is observed. Shade/swatch behaviour is **inferred**. Risk: over-fitting a size example onto makeup shades. *Mitigation:* treat `swatch`/`shadeDescription`/`variationType` as first-class but validate shade UX against a real makeup product later.
2. **Read model ≠ data model.** The flat denormalized response hides normalization. Treating any field as a "Beauty Bay column" would be wrong. *Mitigation:* every §4 row is tagged by **logical layer**, not table.
3. **Third-party coupling.** `attraqt.*` indicates discovery/facets come from an external search platform. We should **not** assume facets live on the product row; we already model them relationally (`ProductReferenceAttribute`). *Mitigation:* keep facets relational; optionally project them into responses.
4. **Derived vs stored ambiguity.** Many fields (`percentageSaving`, `displayPrice`, `priceRange`, `showOptions`, `inStock`) are clearly **derived**. Persisting them would create drift. *Mitigation:* compute in the response layer.
5. **Currency/locale assumptions baked in.** GBP/EUR/locale fallbacks are irrelevant and could mislead modelling. *Mitigation:* explicitly out-of-scope for MVP (§7).
6. **No cart/order shape in sample.** The snapshot/checkout behaviour (§5 step 7) is entirely **inferred**. *Mitigation:* ground order-snapshot decisions in our own `OrderItem` code, not this PDP.
7. **No admin shape in sample.** This is a customer read model; it says nothing about admin authoring. *Mitigation:* derive admin needs from our `admin-products`/`product-references` controllers, not here.

---

## 9. Summary for Our Product Domain Redesign

The Beauty Bay PDP **validates the backbone we already have**: a parent **Product** (shared identity, content, media, taxonomy, facets) over sellable **variant/SKU** units (own price, stock state, image, and size/shade), assembled into one rich read model at request time.

The clearest, lowest-risk lessons to carry into our redesign:

- **Keep `Product` → `ProductReference`** as parent vs sellable SKU; the customer always buys a reference. **(Confirmed alignment.)**
- **Make the storefront PDP an aggregation** of product + selected reference + all references + price + stock + media + taxonomy + facets, not a fat table. **(Confirmed pattern.)**
- **Keep price numeric (MAD)**; derive formatted/`onSale`/`% saving`. Add an optional original/compare-at price. **(Confirmed pattern.)**
- **Split content** into `description` / `ingredients` / `directions` and add **`productType`** and **SEO** fields. **(Confirmed gaps vs our schema.)**
- **Beauty facets** (concern, skin type, formulation, finish/coverage, tone, undertone) belong in our relational attribute model — some at **Product** level (general suitability), some at **ProductReference** level (shade-specific tone/undertone). **(Confirmed need; ownership is our Target decision — see Deliverable 2.)**
- **Defer** multi-currency, reviews, promotions engine, loyalty, enhanced media, delivery countdowns — but reserve extension points. **(Confirmed deferrable.)**

**Evidence**
- `docs/reference/beauty-bay-product-object-sample.json` - `parentProductId`, root `sku`, `variants.inStock[]`, `variants.outOfStock[]`, `variants[].price`, `variants[].measurement`, `variants[].swatch`, `variants[].imageUrl`, `media.images[]`, `attraqt.facets[]`, `seoData`, `reviewSummary`, `promoText[]`, `deliveryCountdown`.
- `prisma/schema.prisma` - `model Product`, `model ProductReference`, `model ProductImage`, `model ProductReferenceImage`, `model ProductAttribute`, `model ProductReferenceAttribute`, `model OrderItem`.
- `docs/PRODUCT_OBJECT_CURRENT_STATE_ANALYSIS.md` - parent/reference split, media duplication, stock risk, order snapshot risk, packs, and recommendations.
- `src/modules/products/products.service.ts` - public product aggregation, image projection, suitability projection, and public stock signal.
- `src/modules/recommendations/recommendation-engine.service.ts` - selected reference scoring and availability check.

The detailed adaptation, ownership matrix, and lifecycle are specified in `docs/PRODUCT_DOMAIN_TARGET_CONCEPTION.md`; the safe rollout is in `docs/PRODUCT_DOMAIN_REDESIGN_MASTER_PLAN.md`.
