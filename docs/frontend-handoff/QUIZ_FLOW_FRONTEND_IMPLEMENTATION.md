# Quiz Flow — Frontend Implementation Handoff

## 1. Purpose

The Quiz collects customer preference answers and turns them into a backend `CustomerProfile`. Recommendations are then generated from that profile by matching the profile's answer codes against active pack attributes and product-reference compatibility attributes.

The frontend owns the mobile quiz experience: introduction page, one-question-per-screen flow, local answer state, step navigation, final validation, loading/error states, result routing, and restart behavior. The backend owns question/option loading, answer validation, profile persistence, recommendation scoring, recommendation session persistence, active pack/product/reference filtering, and pack/product detail APIs.

Current implementation supports a public quiz question endpoint, public profile creation, public recommendation generation, public recommendation session reload, and public pack/product detail endpoints. It does not support customer authentication, incomplete quiz resume from backend, updating an existing quiz profile, fetching a customer profile by `sessionToken`, or idempotent recommendation creation.

## 2. Current Backend Status

| Area | Status | Existing Implementation | Frontend Impact |
| ---- | ------ | ----------------------- | --------------- |
| Quiz questions / attributes | Implemented | `GET /quiz/questions` returns active questions whose attribute group is active. Seed creates five active required questions. | Load questions dynamically and order by `stepOrder`. |
| Quiz options | Implemented | Each question returns active mapped options with option codes, labels, `attributeOptionId`, optional display label, and optional display image URL. | Use codes for submission; use display labels for UI. |
| Create quiz profile | Implemented | `POST /quiz/profiles` creates `CustomerProfile` and `CustomerProfileAnswer` rows in one transaction. | Submit only once after final validation where possible. |
| Store customer answers | Implemented | Answers are persisted as one option answer per active attribute group. | Backend persists completed submissions only, not in-progress answers. |
| Recommendation request | Implemented | `POST /recommendations` accepts `customerProfileId`, scores active packs, stores a new recommendation session/results/items, and returns ranked packs. | Call after profile creation; prevent duplicate clicks because each call creates a new session. |
| Recommendation response | Partially implemented | Service returns flat `recommendedPacks` with pack IDs/names/images, selected items, scores, and reason JSON. Swagger model is more nested than service output. | Integrate against actual service shape; treat OpenAPI response model as partially stale. |
| Pack details | Implemented | `GET /packs/:id` and controller source has `GET /packs/slug/:slug`; both return active pack details. Generated `docs/openapi.json` does not list the slug route. | Use `packId` from recommendations for reliable detail loading; slug route exists in code but generated docs need refresh. |
| Product references | Partially implemented | Public product and pack detail responses include references. Standalone product-reference endpoints are admin-only. | Result/details UI can show selected reference data from recommendations and pack/product details; no public reference-only fetch. |
| Stock availability | Partially implemented | Recommendation loading filters active references with `stockQuantity > 0`, then engine requires `stockQuantity > reservedQuantity`. Public details expose `stockQuantity`; computed `availableStock` is not consistently exposed publicly. | Treat recommended selected references as available at generation time; re-check via details if needed but computed availability is missing. |
| Session persistence | Partially implemented | Recommendation sessions persist and can be reloaded with `GET /recommendations/:sessionId`. Customer profile has `sessionToken`, but no public profile/session lookup endpoint uses it. | Store `recommendationSessionId` for refreshable result pages. Store `customerProfileId` only for generation/retry. |
| Error handling | Implemented | Uses Nest default errors plus service messages for bad answers, duplicate groups, missing required answers, not found resources, and validation failures. | Handle `400`, `404`, and malformed response states. Validation messages can be string or string array. |
| Authentication requirement | Implemented | Quiz, recommendations, packs, products, and attributes are public; admin routes require JWT. | Customer quiz UI should not send bearer auth. |
| Public API readiness | Partially implemented | Core quiz/recommendation APIs exist publicly. Missing profile reload/update and idempotency support. | The happy path is implementable; resume/retry behavior needs frontend safeguards. |
| CORS readiness | Needs verification | `src/main.ts` enables CORS only when `ADMIN_DASHBOARD_ORIGIN` and/or `STORE_FRONTEND_ORIGIN` are configured. | Set `STORE_FRONTEND_ORIGIN` to the Next.js dev/deployed origin. |

## 3. Customer Quiz Journey

1. Store or Packs page

   UI/page responsibility: Link into the quiz or show normal active pack catalog.

   Backend API call: Optional `GET /packs` for a pack listing.

   Required request data: None.

   Expected response data: Active packs with `id`, `name`, `slug`, price fields, images, attributes, and items.

   Loading behavior: Show pack-list skeletons if loading packs.

   Empty state behavior: Show an empty catalog state if `GET /packs` returns `[]`.

   Error behavior: Show retry for catalog load failure.

   Navigation behavior: Primary quiz CTA should route to `/quiz`.

2. Quiz introduction page

   UI/page responsibility: Explain the quiz entry point with static copy and start action.

   Backend API call: Prefer preloading `GET /quiz/questions` on entry or on first question screen.

   Required request data: None.

   Expected response data: Active questions ordered by `stepOrder`.

   Loading behavior: If preloading, disable Start until questions are ready.

   Empty state behavior: If no questions are returned, show a backend-not-ready state.

   Error behavior: Show retry; keep the user on `/quiz`.

   Navigation behavior: Start routes to `/quiz/question/1`.

