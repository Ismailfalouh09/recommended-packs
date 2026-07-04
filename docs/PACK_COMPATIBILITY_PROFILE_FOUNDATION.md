# Pack Compatibility Profile Foundation (Phase 2.5)

> **Status:** Foundation-only. This document describes additive data introduced
> after [Phase 2](./PACK_ITEM_ROLE_FOUNDATION.md) in the
> [Pack Core Evolution Master Plan](./PACK_CORE_EVOLUTION_MASTER_PLAN.md).
> Every structure below is **persisted and returned through the admin Pack APIs
> but inert in runtime business logic.** Nothing here activates recommendation
> scoring, ranking, filtering, customer configuration, checkout, cart, or
> generated Packs.

---

## 1. The chosen compatibility data model

A **dedicated, normalized relation** was added — not an overload of
`PackAttribute`:

```text
enum PackCompatibilityCriterion { SKIN_TONE, SKIN_TYPE, MAKEUP_STYLE, BUDGET, OCCASION }
enum PackCompatibilityMode      { UNIVERSAL, RESTRICTED }

PackCompatibilityProfile        (one row per pack + criterion)
├── id
├── packId            → Pack (cascade delete)
├── criterion         PackCompatibilityCriterion
├── mode              PackCompatibilityMode @default(RESTRICTED)
├── createdAt / updatedAt
└── @@unique([packId, criterion])

PackCompatibilityValue          (allowed canonical values for a RESTRICTED criterion)
├── id
├── profileId         → PackCompatibilityProfile (cascade delete)
├── attributeOptionId → AttributeOption (restrict delete)
├── createdAt
└── @@unique([profileId, attributeOptionId])
```

Each value is a **foreign key to a canonical `AttributeOption`** — the same
records the quiz uses. There is no free text, and the only criterion→group
mapping lives in one place:
[`pack-compatibility.constants.ts`](../src/modules/packs/pack-compatibility.constants.ts).

---

## 2. Why a dedicated relation (and not `PackAttribute` / new quiz values)

- **`PackAttribute` is already live in the recommendation engine.** It is read by
  `loadActivePacks` and scored/hard-filtered in `recommendation-engine.service`.
  Writing compatibility data as `PackAttribute` rows would **immediately change
  runtime recommendation scoring/filtering**, which this task explicitly forbids.
  A separate table that the engine does not read keeps the profile inert.
- **`PackAttribute` cannot cleanly express the required semantics:** it has no
  five-dimension constraint, no `UNIVERSAL`/`RESTRICTED` applicability mode, and
  no way to distinguish "unconfigured" from "universal".
- **Single source of truth is preserved without duplication.** The new values are
  FKs to existing `AttributeOption` rows (the quiz canonical options). The same
  logical customer value is never duplicated as free text — e.g. skin tone
  `MEDIUM` exists once, in `SKIN_COLOR`, and both the quiz and the Pack profile
  point at it.

---

## 3. The five supported dimensions and their canonical sources

| Criterion (enum) | Canonical `AttributeGroup.code` | Canonical option examples |
| --- | --- | --- |
| `SKIN_TONE` | `SKIN_COLOR` | `LIGHT`, `MEDIUM`, `DARK` |
| `SKIN_TYPE` | `SKIN_TYPE` | `DRY`, `OILY`, `COMBINATION`, `SENSITIVE`, `NORMAL` |
| `MAKEUP_STYLE` | `STYLE` | `NATURAL`, `SOFT_GLAM`, `GLAM`, `DAILY` |
| `BUDGET` | `BUDGET` | `LOW`, `MEDIUM`, `HIGH` |
| `OCCASION` | `OCCASION` | `EVERYDAY`, `WORK`, `EVENING`, `PARTY`, `WEDDING` |

`SKIN_COLOR`, `SKIN_TYPE`, `STYLE`, and `BUDGET` already existed. **`OCCASION`
did not exist** and was added to the seed as a customer-facing `AttributeGroup`
with options (group + options only — no quiz question and no recommendation rule,
so the quiz and engine are unchanged). It remains admin-managed via the existing
attributes module.

A compatibility value is validated by resolving its option **inside the
criterion's canonical group**. This rejects cross-dimension links and correctly
disambiguates shared codes (e.g. `MEDIUM` resolves to `SKIN_COLOR.MEDIUM` for
`SKIN_TONE` and to `BUDGET.MEDIUM` for `BUDGET`).

---

