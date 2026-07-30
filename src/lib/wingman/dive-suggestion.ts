/**
 * What the Coach's pending call-suggestion should be after a chat reply.
 *
 * Extracted as a pure function because getting it wrong costs real money, and the
 * component it used to live inside is not reachable from the test runner.
 *
 * THE BUG THIS ENCODES (fixed 2026-07-29): `setSuggestion(null)` lived inside a
 * branch keyed on `diveReady.callData.id` — a field the route never sends, because
 * its select has no `id`. The branch was dead, so the suggestion NEVER cleared.
 * `pendingCallId` then rode every later global send, the model re-fired DIVE_NOW,
 * and each message re-read the full call row PLUS the entire transcript and paid
 * for another Sonnet call and another daily-quota decrement. Silently, until reload.
 *
 * THE RULE:
 *   · `diveFailed` marks a TRANSIENT failure ("just say 'try again'"). The retry is
 *     only possible while the client still holds the call id, so keep it.
 *   · Everything else settles to whatever this turn produced — normally nothing,
 *     which is what actually clears a stale suggestion. That includes a successful
 *     dive AND the permanent "that call has no transcript" case, where retrying
 *     could never succeed and would just re-run the fetch and the model call.
 */

export type CallSuggestion = { call_id: string; name: string };

/**
 * The dive half of the /api/ai/chat response — declared ONCE and imported by both
 * the route that emits it and the client that reads it.
 *
 * This exists because the original bug was invisible: the route sent `callData`
 * (no `id`) and the client read `callData.id`. `res.json()` is `any`, so the two
 * sides were connected by nothing but two independently-typed string literals, and
 * TypeScript stayed green while the feature was dead for its entire life. With one
 * declaration, renaming a key breaks both ends at compile time.
 *
 * `callData` is `unknown` here on purpose: only the server needs its shape (it is
 * echoed back verbatim by Flight Log), and pinning it would drag the route's
 * private `CallRow` into shared code.
 */
export type ChatDiveReady = {
  openerReply: string;
  /** The id to actually OPEN — the route's already-UUID-validated pendingCallId. */
  callId: string;
  callData: unknown;
};

/** The fields of the /api/ai/chat response this decision depends on. */
export type DiveReplyFields = {
  callSuggestion?: CallSuggestion | null;
  /** Transient dive failure — the rep was told to retry. */
  diveFailed?: boolean;
};

export function nextSuggestion(
  current: CallSuggestion | null,
  res: DiveReplyFields
): CallSuggestion | null {
  if (res.diveFailed) return current;
  // `call_id` must be present, not just the object: this value comes from an
  // untyped `res.json()`, and a suggestion without an id would be sent as a body
  // with `pendingCallId: undefined` — which JSON.stringify drops entirely, landing
  // straight in the "DIVE_NOW with no id" path this module exists to keep out of.
  return res.callSuggestion?.call_id ? res.callSuggestion : null;
}
