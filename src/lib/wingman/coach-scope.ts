/**
 * Which conversation the unified Coach bar is talking about.
 *
 * The bar sits outside the tab switch, so "what am I asking about?" is no longer
 * implied by which screen is mounted. It is derived from two independent signals
 * that can disagree, and getting that disagreement wrong is expensive: a global
 * question answered against one call's transcript is a confidently wrong answer,
 * and a call question answered from 150-char summaries is the "which call do you
 * mean?" failure the single-call mode exists to prevent.
 *
 * Pure and dependency-free so it can be unit-tested — the component it drives is
 * not reachable from the test runner (vitest runs in `node`, no jsdom).
 *
 * THE TWO SIGNALS
 *
 *  · `derived`  — the call Flight Log currently has open. Reported by FlightLogTab
 *                 on select, on back, on the HUD deep-link, AND in an unmount
 *                 cleanup. The cleanup is load-bearing: FlightLogTab unmounts on
 *                 every tab change, so without it the bar would keep answering
 *                 about a call that is no longer on screen anywhere.
 *
 *  · `override` — set ONLY by a dive ("yes, dive into that call"). It outranks
 *                 `derived` because a dive is an explicit instruction, and it
 *                 deliberately SURVIVES a tab change: the dive itself navigates to
 *                 Flight Log, so clearing on tab change would cancel the very thing
 *                 it exists to serve.
 */

export const GLOBAL_SCOPE = "global";

export type ScopeState = {
  /** Set only by a dive. Outranks `derived`. */
  override: string | null;
  /** The call Flight Log has open, or null (list view / another tab). */
  derived: string | null;
  /**
   * A `derived` scope the rep dismissed with the chip's ✕, remembered by id.
   *
   * Without this, ✕ is a dead button: dropping the override leaves `derived`
   * untouched, the chip re-derives on the very next render, and the rep clicks it
   * again. Cleared the moment `derived` goes null, so LEAVING the call and
   * reopening it re-scopes — the dismissal is for this visit, not forever.
   */
  dismissedDerived: string | null;
};

export const INITIAL_SCOPE: ScopeState = {
  override: null,
  derived: null,
  dismissedDerived: null,
};

/** The thread key the bar is currently showing: a call id, or `"global"`. */
export function resolveScope(s: ScopeState): string {
  if (s.override) return s.override;
  if (s.derived && s.derived !== s.dismissedDerived) return s.derived;
  return GLOBAL_SCOPE;
}

/**
 * Flight Log opened, closed, or swapped the call on screen.
 *
 * A DIFFERENT non-null call drops the override — the rep has visibly moved on, and
 * an override outranking what they are looking at would answer about the old call
 * while the new one fills the screen. The SAME call leaves it alone (that is just
 * the dive's own navigation landing), and `null` leaves it alone too (a tab change).
 */
export function onDerivedChange(s: ScopeState, next: string | null): ScopeState {
  const override = next && next !== s.override ? null : s.override;
  // Leaving the call clears the dismissal — see `dismissedDerived`.
  const dismissedDerived = next === null ? null : s.dismissedDerived;
  if (override === s.override && dismissedDerived === s.dismissedDerived && next === s.derived) return s;
  return { override, derived: next, dismissedDerived };
}

/**
 * Jump straight to a scope — a dive resolving, or the rep picking a saved
 * conversation out of History. Both are explicit instructions, so both outrank
 * whatever Flight Log happens to have open.
 */
export function selectScope(s: ScopeState, scope: string): ScopeState {
  return scope === GLOBAL_SCOPE ? dismissScope(s) : onDive(s, scope);
}

/** A dive resolved. Only ever called with a call id that IS in the loaded list. */
export function onDive(s: ScopeState, callId: string): ScopeState {
  // Clear any dismissal for this id, or an explicit dive could land on a scope the
  // rep dismissed earlier in the session and be silently ignored.
  return {
    ...s,
    override: callId,
    dismissedDerived: s.dismissedDerived === callId ? null : s.dismissedDerived,
  };
}

/**
 * The scope chip's ✕. Drops the override AND suppresses the current derived call.
 *
 * This is the ONE way out of a call scope, and it is deliberately the only one.
 * The plan had "New chat" drop the override too, but that quietly costs the rep
 * data: dropping it changes the VISIBLE thread, so New chat would have to clear the
 * thread they land in as well — meaning "start over on this call" also wipes the
 * global coaching history and its 24h localStorage entry. New chat now means
 * "clear the conversation I'm looking at, stay where I am"; ✕ means "stop talking
 * about this call". Two buttons, two jobs, neither surprising.
 */
export function dismissScope(s: ScopeState): ScopeState {
  return { ...s, override: null, dismissedDerived: s.derived };
}
