import type { Profile } from "@/types";

/**
 * Wingman Coach daily message quota — the CLIENT-SIDE mirror.
 *
 * The server is the enforcer (`src/app/api/wingman/../ai/chat/route.ts`); this
 * exists only so the UI can show an honest count and disable input at the cap.
 *
 * ⚠️ WHY THIS IS A SHARED FUNCTION AND NOT AN INLINE `?? 0`:
 * `profiles.chat_messages_today` is a RAW COUNTER that is only meaningful when
 * `chat_reset_date` is today. Read it directly and a rep returning the next
 * morning sees yesterday's total — e.g. "17 of 20 used" on a day they haven't
 * touched the Coach, with the input disabled at 20. Every surface that shows this
 * number must apply the same reset check, so there is exactly one copy of it.
 *
 * Mirrors the route exactly, including:
 *   - UTC (`toISOString().slice(0,10)`), NOT local time
 *   - a null/absent `chat_reset_date` counting AS today (so the counter is trusted
 *     rather than silently zeroed for legacy rows)
 *
 * If the route's cap or reset logic changes, change it here in the same commit.
 */
export const CHAT_DAILY_CAP = 20;

export function chatMessagesUsedToday(
  profile: Pick<Profile, "chat_messages_today" | "chat_reset_date">
): number {
  const utcToday = new Date().toISOString().slice(0, 10);
  const lastReset = profile.chat_reset_date ?? utcToday;
  return lastReset === utcToday ? (profile.chat_messages_today ?? 0) : 0;
}

/** UTC day key — the same slice the route and `chatMessagesUsedToday` use. */
export function utcDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * The client's view of the daily quota.
 *
 * `day` is what makes midnight safe. The previous version anchored `baseline` in a
 * `useRef` that was captured once and never reset: after UTC midnight the server
 * reports a fresh low count while `baseline` still holds yesterday's, so
 * `max(server, baseline + sent)` kept the stale high number and a rep who left the
 * tab open overnight stayed locked at the cap on a day they hadn't used.
 *
 * Rollover is detected by DATE, never by "the number went down". A value-based
 * check would misfire constantly: the profile prop lags every send, so a stale-but
 * -valid count is routinely lower than `baseline + sent`.
 */
export type QuotaState = {
  /** UTC day this baseline belongs to. */
  day: string;
  /** Server count when this day's baseline was captured. */
  baseline: number;
  /** Sends the server has ACCEPTED (200) since that baseline. */
  sent: number;
  /** Highest count the server itself has reported, live from chat replies. */
  serverLive: number;
};

export function initQuota(serverCount: number, day: string = utcDay()): QuotaState {
  return { day, baseline: serverCount, sent: 0, serverLive: serverCount };
}

/**
 * Fold in a server-reported count — from a chat reply (200 **or** 429) or from a
 * refreshed profile. This is the ONLY way `serverLive` moves.
 */
export function quotaReconcile(
  state: QuotaState,
  serverCount: number,
  day: string = utcDay()
): QuotaState {
  if (!Number.isFinite(serverCount) || serverCount < 0) return state;
  /*
    Re-anchor only FORWARDS. Day keys are "YYYY-MM-DD", so a lexicographic compare is
    a date compare.

    A LATER day means yesterday's baseline and sends describe a quota that no longer
    exists — re-anchor. An EARLIER day is never a real rollover: it is either clock
    skew (the profile-refresh path reports the CLIENT's day, chat replies report the
    SERVER's) or a reply that was in flight across midnight. The old `day !== state.day`
    treated both directions the same, so a client clock a few seconds ahead of the
    server flapped the anchor back and forth around midnight and wiped the new day's
    sends each time.
  */
  if (day > state.day) return initQuota(serverCount, day);
  if (day < state.day) return state;
  // Nothing to learn — return the SAME OBJECT so React bails out of the re-render.
  // This is what makes it free to poll this on a timer (see the rollover ticker in
  // DashboardClient): same-day ticks cost nothing, and only the midnight one renders.
  if (serverCount <= state.serverLive) return state;
  return { ...state, serverLive: serverCount };
}

/** Record a send the server accepted. Never call this optimistically. */
export function quotaOnSent(state: QuotaState): QuotaState {
  return { ...state, sent: state.sent + 1 };
}

/**
 * What every surface DISPLAYS as "used today".
 *
 * MAX, not sum: once a profile refresh lands, the server has already folded this
 * session's sends into its own count, so adding would double-count and cut the rep
 * off at half their quota. `baseline + sent` covers the opposite gap — the server
 * number is stale between refreshes while the chat box counts live.
 *
 * Clamped to the cap: the old code set `sent = CAP` on a 429, and with a non-zero
 * baseline that rendered "23 of 20 coaching messages used" and "-3 left".
 */
export function quotaUsed(state: QuotaState): number {
  return Math.min(CHAT_DAILY_CAP, Math.max(state.serverLive, state.baseline + state.sent));
}
