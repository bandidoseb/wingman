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
import { chatMessagesUsedToday, CHAT_DAILY_CAP } from "../../src/lib/wingman/chat-quota";

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
