# Reviews & Ratings Progress

## Architecture Decisions
- Reviews support PRODUCT and PACK.
- A review requires a DELIVERED order.
- Order UUID is the current verified-purchase credential.
- Phone is not treated as proof of ownership.
- Review starts PENDING and becomes public only after APPROVED.
- Only masked author display name is public.

## Completed
- Phase R1 items actually implemented:
  - `Review` model + `ReviewTargetType` / `ReviewStatus` enums added to the
    Prisma schema, with `Review[]` back-relations on `Product`, `Pack`,
    `Customer`, and `Order`.
  - Migration `20260701170000_reviews_and_ratings_foundation` creates the
    `reviews` table, its indexes, and the cascading foreign keys.
  - Database CHECK constraints enforce invariants Prisma cannot express:
    rating bounded 1..5 (`reviews_rating_range_check`) and PRODUCT/PACK XOR
    consistency with `target_type` (`reviews_target_xor_check`).
  - Per-`(customer, order, target)` duplicate protection via two partial-safe
    unique indexes (product-scoped and pack-scoped; NULLs distinct in Postgres).
  - Server-authoritative verified-purchase gate `assertReviewEligibility`
    (`src/modules/reviews/review-eligibility.ts`): requires the order to exist,
    be DELIVERED, belong to the reviewing customer, and actually contain the
    target (`selectedPackId` for PACK, an `OrderItem` for PRODUCT).
  - `customerId`, `orderId`, `status`, and `isVerifiedPurchase` are
    server-owned; never accepted from a client.
  - Unit tests pass (10/10): `review-eligibility.spec.ts` covers the
    eligibility rules and asserts the migration's constraints are present.

- Phase R2 items actually implemented (`src/modules/reviews/`):
  - Customer write API (`reviews.controller.ts`, `reviews.service.ts`):
    - `POST /reviews` — creates a PENDING review. Ownership is derived from the
      order (`Order.customerId`); no `customerId` is ever accepted from the
      client. Reuses the Phase R1 `assertReviewEligibility` gate (delivered +
      owned + target contained). `authorDisplayName` is generated and masked
      server-side (`author-display-name.ts`: first name + last initial).
      Duplicate `(customer, order, target)` reviews are rejected via the R1
      unique index (P2002 → 409 Conflict). `isVerifiedPurchase` and `status`
      are server-owned.
    - `PATCH /reviews/:reviewId` — edits a still-PENDING review. Requires the
      original `orderId` as ownership proof (no login). Only `rating/title/
      comment` change; target/order/customer are immutable. The edit keeps the
      review PENDING for re-moderation. APPROVED/REJECTED are locked (403).
    - `DELETE /reviews/:reviewId?orderId=` — deletes a PENDING review with the
      original order as proof. APPROVED/REJECTED are locked (403).
  - Public read API (`public-reviews.controller.ts`):
    - `GET /products/:slug/reviews`, `GET /packs/:slug/reviews` — APPROVED
      reviews only, paginated (`page`, `limit`), with a safe rating summary
      (`ratingAverage`, `reviewCount`) computed from APPROVED reviews on read
      (no cached aggregate columns). Public fields only: `rating`, `title`,
      `comment`, `authorDisplayName`, `isVerifiedPurchase`, `createdAt`.
  - Privacy: phone, address, `customerId`, `orderId`, target foreign keys, quiz
    data, scores, costs, and margins are never returned by any review endpoint.
  - `ReviewsModule` wired into `AppModule`; OpenAPI regenerated and verified.
  - Focused unit tests (28/28) in `reviews.service.spec.ts` and
    `author-display-name.spec.ts` cover create (product/pack), non-delivered
    rejection, duplicate rejection, edit/delete with correct vs wrong order,
    APPROVED/REJECTED lock, APPROVED-only public reads, APPROVED-only
    average/count, and absence of private fields.

## Phase R2.5 — Review Images
- Optional image attachments for pending reviews
- Images are public only after review approval
- Video/reels intentionally deferred

Implemented (`src/modules/reviews/` + `src/modules/media/`):
- Schema: additive `ReviewImage` join table (`review_images`) linking one
  `Review` to one `MediaAsset`, ordered by `position`, with both FKs cascading.
  Migration `20260701180000_review_images`. Back-relations added: `Review.images`
  and `MediaAsset.reviewImages`. No image bytes are stored in PostgreSQL and no
  separate file store was introduced — the existing Cloudinary media pipeline is
  reused end to end.
- Media approach: `MediaService.uploadReviewImage` / `deleteReviewImage` reuse
  the shared `ImageFileValidationPipe` (same JPEG/PNG/WEBP allow-list and size
  limit) and storage provider. Customer uploads persist a `MediaAsset` with a
  null `uploadedByAdminId` (no admin actor), tagged `usageContext=REVIEW_IMAGE`.
  `countMediaReferences` now also counts review images so admin media deletion
  cannot orphan a review's photo.
- Endpoints (`reviews.controller.ts`):
  - `POST /reviews/:reviewId/images` — multipart upload (`file` + `orderId`).
  - `DELETE /reviews/:reviewId/images/:imageId?orderId=` — detach one image.
- Ownership & locking: image add/remove reuse the exact `orderId` credential and
  `loadEditableReview` gate used by review edit/delete. Only PENDING reviews
  accept image changes; APPROVED/REJECTED are locked (403). Max 5 images per
  review, enforced up front and re-checked inside the write transaction.
- Public visibility: the public product/pack read layer only ever returns
  APPROVED reviews, so their images are inherently public; PENDING review images
  never appear publicly. Owners see their own (possibly pending) image previews
  in write responses because ownership is proven via the order credential.
- Privacy: review-image responses expose only display URLs plus harmless
  dimensions (id, position, mimeType, format, width, height, urls, createdAt).
  Raw `publicId`, `folder`, `providerAssetId`, `secureUrl`, `mediaId`,
  `uploadedByAdminId`, and storage keys are never returned.
- Tests (`review-images.spec.ts`, 12): pending product/pack upload, 5-image cap
  with rollback, ordering, wrong-order rejection (upload + remove), APPROVED and
  REJECTED locks, pending images hidden publicly, approved images shown publicly,
  and no private storage detail leakage. Existing review/media suites updated for
  the new relation (48/48 review+media tests pass).

## Next
- Phase R3: admin moderation (approve/reject) — must approve/reject the review
  and its images together — and cached rating aggregates.

## Deferred
- Admin moderation APIs
- Rating aggregate cache
- Frontend stars/review form
- Review videos / reels / audio / external media URLs (Phase R2.5 is images only)