3. Quiz question pages

   UI/page responsibility: Render one question per screen, options, progress, Previous and Next controls.

   Backend API call: `GET /quiz/questions` if questions are not already in memory/session storage.

   Required request data: None.

   Expected response data: `id`, `questionText`, `helperText`, `selectionType`, `isRequired`, `stepOrder`, `attributeGroup.code`, and `options`.

   Loading behavior: Show a compact question skeleton.

   Empty state behavior: Redirect to `/quiz` with an unavailable message if question index is invalid or no questions exist.

   Error behavior: Keep local answers and allow retry.

   Navigation behavior: Next advances; Previous goes back without clearing answers.

4. Local answer storage while navigating

   UI/page responsibility: Preserve selected answers between steps and browser back/forward.

   Backend API call: None while navigating.

   Required request data: None.

   Expected response data: None.

   Loading behavior: None.

   Empty state behavior: Missing local answers should simply show unselected options.

   Error behavior: Local state errors should not clear existing selections.

   Navigation behavior: Persist answers in React state and optionally `sessionStorage`.

5. Final validation

   UI/page responsibility: Ensure every required backend question has a selected answer before submission.

   Backend API call: None until validation passes.

   Required request data: Local answers keyed by `attributeGroup.code`.

   Expected response data: None.

   Loading behavior: Disable submit while validating/submitting.

   Empty state behavior: Route the user to the first missing required question.

   Error behavior: Show a field-level or step-level required message.

   Navigation behavior: Do not submit until required answers are complete.

6. Create quiz profile/session

   UI/page responsibility: Convert selected option codes into the backend DTO.

   Backend API call: `POST /quiz/profiles`.

   Required request data: `sourceChannel` optional; `answers[]` with `attributeGroupCode` and `attributeOptionCode`.

   Expected response data: `customerProfileId`, `sessionToken`, `sourceChannel`, `answers`.

   Loading behavior: Show final submission/loading screen.

   Empty state behavior: Not applicable; backend rejects empty `answers`.

   Error behavior: Keep local answers and show retry. Do not clear selections.

   Navigation behavior: On success, keep `customerProfileId` and continue to recommendation request.

7. Request recommendations

   UI/page responsibility: Call the generator and store the returned recommendation session ID.

   Backend API call: `POST /recommendations`.

   Required request data: `customerProfileId`.

   Expected response data: `sessionId`, `recommendedPacks`.

   Loading behavior: Keep `/quiz/loading` or an equivalent pending state visible.

   Empty state behavior: If `recommendedPacks` is empty, route to result page and show empty recommendations.

   Error behavior: Keep `customerProfileId` and local answers; allow retry. Guard against duplicate submit.

   Navigation behavior: On success, route to `/packs/recommended/[sessionId]`.

8. Loading recommendation result page

   UI/page responsibility: Reload stored recommendations on direct navigation or refresh.

   Backend API call: `GET /recommendations/:sessionId`.

   Required request data: `sessionId` route parameter.

   Expected response data: Session metadata plus `recommendedPacks`.

   Loading behavior: Show result-page skeleton.

   Empty state behavior: Show no matches if session exists with zero recommendations.

   Error behavior: On `404`, offer restart quiz. On network error, offer retry.

   Navigation behavior: Stay on result route unless `sessionId` is invalid.

9. Recommendation result page

   UI/page responsibility: Display ranked packs and selected product references.

   Backend API call: `GET /recommendations/:sessionId`; optionally `GET /packs/:id` per selected pack for price/slug/detail data.

   Required request data: `sessionId`; optional `packId`.

   Expected response data: Recommended pack card data and selected items.

   Loading behavior: Progressive render session first; fetch pack details only when needed.

   Empty state behavior: Show empty recommendation state and Restart Quiz action.

   Error behavior: Retry session fetch without clearing local quiz history.

   Navigation behavior: Pack cards route to `/packs/[packSlug-or-id]`; use ID if slug was not fetched.

10. Recommended pack details page

   UI/page responsibility: Show the selected pack, included products, selected references, and availability messaging.

   Backend API call: `GET /packs/:id` or source-confirmed `GET /packs/slug/:slug`.

   Required request data: Pack ID or slug.

   Expected response data: Pack fields, images, attributes, items, product summaries, and references.

   Loading behavior: Show detail skeleton.

   Empty state behavior: If pack is inactive/archived, show unavailable state.

   Error behavior: `404` should route back to recommendations or packs.

   Navigation behavior: Back returns to recommendations if `sessionId` is known.

11. Restart Quiz behavior

   UI/page responsibility: Clear frontend quiz state and start from intro or first question.

   Backend API call: None required.

   Required request data: None.

   Expected response data: None.

   Loading behavior: None.

   Empty state behavior: Reset to no selections.

   Error behavior: None.

   Navigation behavior: Clear `answers`, `customerProfileId`, and `recommendationSessionId`; route to `/quiz`.

## 4. Quiz Questions and Options Data Contract

The seeded data supports five questions. Question UUIDs are explicitly seeded. Attribute group IDs, attribute option IDs, and quiz question option IDs are generated by the database and must be loaded from `GET /quiz/questions` or public attribute endpoints; do not hardcode them.

| Question Code | UI Label | Required | Selection Type | Backend Attribute ID | Answer Format |
| ------------- | -------- | -------: | -------------- | -------------------- | ------------- |
| `SKIN_COLOR` | What is your skin color? | true | `SINGLE` | Load from DB only if using `GET /attributes`; quiz endpoint returns code/name, not group ID. | `{ "attributeGroupCode": "SKIN_COLOR", "attributeOptionCode": "MEDIUM" }` |
| `UNDERTONE` | What is your undertone? | true | `SINGLE` | Load from DB only if using `GET /attributes`; quiz endpoint returns code/name, not group ID. | `{ "attributeGroupCode": "UNDERTONE", "attributeOptionCode": "WARM" }` |
| `SKIN_TYPE` | What is your skin type? | true | `SINGLE` | Load from DB only if using `GET /attributes`; quiz endpoint returns code/name, not group ID. | `{ "attributeGroupCode": "SKIN_TYPE", "attributeOptionCode": "OILY" }` |
| `STYLE` | What makeup style do you prefer? | true | `SINGLE` | Load from DB only if using `GET /attributes`; quiz endpoint returns code/name, not group ID. | `{ "attributeGroupCode": "STYLE", "attributeOptionCode": "NATURAL" }` |
| `BUDGET` | What is your budget? | true | `SINGLE` | Load from DB only if using `GET /attributes`; quiz endpoint returns code/name, not group ID. | `{ "attributeGroupCode": "BUDGET", "attributeOptionCode": "MEDIUM" }` |

