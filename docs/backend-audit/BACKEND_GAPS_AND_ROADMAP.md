# Backend Gaps And Roadmap

Date: 2026-07-02

## P0: Must Fix Before Real Customers

- Confirm production environment configuration: `DATABASE_URL`, `JWT_SECRET`, Cloudinary credentials, CORS origins, and admin bootstrap process.
- Confirm stock behavior for every checkout path: direct order, cart-line checkout, fixed pack order, and pack-configuration checkout. Decide whether current reservation/deduction behavior is sufficient for live inventory.
- Add or document customer/order lookup risk controls. Public order lookup currently exposes a safe summary by ID, but production should decide whether an additional verification token/order number/phone check is required.
- Run manual end-to-end API testing against a seeded local/staging database using the Postman checklist before launch.
- Confirm error monitoring/logging and backup/restore practices for PostgreSQL and Cloudinary assets.

## P1: Important For MVP Launch

- Add refresh-token/session-expiry handling for admin dashboard UX, or document short-lived token re-login behavior.
- Add admin user management or a documented operational process for creating/deactivating admins.
- Decide whether a persistent cart resource is required for the storefront. Current checkout accepts cart-line payloads but does not expose cart CRUD.
- Add delivery/shipping operational fields or integration if order tracking must go beyond the current status workflow.
- Add direct relationship endpoints for brand logos, attribute option images, and quiz option images if the admin dashboard must manage those images as media assets instead of plain URLs.
- Expand production-grade API/e2e coverage for checkout, status transitions, review eligibility, and media upload failure cases.

## P2: Later Operational Improvements

- Direct signed browser-to-Cloudinary uploads to reduce backend upload load.
- Online payment provider support beyond Cash on Delivery.
- WhatsApp/SMS/email provider integration using the existing message/event foundations.
- Customer accounts and authenticated self-service order history.
- Recommendation analytics, A/B testing, or ML-assisted ranking after the rule-based V1 is stable.
- Back-office dashboards for operational metrics, low stock, review queues, and media usage.
