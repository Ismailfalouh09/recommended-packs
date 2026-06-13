# Known Limitations

These are current backend limitations for the admin dashboard frontend.

## Not Implemented

- Stock reservation and automatic stock deduction.
- WhatsApp integration.
- Delivery-provider integration.
- Refresh-token flow.
- Online payment.
- Admin user management CRUD.
- Customer authentication.
- Direct browser-to-Cloudinary signed upload.

## Media Limitations

Implemented catalog media relationships:

- Product cover and gallery.
- Pack cover and gallery.
- Category image.
- Product-reference swatch.

Not yet implemented as dedicated Cloudinary relationship endpoints:

- Brand logo upload relationship.
- Attribute option image upload relationship.
- Quiz option image upload relationship.

Existing `logoUrl`, `imageUrl`, and `displayImageUrl` fields may still be managed as plain URLs where present.

## API Shape Notes

- Some admin list responses use a general paginated shape instead of one unique OpenAPI response class per resource.
- The backend uses Nest's default exception response shape and does not add `timestamp` or `path`.
- Generic `/admin/media/upload` creates unassigned media; catalog pages should prefer entity-specific image endpoints.

## Business Workflow Limitations

- Cash on Delivery is the only payment method.
- No delivery tracking or shipping provider workflow exists.
- Recommendation logic is rule-based V1, not ML-based.
- Public order lookup is intentionally a safe summary and does not expose full customer details.