### Question: Skin Color

Seeded question ID: `00000000-0000-4000-8000-000000000001`

Recommendation importance: group score key `SKIN_COLOR_MATCH`; seed rule score `40`; engine fallback score `40`; mainly scores product references.

| Option ID | Option Code | Display Label | Recommendation Meaning |
|---|---|---|---|
| Load from API | `LIGHT` | Light | Matches reference attributes with `SKIN_COLOR/LIGHT`. |
| Load from API | `MEDIUM` | Medium | Matches reference attributes with `SKIN_COLOR/MEDIUM`. |
| Load from API | `DARK` | Dark | Matches reference attributes with `SKIN_COLOR/DARK`. |

### Question: Undertone

Seeded question ID: `00000000-0000-4000-8000-000000000002`

Recommendation importance: group score key `UNDERTONE_MATCH`; seed rule score `25`; engine fallback score `25`; mainly scores product references.

| Option ID | Option Code | Display Label | Recommendation Meaning |
|---|---|---|---|
| Load from API | `COOL` | Cool | Matches reference attributes with `UNDERTONE/COOL`. |
| Load from API | `NEUTRAL` | Neutral | Matches reference attributes with `UNDERTONE/NEUTRAL`. |
| Load from API | `WARM` | Warm | Matches reference attributes with `UNDERTONE/WARM`. |

### Question: Skin Type

Seeded question ID: `00000000-0000-4000-8000-000000000003`

Recommendation importance: group score key `SKIN_TYPE_MATCH`; seed rule score `15`; engine fallback score `15`; mainly scores product references.

| Option ID | Option Code | Display Label | Recommendation Meaning |
|---|---|---|---|
| Load from API | `DRY` | Dry | Matches reference attributes with `SKIN_TYPE/DRY`. |
| Load from API | `OILY` | Oily | Matches reference attributes with `SKIN_TYPE/OILY`. |
| Load from API | `COMBINATION` | Combination | Matches reference attributes with `SKIN_TYPE/COMBINATION`. |
| Load from API | `SENSITIVE` | Sensitive | Matches reference attributes with `SKIN_TYPE/SENSITIVE`. |
| Load from API | `NORMAL` | Normal | Matches reference attributes with `SKIN_TYPE/NORMAL`. |

### Question: Style

Seeded question ID: `00000000-0000-4000-8000-000000000004`

Recommendation importance: group score key `STYLE_MATCH`; seed rule score `20`; engine fallback score `20`; scores pack attributes and any reference attributes using `STYLE`.

| Option ID | Option Code | Display Label | Recommendation Meaning |
|---|---|---|---|
| Load from API | `NATURAL` | Natural | Matches pack/reference attributes with `STYLE/NATURAL`. |
| Load from API | `SOFT_GLAM` | Soft Glam | Matches pack/reference attributes with `STYLE/SOFT_GLAM`. |
| Load from API | `GLAM` | Glam | Matches pack/reference attributes with `STYLE/GLAM`. |
| Load from API | `DAILY` | Daily | Matches pack/reference attributes with `STYLE/DAILY`. |

### Question: Budget

Seeded question ID: `00000000-0000-4000-8000-000000000005`

Recommendation importance: group score key `BUDGET_MATCH`; seed rule score `10`; engine fallback score `10`; seed data uses it on pack attributes.

| Option ID | Option Code | Display Label | Recommendation Meaning |
|---|---|---|---|
| Load from API | `LOW` | Low | Matches pack attributes with `BUDGET/LOW`. |
| Load from API | `MEDIUM` | Medium | Matches pack attributes with `BUDGET/MEDIUM`. |
| Load from API | `HIGH` | High | Matches pack attributes with `BUDGET/HIGH`. |

## 5. API Contract for the Quiz UI

Base URL in local development: `http://localhost:3000`

Required headers for JSON requests:

```http
Content-Type: application/json
```

No customer quiz endpoint requires `Authorization`.

### GET /quiz/questions

Purpose: Load active quiz questions with active selectable options.

Authentication requirement: None.

Request body: None.

Validation rules: None.

Success response shape:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `id` | UUID string | Seeded question IDs are listed in section 4; custom/admin-created questions use database-generated UUIDs. |
| `questionText` | string | Main UI label. |
| `helperText` | string or null | Optional helper copy. |
| `selectionType` | `SINGLE` or `MULTIPLE` | Seeded questions are `SINGLE`. |
| `isRequired` | boolean | Seeded questions are required. |
| `stepOrder` | number | Sort ascending. |
| `attributeGroup.code` | string | Submit this as `attributeGroupCode`. |
| `attributeGroup.name` | string | Display/group label. |
| `options[].id` | UUID string | Quiz question option mapping ID; runtime DB value. |
| `options[].attributeOptionId` | UUID string | Attribute option ID; runtime DB value. |
| `options[].code` | string | Submit this as `attributeOptionCode`. |
| `options[].label` | string | Fallback UI label. |
| `options[].displayLabel` | string or null | Preferred UI option label when present. |
| `options[].displayImageUrl` | string or null | Optional option image URL. |

