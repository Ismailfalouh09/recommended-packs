# Create Cart Order DTO

## Reason

The current `POST /orders` flow is built for the quiz/recommendation funnel and requires `recommendationResultId`. Normal store checkout needs a separate request shape because the customer orders direct cart lines made of products, references, and quantities. A new DTO keeps the future cart checkout path additive and avoids changing the existing funnel contract.

## No-Impact Strategy

* Existing `CreateOrderDto` was not changed.
* Existing `POST /orders` was not changed.
* Existing `orders.service.create()` was not changed.
* Quiz/recommendation flow was not changed.
* Admin routes were not changed.
* Prisma schema was not changed in this task.

## DTO Created

* File path: `src/modules/orders/dto/create-cart-order.dto.ts`
* DTO classes: `CartOrderItemDto`, `CreateCartOrderDto`

### Fields

`CartOrderItemDto`:

* `productId: string`
* `referenceId: string`
* `quantity: number`

`CreateCartOrderDto`:

* `items: CartOrderItemDto[]`
* `fullName: string`
* `phone: string`
* `whatsappPhone?: string`
* `city: string`
* `addressLine: string`
* `extraInfo?: string`
* `notes?: string`

### Validation Rules

`CartOrderItemDto`:

* `productId` must be a UUID.
* `referenceId` must be a UUID.
* `quantity` is transformed to a number, must be an integer, and must be at least `1`.

`CreateCartOrderDto`:

* `items` must be an array.
* `items` must be non-empty.
* `items` validates nested `CartOrderItemDto` entries.
* `fullName`, `phone`, `city`, and `addressLine` use the same trim, string, and non-empty style as `CreateOrderDto`.
* `whatsappPhone`, `extraInfo`, and `notes` are optional trimmed strings.

### Swagger Examples

The DTO includes Swagger examples for:

* `productId`: `00000000-0000-4000-8000-000000000001`
* `referenceId`: `00000000-0000-4000-8000-000000000002`
* `quantity`: `2`
* `fullName`: `Demo Customer`
* `phone`: `0600000000`
* `whatsappPhone`: `0600000000`
* `city`: `Casablanca`
* `addressLine`: `Maarif`
* `extraInfo`: `Near the pharmacy`
* `notes`: `Call before delivery`

## Verification Results

| Check | Result | Notes |
| ----- | ------ | ----- |
| `npm run build` | Passed | Nest build completed successfully. |
| `npm run test` | Passed | 16 test suites passed; 169 tests passed. |

## Next Step

The next backend task should be adding a new `createFromCart()` service method in `orders.service.ts`, using this DTO, without touching the existing funnel `create()` method.
