/**
 * Pack Core Evolution (Phase 8B) — Universal Share Support.
 *
 * Builds the small, storefront-safe metadata block that lets a client render a
 * share/Open Graph card for an active public Product or Pack (and the read-only
 * shared Pack configuration view). It only ever composes fields that are already
 * public: the canonical public path/slug, a display title, a short description,
 * and a cover image URL. No admin, cost, margin, stock-internal, recommendation,
 * or private data is ever touched here.
 */
export interface ShareMetadata {
  shareUrl: string;
  shareTitle: string;
  shareDescription: string | null;
  shareImageUrl: string | null;
}

export interface ShareMetadataInput {
  /** Canonical public path, e.g. `/products/foundation-x` or `/packs/glow`. */
  path: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
}

/** Share descriptions are trimmed to a compact, card-friendly length. */
const MAX_SHARE_DESCRIPTION_LENGTH = 300;

/**
 * Resolves the public storefront origin from the environment. When configured,
 * share URLs are absolute (ready to drop into a share sheet); otherwise the
 * canonical relative path is returned so the caller can resolve it against its
 * own origin. Reuses the same `STORE_FRONTEND_ORIGIN` value the API already
 * trusts for CORS — a comma-separated list is allowed, and the first entry wins.
 */
function resolveStorefrontOrigin(): string | null {
  const raw = process.env.STORE_FRONTEND_ORIGIN?.split(',')[0]?.trim();
  if (!raw) {
    return null;
  }
  return raw.replace(/\/+$/, '');
}

function buildShareUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const origin = resolveStorefrontOrigin();
  return origin ? `${origin}${normalizedPath}` : normalizedPath;
}

function normalizeDescription(description?: string | null): string | null {
  if (!description) {
    return null;
  }
  const trimmed = description.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > MAX_SHARE_DESCRIPTION_LENGTH
    ? `${trimmed.slice(0, MAX_SHARE_DESCRIPTION_LENGTH - 1).trimEnd()}…`
    : trimmed;
}

export function buildShareMetadata(input: ShareMetadataInput): ShareMetadata {
  return {
    shareUrl: buildShareUrl(input.path),
    shareTitle: input.title,
    shareDescription: normalizeDescription(input.description),
    shareImageUrl: input.imageUrl ?? null,
  };
}