Error response: Standard Nest error if an unexpected server error occurs.

Frontend action after success: Sort by `stepOrder`, render one question per step, use `option.displayLabel ?? option.label`.

Frontend action after failure: Show retry and keep existing local answers.

### POST /quiz/profiles

Purpose: Create a completed customer quiz profile and persist answers.

Authentication requirement: None.

Request body:

```json
{
  "sourceChannel": "DIRECT",
  "answers": [
    { "attributeGroupCode": "SKIN_COLOR", "attributeOptionCode": "MEDIUM" },
    { "attributeGroupCode": "UNDERTONE", "attributeOptionCode": "WARM" },
    { "attributeGroupCode": "SKIN_TYPE", "attributeOptionCode": "OILY" },
    { "attributeGroupCode": "STYLE", "attributeOptionCode": "NATURAL" },
    { "attributeGroupCode": "BUDGET", "attributeOptionCode": "MEDIUM" }
  ]
}
```

Validation rules:

- `sourceChannel` is optional and must be one of `INSTAGRAM`, `WHATSAPP`, `TIKTOK`, `FACEBOOK`, `DIRECT`, `OTHER`.
- `answers` must be a non-empty array.
- Each answer requires non-empty string `attributeGroupCode` and `attributeOptionCode`.
- Backend normalizes answer codes with `trim().toUpperCase()`.
- Duplicate attribute groups are rejected.
- Every active required quiz question must be answered.
- Selected option must be active and belong to the selected active group.
- Selected group must have an active quiz question.

Success response fields: `customerProfileId` UUID string, `sessionToken` string, `sourceChannel`, and normalized `answers[]` containing `attributeGroupCode` and `attributeOptionCode`.

Error response:

```json
{
  "statusCode": 400,
  "message": "Missing answers for required quiz questions: BUDGET.",
  "error": "Bad Request"
}
```

Frontend action after success: Store `customerProfileId` for `POST /recommendations`; optionally store `sessionToken` only as opaque profile metadata.

Frontend action after failure: Show message, keep answers, route user to first invalid/missing question if detectable.

### MISSING API — Separate answer submission endpoint

**Why it is needed:**  
Only needed if the frontend wants to save answers incrementally before final profile creation.

**Current backend limitation:**  
There is no endpoint to create/update partial customer answers separately from `POST /quiz/profiles`.

**Smallest recommended backend change:**  
Add an explicit draft/resume profile flow only if product requirements need server-side incomplete quiz persistence.

**Priority:** Medium

### POST /recommendations

Purpose: Generate and persist recommendations for a customer profile.

Authentication requirement: None.

Request body:

Build the request with the exact `customerProfileId` UUID returned by `POST /quiz/profiles`:

```ts
{
  customerProfileId: profile.customerProfileId
}
```

Validation rules:

- `customerProfileId` must be a UUID.
- Profile must exist.
- Profile must have stored quiz answers.

Success response fields:

| Field | Type | Notes |
| ----- | ---- | ----- |
| `sessionId` | UUID string | New recommendation session created by this call. |
| `recommendedPacks[].recommendationResultId` | UUID string or undefined | Present when persisted through public `POST /recommendations`. |
| `recommendedPacks[].packId` | UUID string | Use for `GET /packs/:id`. |
| `recommendedPacks[].packName` | string | Pack card title. |
| `recommendedPacks[].packCoverImage` | image object or null | Built from pack media cover image. |
| `recommendedPacks[].packImages` | image array | May be empty. |
| `recommendedPacks[].rank` | number | 1-based rank. |
| `recommendedPacks[].totalScore` | number | Engine score. |
| `recommendedPacks[].matchPercentage` | number | 0 to 100. |
| `recommendedPacks[].reason` | object | Score details from engine. |
| `recommendedPacks[].selectedItems[]` | array | Selected product references for the pack. |
| `selectedItems[].productId` | UUID string | Product ID. |
| `selectedItems[].productName` | string | Product display name. |
| `selectedItems[].referenceId` | UUID string | Selected product reference ID. |
| `selectedItems[].referenceName` | string | Combined reference code/name. |
| `selectedItems[].quantity` | number | Pack quantity. |
| `selectedItems[].itemScore` | number | Item score. |
| `selectedItems[].reason` | object | Selection details, including selection mode. |

Error response:

```json
{
  "statusCode": 404,
  "message": "Customer profile <requested UUID> was not found.",
  "error": "Not Found"
}
```

Frontend action after success: Store `sessionId`, route to `/packs/recommended/[sessionId]`.

Frontend action after failure: Keep `customerProfileId` and answers; allow retry. Disable duplicate submit while request is pending.

### GET /recommendations/:sessionId

Purpose: Reload a stored recommendation session by ID.

Authentication requirement: None.

Request body: None.

Validation rules: `sessionId` is used as route string; invalid or unknown IDs return not found from Prisma lookup.

Success response fields include all `POST /recommendations` recommendation pack fields plus session metadata: `customerProfileId`, `algorithmVersion`, `totalCandidatePacks`, `totalRecommendedPacks`, `status`, and `createdAt`. Stored selected items additionally include `recommendationResultItemId` and `packItemId`.

Error response:

```json
{
  "statusCode": 404,
  "message": "Recommendation session <requested UUID> was not found.",
  "error": "Not Found"
}
```

Frontend action after success: Render result page. If `recommendedPacks` is empty, render empty state.

Frontend action after failure: Show retry for network errors; for `404`, offer Restart Quiz.

### GET /packs/:id

Purpose: Load active pack details after recommendation.

Authentication requirement: None.

Request body: None.

