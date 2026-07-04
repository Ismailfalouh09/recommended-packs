# Frontend Handoff V2

Generated on 2026-07-02 from the current backend source and `docs/openapi.json`.

OpenAPI is the main source of truth. Both JSON and YAML formats were generated successfully and copied into this folder.

This revision includes creation-time catalog media upload support for admin product and product-reference create flows, plus per-reference (per-shade) multi-image galleries: admin CRUD under `/admin/product-references/{referenceId}/gallery-images`, and `galleryImages` + `primaryImageUrl` on every reference in the public product-detail response.

Files:

- `openapi.json`: latest generated OpenAPI contract.
- `openapi.yaml`: latest generated OpenAPI contract in YAML.
- `FRONTEND_HANDOFF_V2.md`: integration notes and verification snapshot.
- `PAGE_ENDPOINT_MAPPING.md`: page-to-endpoint readiness mapping.
- `KNOWN_LIMITATIONS.md`: confirmed backend limitations.
- `.env.example`: frontend-safe environment placeholders.
