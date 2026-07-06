"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Profile, Call, VaultObjection, VaultSignal, CallStageLabel } from "@/types";
import Sidebar from "@/components/dashboard/Sidebar";
import HomeTab from "@/components/dashboard/HomeTab";
import FlightLogTab from "@/components/dashboard/FlightLogTab";
import ObjectionVaultTab from "@/components/dashboard/ObjectionVaultTab";
import SignalVaultTab from "@/components/dashboard/SignalVaultTab";
import IntelTab from "@/components/dashboard/IntelTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import PersonalizeTab from "@/components/dashboard/PersonalizeTab";
import FlightPlanTab from "@/components/dashboard/FlightPlanTab";
import PaywallModal from "@/components/ui/PaywallModal";
import { FREE_CALL_LIMIT } from "@/lib/constants";
import { getDefaultStage } from "@/lib/wingman/poll-intervals";
import { parseSSEBuffer } from "@/lib/wingman/sse-parse";
import { HOT_PARTIAL_MS, SETTLE_WAIT_MS } from "@/lib/wingman/live-tail";
import { useWingmanPoller } from "@/hooks/useWingmanPoller";
import { useRecallTranscript } from "@/hooks/useRecallTranscript";

export type DashboardTab = "home" | "flight-plan" | "library" | "objections" | "signals" | "intel" | "settings" | "personalize";

interface Props {
  profile: Profile;
  initialCalls: Call[];
  initialObjections: VaultObjection[];
  initialSignals: VaultSignal[];
  userId: string;
}

function isPaywallActive(profile: Profile): boolean {
  const isSubscribed = profile.subscription_status === "active";
  const hitLimit     = (profile.calls_used ?? 0) >= FREE_CALL_LIMIT;
  return !isSubscribed && hitLimit;
}

// ── Objection Flow threading (Phase B) ────────────────────────────────────────
// Client-side ledger for multi-turn objection handling. When a flow is open, each ↑↑
// press sends the verbatim lines already given + the anchored exchange since the objection
// opened + the fresh tail, so the card ADVANCES the sequence instead of restarting.
type ObjectionThread = {
  active: boolean;               // a flow is open (card 1 landed)
  linesGiven: string[];          // verbatim lines handed to the rep — the no-repeat guard
  leversUsed: string[];          // B4: plays run THIS flow, in order. FLOW-scoped — resets with the
                                 // thread; the archived copy never feeds the consecutive-lever guard.
  beatNumber: number;            // 1 after card-1 done; ++ on each subsequent real line
  anchorCursor: number;          // whole-call transcript cursor at flow open (objection start)
  lastMoveCursor: number;        // cursor at the most recent done — end of the last move
  beliefSnapshot: string | null; // liveSummary FROZEN at flow open (prompt-cache stability)
};
const EMPTY_THREAD: ObjectionThread = {
  active: false, linesGiven: [], leversUsed: [], beatNumber: 0,
  anchorCursor: 0, lastMoveCursor: 0, beliefSnapshot: null,
};

// A flow older than this since the last press is treated as stale → next press starts fresh.
const FLOW_IDLE_MS = 120_000; // 2 min (Phase C moves ownership to main.ts)
// A pause longer than this (but under FLOW_IDLE_MS) flags the prompt to re-evaluate same-vs-new.
const GAP_FLAG_MS  = 40_000;
// Interim overflow caps for the anchored history (Step 1). Step 2 (rolling synthesis) replaces
// the elision with a pre-computed strategic recap; until then, never front-slice the whole thing.
const LATEST_MAX_CHARS  = 3_500;
const HISTORY_MAX_CHARS = 4_500;

/** Keep the freshest tail — what the prospect JUST said matters most. */
function capLatest(s: string): string {
  return s.length <= LATEST_MAX_CHARS ? s : s.slice(-LATEST_MAX_CHARS);
}
/**
 * Pin the objection opening + keep the recent tail, elide the middle. NEVER front-slice the
 * whole thing (that would drop the opening objection). Interim until the Step-2 rolling recap.
 */
function capHistory(history: string): string {
  if (history.length <= HISTORY_MAX_CHARS) return history;
  const head = history.slice(0, Math.floor(HISTORY_MAX_CHARS * 0.4));
  const tail = history.slice(-Math.floor(HISTORY_MAX_CHARS * 0.6));
  return `${head}\n--- earlier exchange omitted ---\n${tail}`;
}

