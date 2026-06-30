# Recommendation MVP Database Readiness

## Local database target

- Source: `.env` via `prisma.config.ts`
- Host: `localhost`
- Port: `5432`
- Database: `beauty_pack_db`
- Schema: `public`
- Safety: confirmed local development target before migration.

## Migration status

- Before: `npx prisma migrate status` reported 10 local migrations with two pending:
  - `20260630180000_pack_compatibility_profile_foundation`
  - `20260630193000_attribute_option_budget_ranges`
- Applied with: `npx prisma migrate deploy`
- After: `npx prisma migrate status` reports the database schema is up to date.
- Validation: `npx prisma validate` passes.
- Client: `npx prisma generate` completed with Prisma Client v7.8.0.
- Drift check: `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` reports no difference.

## Schema objects verified

- Tables:
  - `pack_compatibility_profiles`
  - `pack_compatibility_values`
- Columns:
  - `attribute_options.min_numeric_value`
  - `attribute_options.max_numeric_value`

## Budget ranges

Canonical `BUDGET` options use non-overlapping inclusive MAD ranges:

- `LOW`: 150-220
- `MEDIUM`: 221-350
- `HIGH`: 351-600

## Seed-data readiness

`npm run prisma:seed` is idempotent for the touched records and completed successfully.

The seed now includes development-only manual recommendation fixtures:

- `MANUAL-REC-EXACT`
- `MANUAL-REC-TONE-MISMATCH`
- `MANUAL-REC-SKIN-MISMATCH`
- `MANUAL-REC-STYLE-MISMATCH`
- `MANUAL-REC-BUDGET-MISMATCH`
- `MANUAL-REC-UNCONFIGURED`

Configured fixtures use existing canonical attribute options across:

- `SKIN_TONE`
- `SKIN_TYPE`
- `MAKEUP_STYLE`
- `BUDGET`
- `OCCASION`

`MANUAL-REC-UNCONFIGURED` intentionally has no compatibility profile rows.

## Verification

- `npm run build`: pass
- `npm run swagger:generate`: pass
- `npm run swagger:check`: pass

Smoke test against the existing local listener on port `3000`:

- `POST /quiz/profiles`: HTTP 201
- `POST /recommendations`: HTTP 201
- Top result: `MANUAL-REC-EXACT`
- Returned results include the exact match, the style-mismatch alternative, and the unconfigured Pack below the exact match.
- The response did not expose raw compatibility score fields, compatibility weights, costs, margins, internal stock quantities, or a private answers collection.

Note: the existing public recommendation response still includes legacy scoring and match-detail fields such as `totalScore`, `itemScore`, `reason.packMatches`, and selected item `referenceMatches`. Treat response sanitization as a separate blocker only if those legacy fields are now considered private quiz-answer leakage.

## Remaining blockers

- No schema or seed-data blocker remains for rerunning the recommendation manual test matrix.
- The local public quiz currently has additional active required groups (`SKIN_TONE`, `COVERAGE`, `FINISH`) alongside the canonical recommendation groups. Manual smoke requests should use `GET /quiz/questions` and answer all active required groups.