Success response includes confirmed fields: `id`, `name`, `slug`, `description`, `mainImageUrl`, `priceMode`, `fixedPrice`, `discountAmount`, `discountPercentage`, `minBudget`, `maxBudget`, `currency`, `priority`, `status`, `coverImage`, `images`, `attributes`, and `items`.

Error response: `404` when pack is missing, inactive, or not `ACTIVE`.

Frontend action after success: Render pack details and use `items[].product.references` for available reference choices shown by pack detail.

Frontend action after failure: Show unavailable pack state and link back to results/catalog.

### GET /packs/slug/:slug

Purpose: Load active pack details by slug.

Authentication requirement: None.

Current verification: Implemented in `src/modules/packs/packs.controller.ts`; missing from generated `docs/openapi.json` inspected on 2026-06-26.

Frontend action: Prefer `GET /packs/:id` from recommendation cards unless frontend routing already has the slug. Regenerate OpenAPI before relying on generated client support for this route.

### GET /products/:id

Purpose: Load active product details with references and compatibility attributes.

Authentication requirement: None.

Success response includes confirmed fields: `id`, `name`, `slug`, `description`, `basePrice`, `currency`, `mainImageUrl`, `status`, `category`, `brand`, `references`, `coverImage`, and `images`.

Frontend action after success: Use only if product detail/reference drill-down is needed.

### MISSING API — Public product reference by ID

**Why it is needed:**  
The recommendation result includes `referenceId`, but there is no public standalone endpoint to refresh only that reference.

**Current backend limitation:**  
Product-reference detail endpoints exist only under `/admin/*` and require JWT.

**Smallest recommended backend change:**  
Add a public read-only reference endpoint only if frontend needs direct reference refresh independent of product/pack detail.

**Priority:** Low

## 6. Recommended Frontend State Model

```ts
type SourceChannel =
  | 'INSTAGRAM'
  | 'WHATSAPP'
  | 'TIKTOK'
  | 'FACEBOOK'
  | 'DIRECT'
  | 'OTHER';

type QuizQuestion = {
  id: string;
  questionText: string;
  helperText: string | null;
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  stepOrder: number;
  attributeGroup: {
    code: string;
    name: string;
  };
  options: Array<{
    id: string;
    attributeOptionId: string;
    code: string;
    label: string;
    displayLabel: string | null;
    displayImageUrl: string | null;
  }>;
};

type QuizAnswer = {
  attributeGroupCode: string;
  attributeOptionCode: string;
};

type QuizProgressState = {
  currentStep: number;
  questions: QuizQuestion[];
  answersByGroupCode: Record<string, string>;
  isLoadingQuestions: boolean;
  isSubmitting: boolean;
  customerProfileId?: string;
  profileSessionToken?: string;
  recommendationSessionId?: string;
  error?: string;
};

type CreateCustomerProfileRequest = {
  sourceChannel?: SourceChannel;
  answers: QuizAnswer[];
};

type CreateRecommendationRequest = {
  customerProfileId: string;
};
```

Frontend-only persistence:

- Current quiz step.
- Loaded questions cache.
- In-progress `answersByGroupCode`.
- Pending UI state and client-side validation messages.

Backend-persisted data:

- Completed `CustomerProfile`.
- Completed `CustomerProfileAnswer` rows.
- `RecommendationSession`, `RecommendationResult`, and `RecommendationResultItem` rows after `POST /recommendations`.

Not currently supported:

- Backend-persisted incomplete quiz drafts.
- Updating answers on an existing profile.
- Fetching a customer profile by `customerProfileId` or `sessionToken`.
- Fetching recommendations by `customerProfileId` without a recommendation `sessionId`.

Use `sessionStorage` for incomplete quiz answers so browser refresh does not wipe progress. Store the returned `recommendationSessionId` in the URL route and optionally in `sessionStorage`. Results can be refreshed safely with `GET /recommendations/:sessionId`. A customer can resume an incomplete quiz only from frontend storage. Restart should clear answers, current step, `customerProfileId`, `profileSessionToken`, and `recommendationSessionId`.

## 7. Submission and Recommendation Sequence

```ts
1. Load questions with GET /quiz/questions.
2. Sort questions by stepOrder.
3. Validate every question where isRequired is true has a selected option code.
4. Build:
   {
     sourceChannel: 'DIRECT',
     answers: questions.map(question => ({
       attributeGroupCode: question.attributeGroup.code,
       attributeOptionCode: answersByGroupCode[question.attributeGroup.code],
     }))
   }
5. POST /quiz/profiles.
6. Read customerProfileId from the response.
7. POST /recommendations with { customerProfileId }.
8. Read sessionId from the response.
9. Store sessionId and route to /packs/recommended/[sessionId].
10. On the result page, reload with GET /recommendations/:sessionId.
```

Calls that should happen only once:

- `POST /quiz/profiles` for one final submit attempt.
- `POST /recommendations` for one created profile, unless a retry is required after a network failure.

Calls safe to retry:

- `GET /quiz/questions`.
- `GET /recommendations/:sessionId`.
- `GET /packs/:id`.
- `GET /products/:id`.

Duplicate profiles can be created because `POST /quiz/profiles` has no idempotency key. Recommendations are not idempotent because `POST /recommendations` creates a new session every time. On temporary network error after profile creation, retry recommendations using the stored `customerProfileId`. If the user presses submit twice, the frontend should ignore the second click while a submit is in flight.

## 8. Mobile Quiz UI Integration Guidance

The quiz UI should use backend-provided `questionText`, `helperText`, `stepOrder`, `selectionType`, `isRequired`, and option labels. Static frontend copy is appropriate for the quiz intro, loading message, generic error messages, empty result explanation, and restart labels.

