# Cart Checkout Route

## Reason

The normal ecommerce store needs to create COD orders from direct cart items. The existing `POST /orders` endpoint belongs to the quiz/recommendation funnel and requires `recommendationResultId`, so normal checkout needs a separate additive route.

## Backend Change

* Controller file: `src/modules/orders/orders.controller.ts`
* Route: `POST /orders/checkout`
* HTTP method: `POST`
* DTO used: `CreateCartOrderDto`
* Service method called: `ordersService.createFromCart(dto)`
* Response behavior: returns the cart order creation response with COD status, totals, customer/address summary, `pack: null`, and order line item snapshots.

Swagger was updated with:

* Request body example.
* `CartOrderCreateResponse` response model.
* Bad request response documentation.
* Product/reference not found response documentation.

## Route Contract

Endpoint:

```txt
POST /orders/checkout
```

Request example:

```json
{
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000001",
      "referenceId": "00000000-0000-0000-0000-000000000002",
      "quantity": 1
    }
  ],
  "fullName": "Test Customer",
  "phone": "0600000000",
  "whatsappPhone": "0600000000",
  "city": "Casablanca",
  "addressLine": "Test address",
  "extraInfo": "Near main street",
  "notes": "Call before delivery"
}
```

Response example:

```json
{
  "orderId": "00000000-0000-4000-8000-000000000001",
  "orderNumber": "ORD-20260612-0001",
  "orderStatus": "PENDING_CONFIRMATION",
  "paymentMethod": "CASH_ON_DELIVERY",
  "paymentStatus": "UNPAID",
  "subtotalAmount": 120,
  "discountAmount": 0,
  "deliveryFee": 0,
  "totalAmount": 120,
  "currency": "MAD",
  "customer": {
    "fullName": "Test Customer",
    "phone": "0600000000"
  },
  "address": {
    "city": "Casablanca",
    "addressLine": "Test address"
  },
  "pack": null,
  "items": [
    {
      "productId": "00000000-0000-0000-0000-000000000001",
      "productName": "Foundation X",
      "referenceId": "00000000-0000-0000-0000-000000000002",
      "referenceName": "RF2 Medium Warm",
      "quantity": 1,
      "unitPrice": 120,
      "totalPrice": 120
    }
  ]
}
```

Validation errors:

* Empty `items` array returns `400`.
* Invalid UUID fields return `400`.
* Missing required customer/address fields return `400`.
* Invalid quantity returns `400`.

Business errors:

* Missing product or reference returns `404`.
* Inactive product/reference returns `400`.
* Reference/product mismatch returns `400`.
* Insufficient stock returns `400`.
* Mixed currencies return `400`.

Manual curl tests prepared:

* Successful checkout: requires known active product/reference fixture data.
* Empty items array: executed successfully and returned `400`.
* Invalid UUID: covered by DTO validation and available for manual curl.
* Out-of-stock item: requires known out-of-stock product/reference fixture data.
* Inactive product/reference: requires known inactive product/reference fixture data.

## No-Impact Confirmation

* Existing `POST /orders` untouched.
* Existing `CreateOrderDto` untouched.
* Existing `orders.service.create()` untouched.
* Quiz/recommendation flow untouched.
* Admin routes untouched.
* `GET /orders/:id` untouched.
* Prisma schema unchanged in this task.

## Verification Results

| Check | Result | Notes |
| ----- | ------ | ----- |
| `npm run build` | Passed | Nest build completed successfully. |
| `npm run test` | Passed | 16 test suites passed; 177 tests passed. |
| `curl` empty items validation | Passed | Temporary app on port `3010`; `POST /orders/checkout` with `items: []` returned HTTP `400`. |

## Next Step

The next backend task should be final checkout flow verification and frontend handoff update.
