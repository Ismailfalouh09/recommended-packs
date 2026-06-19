# Checkout Manual Test Plan

## Scope

This plan covers the final manual verification for normal store cart checkout after the additive backend checkout work.

Primary route:

- `POST /orders/checkout`

Routes that must remain unchanged:

- `POST /orders`
- `GET /orders/:id`
- Quiz and recommendation routes
- Admin routes

## Test Data Notes

The successful local smoke test used an active product reference returned by `GET /products`:

| Field | Value |
| ----- | ----- |
| Product | Sahra Pore Smooth Primer |
| Reference | Oil Control |
| Quantity | 1 |
| Created order number | ORD-20260619-0C393C |
| Total | 109 MAD |

If this fixture changes, choose another active product reference with `stockQuantity >= 1` from `GET /products`.

## Manual Test Matrix

| Case | Purpose | Steps | Expected Result | Current Status |
| ---- | ------- | ----- | --------------- | -------------- |
| Successful one-item checkout | Confirm normal store COD order works. | Fetch `GET /products`, choose an active product reference with stock, then submit one item to `POST /orders/checkout`. | HTTP 201; response includes `orderId`, `orderNumber`, `PENDING_CONFIRMATION`, `CASH_ON_DELIVERY`, `UNPAID`, totals, `pack: null`, and line item snapshot. | Passed by curl smoke test. |
| Multiple quantity checkout | Confirm quantity affects totals and stock validation. | Submit one cart line with `quantity > 1` where stock is sufficient. | HTTP 201; line total equals backend recalculated unit price times quantity. | Covered by service tests; ready for manual retest with stock fixture. |
| Multiple item checkout | Confirm cart can contain several product/reference lines. | Submit two or more valid cart lines in `items`. | HTTP 201; subtotal is the sum of all backend-recalculated line totals. | Supported by service path; ready for manual fixture test. |
| Empty cart | Confirm non-empty cart validation. | Submit `items: []` to `POST /orders/checkout`. | HTTP 400 validation failure. | Passed by curl smoke test. |
| Invalid UUID | Confirm DTO validation rejects malformed IDs. | Submit invalid `productId` or `referenceId`. | HTTP 400 validation failure. | Passed by curl smoke test. |
| Reference not linked to product | Confirm product/reference mismatch protection. | Submit a valid product ID with a reference ID from another product. | HTTP 400 with reference mismatch error. | Covered by service tests; ready for manual fixture test. |
| Out of stock | Confirm stock guard. | Submit a quantity greater than reference `stockQuantity`. | HTTP 400 with insufficient stock error. | Covered by service tests; ready for manual fixture test. |
| Inactive product/reference | Confirm inactive catalog entries cannot be ordered. | Submit IDs for inactive product or inactive reference from admin/test data. | HTTP 400; inactive product/reference rejected. | Covered by service tests; requires admin fixture for manual retest. |
| Existing funnel order | Confirm `POST /orders` still behaves as recommendation checkout. | Run an existing recommendation funnel order request with `recommendationResultId`. | Existing funnel behavior remains unchanged and requires `recommendationResultId`. | Existing tests passed; route and DTO unchanged. |
| Admin route protection | Confirm admin routes were not loosened. | Call protected admin endpoints without a bearer token. | Admin endpoints remain protected by existing guards. | OpenAPI/security check passed; admin code unchanged. |

## Curl Examples

Empty cart validation:

```bash
curl -i -X POST http://localhost:3010/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [],
    "fullName": "Smoke Test Customer",
    "phone": "0600000000",
    "city": "Casablanca",
    "addressLine": "Test address"
  }'
```

Successful checkout shape:

```bash
curl -i -X POST http://localhost:3010/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "PRODUCT_UUID_FROM_GET_PRODUCTS",
        "referenceId": "REFERENCE_UUID_FROM_GET_PRODUCTS",
        "quantity": 1
      }
    ],
    "fullName": "Smoke Test Customer",
    "phone": "0600000000",
    "whatsappPhone": "0600000000",
    "city": "Casablanca",
    "addressLine": "Test address",
    "extraInfo": "Smoke test",
    "notes": "Created by checkout smoke test"
  }'
```

## Verification Commands

| Command | Result | Notes |
| ------- | ------ | ----- |
| npm run build | Passed | Nest build completed successfully. |
| npm run test | Passed | 16 suites passed, 177 tests passed. |
| npx prisma validate | Passed | Prisma schema is valid. |
| npm run swagger:generate | Passed | OpenAPI files regenerated. |
| npm run swagger:check | Passed | OpenAPI check completed successfully. |

## Manual Retest Recommendation

Before frontend launch, repeat the successful checkout test against staging data and record:

- Product ID
- Reference ID
- Quantity
- Order number
- Total amount
- Admin dashboard visibility of the created COD order