## 4. UNIVERSAL / RESTRICTED / UNCONFIGURED

Per criterion, exactly one explicit, documentable state applies:

| State | Stored as | Meaning |
| --- | --- | --- |
| `UNCONFIGURED` | **no** `PackCompatibilityProfile` row for the (pack, criterion) | Not yet defined. Legacy default. Inert. Must be intentionally completed before the future five-criteria algorithm relies on it. |
| `UNIVERSAL` | profile row, `mode = UNIVERSAL`, **zero** values | The Pack does not depend on this criterion; any customer value may match (e.g. a brush-only Pack for skin tone). |
| `RESTRICTED` | profile row, `mode = RESTRICTED`, **≥ 1** value | The Pack is intended only for the listed canonical values. |

This removes the "admin forgot" vs. "deliberately universal" ambiguity: silence
is `UNCONFIGURED`, an explicit `UNIVERSAL` row is a deliberate choice. There is
**no** exclusion / "not suitable" mode in this task.

---

## 5. The budget rule

Budget compatibility reuses the canonical `BUDGET` tier options (`LOW` / `MEDIUM`
/ `HIGH`) like every other dimension. It is a **coarse normalized hint only**.

The affordability hierarchy the future engine must follow:

```text
1. Actual Pack selling price  (authoritative)
2. Canonical BUDGET tier compatibility value (this profile — coarse hint)
3. Optional Pack tier/positioning data (only when useful)
```

The Pack's real commercial price (`priceMode` → `fixedPrice` / sum of items)
remains the source of truth for affordability. The existing numeric
`Pack.minBudget` / `Pack.maxBudget` fields are **untouched** and are not replaced
by this profile. A budget tier value never makes a Pack recommendable on its own
and never bypasses real price validation.

---

## 6. Legacy Pack behavior

The migration is fully additive (new enums + two new tables; **no** column drops,
renames, or data rewrites). For an existing Pack with no compatibility profile:

- every criterion is `UNCONFIGURED` (no rows);
- it stays visible in public reads and updatable via admin APIs;
- recommendation, pricing, stock, cart, checkout, and order behavior are
  unchanged;
- a partial admin update that omits `compatibility` **preserves** the stored
  profile (same convention as `items` / `attributes`).

A legacy Pack is **never** silently treated as universally compatible — absence
is `UNCONFIGURED`, and future scoring must require it to be intentionally
completed.

---

## 7. Admin API surface

`CreatePackDto` / `UpdatePackDto` gain one optional field, `compatibility[]`
([`PackCompatibilityInputDto`](../src/modules/packs/dto/pack-compatibility-input.dto.ts)):

```jsonc
"compatibility": [
  { "criterion": "SKIN_TONE", "mode": "RESTRICTED", "optionCodes": ["LIGHT", "MEDIUM"] },
  { "criterion": "SKIN_TYPE", "mode": "UNIVERSAL" }
]
```

- Admin can **set / read / replace** the profile. On update, supplying
  `compatibility` replaces it wholesale (delete + recreate in one transaction),
  matching the existing items/attributes convention; omitting it preserves it.
- The admin detail response exposes a read-only `compatibility[]` with each
  value's `attributeOptionId`, `optionCode`, `optionLabel`, and
  `attributeGroupCode`.
- All new request fields are optional; existing create/update payloads stay valid.
- **Public Pack responses are unchanged** (no public filtering, no public
  compatibility metadata added in this task).

### Structural validation (data-integrity only)

1. A referenced option must exist and be active.
2. It must belong to the criterion's expected canonical group (cross-dimension
   links rejected).
3. Unsupported groups cannot be stored (only the five criteria exist in the enum,
   each pinned to its canonical group).
4. Duplicate option codes within a criterion are de-duplicated; the
   `@@unique([profileId, attributeOptionId])` constraint backs this at the DB
   level, and a duplicate **criterion** is rejected.
5. `RESTRICTED` requires ≥ 1 value.
6. `UNIVERSAL` requires zero values (and rejects supplied codes).
7. Omitting `compatibility` leaves existing Pack behavior unchanged.

---

## 8. Explicitly deferred

Not implemented here (belongs to the recommendation-algorithm task and later
phases): recommendation scoring/ranking/filtering on the profile, hard
exclusions / "not suitable", customer-facing match reasons, stock-aware matching,
product-reference selection, budget upgrade logic, result diversity, customer
configuration, cart/checkout, and generated Packs. Until then the profile is
**structural foundation only.**
