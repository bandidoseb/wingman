/**
 * owner.ts — single source of truth for "who is an owner."
 *
 * Owner-only surfaces (the /changelog page, the /owner founder cockpit, the
 * owner-gated devlog report API) all gate on this allowlist. To add an owner,
 * add their email here. To make a surface public, drop its gate — not this list.
 */
const ALLOWED_OWNER_EMAILS = new Set([
  "sebmattiasperez@gmail.com",
  "sebastian@meetwingman.ai",
  "yungseboo@gmail.com",
]);

/** True iff the (case-insensitive) email belongs to an owner account. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ALLOWED_OWNER_EMAILS.has(email.toLowerCase());
}
