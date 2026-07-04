# Admin Guide: Products, References, and Recommendation Rules

This is a practical, step-by-step guide for setting up catalog data so the
recommendation engine scores packs correctly. It uses the real DTO fields
and endpoint paths from the current backend.

Engine source of truth: `src/modules/recommendations/recommendation-engine.service.ts`

## 0. Mental model

```
AttributeGroup (e.g. SKIN_COLOR)
  -> AttributeOption (e.g. LIGHT, MEDIUM, DARK)

Quiz question -> asks customer to pick an AttributeOption for a group
Customer answer -> stored as { groupCode: optionCode }

Product -> has ProductReference(s) (variants/shades)
  ProductReference -> has ReferenceAttribute rows (compatibility with options)

Pack -> bundles Product(s) via PackItem
  Pack -> has PackAttribute rows (compatibility with options)

RecommendationRule -> base score per attribute group (overrides engine defaults)
```

When a recommendation runs, the engine compares the customer's answers
against **PackAttribute** rows (pack-level score) and **ReferenceAttribute**
rows (which variant gets picked + item score). Everything else (Product,
Category, Brand) is just catalog metadata with no scoring effect.

## 1. Create the attribute group and options first

You cannot score anything until the `AttributeGroup` and its `AttributeOption`s exist.

`POST /admin/attributes`
```json
{
  "code": "SKIN_COLOR",
  "name": "Skin Color",
  "isCustomerAttribute": true,
  "isProductAttribute": true,
  "isActive": true
}
```

`POST /admin/attributes/:attributeGroupId/options`
```json
{ "code": "LIGHT", "label": "Light", "isActive": true }
```
Repeat for `MEDIUM`, `DARK`, etc.

Important: `code` must be `UPPER_SNAKE_CASE` (validated by
`/^[A-Z][A-Z0-9_]*$/`). This code is what you reference everywhere else.

Built-in groups the engine already knows about (have default scores even
with no `RecommendationRule`): `SKIN_COLOR`, `UNDERTONE`, `STYLE`,
`SKIN_TYPE`, `BUDGET`. Any other group code (e.g. `COVERAGE`) scores 0
unless you add a matching rule (see step 4).

## 2. Create the product and its references

A `Product` (e.g. "Foundation X") has no scoring fields itself — scoring
happens on its `ProductReference`s (the actual shades/variants).

`POST /admin/products`
```json
{
  "categoryId": "<category-uuid>",
  "brandId": "<brand-uuid>",
  "name": "Foundation X",
  "slug": "foundation-x",
  "basePrice": 120,
  "currency": "MAD",
  "status": "ACTIVE",
  "isActive": true
}
```

`POST /admin/products/:productId/references`
```json
{
  "referenceCode": "RF2",
  "referenceName": "Medium Warm",
  "stockQuantity": 20,
  "isActive": true,
  "attributes": [
    {
      "attributeGroupCode": "SKIN_COLOR",
      "attributeOptionCode": "MEDIUM",
      "matchType": "COMPATIBLE",
      "scoreValue": 40,
      "isHardFilter": false
    },
    {
      "attributeGroupCode": "UNDERTONE",
      "attributeOptionCode": "WARM",
      "matchType": "BOOST",
      "scoreValue": 10,
      "isHardFilter": false
    }
  ]
}
```

Notes on `attributes[]` (`ReferenceAttributeInputDto`):
- `attributeGroupCode` / `attributeOptionCode` — must match existing codes from step 1.
- `matchType`:
  - `COMPATIBLE` — normal match, adds score when the customer's answer equals this option.
  - `BOOST` — same scoring behavior as `COMPATIBLE` in the current engine; use it to signal "this is an extra-good match" semantically, but functionally it adds the same way.
  - `NOT_COMPATIBLE` — defines an explicit mismatch. If the customer's answer equals this option, the engine does **not** add score for this row (it's skipped). Only matters in practice when combined with `isHardFilter: true` (see below).
- `scoreValue` — added on top of the group's base score (from `RecommendationRule` or fallback) **only if the customer's answer matches** `attributeOptionCode`. Negative values are ignored by the engine (treated as 0 bonus, `safePositiveScore`).
- `isHardFilter: true` with `NOT_COMPATIBLE` — if the customer's answer matches this option, **this reference cannot be auto-selected at all** in `AUTO_BEST_REFERENCE`/`CUSTOMER_CHOICE` mode (it's excluded). Use this for genuine incompatibilities (e.g. don't recommend a `DARK`-shade-only reference to a `LIGHT` skin tone match if you never want it suggested for any other reason).

  Caution: at reference level, `isHardFilter` only filters within `selectReference`'s candidate list (a reference simply won't be picked); it does not reject the whole pack the way pack-level hard filters do.

If a reference has **no** attribute rows that match the customer's answers,
it can still be picked (e.g. as the only option, or via `FIXED_REFERENCE`)
but contributes 0 to `itemScore` and is excluded from the pack's averaged
item score (`scoredForAverage: false`).

## 3. Build the pack

