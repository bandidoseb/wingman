"use client";

import * as React from "react";
import type { Call } from "@/types";
import type { TranscriptEntry } from "@/lib/wingman/coach-payload";
import { applySessionOutcomes as applyOutcomes } from "@/lib/wingman/session-outcomes";

/**
 * Dashboard-wide state that outlives a tab.
 *
 * WHY THIS EXISTS: the unified Coach bar (PR 4) sits outside the tab switch and has
 * to answer questions about a call. Two things it needs are currently trapped inside
 * `FlightLogTab`, which `DashboardClient` renders conditionally — so both die on
 * every tab change:
 *
 *   1. the fetched transcript (the dashboard query deliberately drops transcripts —
 *      see dashboard/page.tsx — so this fetch is the ONLY source), and
 *   2. outcomes the rep confirmed this session.
 *
 * WHY A PROVIDER RATHER THAN DashboardClient's BODY: that component owns the live-call
 * hotkey handlers, the objection ledger and the Live Hub pill state machine. Putting a
 * ~1,400-row transcript in its state would drag it into that render path, and every
 * chat message would re-render the machinery running a live call. Here, `children` is
 * an element created by DashboardClient, so a state change re-renders only the
 * CONSUMERS — DashboardClient itself never re-renders.
 *
 * This PR is a lift ONLY. Behaviour must be identical; the bar arrives in PR 4.
 */

/*
 * Transcript shapes are re-exported from coach-payload, not redeclared: they were
 * defined in both places and were only structurally compatible by luck.
 *
 * `provisional` means the fetch raced the call still being written — rows flush
 * every ~25s, so its emptiness proves nothing and it is refetched once the debrief
 * lands.
 */
export type { TranscriptEntry, TranscriptStatus } from "@/lib/wingman/coach-payload";

type CoachContext = {
  /**
   * Outcomes confirmed this session, overlaid on the server rows.
   *
   * Deliberately NOT followed by `router.refresh()`: on the dashboard that re-runs
   * the full 20-calls query (the ~180MB/2000× regression from PR #54). The server
   * copy is already correct; this keeps the UI honest until the next natural load.
   *
   * ONE map for the whole dashboard. Home and Flight Log each kept their own, in
   * different shapes — Home's applied `outcome_source: "manual"` so stats counted
   * it, Flight Log's was a bare string — so a confirmation in one was invisible to
   * the other.
   */
  sessionOutcomes: Record<string, string>;
  setSessionOutcome: (callId: string, outcome: string) => void;
  /**
   * Apply this session's confirmations over server rows. PURE and NOT memoised —
   * it maps on every call. Wrap the result in `useMemo` at the call site, or the
   * fresh array will invalidate every effect dependency that touches it. (It does
   * return the SAME array when nothing has been confirmed, which is the common case.)
   */
  applySessionOutcomes: (calls: Call[]) => Call[];

  transcripts: Record<string, TranscriptEntry>;
  setTranscript: (callId: string, entry: TranscriptEntry) => void;
  /** Calls the SERVER has confirmed will never get a debrief (zero rows, past grace). */
  noDebriefIds: Set<string>;
  markNoDebrief: (callId: string) => void;
};

const Ctx = React.createContext<CoachContext | null>(null);

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [sessionOutcomes, setSessionOutcomes] = React.useState<Record<string, string>>({});
  const [transcripts, setTranscripts] = React.useState<Record<string, TranscriptEntry>>({});
  const [noDebriefIds, setNoDebriefIds] = React.useState<Set<string>>(() => new Set());

  const setSessionOutcome = React.useCallback((callId: string, outcome: string) => {
    setSessionOutcomes((prev) => ({ ...prev, [callId]: outcome }));
  }, []);

  const setTranscript = React.useCallback((callId: string, entry: TranscriptEntry) => {
    setTranscripts((prev) => ({ ...prev, [callId]: entry }));
  }, []);

  const markNoDebrief = React.useCallback((callId: string) => {
    setNoDebriefIds((prev) => (prev.has(callId) ? prev : new Set(prev).add(callId)));
  }, []);

  // The overlay itself is a pure function in lib/ so it can be unit-tested — it is
  // the one piece of this lift that can silently change a number on screen.
  const applySessionOutcomes = React.useCallback(
    (calls: Call[]): Call[] => applyOutcomes(calls, sessionOutcomes),
    [sessionOutcomes]
  );

  const value = React.useMemo(
    () => ({
      sessionOutcomes, setSessionOutcome, applySessionOutcomes,
      transcripts, setTranscript,
      noDebriefIds, markNoDebrief,
    }),
    [sessionOutcomes, setSessionOutcome, applySessionOutcomes, transcripts, setTranscript, noDebriefIds, markNoDebrief]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCoachContext(): CoachContext {
  const ctx = React.useContext(Ctx);
  // Throwing beats a silent default: a missing provider would otherwise show an
  // empty transcript and a coach confidently reporting "nothing was captured".
  if (!ctx) throw new Error("useCoachContext must be used inside <CoachProvider>");
  return ctx;
}
