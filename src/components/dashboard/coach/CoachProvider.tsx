"use client";

import * as React from "react";
import type { Call } from "@/types";
import type { TranscriptEntry } from "@/lib/wingman/coach-payload";
import { applySessionOutcomes as applyOutcomes } from "@/lib/wingman/session-outcomes";

/**
 * Dashboard-wide state that outlives a tab.
 *
 * WHY THIS EXISTS: the unified Coach bar sits outside the tab switch and has to
 * answer questions about a call. Three things it needs would otherwise be trapped
 * inside `FlightLogTab`, which `DashboardClient` renders conditionally — so all
 * three would die on every tab change:
 *
 *   1. the fetched transcript (the dashboard query deliberately drops transcripts —
 *      see dashboard/page.tsx — so this fetch is the ONLY source),
 *   2. outcomes the rep confirmed this session, and
 *   3. which call Flight Log currently has open, which is what tells the bar
 *      whether "how did that go?" means one call or the last twenty.
 *
 * WHY A PROVIDER RATHER THAN DashboardClient's BODY: that component owns the live-call
 * hotkey handlers, the objection ledger and the Live Hub pill state machine. Putting a
 * ~1,400-row transcript in its state would drag it into that render path, and every
 * chat message would re-render the machinery running a live call. Here, `children` is
 * an element created by DashboardClient, so a state change re-renders only the
 * CONSUMERS — DashboardClient itself never re-renders.
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

/** Everything about a cached transcript EXCEPT the rows. Small enough to live in state. */
type TranscriptMeta = { provisional: boolean; rowCount: number };

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
   *
   * ⚠️ This must reach EVERY read of a call, not just the `calls` array. A call
   * resolved by id — the detail view's fallback, the Coach bar's per-send lookup —
   * that skips it renders as if the rep's ✓ never happened. That bug has shipped once.
   */
  applySessionOutcomes: (calls: Call[]) => Call[];

  /**
   * Read a cached transcript.
   *
   * ROWS LIVE IN A REF, NOT STATE. The Coach bar is an ALWAYS-MOUNTED consumer of
   * this context, so putting a 2-hour call's ~2,800 transcript rows into state would
   * copy them into the render path of a component that only ever needs them at send
   * time.
   *
   * Every ref write is paired with a `transcriptMeta` write in the SEPARATE context
   * below, so a component that renders in response to the meta always sees the
   * matching rows. Depend on the meta, never on this function's identity — it is
   * stable for the life of the provider and will never trigger anything.
   */
  getTranscript: (callId: string) => TranscriptEntry | undefined;
  setTranscript: (callId: string, entry: TranscriptEntry) => void;
  /** Calls the SERVER has confirmed will never get a debrief (zero rows, past grace). */
  noDebriefIds: Set<string>;
  markNoDebrief: (callId: string) => void;

  /**
   * The call Flight Log currently has open — the Coach bar's `derived` scope.
   *
   * Written by FlightLogTab on select, on back, on the HUD deep-link, and in an
   * unmount cleanup. The cleanup matters: FlightLogTab unmounts on every tab
   * change, so without it the bar would keep answering about a call that is no
   * longer on screen anywhere.
   */
  openCallId: string | null;
  setOpenCallId: (callId: string | null) => void;
};

const Ctx = React.createContext<CoachContext | null>(null);

/**
 * A SECOND context, holding only "what is cached and is it settled".
 *
 * React context has no selective subscription: one context means every consumer
 * re-renders whenever any part of the value changes. Flight Log is the only thing
 * that needs to re-render when a transcript lands (it draws the rows and re-arms the
 * provisional refetch); the always-mounted Coach bar reads rows through the ref at
 * send time and needs nothing. Splitting is what actually keeps the bar out of that
 * render — the comment claiming so was false while both lived in one value.
 */
const TranscriptMetaCtx = React.createContext<Record<string, TranscriptMeta>>({});

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [sessionOutcomes, setSessionOutcomes] = React.useState<Record<string, string>>({});
  const [noDebriefIds, setNoDebriefIds] = React.useState<Set<string>>(() => new Set());
  const [openCallId, setOpenCallIdState] = React.useState<string | null>(null);

  // Rows out of the render path — see `getTranscript`.
  const transcriptsRef = React.useRef<Map<string, TranscriptEntry>>(new Map());
  const [transcriptMeta, setTranscriptMeta] = React.useState<Record<string, TranscriptMeta>>({});

  const setSessionOutcome = React.useCallback((callId: string, outcome: string) => {
    setSessionOutcomes((prev) => ({ ...prev, [callId]: outcome }));
  }, []);

  const getTranscript = React.useCallback(
    (callId: string) => transcriptsRef.current.get(callId),
    []
  );

  const setTranscript = React.useCallback((callId: string, entry: TranscriptEntry) => {
    transcriptsRef.current.set(callId, entry);
    const meta: TranscriptMeta = { provisional: entry.provisional, rowCount: entry.rows?.length ?? 0 };
    setTranscriptMeta((prev) => {
      const cur = prev[callId];
      // Identical meta → same object, so a refetch that changed nothing observable
      // (the common case for a settled transcript) costs zero renders.
      if (cur && cur.provisional === meta.provisional && cur.rowCount === meta.rowCount) return prev;
      return { ...prev, [callId]: meta };
    });
  }, []);

  const markNoDebrief = React.useCallback((callId: string) => {
    setNoDebriefIds((prev) => (prev.has(callId) ? prev : new Set(prev).add(callId)));
  }, []);

  const setOpenCallId = React.useCallback((callId: string | null) => {
    setOpenCallIdState((prev) => (prev === callId ? prev : callId));
  }, []);

  // The overlay itself is a pure function in lib/ so it can be unit-tested — it is
  // the one piece of this state that can silently change a number on screen.
  const applySessionOutcomes = React.useCallback(
    (calls: Call[]): Call[] => applyOutcomes(calls, sessionOutcomes),
    [sessionOutcomes]
  );

  // Deliberately does NOT include `transcriptMeta` — see TranscriptMetaCtx.
  const value = React.useMemo(
    () => ({
      sessionOutcomes, setSessionOutcome, applySessionOutcomes,
      getTranscript, setTranscript,
      noDebriefIds, markNoDebrief,
      openCallId, setOpenCallId,
    }),
    [
      sessionOutcomes, setSessionOutcome, applySessionOutcomes,
      getTranscript, setTranscript,
      noDebriefIds, markNoDebrief,
      openCallId, setOpenCallId,
    ]
  );

  return (
    <Ctx.Provider value={value}>
      <TranscriptMetaCtx.Provider value={transcriptMeta}>{children}</TranscriptMetaCtx.Provider>
    </Ctx.Provider>
  );
}

export function useCoachContext(): CoachContext {
  const ctx = React.useContext(Ctx);
  // Throwing beats a silent default: a missing provider would otherwise show an
  // empty transcript and a coach confidently reporting "nothing was captured".
  if (!ctx) throw new Error("useCoachContext must be used inside <CoachProvider>");
  return ctx;
}

/**
 * Subscribe to transcript CACHE STATE (not rows). Call this only where a render has
 * to react to a transcript landing — today that is FlightLogTab alone.
 */
export function useTranscriptMeta(): Record<string, TranscriptMeta> {
  return React.useContext(TranscriptMetaCtx);
}