`POST /admin/packs`
```json
{
  "name": "Natural Glow Pack",
  "slug": "natural-glow-pack",
  "priceMode": "SUM_ITEMS",
  "priority": 5,
  "status": "ACTIVE",
  "isActive": true,
  "items": [
    {
      "productId": "<foundation-x-product-uuid>",
      "selectionMode": "AUTO_BEST_REFERENCE",
      "quantity": 1,
      "isRequired": true,
      "sortOrder": 0
    }
  ],
  "attributes": [
    {
      "attributeGroupCode": "STYLE",
      "attributeOptionCode": "NATURAL",
      "matchType": "COMPATIBLE",
      "scoreValue": 20,
      "isHardFilter": false
    }
  ]
}
```

### `items[]` (`PackItemInputDto`) — controls which reference gets used

- `selectionMode`:
  - `FIXED_REFERENCE` — always uses `productReferenceId` you specify. No scoring competition between references; if that reference is unavailable (inactive or out of stock), the item fails.
  - `AUTO_BEST_REFERENCE` — engine scores every active, in-stock reference of the product against the customer's answers and picks the highest scorer (ties broken alphabetically by reference name).
  - `CUSTOMER_CHOICE` — scored identically to `AUTO_BEST_REFERENCE` by the engine today; intended for future "let the customer pick" UI, but current engine still auto-picks the best-scoring one.
- `isRequired: true` — if this item can't resolve to a valid reference (or the product is inactive/not `ACTIVE`), **the entire pack is rejected** from recommendations. Set `false` only for genuinely optional add-ons.
- `quantity` — used for order totals, not scoring.

### `attributes[]` (`PackAttributeInputDto`) — controls the pack-level score

Same shape and semantics as reference attributes, but evaluated once per
pack (not per item):

- `matchType: COMPATIBLE` / `BOOST` + customer match → adds `(group base score + scoreValue)` to the pack's score.
- `matchType: NOT_COMPATIBLE` + customer match + `isHardFilter: true` → **pack is excluded entirely** from recommendations for this customer.
- Any attribute (any matchType) with `isHardFilter: true` that the customer's answer does **not** match → **pack is excluded entirely** (mismatch on a hard-filter requirement disqualifies the pack, regardless of `matchType`).
- `isHardFilter: false` (default) — mismatches just mean "no bonus," never a rejection.

Use pack-level hard filters for "this pack absolutely requires X" rules
(e.g. a sensitive-skin pack hard-filtering on `SKIN_TYPE = SENSITIVE`).

### `priority`

Flat bonus added to every score for this pack, regardless of any matching.
Use it to nudge a promoted/featured/higher-margin pack up the ranking when
scores are otherwise close. It does not depend on customer answers.

## 4. (Optional) Override default scoring weights with Recommendation Rules

You only need this if you want to change the base point value for a group,
or add scoring for a brand-new group beyond the 5 built-ins.

`POST /admin/recommendation-rules`
```json
{
  "code": "STYLE_MATCH",
  "name": "Style match",
  "targetType": "PACK",
  "conditionType": "SHOULD_MATCH",
  "scoreValue": 25,
  "weight": 1,
  "isActive": true
}
```

Critical rule: **`code` must equal `${groupCode}_MATCH`** for the built-in
mapping, or literally `${groupCode}_MATCH` for any other group (the engine
falls back to this pattern automatically). Example: a `COVERAGE` group
needs a rule coded `COVERAGE_MATCH`.

- `effectiveScore = scoreValue * weight` (rounded) — this becomes the "base
  score" added whenever a customer's answer matches that group, on top of
  whatever `scoreValue` you set on the individual `PackAttribute` /
  `ReferenceAttribute` row.
- `targetType` and `conditionType` are stored and shown in the admin UI but
  **not currently read by the scoring engine** — don't rely on them to
  change behavior yet.
- If you don't create a rule for a group, the engine uses hardcoded
  fallbacks: `SKIN_COLOR=40, UNDERTONE=25, STYLE=20, SKIN_TYPE=15, BUDGET=10`.
  Any other group with no rule scores 0 base (only the row-level `scoreValue`
  would apply, if matched).

## 5. Verify before trusting it live

Use the preview endpoint — it runs the exact same engine without saving
anything:

`POST /admin/recommendation-rules/preview`
```json
{ "customerProfileId": "<existing-profile-id>" }
```

The response's `reason` object on each pack shows the full breakdown:
`packScore`, `rawItemsScore`, `normalizedItemsScore`, `priorityBonus`,
`packMatches` (per-group match detail), and `details.exclusions` (why
optional items/packs got dropped). Use this to confirm your attribute rows
produce the ranking you expect before going live.

## Quick checklist for adding a new recommendable product

1. Confirm the attribute groups/options you need already exist (step 1).
2. Create the product (`ACTIVE`, `isActive: true`).
3. Create at least one reference per relevant variant, with `attributes[]`
   covering every group you want it to score on.
4. Add/edit the pack that should include this product as a `PackItem`.
5. Add `PackAttribute` rows on the pack for group-level compatibility.
6. If introducing a new attribute group, add a `RecommendationRule` coded
   `${GROUP}_MATCH`.
7. Run `POST /admin/recommendation-rules/preview` with a real profile and
   check the `reason` breakdown matches your intent.