Supported controls:

- One question per screen.
- Visible progress indicator based on sorted questions count.
- Previous button disabled on the first question.
- Next button disabled until a required `SINGLE` answer is selected.
- Back navigation reads from local state/session storage.
- Final loading state covers both profile creation and recommendation generation.
- Retry button for failed question load, profile creation, recommendation generation, and result reload.
- Restart Quiz action clears local quiz/recommendation identifiers.
- Empty recommendation result state renders when `recommendedPacks.length === 0`.
- Result cards navigate to pack details by `packId`; fetch detail first if the UI needs slug/price.

Temporary mock data can be used only for the first static UI prototype and should mirror the seed codes listed in section 4. Replace mock questions with `GET /quiz/questions` before backend integration acceptance. Do not hardcode database IDs.

If the API returns `selectionType: MULTIPLE`, the Prisma enum supports it, but `POST /quiz/profiles` currently accepts only one `attributeOptionCode` per attribute group. Treat unknown or `MULTIPLE` types as unsupported in the customer UI until backend answer DTOs support multiple options.

## 9. Error and Edge Case Handling

| Case | UI behavior | Retry behavior | Redirect behavior | Local answers |
| ---- | ----------- | -------------- | ----------------- | ------------- |
| Missing required answer | Disable Next/Submit and show required state. | No backend retry; fix locally. | Stay on or route to missing question. | Keep. |
| Invalid option ID/code | Show backend validation message. | Allow resubmit after refetching questions. | Stay in quiz. | Keep unless question data changed. |
| Quiz profile creation failure | Show final-submit error. | Retry `POST /quiz/profiles`, but keep submit disabled while pending. | Stay on loading/final step. | Keep. |
| Recommendation request failure | Show recommendation error. | Retry `POST /recommendations` with stored `customerProfileId`. | Stay on loading state. | Keep. |
| Empty recommendation result | Show no-match result state. | Allow retry by creating recommendations again only if desired; note duplicate session risk. | Stay on result page or restart. | Keep until restart. |
| Recommendation contains unavailable or out-of-stock pack | Backend filters unavailable references during generation but pack can change later. Show unavailable if pack detail returns `404`. | Retry pack detail or return to result list. | Back to recommendations or packs. | Keep. |
| Refreshing recommendation result page | Fetch `GET /recommendations/:sessionId`. | Retry GET safely. | If missing session, offer restart. | Keep if still in storage. |
| Invalid or expired profile/session ID | Show invalid session state. Backend has no expiry field. | Retry once for network uncertainty. | Offer `/quiz` restart. | Keep until restart. |
| Customer going back after submitting | Show previous answer state if local storage exists; avoid resubmitting automatically. | Manual submit only. | Back can return to quiz or result depending route. | Keep unless restart. |
| Customer restarting quiz | Confirm if needed, then clear state. | Not applicable. | Route to `/quiz`. | Clear. |
| Slow mobile connection | Show loading skeletons and disabled submit buttons. | Retry after timeout/failure. | Stay on current screen. | Keep. |
| API returning a new/unknown question type | Show unsupported question state and block submission for that question. | Refetch questions. | Stay in quiz or restart. | Keep compatible answers. |
| API returning a malformed response | Show generic error and log client-side. | Refetch endpoint. | Stay on current route. | Keep. |
| Duplicate submit click | Ignore second click while `isSubmitting` is true. | Not applicable. | Continue first request's route. | Keep. |

## 10. Frontend Route Proposal

```text
/quiz
/quiz/question/[step]
/quiz/loading
/packs/recommended/[sessionId]
/packs/[packSlug-or-id]
```

| Route | Purpose | Required route parameters | API calls | Required local state | Invalid parameter behavior | Refresh behavior | Redirect fallback behavior |
| ----- | ------- | ------------------------- | --------- | -------------------- | -------------------------- | ---------------- | -------------------------- |
| `/quiz` | Quiz intro/start | None | Optional `GET /quiz/questions` preload | Optional cached questions | None | Can preload questions again | If questions empty, stay and show unavailable |
| `/quiz/question/[step]` | One question screen | `step` numeric 1-based index | `GET /quiz/questions` if missing | Questions and answers | Redirect to first valid step or `/quiz` | Restore from `sessionStorage`, then refetch if needed | `/quiz` |
| `/quiz/loading` | Final submit and recommendation generation | None | `POST /quiz/profiles`, then `POST /recommendations` | Complete answers; optional source channel | If answers incomplete, route to missing question | Avoid auto duplicate POST on refresh unless guarded by stored state | `/quiz` |
| `/packs/recommended/[sessionId]` | Recommendation results | `sessionId` | `GET /recommendations/:sessionId` | None required beyond route param | Show invalid session and restart action | Safe to refetch session | `/quiz` or `/packs` |
| `/packs/[packSlug-or-id]` | Pack details | Pack ID or slug | `GET /packs/:id` or `GET /packs/slug/:slug` | Optional originating `sessionId` | Show pack unavailable | Refetch detail | Back to result if known, otherwise `/packs` |

## 11. Frontend to Backend Data Mapping Cheat Sheet

