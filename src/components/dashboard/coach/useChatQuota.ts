"use client";

import { useCallback, useState } from "react";
import { initQuota, quotaOnSent, quotaReconcile, utcDay, type QuotaState } from "@/lib/wingman/chat-quota";

/**
 * The Coach's daily-quota mirror.
 *
 * Lives in DashboardClient, NOT in the Coach bar, for two reasons:
 *  1. the sidebar renders the same number, and two sources guarantee two numbers; and
 *  2. the midnight rollover ticker (also in DashboardClient) has to be able to
 *     re-anchor it — a ref captured once inside the bar could not, which is exactly
 *     how a rep who left the tab open overnight stayed locked at yesterday's cap.
 *
 * This is the surviving half of the old `useCoachSession`. The conversation half
 * (messages, suggestion, open/closing) moved into `CoachBar`, which owns threads
 * per scope and no longer needs anything lifted above the tab switch — the bar
 * itself never unmounts.
 */
export type ChatQuota = {
  quota: QuotaState;
  /** Record a send the server ACCEPTED. Never call optimistically. */
  markSent: () => void;
  /**
   * Fold in a count the server reported — from a 200, a 429, or a fresh profile.
   * Pass `day` whenever the server told us which day the count belongs to; relying
   * on the client clock across midnight re-anchors the new day to yesterday's total.
   */
  reportServerCount: (n: number, day?: string) => void;
};

export function useChatQuota(initialServerCount: number): ChatQuota {
  // Lazy initialiser: `initialServerCount` is only the SEED. Re-running it on every
  // render would wipe the session's sends on each parent re-render.
  const [quota, setQuota] = useState<QuotaState>(() => initQuota(initialServerCount));
  const markSent = useCallback(() => setQuota((q) => quotaOnSent(q)), []);
  const reportServerCount = useCallback(
    (n: number, day?: string) => setQuota((q) => quotaReconcile(q, n, day ?? utcDay())),
    []
  );
  return { quota, markSent, reportServerCount };
}
