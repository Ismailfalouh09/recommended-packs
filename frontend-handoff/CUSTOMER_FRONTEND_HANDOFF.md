# Customer Frontend Handoff

This backend is ready to support a mobile-first customer quiz funnel and a read-only customer storefront. It does not contain frontend code, customer authentication, cart sessions, or direct regular-store checkout yet.

## Backend Start

```bash
npm install
npx prisma validate
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

## URLs

- API base URL: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON endpoint: `http://localhost:3000/api/docs-json`

For local browser development, set the backend CORS origin to the frontend dev server origin:

```env
ADMIN_DASHBOARD_ORIGIN="http://localhost:5173"
```

The variable name is admin-oriented, but currently it is the single CORS origin used by the backend. Use the exact deployed customer frontend origin in production.

## Public Customer Endpoints

No bearer token is required for these endpoints.

### Quiz Funnel

- `GET /quiz/questions`
- `POST /quiz/profiles`
- `POST /recommendations`
- `GET /recommendations/:sessionId`
- `POST /orders`
- `GET /orders/:id`

### Storefront Catalog

- `GET /products`
- `GET /products/:id`
- `GET /packs`
- `GET /packs/:id`
- `GET /attributes`
- `GET /attributes/:code/options`

There are no public category, brand, search, filter, slug, cart, or direct product checkout endpoints yet.

## Recommended Mobile Customer Flow

1. Load quiz questions with `GET /quiz/questions`.
2. Render one question per step, ordered by `stepOrder`.
3. Submit answers to `POST /quiz/profiles`.
4. Use `customerProfileId` from the profile response to call `POST /recommendations`.
5. Show `recommendedPacks`; use `recommendationResultId` as the checkout selection ID.
6. Create a Cash on Delivery order with `POST /orders`.
7. Show the order confirmation using the order response or `GET /orders/:id`.

## Quiz Questions

`GET /quiz/questions` returns active quiz questions only.

Important fields:

- `id`: question UUID.
- `questionText`: main question copy.
- `helperText`: optional helper copy.
- `selectionType`: currently seeded as `SINGLE`; enum also supports `MULTIPLE`.
- `isRequired`: required questions must be answered.
- `stepOrder`: use this for mobile step order.
- `attributeGroup.code`: the stable value to send back as `attributeGroupCode`.
- `options[].code`: the stable value to send back as `attributeOptionCode`.
- `options[].displayLabel`: prefer this for UI when present; otherwise use `label`.
- `options[].displayImageUrl`: optional plain image URL.

Example shape:

```json
[
  {
    "id": "00000000-0000-4000-8000-000000000001",
    "questionText": "What is your skin color?",
    "helperText": null,
    "selectionType": "SINGLE",
    "isRequired": true,
    "stepOrder": 1,
    "attributeGroup": {
      "code": "SKIN_COLOR",
      "name": "Skin Color"
    },
    "options": [
      {
        "id": "option-id",
        "attributeOptionId": "attribute-option-id",
        "code": "MEDIUM",
        "label": "Medium",
        "displayLabel": "Medium",
        "displayImageUrl": null
      }
    ]
  }
]
```

## Create Quiz Profile

`POST /quiz/profiles`

Use quiz codes, not UUIDs, in the request.

```json
{
  "sourceChannel": "INSTAGRAM",
  "answers": [
    { "attributeGroupCode": "SKIN_COLOR", "attributeOptionCode": "MEDIUM" },
    { "attributeGroupCode": "UNDERTONE", "attributeOptionCode": "WARM" },
    { "attributeGroupCode": "SKIN_TYPE", "attributeOptionCode": "OILY" },
    { "attributeGroupCode": "STYLE", "attributeOptionCode": "NATURAL" },
    { "attributeGroupCode": "BUDGET", "attributeOptionCode": "MEDIUM" }
  ]
}
```

`sourceChannel` is optional and defaults to `DIRECT`.

Allowed `sourceChannel` values:

- `INSTAGRAM`
- `WHATSAPP`
- `TIKTOK`
- `FACEBOOK`
- `DIRECT`
- `OTHER`

Validation rules:

- `answers` must be a non-empty array.
- Required active quiz questions must be answered.
- Only one answer per attribute group is accepted.
- Codes are normalized to uppercase by the backend.
- The selected option must belong to the selected group.

