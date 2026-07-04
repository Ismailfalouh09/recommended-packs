# Create From Cart Service

## Reason

The existing `orders.service.create()` method is tied to the quiz/recommendation funnel and builds order items from a selected `recommendationResultId`. Normal store checkout needs a separate service path that accepts direct cart lines, recalculates prices on the backend, and creates a COD order without a selected pack.

## Backend Change

* Method name: `createFromCart()`
* File path: `src/modules/orders/orders.service.ts`
* DTO used: `CreateCartOrderDto`
* Main validation logic: each cart line validates the product, reference, product/reference ownership, active/sellable status, quantity, and stock before any order is created.
* Price calculation logic: unit price is recalculated server-side using `priceOverride` when present, otherwise `product.basePrice + reference.priceDelta`. Line totals, subtotal, delivery fee, and total are calculated by the backend.
* Transaction behavior: the method reuses the existing customer upsert helper, clears previous default addresses, creates a new default address, creates the order with `selectedPackId`, `recommendationResultId`, and `customerProfileId` set to `null`, creates order item snapshots, and writes initial order status history.
* Response behavior: returns a frontend-usable order response with COD status, totals, customer/address summary, `pack: null`, and line items with price snapshots.

## No-Impact Confirmation

* Existing `orders.service.create()` untouched.
* Existing `CreateOrderDto` untouched.
* Existing `POST /orders` untouched.
* Quiz/recommendation flow untouched.
* Admin routes untouched.
* Existing public product and pack routes untouched.
* Prisma schema unchanged in this task.

## Validation Rules

Product:

* Product must exist.
* Product must be active.
* Product status must be `ACTIVE`.

Reference:

* Reference must exist.
* Reference must belong to the selected product.
* Reference must be active.

Quantity:

* Cart must contain at least one item.
* Each item quantity must be an integer of at least `1`.

Stock:

* Requested quantity for a reference must not exceed that reference's `stockQuantity`.
* Duplicate cart lines for the same reference are aggregated before stock validation.

Price calculation:

* Frontend price is ignored.
* Unit price uses `priceOverride` when present.
* Without `priceOverride`, unit price is `product.basePrice + reference.priceDelta`.
* Order item snapshots store product name, reference name, unit price, quantity, and line total.
* Delivery fee uses the backend's current flat `0` behavior.

## Verification Results

| Check | Result | Notes |
| ----- | ------ | ----- |
| `npm run build` | Passed | Nest build completed successfully. |
| `npm run test` | Passed | 16 test suites passed; 177 tests passed. |

## Next Step

The next backend task should be adding a new public controller route for normal cart checkout that calls `createFromCart()`.
