# Pack Configuration Lifecycle

Phase 6 adds persistence and checkout for customer-configured Packs without
changing the legacy order or cart checkout paths.

Lifecycle:

```text
validate/persist configuration -> revalidate at checkout -> reserve stock ->
create normal OrderItems -> write immutable packConfigurationSnapshot
```

## Persist

- `POST /packs/:packId/configurations` reloads the Pack, runs the same
  server-authoritative configuration validator used by Phase 5, recomputes price
  and stock status, and persists only valid configurations.
- Invalid configurations return `400` and are not saved.
- Clients do not provide prices, provider IDs, snapshots, or storage details.

## Checkout

- `POST /configurations/:id/checkout` loads the saved configuration and current
  source Pack state.
- The saved composition is reconstructed and revalidated against live Pack
  rules, allowed references/add-ons, stock, active status, and price floor.
- Stale, out-of-stock, disallowed, inactive, non-customizable, or below-floor
  configurations are rejected before stock reservation or order creation.
- Successful checkout reserves stock through the existing order stock flow,
  creates normal `OrderItem` rows, and stores an immutable
  `Order.packConfigurationSnapshot`.

Existing `POST /orders`, `POST /orders/checkout`, and fixed Pack purchase remain
additive and unchanged.