Response:

```json
{
  "customerProfileId": "profile-id",
  "sessionToken": "profile-session-token",
  "sourceChannel": "INSTAGRAM",
  "answers": [
    { "attributeGroupCode": "SKIN_COLOR", "attributeOptionCode": "MEDIUM" }
  ]
}
```

Store `customerProfileId` for recommendation generation. `sessionToken` is returned but there is no customer-session API around it yet.

## Generate Recommendations

`POST /recommendations`

```json
{
  "customerProfileId": "profile-id"
}
```

The response contains ranked pack recommendations. Use `recommendationResultId` from the selected pack when creating the order.

```json
{
  "sessionId": "recommendation-session-id",
  "recommendedPacks": [
    {
      "recommendationResultId": "recommendation-result-id",
      "packId": "pack-id",
      "packName": "Natural Glow Pack",
      "packCoverImage": {
        "urls": {
          "card": "https://...",
          "detail": "https://..."
        }
      },
      "rank": 1,
      "totalScore": 83,
      "matchPercentage": 92,
      "reason": {},
      "selectedItems": [
        {
          "productId": "product-id",
          "productName": "Foundation X",
          "referenceId": "reference-id",
          "referenceName": "RF2 Medium Warm",
          "quantity": 1,
          "itemScore": 65
        }
      ]
    }
  ]
}
```

`GET /recommendations/:sessionId` returns the stored session later. Its result shape is similar, but includes extra session metadata such as `customerProfileId`, `algorithmVersion`, `totalCandidatePacks`, `totalRecommendedPacks`, `status`, and `createdAt`.

## Create Order

`POST /orders`

Orders currently require a `recommendationResultId`. This means checkout is supported from the recommendation funnel, not from an arbitrary storefront cart.

```json
{
  "recommendationResultId": "recommendation-result-id",
  "fullName": "Demo Customer",
  "phone": "0600000000",
  "whatsappPhone": "0600000000",
  "city": "Casablanca",
  "addressLine": "Maarif",
  "extraInfo": "Near the pharmacy",
  "notes": "Call before delivery"
}
```

Required fields:

- `recommendationResultId`
- `fullName`
- `phone`
- `city`
- `addressLine`

Optional fields:

- `whatsappPhone`
- `extraInfo`
- `notes`

Order behavior:

- Payment method is always `CASH_ON_DELIVERY`.
- Initial payment status is `UNPAID`.
- Initial order status is `PENDING_CONFIRMATION`.
- The backend creates or updates a customer by `phone`.
- A new default delivery address is created for the customer.
- Product and reference names/prices are snapshotted into order items.
- Stock is validated at order creation, but stock reservation/deduction is not implemented yet.

Response:

```json
{
  "orderId": "order-id",
  "orderNumber": "ORD-20260619-ABC123",
  "orderStatus": "PENDING_CONFIRMATION",
  "paymentMethod": "CASH_ON_DELIVERY",
  "paymentStatus": "UNPAID",
  "subtotalAmount": 299,
  "discountAmount": 0,
  "deliveryFee": 0,
  "totalAmount": 299,
  "currency": "MAD",
  "customer": {
    "fullName": "Demo Customer",
    "phone": "0600000000"
  },
  "address": {
    "city": "Casablanca",
    "addressLine": "Maarif"
  },
  "pack": {
    "id": "pack-id",
    "name": "Natural Glow Pack"
  },
  "items": [
    {
      "productId": "product-id",
      "productName": "Foundation X",
      "referenceId": "reference-id",
      "referenceName": "RF2 Medium Warm",
      "quantity": 1,
      "unitPrice": 129,
      "totalPrice": 129
    }
  ]
}
```

## Public Order Summary

`GET /orders/:id`

This is safe for a public confirmation page. It intentionally excludes phone, address, notes, line items, and status history.

```json
{
  "orderId": "order-id",
  "orderNumber": "ORD-20260619-ABC123",
  "orderStatus": "PENDING_CONFIRMATION",
  "paymentStatus": "UNPAID",
  "totalAmount": 299,
  "currency": "MAD",
  "packName": "Natural Glow Pack",
  "createdAt": "2026-06-19T12:00:00.000Z",
  "updatedAt": "2026-06-19T12:00:00.000Z"
}
```

