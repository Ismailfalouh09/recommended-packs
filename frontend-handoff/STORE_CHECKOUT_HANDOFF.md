# Store Checkout Handoff

## Purpose

Normal store checkout is now available for direct product cart orders. This is separate from the quiz/recommendation funnel checkout.

Frontend can build a cart from public product references and submit the cart as a Cash on Delivery order.

## Endpoint

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| POST | `/orders/checkout` | Public | Create a normal store Cash on Delivery order from cart items. |

Use `GET /products` or `GET /products/:id` to collect valid `productId` and `referenceId` values for cart lines.

## Request Body

```json
{
  "items": [
    {
      "productId": "00000000-0000-4000-8000-000000000001",
      "referenceId": "00000000-0000-4000-8000-000000000002",
      "quantity": 1
    }
  ],
  "fullName": "Demo Customer",
  "phone": "0600000000",
  "whatsappPhone": "0600000000",
  "city": "Casablanca",
  "addressLine": "Maarif",
  "extraInfo": "Near the pharmacy",
  "notes": "Call before delivery"
}
```

## Request Fields

| Field | Required | Notes |
| ----- | -------- | ----- |
| `items` | Yes | Must be a non-empty array. |
| `items[].productId` | Yes | Must be a UUID from the public product catalog. |
| `items[].referenceId` | Yes | Must be a UUID for a reference that belongs to the selected product. |
| `items[].quantity` | Yes | Must be an integer of at least `1`. |
| `fullName` | Yes | Trimmed string. |
| `phone` | Yes | Trimmed string; backend creates or reuses a customer by phone. |
| `whatsappPhone` | No | Trimmed string when provided. |
| `city` | Yes | Trimmed string. |
| `addressLine` | Yes | Trimmed string. |
| `extraInfo` | No | Optional delivery directions. |
| `notes` | No | Optional order note for fulfillment. |

Do not send frontend-calculated prices, totals, discounts, delivery fees, payment status, order status, pack ID, or recommendation IDs to this route.

## Success Response

The route returns HTTP 201 with an order confirmation payload:

```json
{
  "orderId": "134b90ce-8d2c-4119-9da0-0a5e914a2f7c",
  "orderNumber": "ORD-20260619-0C393C",
  "orderStatus": "PENDING_CONFIRMATION",
  "paymentMethod": "CASH_ON_DELIVERY",
  "paymentStatus": "UNPAID",
  "subtotalAmount": 109,
  "discountAmount": 0,
  "deliveryFee": 0,
  "totalAmount": 109,
  "currency": "MAD",
  "customer": {
    "fullName": "Smoke Test Customer",
    "phone": "0600000000"
  },
  "address": {
    "city": "Casablanca",
    "addressLine": "Test address"
  },
  "pack": null,
  "items": [
    {
      "productId": "product-id",
      "productName": "Sahra Pore Smooth Primer",
      "referenceId": "reference-id",
      "referenceName": "PRIMER-OIL Oil Control",
      "quantity": 1,
      "unitPrice": 109,
      "totalPrice": 109
    }
  ]
}
```

## Backend Behavior

- Creates a Cash on Delivery order.
- Sets `paymentMethod` to `CASH_ON_DELIVERY`.
- Sets `paymentStatus` to `UNPAID`.
- Sets `orderStatus` to `PENDING_CONFIRMATION`.
- Sets `selectedPackId` to `null`.
- Sets `recommendationResultId` to `null`.
- Creates order item snapshots for product name, reference name, unit price, quantity, and line total.
- Returns `pack: null` because normal store checkout is not pack-based.

## Backend Validation

The backend validates and recalculates checkout server-side:

- Product must exist.
- Product must be active and have status `ACTIVE`.
- Reference must exist.
- Reference must belong to the submitted product.
- Reference must be active.
- Requested quantity is aggregated by reference and checked against `stockQuantity`.
- All cart items must use the same currency.
- Unit price is recalculated from `reference.priceOverride` when present; otherwise from `product.basePrice + reference.priceDelta`.
- Delivery fee is currently `0`.
- Discount is currently `0`.

## Common Errors

The backend uses the Nest default error shape.

```json
{
  "statusCode": 400,
  "message": ["items should not be empty"],
  "error": "Bad Request"
}
```

Expected error cases:

| Status | Cause |
| ------ | ----- |
| 400 | Empty cart, invalid UUIDs, invalid quantity, inactive product, inactive reference, reference/product mismatch, insufficient stock, mixed currencies. |
| 404 | Product or reference does not exist. |

## Frontend Flow

1. Load products from `GET /products`.
2. Store selected `productId`, `referenceId`, and quantity in frontend cart state.
3. Submit cart and customer delivery fields to `POST /orders/checkout`.
4. Show confirmation using `orderNumber`, totals, COD status, and returned line items.
5. Persist `orderId` and `orderNumber` for the confirmation page.

## OpenAPI

Generated contracts are available at:

- docs/openapi.json
- docs/openapi.yaml

The OpenAPI contract includes:

- `POST /orders/checkout`
- `CreateCartOrderDto`
- `CartOrderItemDto`
- `CartOrderCreateResponse`
- Checkout request example
- 400 and 404 response declarations

## No-Impact Confirmation

- Existing quiz/recommendation checkout still uses `POST /orders`.
- Existing `CreateOrderDto` is unchanged.
- Existing `orders.service.create()` is unchanged.
- Existing `GET /orders/:id` is unchanged.
- Admin routes are unchanged.