export default function DashboardClient({
  profile,
  initialCalls,
  initialObjections,
  initialSignals,
  userId,
}: Props) {
  const router = useRouter();
  const defaultStage = getDefaultStage();

  // ── Tab / UI state ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<DashboardTab>("home");
  const [collapsed, setSidebarCollapsed] = useState(false);
  const [badges, setBadges] = useState({
    objections: initialObjections.filter((o) => o.is_new).length,
    signals:    initialSignals.filter((s) => s.is_new).length,
  });
  const [pendingCall, setPendingCall] = useState<Call | null>(null);

  // ── Zoom display name — lifted to client state so the deploy gate stays current
  // when the user saves a new name in SettingsTab without a full page reload.
  const [savedZoomName, setSavedZoomName] = useState(profile.zoom_display_name ?? "");

  // ── Call session state ─────────────────────────────────────────────────────
  const [callId, setCallId]       = useState<string | null>(null);
  const [isActive, setIsActive]     = useState(false);
  // Stays true from call-end until the disposition is saved — keeps the
  // "Processing call…" skeleton visible until the real entry (with outcome) loads.
  const [pendingOutcome, setPendingOutcome] = useState(false);
  // Tracks which call is pending so we can detect when it appears with an outcome.
  const pendingCallIdRef = useRef<string | null>(null);
  const [stage, setStage]         = useState<CallStageLabel>(defaultStage);
  const [startError, setStartError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Ref so IPC callback always reads latest isActive without stale closure
  const isActiveRef = useRef(false);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // Live callId mirror — the async objection stream can resolve AFTER the call ended and
  // a new one started. The `done` branch compares this LIVE ref against the callId captured
  // at press time; a closed-over `callId` could never detect the change (it'd be frozen at
  // press time), so this ref is load-bearing for the "never arm a thread on a dead call" guard.
  const callIdRef = useRef<string | null>(null);
  useEffect(() => { callIdRef.current = callId; }, [callId]);

  // ── Objection Flow thread ledger (Phase B) ─────────────────────────────────
  // Drives multi-turn threading: on card-1 `done` the flow opens (freeze belief, drop the
  // anchor cursor into the poller's whole-call transcript); each subsequent press feeds the
  // verbatim lines already given + the anchored exchange since the objection opened + the
  // fresh tail, so Sonnet advances the sequence instead of restarting. Mutated ONLY in the
  // stream `done` branch (SEV-E) — never in release()/finally, which runs on abort/error too.
  const objectionThreadRef = useRef<ObjectionThread>({ ...EMPTY_THREAD });

  // ── No-silent deferred press (Phase B / C) ─────────────────────────────────
  // A press inside the throttle window is NOT silently dropped: we show the "thinking" pill
  // immediately and schedule ONE coalesced re-fire when the throttle releases. Cancelled on
  // call-end + dismiss. One pending max (a boolean — respects "never queue").
  const pendingPressRef = useRef(false);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-entrancy guard: prevents handleEndCall from executing twice if the user
  // clicks End Call AND hits the keyboard shortcut before the first async call
  // resolves. Without this, two PATCH requests fire simultaneously.
  const isEndingRef = useRef(false);

  // ── Paywall ────────────────────────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState<boolean>(() => isPaywallActive(profile));
  const handleLimitReached = useCallback(() => setShowPaywall(true), []);

  // ── Wingman AI poller (always mounted, does nothing when isActive=false) ───
  const {
    scorecard,
    currentSignal,
    prospectName,
    liveSummary,
    getRecentTranscript,
    getTranscriptCursor,
    getTranscriptSince,
    setFlowSynthContext,
    getFlowRecap,
    getRecapCursor,
    synthesizeClosedFlow,
    addChunk,
    addPartial,
    getLiveTail,
    hotPartialAgeMs,
    dismissSignal,
    flushBuffer,
    flushSummarize,
  } = useWingmanPoller({
    callId,
    stage,
    isActive,
    objections: initialObjections,
    repName: savedZoomName || null,
  });

  // ── Call-level objection memory (Phase B, Step 2) ───────────────────────────
  // Learnings from EARLIER objection flows this call — they never die with a flow reset
  // (Sebastian's rule). Archived recaps + every line given, resets ONLY on callId change.
  // Compact by design: what rides on a card is capped at send time (last 3 recaps / 8 lines).
  const callObjectionMemoryRef = useRef<{ archivedRecaps: string[]; allLinesGiven: string[] }>({
    archivedRecaps: [], allLinesGiven: [],
  });

  /**
   * Archive a DYING flow's learnings into call-level memory. MUST run BEFORE any reset
   * overwrites `objectionThreadRef` (two of the three reset sites destroy the data in the
   * same statement — plan-review blocker 4). Lines always survive; the recap survives when
   * the rolling synth produced one. `closeOutSynth: true` (stale-expiry path ONLY — never
   * call-end, which races teardown) fires one bounded background synthesis for a ≥2-beat
   * flow that never got a recap, archiving the result if the same call is still live.
   */
  const archiveCurrentFlow = useCallback((opts?: { closeOutSynth?: boolean }) => {
    const t = objectionThreadRef.current;
    if (!t.active) return;
    const mem = callObjectionMemoryRef.current;
    for (const l of t.linesGiven) {
      if (!mem.allLinesGiven.includes(l)) mem.allLinesGiven.push(l);
    }
    if (mem.allLinesGiven.length > 40) mem.allLinesGiven = mem.allLinesGiven.slice(-40);
    const recap = getFlowRecap();
    if (recap) {
      mem.archivedRecaps.push(recap);
      if (mem.archivedRecaps.length > 5) mem.archivedRecaps = mem.archivedRecaps.slice(-5);
    } else if (opts?.closeOutSynth && t.beatNumber >= 2) {
      const cid = callIdRef.current;
      const { anchorCursor, lastMoveCursor, beliefSnapshot } = t;
      synthesizeClosedFlow({ anchorCursor, lastMoveCursor, beliefSnapshot })
        .then((r) => {
          // Guard: archive only if the SAME call is still live when the synth lands.
          if (r && cid && callIdRef.current === cid) {
            const m = callObjectionMemoryRef.current;
            m.archivedRecaps.push(r);
            if (m.archivedRecaps.length > 5) m.archivedRecaps = m.archivedRecaps.slice(-5);
          }
        })
        .catch(() => { /* close-out is best-effort — lines already archived above */ });
    }
  }, [getFlowRecap, synthesizeClosedFlow]);

  // ── In-flight guard — prevents double-billing on rapid hotkey presses ───────
  const isGeneratingRef = useRef(false);
  // Streaming objection card (Step 4): a monotonic press id stamped on every reveal
  // frame (HUD drops stale ones), and the AbortController for the in-flight SSE stream
  // so call-end / dismiss can stop Sonnet immediately (don't bill an abandoned card).
  const seqCounterRef    = useRef(0);
  const streamAbortRef   = useRef<AbortController | null>(null);
  // Client-side summon throttle — silently ignore a press within this window of the last
  // processed one (mirrors the server's 3s cost guard, set slightly higher so a press the
  // client lets through always clears the server). Prevents rapid-fire presses from firing
  // a "thinking" pill that then resolves as a misleading "couldn't pull that" error.
  const lastSummonAtRef  = useRef(0);
  const SUMMON_THROTTLE_MS = 3_500;

  // Keep stage in sync with what the AI detects so poll intervals adapt
  useEffect(() => {
    if (scorecard.current_stage) {
      setStage(scorecard.current_stage as CallStageLabel);
    }
  }, [scorecard.current_stage]);

  // ── Navigate to Settings when HUD "Open Settings" button is clicked ─────────
  useEffect(() => {
    if (typeof window === "undefined" || !window.wingman) return;
    window.wingman.onNavigateToSettings(() => setTab("settings"));
  // Runs once on mount — DashboardClient never unmounts, so no cleanup needed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync Zoom name status to Electron so tray + HUD can gate deploys ────────
  // Runs on mount (with the server-rendered value) and again whenever the name
  // is saved in SettingsTab. Main process uses this to show a "set your Zoom
  // name" warning before it even reaches handleStartCall.
  useEffect(() => {
    if (typeof window !== "undefined" && window.wingman) {
      window.wingman.setZoomStatus(!!savedZoomName.trim());
    }
  }, [savedZoomName]);

  // ── Recall AI transcript listener (Electron only, no-op in browser) ────────
  const { isElectron } = useRecallTranscript({ isActive, addChunk, addPartial });

  // ── Start a live call ──────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    setStartError(null);

    // Gate: Zoom display name must be set so Wingman knows which voice is the rep's.
    // Without it, keyword triggers may fire on the rep's own words.
    if (!savedZoomName.trim()) {
      setStartError("Set your Zoom display name in Settings before deploying Wingman.");
      return;
    }

    try {
      // Check meeting detection BEFORE creating a session record.
      // If no Zoom/Meet window is open, bail immediately — no DB entry created.
      if (typeof window !== "undefined" && window.wingman) {
        // Fetch the Supabase access token so Electron can authenticate
        // the server-side Recall AI upload token request.
        let authToken: string | undefined;
        try {
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          authToken = session?.access_token ?? undefined;
        } catch (sessionErr) {
          // Token fetch failure is non-fatal for the meeting detection check.
          // If the token is missing, Electron will return no_auth and we surface
          // a clear error to the user below. Log so it's visible in production.
          console.error("[handleStartCall] Failed to get Supabase session:", sessionErr);
        }

        const result = await window.wingman.startCall(authToken) as { success: boolean; error?: string } | undefined;
        if (result && !result.success) {
          if (result.error === "no_meeting") {
            setStartError("No call detected. Open Zoom or Google Meet first.");
          } else if (result.error === "no_auth") {
            setStartError("Session expired. Please refresh the page and try again.");
          } else {
            setStartError("Failed to start audio capture. Please try again.");
          }
          return;
        }
      }

      const res = await fetch("/api/wingman/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospect_name: "Live Call" }),
      });
      const data = await res.json();

      if (!res.ok) {
        // Session creation failed after Electron already started — stop Electron too
        if (typeof window !== "undefined" && window.wingman) window.wingman.endCall();
        if (data.error === "trial_ended") {
          handleLimitReached();
        } else if (data.error === "call_limit_reached") {
          setStartError(`You've hit your monthly call limit (${data.call_limit} calls). Purchase additional calls to continue.`);
        } else {
          setStartError(data.message ?? data.error ?? "Failed to start call");
        }
        return;
      }

      if (!data.call_id) throw new Error("Failed to start");
      setCallId(data.call_id);
      setIsActive(true);
      setPendingOutcome(false);
      pendingCallIdRef.current = null;
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start call");
    }
  }, [handleLimitReached, savedZoomName]);

  // ── End the active call ────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    // Guard: if already ending (e.g. button click + keyboard shortcut fired simultaneously),
    // skip the second invocation to prevent duplicate PATCH requests and UI flickers.
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setIsActive(false);

    // Tell Electron to stop Recall AI and show the HUD outcome card.
    // This always runs regardless of callId — Electron needs the stop signal.
    if (typeof window !== "undefined" && window.wingman) {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        window.wingman.endCall(callId ?? undefined, session?.access_token ?? undefined);
      } catch {
        // If token fetch fails, still end the call — outcome card just won't save
        window.wingman.endCall();
      }
    }

    // If there's no active call session, nothing more to do.
    // Don't show the Processing skeleton — there's no call entry to wait for.
    if (!callId) {
      isEndingRef.current = false;
      return;
    }

    // Only start the skeleton AFTER confirming there's a real call to track.
    setPendingOutcome(true);
    pendingCallIdRef.current = callId;

    try {
      // Flush transcript + fire final Belief Ladder update before closing the session.
      // flushSummarize is fire-and-forget (no await) — Sonnet takes 2-5s and the rep
      // shouldn't wait for the background scorer before the UI resets.
      flushSummarize();
      await flushBuffer();

      try {
        await fetch("/api/wingman/session", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            call_id:       callId,
            prospect_name: prospectName ?? undefined,
          }),
        });
        setSavedMessage("Saved to Flight Log ✓");
        setTimeout(() => setSavedMessage(null), 4000);
        router.refresh();
      } catch {
        // fail silently — call record is already saved in DB
      }

      setCallId(null);
      setStage(defaultStage);
    } finally {
      // Always reset the guard — if flushBuffer or anything else throws,
      // future calls to handleEndCall must not be permanently blocked.
      isEndingRef.current = false;
    }
  }, [callId, defaultStage, prospectName, flushBuffer, flushSummarize, router]);

  // ── Auto-ended by Recall AI (meeting lost, inactivity, 2h cap) ────────────
  // Electron already stopped Recall AI before this fires, so we must NOT call
  // window.wingman.endCall() for stopping purposes — stopRecallAI() is idempotent
  // so it won't double-stop, but we call endCall() specifically to pass the callId
  // + token to Electron so the HUD outcome card can appear and save correctly.
  const handleAutoEnd = useCallback(async () => {
    // Re-entrancy guard: SHARED with handleEndCall via isEndingRef. If the user
    // clicks End Call / hits the hotkey at the same instant Recall AI auto-stops
    // (meeting lost, inactivity, 2h cap), both handlers would otherwise run the
    // end-flow for the same call — firing two session PATCHes. That double-bills
    // the post-call Sonnet job, double-charges the user's call quota, and races
    // the call_stages write. Whichever path sets the guard first wins; the other
    // bails here. Safe to bail: the winning path stops Recall AI (idempotent) and
    // shows the HUD outcome card, so nothing is dropped.
    // NOTE: the check + set MUST stay outside the try below — otherwise a bailed
    // re-entrant call would run the finally and clear the guard the winner set.
    if (isEndingRef.current) return;
    isEndingRef.current = true;

    try {
      setIsActive(false);

      // If there's no active call session, nothing to process.
      if (!callId) return;

      // Only start the skeleton after confirming there's a real call to track.
      setPendingOutcome(true);
      pendingCallIdRef.current = callId;

      // Capture callId now — it will be cleared by setCallId(null) below
      const activeCallId = callId;

      // Flush transcript + fire final Belief Ladder update before closing the session.
      // flushSummarize is fire-and-forget (no await) — same reasoning as handleEndCall.
      flushSummarize();
      await flushBuffer();

      // Run session PATCH and token fetch in parallel — no reason to wait for one
      // before starting the other, and doing both at once cuts ~500ms off the delay
      // before the outcome card appears.
      const supabase = createClient();
      const [patchResult, sessionResult] = await Promise.allSettled([
        fetch("/api/wingman/session", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            call_id:       activeCallId,
            prospect_name: prospectName ?? undefined,
          }),
        }),
        supabase.auth.getSession(),
      ]);

      if (patchResult.status === "fulfilled" && patchResult.value.ok) {
        setSavedMessage("Saved to Flight Log ✓");
        setTimeout(() => setSavedMessage(null), 4000);
        router.refresh();
      } else {
        // Non-fatal — call record is already saved, this just updates stage data
        console.error("[handleAutoEnd] Failed to patch session stages");
      }

      // Show the HUD outcome card so the rep can log the result.
      // We pass callId + a fresh token so the HUD can authenticate the save.
      // stopRecallAI() is already stopped — endCall() here is safe (idempotent guard
      // inside stopRecallAI prevents any double-stop side effects).
      if (typeof window !== "undefined" && window.wingman) {
        const token = sessionResult.status === "fulfilled"
          ? sessionResult.value.data.session?.access_token
          : undefined;

        if (sessionResult.status === "rejected") {
          console.error("[handleAutoEnd] Failed to get Supabase session — outcome card shown without token");
        }

        window.wingman.endCall(activeCallId, token);
      }

      setCallId(null);
      setStage(defaultStage);
    } finally {
      // Always reset the guard — including the early !callId return and any throw —
      // so a future call's end-flow (manual or auto) is never permanently blocked.
      // handleStartCall does not touch isEndingRef, so this finally is the only
      // thing that clears it on the auto-end path.
      isEndingRef.current = false;
    }
  }, [callId, defaultStage, prospectName, flushBuffer, flushSummarize, router]);

  // Stable refs so the IPC listener (registered once) always calls latest handlers
  const handleStartCallRef = useRef(handleStartCall);
  const handleEndCallRef   = useRef(handleEndCall);
  const handleAutoEndRef   = useRef(handleAutoEnd);
  useEffect(() => { handleStartCallRef.current = handleStartCall; }, [handleStartCall]);
  useEffect(() => { handleEndCallRef.current   = handleEndCall;   }, [handleEndCall]);
  useEffect(() => { handleAutoEndRef.current   = handleAutoEnd;   }, [handleAutoEnd]);

  // ── IPC: tray / keyboard shortcut toggle ──────────────────────────────────
  // Registered once — uses refs so it never goes stale.
  // No tab switching: deploy happens silently, HUD takes over.
  useEffect(() => {
    if (typeof window === "undefined" || !window.wingman) return;
    window.wingman.onToggleCall(() => {
      if (isActiveRef.current) handleEndCallRef.current();
      else handleStartCallRef.current();
    });
    return () => { window.wingman?.offToggleCall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── IPC: Recall AI auto-stopped the call ──────────────────────────────────
  // Uses dedicated channel (call:auto-ended) so we patch the session
  // WITHOUT calling window.wingman.endCall() — Electron already stopped Recall.
  useEffect(() => {
    if (typeof window === "undefined" || !window.wingman) return;
    window.wingman.onAutoEnded?.(() => {
      handleAutoEndRef.current();
    });
    return () => { window.wingman?.offAutoEnded?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Outcome saved from HUD → refresh data but keep skeleton up ──────────────
  // Don't clear the skeleton here — the post-call job (debrief) takes a few
  // more seconds. The watch below clears it once both outcome AND summary land.
  useEffect(() => {
    if (!isElectron || !window.wingman) return;
    window.wingman.onOutcomeUpdated?.(() => {
      router.refresh();
    });
    return () => { window.wingman?.offOutcomeUpdated?.(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Poll every 5s while skeleton is up — catches both outcome and summary ────
  useEffect(() => {
    if (!pendingOutcome) return;
    const interval = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(interval);
  }, [pendingOutcome, router]);

  // ── Clear skeleton only when outcome AND summary are both present ─────────────
  // This ensures the debrief is ready before the call entry appears, so the
  // user never needs to hard-refresh to see the full post-call data.
  useEffect(() => {
    if (!pendingOutcome || !pendingCallIdRef.current) return;
    const call = initialCalls.find((c) => c.id === pendingCallIdRef.current);
    if (call?.outcome && call?.summary) {
      setPendingOutcome(false);
      pendingCallIdRef.current = null;
    }
  }, [initialCalls, pendingOutcome]);

  // ── Safety valve: clear skeleton after 2 min if post-call job fails ──────────
  useEffect(() => {
    if (!pendingOutcome) return;
    const t = setTimeout(() => {
      setPendingOutcome(false);
      pendingCallIdRef.current = null;
    }, 2 * 60 * 1000);
    return () => clearTimeout(t);
  }, [pendingOutcome]);

  // ── Sync state → floating HUD (Electron only) ─────────────────────────────
  // (Stage bar retired in Phase 1 — stage data is derived post-call now, so the
  // live stage sync to the HUD was removed. Signal + scorecard sync remain.)
  useEffect(() => {
    if (!isElectron || !currentSignal) return;
    window.wingman?.sendSignal({
      header: currentSignal.header,
      text:   currentSignal.text,
      type:   currentSignal.type,
    });
  }, [currentSignal, isElectron]);

  useEffect(() => {
    if (!isElectron) return;
    window.wingman?.sendScorecard(scorecard as unknown as Record<string, unknown>);
  }, [scorecard, isElectron]);

  // Dismiss signal from HUD syncs back to web app. If the rep dismisses while a card is
  // still streaming, abort the SSE stream so Sonnet stops generating (don't bill it). (W6)
  useEffect(() => {
    if (!isElectron) return;
    window.wingman?.onSignalDismiss(() => {
      streamAbortRef.current?.abort();
      // Cancel a queued deferred press so a dismissed card doesn't auto-pop the next beat.
      // Does NOT reset the thread — dismiss only means "not now" (Sebastian's rule).
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
      pendingPressRef.current = false;
      dismissSignal();
    });
    return () => { window.wingman?.offSignalDismiss(); };
  }, [isElectron, dismissSignal]);

  // When the call goes inactive (manual end, auto-stop, meeting lost), abort any in-flight
  // objection stream — the renderer would otherwise keep reading + keep Sonnet billing
  // after the HUD has torn down (plan review W3/W6). Single point covers every end path.
  useEffect(() => {
    if (!isActive) {
      streamAbortRef.current?.abort();
      // Archive the dying flow's learnings BEFORE the reset destroys them (lines always
      // survive; no close-out synth here — call-end races the teardown). Then reset the
      // objection thread on every call-end path. NOTE: thread reset lives on the isActive
      // effect ONLY — dismiss must NEVER reset the thread (Sebastian's rule).
      archiveCurrentFlow();
      objectionThreadRef.current = { ...EMPTY_THREAD };
      setFlowSynthContext({ active: false });
      // Phase C: main already closed flow mode on its own call-end teardown; this
      // covers ends the renderer sees first. Idempotent on both sides.
      window.wingman?.flowClosed?.();
      // Cancel any queued deferred press + clear its pill state.
      if (pendingTimerRef.current) { clearTimeout(pendingTimerRef.current); pendingTimerRef.current = null; }
      pendingPressRef.current = false;
    }
  }, [isActive, archiveCurrentFlow, setFlowSynthContext]);

  // A new (or ended) call must start with no armed thread — drop any prior flow. Belt-and-
  // suspenders alongside the done-branch callId guard (which is the real safety net).
  // Order matters: archive the old flow → reset the thread → THEN wipe call-level memory
  // (memory is call-scoped; the new call starts with none).
  useEffect(() => {
    archiveCurrentFlow();
    objectionThreadRef.current = { ...EMPTY_THREAD };
    setFlowSynthContext({ active: false });
    callObjectionMemoryRef.current = { archivedRecaps: [], allLinesGiven: [] };
    window.wingman?.flowClosed?.(); // Phase C: no armed single-↑ mode across calls
  }, [callId, archiveCurrentFlow, setFlowSynthContext]);

  // Phase C: main's 2-min flow idle timer expired — same semantics as the press-time
  // stale reset (archive learnings + one bounded close-out synth), minus the re-press.
  useEffect(() => {
    if (!isElectron || !window.wingman?.onFlowExpired) return;
    window.wingman.onFlowExpired(() => {
      if (objectionThreadRef.current.active) {
        archiveCurrentFlow({ closeOutSynth: true });
        objectionThreadRef.current = { ...EMPTY_THREAD };
        setFlowSynthContext({ active: false });
      }
      window.wingman?.sendFlowState?.({ active: false }); // clear the card's flow chrome
    });
    return () => { window.wingman?.offFlowExpired?.(); };
  }, [isElectron, archiveCurrentFlow, setFlowSynthContext]);

  // ── Hotkey compass menu — handle direction pick from Electron main ─────────
  // Called by main.ts when the rep presses a direction key after the Up Arrow
  // summons the compass. Assembles the full context (Belief Ladder + last 120 s
  // of transcript), fetches /kb-signal, and forwards the card to the HUD.
  //
  // isGeneratingRef prevents double-billing on rapid presses — if a card stream
  // is already in flight, subsequent picks are silently dropped until it settles.
  const handleMenuPick = useCallback(async (direction: string) => {
    if (isGeneratingRef.current) {
      // Existing pill keeps counting — sending nothing here is correct (a second
      // "thinking" would reset the visible counter mid-generation).
      console.log("[Wingman] Menu pick dropped — card generation already in flight");
      return;
    }
    if (!callId || !isActiveRef.current) return;

    // Phase 3.5 ships only the ↑ objection slot. ← ↓ → are captured by
    // globalShortcut so they don't fall through to Zoom/Meet; the HUD shows a
    // brief "coming soon" pill instead of dead air. Phase 4 implements them.
    if (direction !== "objection") {
      window.wingman?.sendSummonState({ state: "unsupported", slot: direction });
      console.log(`[Wingman] Slot "${direction}" not yet implemented — Phase 4`);
      return;
    }

    // Throttle rapid re-presses (mirrors the server's 3s cost guard). But NEVER silently drop
    // (Sebastian): a press inside the window shows the "thinking" pill immediately and DEFERS
    // one coalesced re-fire until the throttle releases — the pill flows straight into the card,
    // so the rep always knows their press registered. `sinceLast` is ALSO the gap since the last
    // press, reused below for the stale-flow (2-min) and gap-flag (40s) threading decisions.
    const sinceLast = Date.now() - lastSummonAtRef.current;
    if (sinceLast < SUMMON_THROTTLE_MS) {
      if (!pendingPressRef.current) {
        pendingPressRef.current = true;
        window.wingman?.sendSummonState({ state: "thinking", slot: direction });
        const wait = SUMMON_THROTTLE_MS - sinceLast + 50; // small margin past the window
        pendingTimerRef.current = setTimeout(() => {
          pendingTimerRef.current = null;
          pendingPressRef.current = false;
          if (!isActiveRef.current) return;           // call ended during the wait → drop (pill cleared on end)
          handleMenuPickRef.current(direction);       // re-enter FRESH: re-reads context/thread/throttle
        }, wait);
      }
      // else: a deferred press is already queued + the pill is up — coalesce (never queue N).
      return;
    }
    lastSummonAtRef.current = Date.now();

    // ── #41 settle wait ──────────────────────────────────────────────────────────
    // A partial that landed <1.5s ago means the speaker is likely mid-utterance —
    // the objection's last words are still streaming in. Hold one beat (350ms) so
    // the live tail catches them. MUST sit BEFORE the threading decision below:
    // everything (thread ledger, cursors, live tail) is read POST-settle, so a
    // flow expiry during the sleep can't produce a stale threaded payload.
    // No fresh partial (old packaged app, or press after a genuine pause) →
    // hotPartialAgeMs() is +Infinity → zero added latency, request unchanged.
    let pillSent = false;
    if (hotPartialAgeMs() < HOT_PARTIAL_MS) {
      // Guard + pill BEFORE the sleep: re-presses during it drop at the top
      // guard, and the pill is flow-mode's only press ack (no compass flash).
      isGeneratingRef.current = true;
      window.wingman?.sendSummonState({ state: "thinking", slot: direction });
      pillSent = true;
      await new Promise((resolve) => setTimeout(resolve, SETTLE_WAIT_MS));
      if (!isActiveRef.current) {
        // Call ended during the wait — resolve the pill, free the guard.
        window.wingman?.sendSummonState({ state: "idle", slot: direction });
        isGeneratingRef.current = false;
        return;
      }
    }

    // ── Objection Flow threading decision (Phase B) ─────────────────────────────
    // Read the ledger + freeze press-time context into LOCALS. All mutation happens later,
    // ONLY in the stream `done` branch, gated by callId/isActive. isGeneratingRef + the throttle
    // serialize presses, so read-at-top / write-at-done has no intra-call race.
    const callIdAtPress = callId;
    const beliefAtPress = liveSummary ?? undefined;
    const thr = objectionThreadRef.current;

    // Stale flow (>2 min since last press) → treat as expired; fall through as a fresh beat-1.
    // Archive its learnings FIRST (this is the one reset path with a live call + dead time,
    // so it's also the ONLY place the bounded close-out synthesis may fire — Step 2).
    if (thr.active && sinceLast > FLOW_IDLE_MS) {
      archiveCurrentFlow({ closeOutSynth: true });
      objectionThreadRef.current = { ...EMPTY_THREAD };
      setFlowSynthContext({ active: false });
      // Phase C: belt-and-suspenders — main's own 2-min timer normally beat us here.
      window.wingman?.flowClosed?.();
      window.wingman?.sendFlowState?.({ active: false });
    }
    const t = objectionThreadRef.current;
    const isThreaded = t.active && t.beatNumber >= 1;
    // Phase C: a threaded press re-arms main's idle timer NOW (not just when the card
    // lands) so the mode can't expire mid-generation and reset the thread under a
    // stream that's about to advance it.
    if (isThreaded) window.wingman?.flowOpened?.();

    // Build the threaded payload (or leave undefined for a fresh beat-1 single-shot).
    let threadBody: {
      lines_given: string[];
      history_transcript: string;
      beat_number: number;
      gap_flag: boolean;
      flow_recap?: string;
      levers_used?: string[];
    } | null = null;
    let beatNumberSent = 1;
    let transcriptToSend: string;
    let summaryToSend = beliefAtPress;

    if (isThreaded) {
      // Step 2: verbatim history starts at the recap cursor — the absorbed middle arrives as
      // the compact FLOW RECAP instead (pre-computed in background, ~zero press-time latency).
      // Until the first synth completes, recapCursor === anchorCursor → identical to Step 1.
      const recapCursor    = Math.max(t.anchorCursor, getRecapCursor());
      const flowRecap      = getFlowRecap();
      const latestResponse = getTranscriptSince(t.lastMoveCursor);
      const sinceRecap     = getTranscriptSince(recapCursor);
      // latestResponse is always a suffix of sinceRecap (lastMove ≥ recapCursor ≥ anchor, same
      // monotonic buffer) → this slice is exactly recapCursor→lastMove.
      const historyRaw     = sinceRecap.slice(0, sinceRecap.length - latestResponse.length);
      beatNumberSent   = t.beatNumber + 1;
      transcriptToSend = capLatest(latestResponse);
      summaryToSend    = t.beliefSnapshot ?? beliefAtPress; // FROZEN belief → cache stability
      threadBody = {
        lines_given:        t.linesGiven,
        history_transcript: capHistory(historyRaw),
        beat_number:        beatNumberSent,
        gap_flag:           sinceLast > GAP_FLAG_MS, // (already ≤ FLOW_IDLE_MS or we'd have reset)
        ...(flowRecap ? { flow_recap: flowRecap } : {}),
        ...(t.leversUsed.length ? { levers_used: t.leversUsed } : {}),
      };
    } else {
      // Fresh beat-1 — byte-identical to today: the 120s rolling window, no thread fields.
      transcriptToSend = getRecentTranscript();
    }

    // ── #41 live tail ──────────────────────────────────────────────────────────
    // Append the freshest unfinalized words AFTER capping, deduped against the
    // exact finals tail being sent (strict substring — a stale partial whose
    // final already landed is suppressed). Re-cap the combined string to the
    // server's 3,500 limit: capLatest keeps the END, so the live tail always
    // survives whole and only the OLDEST finals get sliced.
    const liveTail = getLiveTail(transcriptToSend);
    if (liveTail) {
      transcriptToSend = capLatest(transcriptToSend + "\n" + liveTail);
    }

    // Call-level memory (Step 2): earlier flows' learnings ride on EVERY objection press —
    // beat-1 included (a resurfacing objection must not restart at square one). Empty on the
    // first objection of a call → omitted → that request stays byte-identical to the shipped
    // single-shot card.
    const mem = callObjectionMemoryRef.current;
    const callMemoryBody = (mem.archivedRecaps.length || mem.allLinesGiven.length)
      ? { call_memory: { recaps: mem.archivedRecaps.slice(-3), lines_given: mem.allLinesGiven.slice(-8) } }
      : {};

    isGeneratingRef.current = true;
    const seq = ++seqCounterRef.current;

    // Pill contract (Phase 3.5, plan review BLOCKER 1): after "thinking" is
    // sent, EVERY exit from this function resolves the pill — either a card
    // (sendSignal/start delta → the HUD clears it) or an explicit "error"
    // (→ "Couldn't pull that — tap ↑ to retry"). There is NO silent path.
    // (#41: skip if the settle wait already sent it — a second "thinking"
    // would reset the pill's visible counter mid-wait.)
    if (!pillSent) window.wingman?.sendSummonState({ state: "thinking", slot: direction });

    // Streaming timeouts (plan review W7): a flat wall would kill a slow-but-alive
    // stream mid-sentence. Instead guard time-to-first-TOKEN (TTFB) and idle gaps
    // BETWEEN deltas. Critical: the TTFB clock measures time to the first real DELTA,
    // NOT the first byte — the server sends a ": ok" flush immediately to open the pipe,
    // and Sonnet's cold first token can be ~6s, so arming the idle timer on the flush
    // would abort a healthy stream mid-think (the live bug 2026-06-30). TTFB sits just
    // above the server's own 12s TTFB so the server's error frame wins over a client abort.
    const controller = new AbortController();
    streamAbortRef.current = controller;
    const TTFB_MS = 14_000;  // cold first-token (~6s, Sonnet un-warmed) + margin
    const IDLE_MS = 7_000;   // gap between deltas once streaming (deltas are ~ms apart)
    let ttfbTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), TTFB_MS);
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const clearTimers = () => {
      if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; }
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
    };
    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => controller.abort(), IDLE_MS);
    };

    // Single idempotent terminal owner (plan review W2): the ONLY place that clears
    // timers, drops the stream ref, and frees the in-flight guard. Called exactly once
    // per press from every exit (done / nudge / error / abort).
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      clearTimers();
      if (streamAbortRef.current === controller) streamAbortRef.current = null;
      isGeneratingRef.current = false;
    };

    // The card arrived (real line via done, or the static nudge) → resolve the pill via
    // the card itself. An error/abort → show the retry pill + wipe any half-revealed line.
    const fail = () => {
      window.wingman?.sendSignalDelta({ seq, phase: "abort" }); // wipe a partial line if any
      window.wingman?.sendSummonState({ state: "error", slot: direction });
    };

    try {
      const res = await fetch("/api/wingman/kb-signal", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript_chunk: transcriptToSend,   // beat-1: 120s window · threaded: fresh tail
          live_summary:     summaryToSend,       // threaded: FROZEN belief snapshot
          slot:             direction,
          // Thread fields — omitted for a fresh beat-1 (byte-identical request to pre-threading).
          ...(threadBody ?? {}),
          // Earlier flows' learnings (Step 2) — omitted when empty (first objection of the call).
          ...callMemoryBody,
          // No current_stage: post-Phase-1 the live stage tracker is gone, so this
          // would be a stale "Rapport". The Belief Ladder (live_summary) carries it. (Fix #1)
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          // Throttled at the server (edge: slipped past the client throttle). Not a
          // failure — resolve the pill quietly, no retry error.
          console.log("[Wingman] kb-signal throttled (429) — resolving pill quietly");
          window.wingman?.sendSummonState({ state: "idle", slot: direction });
        } else {
          console.error("[Wingman] kb-signal request failed:", res.status);
          fail();
        }
        return;
      }

      // The objection slot streams (text/event-stream); pre-Sonnet cases and other slots
      // return JSON. Branch on Content-Type so BOTH keep working (plan: additive fallback).
      const isStream = (res.headers.get("content-type") || "").includes("text/event-stream");

      if (!isStream) {
        const data = await res.json();
        const cardText = data.signal_text || data.signal_header;
        if (cardText && window.wingman) {
          window.wingman.sendSignal({
            header: data.signal_header ?? "",
            text:   data.signal_text   ?? "",
            type:   data.signal_type   ?? "Handle",
            seq,
          });
        } else {
          // res.ok but no card (rate-limit drop / empty / oversized) — retry pill.
          console.warn("[Wingman] kb-signal returned no card — showing retry pill");
          fail();
        }
        return;
      }

      // ── SSE stream: forward deltas into the HUD's reveal loop ──────────────
      if (!res.body) { fail(); return; }
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let startedReveal = false;
      let resolved      = false; // saw a terminal event (done/nudge/error)

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const { events, rest } = parseSSEBuffer(buffer);
        buffer = rest;

        for (const ev of events) {
          // First real EVENT (not the ": ok" flush — that yields no event) satisfies the
          // TTFB clock. The idle-gap guard is armed only by deltas, below — so Sonnet's
          // cold first-token think-time is covered by TTFB, never the idle timer.
          if (ttfbTimer) { clearTimeout(ttfbTimer); ttfbTimer = null; }

          if (ev.event === "delta") {
            let textSoFar = "";
            try { textSoFar = JSON.parse(ev.data)?.textSoFar ?? ""; } catch { /* ignore */ }
            if (!textSoFar) continue;
            armIdle(); // a delta landed → reset the between-delta idle guard
            if (!startedReveal) {
              startedReveal = true;
              window.wingman?.sendSignalDelta({ seq, phase: "start", textSoFar, type: "Objection" });
            } else {
              window.wingman?.sendSignalDelta({ seq, phase: "delta", textSoFar });
            }
          } else if (ev.event === "done") {
            let line = "", doneLever = "";
            try {
              const d = JSON.parse(ev.data);
              line = d?.line ?? "";
              doneLever = typeof d?.lever === "string" ? d.lever : ""; // B4: additive field
            } catch { /* ignore */ }
            // If a `done` somehow precedes any delta, open the shell so it paints.
            window.wingman?.sendSignalDelta({ seq, phase: startedReveal ? "done" : "start", textSoFar: line, type: "Objection" });
            if (!startedReveal) window.wingman?.sendSignalDelta({ seq, phase: "done", textSoFar: line });

            // ── Thread ledger mutation — the ONLY mutation site (SEV-E) ──────────
            // Guard FIRST: never open/advance a thread on a call that ended or changed during
            // the ~2s stream (callIdRef is the LIVE mirror — a closed-over callId can't detect
            // the change). Only a real, non-empty line opens/advances; nudge/error never mutate.
            if (line && isActiveRef.current && callIdRef.current === callIdAtPress) {
              if (!objectionThreadRef.current.active) {
                // Card 1 landed → open the flow: freeze belief, drop the anchor cursor.
                const cursor = getTranscriptCursor();
                objectionThreadRef.current = {
                  active: true,
                  linesGiven: [line],
                  leversUsed: doneLever ? [doneLever] : [],
                  beatNumber: 1,
                  anchorCursor: cursor,
                  lastMoveCursor: cursor,
                  beliefSnapshot: beliefAtPress ?? null,
                };
                // Arm the background synthesis for this flow (Step 2).
                setFlowSynthContext({ active: true, anchorCursor: cursor, lastMoveCursor: cursor, beliefSnapshot: beliefAtPress ?? null });
                // Phase C: arm main's single-↑ flow mode + paint the flow chrome on the card.
                window.wingman?.flowOpened?.();
                window.wingman?.sendFlowState?.({ active: true, move: 1 });
              } else {
                // Continuation beat → advance. beatNumberSent is the value we SENT (not a
                // re-read), so it stays correct even if the ref shifted.
                const cur = objectionThreadRef.current;
                const cursor = getTranscriptCursor();
                cur.linesGiven     = [...cur.linesGiven, line];
                if (doneLever) cur.leversUsed = [...cur.leversUsed, doneLever];
                cur.beatNumber     = beatNumberSent;
                cur.lastMoveCursor = cursor;
                // Same anchor = same flow — this only advances the synth's absorb boundary.
                setFlowSynthContext({ active: true, anchorCursor: cur.anchorCursor, lastMoveCursor: cursor });
                // Phase C: re-arm main's idle timer + advance the card's move counter.
                window.wingman?.flowOpened?.();
                window.wingman?.sendFlowState?.({ active: true, move: beatNumberSent });
              }
            }
            resolved = true;
          } else if (ev.event === "nudge") {
            let header = "", text = "";
            try { const d = JSON.parse(ev.data); header = d?.header ?? ""; text = d?.text ?? ""; } catch { /* ignore */ }
            window.wingman?.sendSignal({ header, text, type: "Nudge", seq });
            resolved = true;
          } else if (ev.event === "error") {
            fail();
            resolved = true;
          }
          if (resolved) break;
        }
        if (resolved) break;
      }

      // Stream ended with no terminal event (mid-stream drop) — wipe + retry pill.
      if (!resolved) {
        console.warn("[Wingman] objection stream ended without a terminal event — retry pill");
        fail();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn("[Wingman] objection stream aborted (timeout / call-end / dismiss).");
      } else {
        console.error("[Wingman] handleMenuPick error:", err);
      }
      fail();
    } finally {
      release();
    }
  }, [callId, getRecentTranscript, getTranscriptCursor, getTranscriptSince, liveSummary,
      archiveCurrentFlow, setFlowSynthContext, getFlowRecap, getRecapCursor]);

  // Stable ref so the IPC listener (registered once on mount) always calls
  // the latest handleMenuPick without going stale across renders.
  const handleMenuPickRef = useRef(handleMenuPick);
  useEffect(() => { handleMenuPickRef.current = handleMenuPick; }, [handleMenuPick]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.wingman) return;
    window.wingman.onMenuPick((direction: string) => {
      handleMenuPickRef.current(direction);
    });
    return () => { window.wingman?.offMenuPick(); };
  // Registered once — uses ref so it never goes stale. Same pattern as onToggleCall.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const handleTabClick = useCallback((id: DashboardTab) => {
    setTab(id);
    if (id === "objections" || id === "signals") {
      setBadges((b) => ({ ...b, [id]: 0 }));
    }
  }, []);

  const goToDebrief = useCallback((call: Call) => {
    setPendingCall(call);
    setTab("library");
  }, []);

  const clearPendingCall = useCallback(() => setPendingCall(null), []);

  const sidebarWidth = collapsed ? 56 : 220;

  return (
    <div
      style={{
        minHeight:  "100vh",
        background: "#f7f5f2",
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box }
        button { cursor: pointer; transition: opacity 0.15s; border: none }
        button:hover { opacity: 0.75 }
        @keyframes accordionDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .accordion-body { animation: accordionDown 0.22s cubic-bezier(0.22,1,0.36,1) both }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
        .typing-dot { width:7px;height:7px;border-radius:50%;background:#aaa;display:inline-block;animation:typingBounce 1.2s infinite ease-in-out; }
        .typing-dot:nth-child(1){animation-delay:0s}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
        @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Error banner (e.g. call limit reached) */}
      {startError && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
          background: "#ff3b30", color: "#fff", padding: "10px 20px",
          fontSize: 13, fontWeight: 500, textAlign: "center",
        }}>
          {startError}
          <button onClick={() => setStartError(null)} style={{ marginLeft: 12, color: "#fff", background: "none", border: "none", fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>
      )}

      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          tab={tab}
          onTabClick={handleTabClick}
          collapsed={collapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          badges={badges}
          role={profile.role || "closer"}
          salesStyle={profile.sales_style || ""}
          subscriptionStatus={profile.subscription_status || "trialing"}
          userId={userId}
          callsUsed={profile.calls_used ?? 0}
          callLimit={FREE_CALL_LIMIT}
          chatMessagesToday={profile.chat_messages_today ?? 0}
        />

        <div
          style={{
            marginLeft: sidebarWidth,
            flex:       1,
            padding:    "48px 32px",
            minHeight:  "100vh",
            background: "#f7f5f2",
            transition: "margin-left 0.28s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {tab === "home" && (
            <HomeTab
              profile={profile}
              calls={initialCalls}
              onDebrief={goToDebrief}
              isActive={isActive}
              isPendingOutcome={pendingOutcome}
              savedMessage={savedMessage}
              onDeploy={handleStartCall}
              onEndCall={handleEndCall}
              onPersonalize={() => setTab("personalize")}
            />
          )}
          {tab === "flight-plan" && <FlightPlanTab />}
          {tab === "library" && (
            <FlightLogTab
              calls={initialCalls}
              initialCall={pendingCall}
              onInitialCallConsumed={clearPendingCall}
              userId={userId}
              isActive={isActive}
              isPendingOutcome={pendingOutcome}
            />
          )}
          {tab === "objections" && (
            <ObjectionVaultTab
              initialObjections={initialObjections}
              userId={userId}
            />
          )}
          {tab === "signals" && (
            <SignalVaultTab
              initialSignals={initialSignals}
              role={profile.role || "closer"}
              userId={userId}
              displayMode={profile.signal_display_mode || "short"}
            />
          )}
          {tab === "intel"    && <IntelTab calls={initialCalls} />}
          {tab === "settings" && (
            <SettingsTab
              profile={profile}
              calls={initialCalls}
              onZoomNameSaved={(name) => setSavedZoomName(name)}
            />
          )}
          {tab === "personalize" && (
            <PersonalizeTab
              profile={profile}
              userId={userId}
            />
          )}
        </div>
      </div>

      {showPaywall && <PaywallModal role={profile.role || "closer"} />}
    </div>
  );
}