## Storefront Products

`GET /products` returns all active products. There is no pagination or filtering yet.

`GET /products/:id` returns one active product by UUID. There is no public slug route yet.

Important fields:

- `id`, `name`, `slug`, `description`
- `basePrice`, `currency`
- `category`
- `brand`
- `references`
- `coverImage`
- `images`

Reference pricing:

- If `reference.priceOverride` is present, use that as the unit price.
- Otherwise use `product.basePrice + reference.priceDelta`.

Image fields:

- `coverImage.urls.card`: recommended for mobile cards.
- `coverImage.urls.detail`: recommended for product detail.
- `references[].image.urls.swatch`: recommended for shade swatches when present.
- Always use `altText` when present.

## Storefront Packs

`GET /packs` returns all active packs ordered by priority and creation date.

`GET /packs/:id` returns one active pack by UUID with product references included for product items where available.

Important fields:

- `id`, `name`, `slug`, `description`
- `priceMode`: `FIXED`, `SUM_ITEMS`, or `SUM_ITEMS_WITH_DISCOUNT`
- `fixedPrice`
- `discountAmount`
- `discountPercentage`
- `minBudget`, `maxBudget`
- `currency`
- `items`
- `coverImage`
- `images`

For display price:

- `FIXED`: show `fixedPrice`.
- `SUM_ITEMS`: sum selected item/reference prices on the frontend only for display; backend order creation still uses recommendation result snapshots.
- `SUM_ITEMS_WITH_DISCOUNT`: sum item/reference prices, then apply either `discountAmount` or `discountPercentage` when present.

Pack item `selectionMode` values:

- `FIXED_REFERENCE`: the backend/admin fixed the exact reference.
- `AUTO_BEST_REFERENCE`: recommendation engine chooses the best reference.
- `CUSTOMER_CHOICE`: intended for customer choice, but there is no order API yet to submit an alternate customer-selected reference. Current recommendation/order flow uses the selected recommendation result.

## Attributes

`GET /attributes` and `GET /attributes/:code/options` are public helpers for rendering reusable option lists. The quiz funnel should normally use `GET /quiz/questions` because it contains the active question text, order, required flag, and quiz-specific option display fields.

Seeded customer attribute groups:

- `SKIN_COLOR`: `LIGHT`, `MEDIUM`, `DARK`
- `UNDERTONE`: `COOL`, `NEUTRAL`, `WARM`
- `SKIN_TYPE`: `DRY`, `OILY`, `COMBINATION`, `SENSITIVE`, `NORMAL`
- `STYLE`: `NATURAL`, `SOFT_GLAM`, `GLAM`, `DAILY`
- `BUDGET`: `LOW`, `MEDIUM`, `HIGH`

## Money And Currency

- Money values are returned as JSON numbers.
- Seeded/default currency is `MAD`.
- Delivery fee is currently `0`.
- Cash on Delivery is the only payment method.

## Error Shape

The backend uses Nest's default error shape.

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

Validation messages may be returned as an array of strings.

Common customer errors:

- `400`: invalid quiz answers, duplicate quiz group, missing required answer, profile has no answers, inactive product/reference, out-of-stock reference.
- `404`: unknown product, pack, customer profile, recommendation session, recommendation result, or order.

## Frontend State To Persist

For a mobile-first funnel, persist these IDs locally until checkout is complete:

- `customerProfileId`
- `sessionToken`
- `recommendationSessionId`
- selected `recommendationResultId`
- created `orderId`
- created `orderNumber`

There is no customer login or refresh-token flow, so treat these as short-lived funnel state rather than an authenticated account.

## Current Backend Gaps For Customer Frontend

- No customer auth/account area.
- No public category or brand list endpoint.
- No public product/pack query filters, search, pagination, or sorting.
- No public product/pack lookup by slug.
- No cart model or cart API.
- No direct checkout for arbitrary product/reference selections.
- No ability to override `CUSTOMER_CHOICE` recommendation references during order creation.
- No online payment.
- No shipping quote, delivery provider, or tracking API.
- No WhatsApp/SMS/email integration.
- No stock reservation or automatic stock deduction.
