# Pack Fixed Purchase Flow (Phase 4B)

> **Scope:** Direct Cash-on-Delivery purchase of a single **fixed,
> non-customizable Pack** as one unit.
> **Companion to** [PACK_CORE_EVOLUTION_MASTER_PLAN.md](./PACK_CORE_EVOLUTION_MASTER_PLAN.md) (Phase 4)
> , [PACK_PUBLIC_DISCOVERY.md](./PACK_PUBLIC_DISCOVERY.md) (Phase 4A), and
> [PACK_CORE_EVOLUTION_PROGRESS.md](./PACK_CORE_EVOLUTION_PROGRESS.md).
>
> **Out of scope (later phases):** customization, `PackConfiguration`, configured
> checkout, wishlist/sharing, quiz-preconfigured/generated packs. In this phase
> `Order.packConfigurationSnapshot` stays `null`.

---

## 1. What changed

One **additive** endpoint lets a customer place a COD order for a single fixed
pack. It reuses the existing order machinery (customer upsert, address creation,
pricing, atomic stock reservation, per-line snapshots, status history) — no order
logic is duplicated. The existing `POST /orders` (recommendation funnel) and
`POST /orders/checkout` (cart) paths are **unchanged**.

### New endpoint

```
POST /packs/:packId/order
```

- **Body:** [`CreatePackOrderDto`](../src/modules/orders/dto/create-pack-order.dto.ts)
  — customer + delivery fields only (`fullName`, `phone`, `whatsappPhone?`,
  `city`, `addressLine`, `extraInfo?`, `notes?`). **No items and no price are
  accepted from the client.**
- **Response:** the same `OrderCreateResponse` shape as `POST /orders`
  (`orderId`, amounts, `customer`, `address`, `pack {id,name}`, `items[]`).
- **Payment:** `CASH_ON_DELIVERY`, `UNPAID`, `PENDING_CONFIRMATION`.

The pack (and therefore its items, references, and price) is identified solely by
the `:packId` route parameter and expanded/priced server-side.

---

## 2. Server flow

Implemented in [`OrdersService.createFromFixedPack`](../src/modules/orders/orders.service.ts)
and invoked from [`PacksController`](../src/modules/packs/packs.controller.ts).
Everything runs in a single Prisma transaction:

1. **Load** the pack with its items, each item's product, and the product's
   references (`loadFixedPurchasePack`). `NotFoundException` if it does not exist.
2. **Validate** (`validateFixedPurchasePack`):
   - Pack must be `status = ACTIVE` and `isActive = true` (else `400`).
   - Pack must be **non-customizable** (`isCustomizable = false`) (else `400`).
   - **No** item may be `role = REQUIRED_SELECTABLE` or
     `selectionMode = CUSTOMER_CHOICE` (else `400`).
   - Pack must be **available now** — reuses the shared, side-effect-free
     [`isPackAvailableNow`](../src/modules/packs/pack-availability.util.ts): every
     blocking (`FIXED` / `REQUIRED_SELECTABLE`) item must have a usable reference.
3. **Expand** (`buildFixedPackItemSnapshots`): only `FIXED`-role items form the
   fixed composition. This exactly matches the availability blocking set (once
   `REQUIRED_SELECTABLE` is rejected), so a pack judged available always reserves
   cleanly. Each item resolves to **one concrete reference server-side**
   (`resolveFixedPackReference`):
   - `FIXED_REFERENCE` → its pinned reference (must be active + in stock).
   - `AUTO_BEST_REFERENCE` → the first active, in-stock reference in the product's
     deterministic (`referenceCode`) order.
4. **Price** (`applyPackPriceMode`, shared with the funnel path) — see §3.
5. **Reserve** stock atomically via the existing
   [`OrderStockService.reserveForNewOrder`](../src/modules/orders/order-stock.service.ts).
6. **Persist** customer (upsert by phone), a new default address, the `Order`
   (`selectedPackId = packId`, `customerProfileId = null`,
   `recommendationResultId = null`), the expanded `OrderItem`s (each with
   `packId` set), and initial status history.

---

## 3. Pricing (server-authoritative)

Line snapshots use `effectiveProductReferencePrice` (reference `priceOverride`,
else product `basePrice + priceDelta`). The pack's `priceMode` is then applied by
the shared `applyPackPriceMode` helper — identical to the recommendation-funnel
order path:

| `priceMode` | `subtotalAmount` | `discountAmount` | `totalAmount` |
| --- | --- | --- | --- |
| `FIXED` | `pack.fixedPrice` (required; `400` if missing) | `0` | `pack.fixedPrice` |
| `SUM_ITEMS` | Σ line totals | `0` | Σ line totals |
| `SUM_ITEMS_WITH_DISCOUNT` | Σ line totals | `discountAmount` or `discountPercentage` (capped at subtotal) | `max(subtotal − discount, 0)` |

`deliveryFee` is `0` (consistent with the other pack order path). No client value
influences any amount.

---

## 4. Rejection matrix

| Condition | Result |
| --- | --- |
| Pack not found | `404 NotFound` |
| Pack inactive / archived | `400 BadRequest` |
| Pack `isCustomizable = true` | `400 BadRequest` |
| Any `REQUIRED_SELECTABLE` / `CUSTOMER_CHOICE` item | `400 BadRequest` |
| A blocking item has no active in-stock reference (not available now) | `400 BadRequest` |
| Pack has no `FIXED` (purchasable) items | `400 BadRequest` |
| Concurrent oversell at reservation time | `400 BadRequest` (atomic guard) |

---

## 5. Tests

[`orders.service.pack.spec.ts`](../src/modules/orders/orders.service.pack.spec.ts):
successful fixed pack COD order · items expanded with `packId` · `FIXED` price
mode · `SUM_ITEMS` price mode · atomic stock reservation called · unavailable
required item rejected (and no reservation) · customizable pack rejected ·
required-selectable rejected · customer-choice rejected · inactive/archived pack
rejected · `AUTO_BEST_REFERENCE` auto-selects an in-stock reference · existing
recommendation funnel and cart checkout paths unchanged.

---

## 6. Backward compatibility

- `POST /orders` and `POST /orders/checkout` behavior is byte-for-byte preserved
  (the price-mode logic was extracted into `applyPackPriceMode` with no change to
  outcomes; covered by the existing `orders.service.spec.ts` suite).
- No schema/migration changes in this phase.
- `Order.packConfigurationSnapshot` remains `null`.
