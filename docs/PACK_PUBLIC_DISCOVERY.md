# Pack Public Discovery (Phase 4A)

> **Scope:** Public catalog discovery and availability for existing (fixed) Packs.
> **Companion to** [PACK_CORE_EVOLUTION_MASTER_PLAN.md](./PACK_CORE_EVOLUTION_MASTER_PLAN.md) (Phase 4)
> and [PACK_CORE_EVOLUTION_PROGRESS.md](./PACK_CORE_EVOLUTION_PROGRESS.md).
>
> **This phase is discovery only.** Direct Pack purchase (`POST /packs/:id/order`),
> cart/checkout changes, stock reservation, pricing changes, `PackConfiguration`,
> customization, wishlist/sharing, and recommendation logic are **out of scope**
> (Phase 4B and later).

---

## 1. What changed

Existing fixed Packs are now discoverable through the public API via optional
filters, sorting, pagination, and a browsing-only availability flag. Everything is
**additive and backward-compatible**.

### Additive discovery fields on `Pack`

Migration: `20260701005043_pack_public_discovery_fields` (applied).

| Field | Type | Notes |
| --- | --- | --- |
| `categoryId` → `category` | `Category?` (FK, `ON DELETE SET NULL`) | **Reuses** the shared `Category` entity — no `PackCategory` duplication. |
| `tier` | `PackTier?` (`ESSENTIAL`, `PREMIUM`, `LUXE`) | Coarse marketing tier. |
| `occasion` | `PackOccasion?` (`EVERYDAY`, `WORK`, `EVENING`, `PARTY`, `WEDDING`, `SPECIAL_EVENT`) | Primary marketing occasion. |
| `experienceLevel` | `PackExperienceLevel?` (`BEGINNER`, `INTERMEDIATE`, `EXPERT`) | Target skill level. |
| `isFeatured` | `Boolean` (default `false`) | Merchandising flag. |
| `isNew` | `Boolean` (default `false`) | Merchandising flag. |
| `isBestSeller` | `Boolean` (default `false`) | Merchandising flag. |
| `tags` | `String[]` (default `[]`) | Free-form discovery tags. |
| `searchKeywords` | `String?` | Extra text matched by free-text search. |

All discovery columns are indexed for filter performance.

**Why a discovery `occasion` when `PackCompatibilityProfile` already models occasion?**
They are deliberately distinct. `PackCompatibilityProfile` expresses the full
*suitability set* consumed by the recommendation engine (scoring/eligibility). The
discovery `occasion`/`tier`/`experienceLevel` are single coarse *browsing* facets
and are never used for scoring, pricing, or eligibility. Compatibility data is not
duplicated.

---

## 2. `GET /packs` — public catalog discovery

### Backward compatibility (contract-preserving)

- **No query parameters ⇒ unchanged behavior:** returns the legacy **plain array**
  of active packs (byte-for-byte the previous response; no `availableNow`, no
  pagination envelope).
- **Any filter/pagination parameter ⇒ paginated envelope:** returns
  `{ data, pagination }` where each item additionally carries an `availableNow`
  boolean. This is additive — it does not alter the no-parameter contract.
- Only **active/public** packs (`status = ACTIVE` and `isActive = true`) are ever
  returned, in both modes.

### Query parameters (all optional, all additive)

| Param | Type | Behavior |
| --- | --- | --- |
| `category` | string | Match `Category.code` (case-insensitive). |
| `tier` | `PackTier` | Exact match. |
| `occasion` | `PackOccasion` | Exact match. |
| `experienceLevel` | `PackExperienceLevel` | Exact match. |
| `customizable` | boolean | `true` → only customizable; `false` → only fixed. |
| `availableNow` | boolean | `true` → only packs available now; `false` → only unavailable. |
| `featured` | boolean | `true` → only `isFeatured` packs. |
| `tags` | string[] | Match packs carrying **any** listed tag (`hasSome`). Repeat the param or pass a comma-separated list. |
| `search` | string | Case-insensitive `contains` over `name`, `slug`, `searchKeywords`, `description`. |
| `sort` | enum | `featured` \| `newest` \| `price_asc` \| `price_desc` \| `priority` (default) \| `name`. |
| `page` | int (≥1) | Page number (default `1`). |
| `limit` | int (1–100) | Page size (default `20`). |

### Sort mapping

| `sort` | Order |
| --- | --- |
| `priority` (default) | `priority desc`, `createdAt desc` |
| `featured` | `isFeatured desc`, `priority desc`, `createdAt desc` |
| `newest` | `createdAt desc` |
| `price_asc` | `fixedPrice asc`, `createdAt desc` |
| `price_desc` | `fixedPrice desc`, `createdAt desc` |
| `name` | `name asc` |

### Response envelope (filtered mode)

```jsonc
{
  "data": [
    {
      "id": "…",
      "name": "Natural Glow Pack",
      "tier": "PREMIUM",
      "occasion": "EVERYDAY",
      "experienceLevel": "BEGINNER",
      "isFeatured": true,
      "tags": ["natural", "glow"],
      "category": { "id": "…", "code": "FACE", "name": "Face" },
      "availableNow": true,
      "items": [ /* … */ ]
    }
  ],
  "pagination": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }
}
```

---

## 3. Availability calculation (browsing only)

Reusable, side-effect-free helper: [`pack-availability.util.ts`](../src/modules/packs/pack-availability.util.ts)
(`isPackAvailableNow`).

A Pack is **available now** when:

1. it is active/public (`status = ACTIVE` and `isActive = true`), **and**
2. every **blocking** item (role `FIXED` or `REQUIRED_SELECTABLE`) has at least one
   valid, **active** reference with **available stock ≥ the item's required
   quantity**.

Rules:

- **Optional items (`OPTIONAL_INCLUDED`) and add-ons (`OPTIONAL_ADDON`) never block
  availability.**
- A pinned `FIXED_REFERENCE` is the *sole* candidate for its slot; otherwise the
  product's active references are the candidate set.
- Available stock = `stockQuantity − reservedQuantity` (never negative).
- **No stock is reserved and checkout behavior is unchanged.** This is a read-only
  browsing signal.
- Reserved-stock counts are stripped from public reference output (no leak).

---

## 4. Admin write

Discovery fields are settable through the existing admin Pack create/update DTOs
(additive optional fields). A `categoryId` is validated to reference an existing
`Category`. Defaults reproduce current behavior, so existing packs are unaffected.

---

## 5. Tests

- [`pack-availability.util.spec.ts`](../src/modules/packs/pack-availability.util.spec.ts) —
  availability rule: active/public gate, fixed-reference vs. candidate set,
  quantity coverage, optional items do not block, required unavailable items block.
- [`packs.service.public.spec.ts`](../src/modules/packs/packs.service.public.spec.ts) —
  each public filter, combined filters, search, sort, `availableNow` true/false,
  no-filter backward compatibility, pagination, and reserved-stock non-leak.

---

## 6. Out of scope — remaining Phase 4B work

- `POST /packs/:id/order` (direct fixed-Pack purchase → priced lines, stock
  reservation, line + pack-config snapshots, `OrderItem.packId`).
- Cart/checkout changes and stock reservation changes.
- Pack pricing changes, `PackConfiguration`, customization.
- Wishlist / sharing, recommendation logic, frontend work.
