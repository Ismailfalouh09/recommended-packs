# Known Limitations

OpenAPI is the main source of truth for implemented endpoint shapes. These limitations are based on the current source and generated contract.

## Not Implemented

- Customer authentication/accounts.
- Admin refresh-token flow.
- Admin user management CRUD.
- Persistent cart CRUD resource.
- Online payment provider integration.
- Delivery-provider integration or carrier tracking.
- WhatsApp/SMS/email provider sending integration.
- Direct signed browser-to-Cloudinary uploads.
- Dedicated media relationship endpoints for brand logos, attribute option images, and quiz option images.

## Partial Or Operationally Constrained

- Checkout is implemented, but Cash on Delivery is the only payment method.
- Cart-line checkout exists through `POST /orders/checkout`, but carts are not stored as backend resources.
- Order tracking is limited to backend order status, with no delivery-provider events.
- Recommendation logic is rule-based V1.
- Review submission is implemented but depends on delivered-order eligibility and moderation.
- Media upload depends on Cloudinary configuration and uses backend-mediated multipart upload. Admin product and product-reference images can be uploaded during creation or later through edit-time media endpoints.
- Each product reference has one swatch image plus an ordered multi-image gallery (`/admin/product-references/{referenceId}/gallery-images`). Exactly one gallery image per reference is primary; this is managed server-side (first upload becomes primary, deleting the primary promotes the next by position) and cannot be set to zero-or-multiple primaries from the client.
