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
import {
  chatMessagesUsedToday,
  CHAT_DAILY_CAP,
  initQuota,
  quotaOnSent,
  quotaReconcile,
  quotaUsed,
} from "../../src/lib/wingman/chat-quota";

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

const DAY1 = "2026-07-29";
const DAY2 = "2026-07-30";

describe("quotaUsed", () => {
  it("counts this session's sends before the server has caught up", () => {
    // The sidebar used to read the server count alone and sat stale until a reload.
    let q = initQuota(1, DAY1);
    q = quotaOnSent(quotaOnSent(q));
    expect(quotaUsed(q)).toBe(3);
  });

  it("does NOT double-count once a refresh folds sends into the server count", () => {
    // baseline 1 + 2 sent = 3, and the refreshed server count is also 3. Adding
    // would say 5 and halve the rep's real quota.
    let q = initQuota(1, DAY1);
    q = quotaOnSent(quotaOnSent(q));
    q = quotaReconcile(q, 3, DAY1);
    expect(quotaUsed(q)).toBe(3);
  });

  it("follows the server upward when another surface spends messages", () => {
    // Flight Log's Mission Intel also burns quota; the server is the truth.
    const q = quotaReconcile(initQuota(1, DAY1), 9, DAY1);
    expect(quotaUsed(q)).toBe(9);
  });

  it("never goes backwards when the server count lags behind our sends", () => {
    // The profile prop trails every send. A stale-but-valid LOW count must not
    // look like a reset — that is why rollover is keyed on the date, not the value.
    let q = initQuota(4, DAY1);
    q = quotaOnSent(q);
    q = quotaReconcile(q, 4, DAY1); // stale profile, same day
    expect(quotaUsed(q)).toBe(5);
  });

  it("CLAMPS to the cap — the sidebar used to render '23 of 20'", () => {
    // Old behaviour: a 429 set sent = CAP, and max(server, baseline + CAP) with a
    // baseline of 3 displayed 23 used and "-3 left".
    let q = initQuota(3, DAY1);
    for (let i = 0; i < CHAT_DAILY_CAP; i++) q = quotaOnSent(q);
    expect(quotaUsed(q)).toBe(CHAT_DAILY_CAP);
  });
});

describe("quotaReconcile — midnight rollover", () => {
  it("re-anchors on a new UTC day so an overnight tab is not locked at the cap", () => {
    // THE BUG: baseline lived in a useRef captured once. After midnight the server
    // reports a fresh low count while baseline still holds yesterday's, so the max
    // kept the stale high number and the rep stayed capped on a day they had not used.
    let q = initQuota(12, DAY1);
    for (let i = 0; i < 8; i++) q = quotaOnSent(q); // 20 used — at the cap
    expect(quotaUsed(q)).toBe(CHAT_DAILY_CAP);

    q = quotaReconcile(q, 1, DAY2); // first send of the new day
    expect(quotaUsed(q)).toBe(1);
    expect(q.sent).toBe(0);
    expect(q.day).toBe(DAY2);
  });

  it("re-anchors from a refreshed profile alone — no send required", () => {
    // A tab open past midnight gets no reply to learn from. chatMessagesUsedToday
    // self-heals to 0 on the date check, and that 0 is what re-anchors us.
    let q = initQuota(17, DAY1);
    q = quotaReconcile(q, 0, DAY2);
    expect(quotaUsed(q)).toBe(0);
  });

  it("ignores a garbage count rather than corrupting the state", () => {
    const q = initQuota(5, DAY1);
    expect(quotaReconcile(q, NaN, DAY1)).toEqual(q);
    expect(quotaReconcile(q, -3, DAY1)).toEqual(q);
  });

  it("a 429's reported count pins the display without a local guess", () => {
    // The 429 now carries messagesUsedToday, so the client no longer invents CAP.
    const q = quotaReconcile(initQuota(2, DAY1), CHAT_DAILY_CAP, DAY1);
    expect(quotaUsed(q)).toBe(CHAT_DAILY_CAP);
  });

  it("returns the SAME OBJECT when there is nothing new — React must bail out", () => {
    // Load-bearing, not an optimisation: DashboardClient polls this every 60s to
    // deliver the rollover to a tab nobody is touching. If a same-day tick produced
    // a new object, that would be a re-render a minute, forever, on an idle app.
    const q = initQuota(5, DAY1);
    expect(quotaReconcile(q, 5, DAY1)).toBe(q);
    expect(quotaReconcile(q, 3, DAY1)).toBe(q);
    expect(quotaReconcile(q, 6, DAY1)).not.toBe(q);
  });

  it("uses the SERVER's day, so a reply crossing midnight can't eat the new day", () => {
    // Sent 23:59:58, received 00:00:02. The server counted it against DAY1. Trusting
    // the client clock here would re-anchor DAY2's baseline to yesterday's 15 — the
    // rep would show 16/20 all day with 15 messages actually left.
    let q = initQuota(14, DAY1);
    q = quotaReconcile(q, 15, DAY1); // server says: still day 1
    expect(q.day).toBe(DAY1);
    expect(quotaUsed(q)).toBe(15);

    // The next day's first profile refresh re-anchors properly.
    q = quotaReconcile(q, 0, DAY2);
    expect(quotaUsed(q)).toBe(0);
  });
});
