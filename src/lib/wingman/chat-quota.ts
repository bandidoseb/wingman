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
