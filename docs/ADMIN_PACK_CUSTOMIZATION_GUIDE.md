# Admin Pack Customization Guide

This guide covers the admin API surface for managing Pack customization rules.
It is admin-only and does not change public Pack discovery, checkout, fixed Pack
purchase, recommendation logic, or frontend behavior.

## Endpoints

- `POST /admin/packs` creates a Pack with customization rules.
- `PATCH /admin/packs/:id` updates Pack scalar fields and replaces nested
  `items`, `attributes`, `allowedAddOns`/`allowedAddOnIds`, or `compatibility`
  only when those arrays are provided.
- `GET /admin/packs/:id` returns customization fields, item rules, allowed
  references, allowed add-ons, and compatibility profile data.

## Pack-level fields

- `isCustomizable`: enables configurable Pack rule validation when `true`.
- `minAllowedPrice`: server-side floor for customer configurations.
- `minRequiredItems`: minimum included line-item count after valid removals.
- `maxItemCount`: maximum included line-item count after add-ons.

`maxItemCount` must not be lower than `minRequiredItems`.
`minAllowedPrice` must not exceed the Pack default sellable price.

## Item rules

Each `items[]` entry can carry:

- `role`: `FIXED`, `REQUIRED_SELECTABLE`, `OPTIONAL_INCLUDED`, or
  `OPTIONAL_ADDON`.
- `allowedReferenceIds`: ProductReference IDs allowed for a required selection
  or replacement.
- `minQuantity` / `maxQuantity`: coherent quantity bounds.
- `quantityEditable`: whether the customer may change quantity.
- `removalAllowed`: whether an optional included item may be removed.
- `replacementAllowed`: whether a fixed/optional item may use an allowed
  replacement reference.

For customizable Packs, `REQUIRED_SELECTABLE` items must use
`selectionMode: CUSTOMER_CHOICE` and must define at least one active, in-stock
allowed reference belonging to that item product.

## Allowed add-ons

Use either legacy product-only input:

```json
{
  "allowedAddOnIds": ["<product-id>"]
}
```

or the richer additive form:

```json
{
  "allowedAddOns": [
    {
      "productId": "<product-id>",
      "productReferenceId": "<optional-pinned-reference-id>"
    }
  ]
}
```

For customizable Packs, add-on products must be active and have an active,
in-stock reference. If `productReferenceId` is provided, it must belong to the
add-on product and be active/in stock.

## Compatibility profile

`compatibility[]` is managed on the same admin create/update APIs. Each criterion
may appear once. `UNIVERSAL` criteria must not include option codes.
`RESTRICTED` criteria must include canonical option codes from the criterion's
mapped AttributeGroup.

## Backward compatibility

Fixed non-customizable Packs still use the existing admin flow. Omitting
customization fields defaults to a fixed, non-customizable Pack, and partial
updates preserve omitted nested items, allowed references, add-ons, attributes,
and compatibility profiles.
