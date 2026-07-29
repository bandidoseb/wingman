/**
 * Unit tests — Coach daily-quota client mirror.
 *
 * The bug this guards against: `chat_messages_today` is a raw counter that only
 * means anything when `chat_reset_date` is today. Read it directly (as the sidebar
 * did) and a rep returning the next morning sees yesterday's total — "17 of 20
 * used" on a day they haven't touched the Coach, input disabled at the cap.
 *
 * These assertions encode the SERVER's rules (ai/chat/route.ts): UTC dates, and a
 * null reset date counting AS today. If the two ever drift, the client either
 * locks users out early or lets them believe they have messages they don't.
 */
import { describe, it, expect } from "vitest";
import { chatMessagesUsedToday, coachMessagesUsed, CHAT_DAILY_CAP } from "../../src/lib/wingman/chat-quota";

const utcToday = () => new Date().toISOString().slice(0, 10);

describe("chatMessagesUsedToday", () => {
  it("returns the counter when the reset date is today", () => {
    expect(chatMessagesUsedToday({ chat_messages_today: 7, chat_reset_date: utcToday() })).toBe(7);
  });

  it("returns 0 when the counter is stale from a previous day", () => {
    expect(chatMessagesUsedToday({ chat_messages_today: 20, chat_reset_date: "2020-01-01" })).toBe(0);
  });

  it("treats a null reset date as today, matching the server's `?? today` default", () => {
    expect(chatMessagesUsedToday({ chat_messages_today: 4, chat_reset_date: null })).toBe(4);
  });

  it("handles a missing counter", () => {
    expect(chatMessagesUsedToday({ chat_messages_today: undefined, chat_reset_date: null })).toBe(0);
  });

  it("uses UTC, not local time", () => {
    // A local-time implementation would disagree with the server for anyone west
    // of UTC during their evening. Pin to UTC explicitly.
    const local = new Date();
    const localDate = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
    const used = chatMessagesUsedToday({ chat_messages_today: 3, chat_reset_date: utcToday() });
    expect(used).toBe(3);
    if (localDate !== utcToday()) {
      // Local date differs right now — prove we did NOT key off it.
      expect(chatMessagesUsedToday({ chat_messages_today: 3, chat_reset_date: localDate })).toBe(0);
    }
  });

  it("exposes the cap the server enforces", () => {
    expect(CHAT_DAILY_CAP).toBe(20);
  });
});

describe("coachMessagesUsed", () => {
  it("counts this session's sends before the server has caught up", () => {
    // Sidebar used to read serverCount alone and sat stale until a page reload.
    expect(coachMessagesUsed(1, 1, 2)).toBe(3);
  });

  it("does NOT double-count once a refresh folds sends into the server count", () => {
    // The bug this guards: baseline 1 + 2 sent = 3, and the refreshed server
    // count is also 3. Adding would say 5 and halve the rep's real quota.
    expect(coachMessagesUsed(1, 3, 2)).toBe(3);
  });

  it("follows the server upward when another surface spends messages", () => {
    // Mission Intel in Flight Log also burns quota; the server is the truth.
    expect(coachMessagesUsed(1, 9, 0)).toBe(9);
  });

  it("never goes backwards when the server count lags", () => {
    expect(coachMessagesUsed(4, 0, 1)).toBe(5);
  });

  it("forcing sentCount to the cap always reaches the limit", () => {
    // How the client locks itself after a server 429, for any baseline.
    for (const baseline of [0, 1, 7, 19, 20]) {
      expect(coachMessagesUsed(baseline, 0, CHAT_DAILY_CAP)).toBeGreaterThanOrEqual(CHAT_DAILY_CAP);
    }
  });
});