| Frontend UI Field | Backend Field | Source | Notes |
| ----------------- | ------------- | ------ | ----- |
| Selected answer | `answers[].attributeOptionCode` | `GET /quiz/questions` option `code` | Submit code, not option UUID. |
| Question/attribute ID | Question `id`; group ID not returned by quiz endpoint | `GET /quiz/questions`; `GET /attributes` if group IDs are needed | Profile submission uses group code. |
| Option ID | `options[].id` and `options[].attributeOptionId` | `GET /quiz/questions` | Useful for React keys; not used by profile DTO. |
| Customer profile ID | `customerProfileId` | `POST /quiz/profiles` | Required by `POST /recommendations`. |
| Recommendation session ID | `sessionId` | `POST /recommendations`; `GET /recommendations/:sessionId` | Use in result route. |
| Recommended pack ID | `recommendedPacks[].packId` | Recommendation endpoints | Use for `GET /packs/:id`. |
| Pack slug/code | `slug` | `GET /packs/:id` or `GET /packs/slug/:slug` | Not returned by recommendation response. |
| Pack name | `recommendedPacks[].packName`; `pack.name` | Recommendation endpoints; pack detail | Confirmed. |
| Pack image | `packCoverImage`, `packImages`, `coverImage`, `images` | Recommendation endpoints; pack detail | May be `null`/empty. |
| Pack price | `fixedPrice`, discounts, `currency` | `GET /packs/:id` | Not returned by recommendation response. |
| Pack availability | `status`, `isActive`; route returns 404 if inactive | `GET /packs/:id` | Recommendation generation uses active packs only. |
| Product reference ID | `selectedItems[].referenceId`; product detail references `id` | Recommendation endpoints; product/pack detail | Confirmed. |
| Product stock status | `stockQuantity`; computed `availableStock` missing publicly | Product/pack detail references | Public stock availability is partial. |
| Recommendation score | `totalScore`, `matchPercentage`, `selectedItems[].itemScore` | Recommendation endpoints | Confirmed. |
| Recommendation reason/message | `reason`, `reasonSummary` on stored session | Recommendation endpoints | `reasonSummary` appears on `GET /recommendations/:sessionId`; `POST /recommendations` returns `reason`. |

## 12. API Gaps and Frontend Blockers

### GAP-01 — Recommendation POST is not idempotent

**Current situation:**  
Every `POST /recommendations` creates a new `RecommendationSession`.

**Why it blocks or weakens the frontend:**  
Retrying after a timeout can create duplicate sessions, and duplicate submit clicks can create multiple results.

**Smallest recommended backend change:**  
Support an idempotency key or a "get latest/create once for profile" endpoint.

**Priority:** High

### GAP-02 — No backend resume for incomplete quiz

**Current situation:**  
Only completed profiles are persisted. There is no draft profile or partial answer API.

**Why it blocks or weakens the frontend:**  
Customers can resume an unfinished quiz only from browser storage.

**Smallest recommended backend change:**  
Add draft quiz profile APIs only if server-side resume becomes a requirement.

**Priority:** Medium

### GAP-03 — No public profile/session lookup by profile session token

**Current situation:**  
`POST /quiz/profiles` returns `sessionToken`, but no public endpoint accepts it.

**Why it blocks or weakens the frontend:**  
The token cannot currently restore profile answers or locate recommendations.

**Smallest recommended backend change:**  
Add a read-only profile/session endpoint or stop exposing `sessionToken` to avoid implying support.

**Priority:** Medium

### GAP-04 — Recommendation response omits pack slug and price

**Current situation:**  
Recommendation cards return `packId`, `packName`, images, score, and selected items, but not pack slug or price fields.

**Why it blocks or weakens the frontend:**  
Result cards that need price or slug must fetch pack detail for each recommendation.

**Smallest recommended backend change:**  
Include `packSlug`, `fixedPrice`, `priceMode`, and `currency` in recommendation pack response.

**Priority:** Medium

### GAP-05 — Public stock availability is partial

**Current situation:**  
Recommendations filter references using stock and reserved quantity internally. Public detail responses expose `stockQuantity`, but computed `availableStock` is not consistently returned publicly.

**Why it blocks or weakens the frontend:**  
UI cannot reliably show "available now" versus reserved/out-of-stock from public detail alone.

**Smallest recommended backend change:**  
Expose `availableStock` and `isAvailable` on public product reference objects.

**Priority:** Medium

### GAP-06 — Generated OpenAPI is stale or mismatched in places

**Current situation:**  
Generated `docs/openapi.json` omits source-confirmed slug routes and Swagger response classes for recommendations do not match the flat service response shape.

**Why it blocks or weakens the frontend:**  
Generated frontend clients may miss routes or produce incorrect response types.

**Smallest recommended backend change:**  
Update Swagger response models to match service output and regenerate OpenAPI snapshots.

**Priority:** High

### GAP-07 — `MULTIPLE` selection type exists but profile DTO accepts one option per group

**Current situation:**  
Prisma enum supports `MULTIPLE`; the seed uses only `SINGLE`; `POST /quiz/profiles` rejects duplicate groups and accepts one `attributeOptionCode`.

**Why it blocks or weakens the frontend:**  
A future active multiple-choice question could not be submitted without backend DTO changes.

**Smallest recommended backend change:**  
Add multi-answer DTO support before activating `MULTIPLE` questions publicly.

**Priority:** Medium

## 13. Frontend Agent Implementation Checklist

### Phase A — Static Quiz UI

* [ ] Create Quiz intro page
* [ ] Create one-question-per-step screens
* [ ] Build progress indicator
* [ ] Build previous/next navigation
* [ ] Keep answers in local state
* [ ] Add validation behavior
* [ ] Build loading state
* [ ] Build error state
* [ ] Build empty recommendation state
* [ ] Use temporary mock data only where necessary

### Phase B — Backend Integration

* [ ] Replace mock questions with backend data
* [ ] Map selected answers to the real backend DTO
* [ ] Create quiz profile/session
* [ ] Store returned profile/session identifier
* [ ] Request recommendations
* [ ] Display real recommended packs
* [ ] Open real pack details
* [ ] Handle backend errors
* [ ] Handle no recommendation result
* [ ] Handle stock/unavailability behavior

