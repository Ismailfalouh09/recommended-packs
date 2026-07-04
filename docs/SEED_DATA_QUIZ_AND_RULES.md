# Clean Seed Data: Quiz Attributes + Recommendation Rules

Data to enter manually through the admin API, in order. Covers the 5
required groups: **Skin Tone, Skin Type, Style, Budget**, plus
**Undertone** (kept because product references already score on it and
the engine has a built-in default for it — skip it only if you are sure no
reference/pack will use it).

Create everything in this order: Attribute Groups → Attribute Options →
Quiz Questions (with options) → Recommendation Rules.

---

## 1. Attribute Groups

`POST /admin/attributes`

| code | name | description | isCustomerAttribute | isProductAttribute | sortOrder |
|---|---|---|---|---|---|
| `SKIN_COLOR` | Skin Color | Customer skin color range. | true | true | 1 |
| `UNDERTONE` | Undertone | Customer skin undertone. | true | true | 2 |
| `SKIN_TYPE` | Skin Type | Customer skin type. | true | true | 3 |
| `STYLE` | Style | Preferred makeup style. | true | true | 4 |
| `BUDGET` | Budget | Customer budget band. | true | false | 5 |

Example body (repeat per row):
```json
{
  "code": "SKIN_COLOR",
  "name": "Skin Color",
  "description": "Customer skin color range.",
  "isCustomerAttribute": true,
  "isProductAttribute": true,
  "sortOrder": 1,
  "isActive": true
}
```

> Note: `BUDGET` has `isProductAttribute: false` because budget is a
> customer-only preference — products/references don't carry a budget
> attribute, only packs do (via `minBudget`/`maxBudget` and `PackAttribute`).

---

## 2. Attribute Options

`POST /admin/attributes/:attributeGroupId/options` (use the ID returned in step 1)

### SKIN_COLOR
| code | label | sortOrder |
|---|---|---|
| `LIGHT` | Light | 1 |
| `MEDIUM` | Medium | 2 |
| `DARK` | Dark | 3 |

### UNDERTONE
| code | label | sortOrder |
|---|---|---|
| `COOL` | Cool | 1 |
| `NEUTRAL` | Neutral | 2 |
| `WARM` | Warm | 3 |

### SKIN_TYPE
| code | label | sortOrder |
|---|---|---|
| `DRY` | Dry | 1 |
| `OILY` | Oily | 2 |
| `COMBINATION` | Combination | 3 |
| `SENSITIVE` | Sensitive | 4 |
| `NORMAL` | Normal | 5 |

### STYLE
| code | label | sortOrder |
|---|---|---|
| `NATURAL` | Natural | 1 |
| `SOFT_GLAM` | Soft Glam | 2 |
| `GLAM` | Glam | 3 |
| `DAILY` | Daily | 4 |

### BUDGET
| code | label | sortOrder |
|---|---|---|
| `LOW` | Low | 1 |
| `MEDIUM` | Medium | 2 |
| `HIGH` | High | 3 |

Example body:
```json
{ "code": "LIGHT", "label": "Light", "sortOrder": 1, "isActive": true }
```

---

## 3. Quiz Questions

`POST /admin/quiz/questions`

One question per group, `selectionType: SINGLE`, `isRequired: true`.
Pass `attributeGroupId` (from step 1) and `options[]` referencing each
option's `attributeOptionId` (from step 2).

| stepOrder | attributeGroupId (use SKIN_COLOR's id) | questionText |
|---|---|---|
| 1 | SKIN_COLOR | What is your skin color? |
| 2 | UNDERTONE | What is your undertone? |
| 3 | SKIN_TYPE | What is your skin type? |
| 4 | STYLE | What makeup style do you prefer? |
| 5 | BUDGET | What is your budget? |

Example body (Skin Color question, fill in real UUIDs):
```json
{
  "attributeGroupId": "<SKIN_COLOR-group-uuid>",
  "questionText": "What is your skin color?",
  "selectionType": "SINGLE",
  "isRequired": true,
  "stepOrder": 1,
  "isActive": true,
  "options": [
    { "attributeOptionId": "<LIGHT-option-uuid>", "displayLabel": "Light", "sortOrder": 1, "isActive": true },
    { "attributeOptionId": "<MEDIUM-option-uuid>", "displayLabel": "Medium", "sortOrder": 2, "isActive": true },
    { "attributeOptionId": "<DARK-option-uuid>", "displayLabel": "Dark", "sortOrder": 3, "isActive": true }
  ]
}
```

Repeat the same shape for Undertone, Skin Type, Style, Budget — using each
group's options from step 2, in the same order as their `sortOrder`.

---

## 4. Recommendation Rules

`POST /admin/recommendation-rules`

These set the base score added whenever a customer's answer matches that
group. `code` **must** be `${GROUP_CODE}_MATCH` — the engine looks this up
literally.

| code | name | attributeGroupId | targetType | conditionType | scoreValue | weight |
|---|---|---|---|---|---|---|
| `SKIN_COLOR_MATCH` | Skin Color Match | SKIN_COLOR | `REFERENCE` | `SHOULD_MATCH` | 40 | 1 |
| `UNDERTONE_MATCH` | Undertone Match | UNDERTONE | `REFERENCE` | `SHOULD_MATCH` | 25 | 1 |
| `SKIN_TYPE_MATCH` | Skin Type Match | SKIN_TYPE | `REFERENCE` | `SHOULD_MATCH` | 15 | 1 |
| `STYLE_MATCH` | Style Match | STYLE | `PACK` | `SHOULD_MATCH` | 20 | 1 |
| `BUDGET_MATCH` | Budget Match | BUDGET | `PACK` | `SHOULD_MATCH` | 10 | 1 |

These values exactly match the engine's hardcoded fallback scores, so
creating them now doesn't change current behavior — it just makes the
weights visible and editable in the admin UI going forward instead of
living only in code.

Example body:
```json
{
  "code": "SKIN_COLOR_MATCH",
  "name": "Skin Color Match",
  "targetType": "REFERENCE",
  "attributeGroupId": "<SKIN_COLOR-group-uuid>",
  "conditionType": "SHOULD_MATCH",
  "scoreValue": 40,
  "weight": 1,
  "isActive": true
}
```

Reminder: `targetType` and `conditionType` are stored/displayed but not
currently read by the scoring engine — only `code` and
`scoreValue * weight` affect actual recommendations.

---

## Order of operations checklist

1. Create the 5 attribute groups (step 1) — note each returned `id`.
2. Create options for each group (step 2) — note each returned `id`.
3. Create the 5 quiz questions with nested options (step 3), using the IDs from steps 1–2.
4. Create the 5 recommendation rules (step 4), using the group IDs from step 1.
5. Verify: `GET /quiz/questions` should return all 5 questions in `stepOrder`; `GET /admin/recommendation-rules` should return all 5 rules.
6. Move on to products/references/packs (see [ADMIN_RULES_GUIDE.md](./ADMIN_RULES_GUIDE.md)) once this base is in place.
