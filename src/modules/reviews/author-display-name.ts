/**
 * Reviews & Ratings (Phase R2) — server-side author display name masking.
 *
 * A public review must never leak the customer's full identity. The stored
 * `authorDisplayName` is derived here from the customer's `fullName` and reduced
 * to a first name plus a last-name initial (e.g. "Ismail Falouh" -> "Ismail F.").
 * The customer never supplies this value; it is generated at create time so the
 * customerId, phone, and full name stay private.
 */
export function buildMaskedDisplayName(fullName: string | null | undefined): string {
  const parts = (fullName ?? '')
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return 'Anonymous';
  }

  const [first, ...rest] = parts;
  if (rest.length === 0) {
    return first;
  }

  const lastInitial = rest[rest.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}