### Phase C — Validation

* [ ] Validate every required question
* [ ] Validate backward navigation
* [ ] Validate forward navigation
* [ ] Validate refresh behavior
* [ ] Validate retry behavior
* [ ] Validate duplicate submit protection
* [ ] Validate mobile responsiveness
* [ ] Validate API request payloads
* [ ] Validate API response mapping
* [ ] Validate empty state
* [ ] Validate restart Quiz behavior

## 14. Verification Notes

Files inspected:

- `AGENTS.md`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `src/main.ts`
- `src/app.module.ts`
- `src/common/swagger/api-response.models.ts`
- `src/modules/quiz/quiz.controller.ts`
- `src/modules/quiz/quiz.service.ts`
- `src/modules/quiz/admin-quiz.controller.ts`
- `src/modules/quiz/dto/create-customer-profile.dto.ts`
- `src/modules/quiz/dto/query-quiz-questions.dto.ts`
- `src/modules/recommendations/recommendations.controller.ts`
- `src/modules/recommendations/recommendations.service.ts`
- `src/modules/recommendations/recommendation-engine.service.ts`
- `src/modules/recommendations/dto/create-recommendation.dto.ts`
- `src/modules/recommendations/admin-recommendation-rules.controller.ts`
- `src/modules/packs/packs.controller.ts`
- `src/modules/packs/packs.service.ts`
- `src/modules/packs/dto/query-packs.dto.ts`
- `src/modules/products/products.controller.ts`
- `src/modules/products/products.service.ts`
- `src/modules/products/dto/query-public-products.dto.ts`
- `src/modules/product-references/admin-product-references.controller.ts`
- `src/modules/attributes/attributes.controller.ts`
- `src/modules/attributes/attributes.service.ts`
- `src/modules/quiz/quiz.service.admin.spec.ts`
- `src/modules/recommendations/recommendation-engine.service.spec.ts`
- `src/modules/recommendations/recommendations.service.admin.spec.ts`
- `src/modules/packs/packs.service.admin.spec.ts`
- `docs/openapi.json`
- `frontend-handoff/openapi.json`
- `frontend-handoff/FRONTEND_HANDOFF.md`
- `frontend-handoff/CUSTOMER_FRONTEND_HANDOFF.md`
- `docs/SEED_DATA_QUIZ_AND_RULES.md`
- `docs/API_AUDIT_REPORT.md`

Prisma models inspected:

- `AttributeGroup`
- `AttributeOption`
- `QuizQuestion`
- `QuizQuestionOption`
- `CustomerProfile`
- `CustomerProfileAnswer`
- `RecommendationRule`
- `RecommendationSession`
- `RecommendationResult`
- `RecommendationResultItem`
- `Pack`
- `PackItem`
- `PackAttribute`
- `Product`
- `ProductReference`
- `ProductReferenceAttribute`
- Media image models used by pack/product responses

Controllers inspected:

- `QuizController`
- `AdminQuizController`
- `RecommendationsController`
- `AdminRecommendationRulesController`
- `PacksController`
- `ProductsController`
- `AttributesController`
- `AdminProductReferencesController`

Services inspected:

- `QuizService`
- `RecommendationsService`
- `RecommendationEngineService`
- `PacksService`
- `ProductsService`
- `AttributesService`

DTOs inspected:

- `CreateCustomerProfileDto`
- `CreateCustomerProfileAnswerDto`
- `CreateRecommendationDto`
- `QueryQuizQuestionsDto`
- `QueryPacksDto`
- `QueryPublicProductsDto`

Swagger/OpenAPI files inspected:

- `src/common/swagger/api-response.models.ts`
- `docs/openapi.json`
- `frontend-handoff/openapi.json`

Existing frontend handoff documents inspected:

- `frontend-handoff/FRONTEND_HANDOFF.md`
- `frontend-handoff/CUSTOMER_FRONTEND_HANDOFF.md`
- `docs/SEED_DATA_QUIZ_AND_RULES.md`
- `docs/API_AUDIT_REPORT.md`

Confirmed endpoints:

- `GET /quiz/questions`
- `POST /quiz/profiles`
- `POST /recommendations`
- `GET /recommendations/:sessionId`
- `GET /packs`
- `GET /packs/:id`
- `GET /packs/slug/:slug` from source code
- `GET /products`
- `GET /products/:id`
- `GET /products/slug/:slug` from source code
- `GET /attributes`
- `GET /attributes/:code/options`

Assumptions made:

- The frontend store will use the public customer endpoints without JWT.
- Seeded question IDs are useful for local development, but the frontend should load all question/option data dynamically.
- `docs/openapi.json` is a generated snapshot but may be stale relative to current controller source.

Items not verified because of missing database, seed data, or environment access:

- Actual runtime UUIDs for attribute groups, attribute options, and quiz question option mappings after seeding.
- Actual Cloudinary media URLs in a seeded or production environment.
- Live CORS behavior for a specific Next.js origin.
- Live API response serialization of Prisma Decimal fields on public product responses.

Conflicts found between documentation/OpenAPI and code:

- `docs/openapi.json` and `frontend-handoff/openapi.json` inspected in this repo do not list `GET /packs/slug/:slug` or `GET /products/slug/:slug`, but both routes exist in current controllers.
- Swagger `RecommendationResponse` classes describe a nested `pack` and `items` shape, while `RecommendationsService` returns flat `recommendedPacks[]` fields such as `packId`, `packName`, `packCoverImage`, `packImages`, `selectedItems`, and `reason`.
- Older handoff documentation says recommendations return `reasonSummary` generally; current `POST /recommendations` returns `reason`, while `GET /recommendations/:sessionId` returns both `reasonSummary` and `reason`.
