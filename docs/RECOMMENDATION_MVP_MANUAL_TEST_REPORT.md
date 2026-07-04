# Recommendation MVP Manual Test Report

## Environment

- Backend URL: `http://localhost:3000`
- Backend process: existing listener on port `3000`
- Process command: `node --enable-source-maps dist/src/main`
- Date: `2026-06-30`
- Scope: manual HTTP API testing only

## Safety checks

- `git status --short`: existing uncommitted phase work present; no reset, restore, checkout, clean, stash, migration, or seed commands were run.
- `git diff --check`: no whitespace errors; PowerShell reported only the existing `prisma/seed.ts` LF-to-CRLF warning.

## Quiz profile values used

`GET /quiz/questions` returned HTTP 200. A fresh profile was created with one answer per active required group:

- `SKIN_COLOR.MEDIUM`
- `SKIN_TONE.MEDIUM`
- `UNDERTONE.WARM`
- `SKIN_TYPE.OILY`
- `STYLE.NATURAL`
- `COVERAGE.MEDIUM`
- `BUDGET.MEDIUM`
- `FINISH.NATURAL`

`OCCASION` was not present in the public quiz and was not fabricated.

## Endpoint statuses

- `POST /quiz/profiles`: HTTP 201
- Customer profile ID: `6dcc6ae0-1884-40df-8a89-2ce925594f88`
- `POST /recommendations`: HTTP 201
- Recommendation session ID: `9d32299c-4e2b-4840-ae33-5e44542a0ebf`

Returned packs:

1. `MANUAL-REC-EXACT`
2. `MANUAL-REC-STYLE-MISMATCH`
3. `MANUAL-REC-UNCONFIGURED`

## Fixture results

| Fixture | Expected | Actual | Status |
| --- | --- | --- | --- |
| `MANUAL-REC-EXACT` | Appears first | Returned rank 1 as `BEST_MATCH`; reasons included skin tone, skin type, makeup style, and budget | PASS |
| `MANUAL-REC-TONE-MISMATCH` | Does not appear | Not present in returned packs | PASS |
| `MANUAL-REC-SKIN-MISMATCH` | Does not appear | Not present in returned packs | PASS |
| `MANUAL-REC-STYLE-MISMATCH` | May appear below exact match and without a makeup-style reason | Returned rank 2; customer reasons included skin tone, skin type, and budget only | PASS |
| `MANUAL-REC-BUDGET-MISMATCH` | Does not appear for `BUDGET.MEDIUM` because price is above 350 MAD | Not present in returned packs | PASS |
| `MANUAL-REC-UNCONFIGURED` | Does not rank above exact match and has no false compatibility reasons | Returned rank 3; `customerReasons` was empty | PASS |

## CUSTOMER_CHOICE result

No returned recommendation contained an item with `selectionRequired = true`.

Status: BLOCKED by fixture/profile compatibility, not failed. The selected profile returned only the controlled manual fixtures, whose selected items are automatic/fixed and do not exercise a live required `CUSTOMER_CHOICE` item.

## API internal-field leak check

No response fields or text matched:

- `compatibilityScore`
- `weights`
- `costPrice`
- `cost price`
- `margin`
- `stockQuantity`
- `reservedQuantity`
- `private quiz answers`
- `privateAnswers`

Legacy score and match-detail fields were present and recorded separately:

- `totalScore`
- `matchPercentage`
- `selectedItems.itemScore`
- `reason.packMatches`
- `selectedItems.reason.referenceMatches`
- nested `score` fields inside legacy match details

These were not fixed in this task.

## Summary

- Passed: 6
- Failed: 0
- Blocked: 1
- Failing fixtures: none
- `MANUAL-REC-EXACT` ranked first: yes
- Mismatch fixtures excluded correctly: yes
- Internal compatibility, weight, cost, margin, stock, or private-answer fields leaked: no
- Legacy score/match-detail fields present: yes, recorded above

## Conclusion

Ready for checkpoint commit.

The core manual recommendation fixture matrix passes. The only blocked item is live `CUSTOMER_CHOICE` response verification for this selected profile because no returned Pack exercised that path.
