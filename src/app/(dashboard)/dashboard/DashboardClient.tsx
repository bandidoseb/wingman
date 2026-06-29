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
    addChunk,
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

  // ── In-flight guard — prevents double-billing on rapid hotkey presses ───────
  const isGeneratingRef = useRef(false);

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
  const { isElectron } = useRecallTranscript({ isActive, addChunk });

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

  // Dismiss signal from HUD syncs back to web app
  useEffect(() => {
    if (!isElectron) return;
    window.wingman?.onSignalDismiss(() => dismissSignal());
    return () => { window.wingman?.offSignalDismiss(); };
  }, [isElectron, dismissSignal]);

  // ── Hotkey compass menu — handle direction pick from Electron main ─────────
  // Called by main.ts when the rep presses a direction key after the Up Arrow
  // summons the compass. Assembles the full context (Belief Ladder + last 120 s
  // of transcript), fetches /kb-signal, and forwards the card to the HUD.
  //
  // isGeneratingRef prevents double-billing on rapid presses — if a Haiku call
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

    isGeneratingRef.current = true;

    // Pill contract (Phase 3.5, plan review BLOCKER 1): after "thinking" is
    // sent, EVERY exit from this function resolves the pill — either a card
    // (sendSignal → the HUD's showSignal clears it) or an explicit "error"
    // (→ "Couldn't pull that — tap ↑ to retry"). There is NO silent path.
    window.wingman?.sendSummonState({ state: "thinking", slot: direction });

    // 12s client-side timeout — slightly above the server's 10s Haiku ceiling.
    // Without it, a stalled connection (mid-call network drop) leaves this fetch
    // hanging and isGeneratingRef stuck true, silently bricking the compass for the
    // rest of the call. On abort, catch + finally reset the guard so the next press recovers.
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 12_000);

    try {
      const recentTranscript = getRecentTranscript();

      const res = await fetch("/api/wingman/kb-signal", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transcript_chunk: recentTranscript,
          live_summary:     liveSummary ?? undefined,
          slot:             direction,
          // No current_stage: post-Phase-1 the live stage tracker is gone, so this
          // would be a stale "Rapport". The Belief Ladder (live_summary) carries the
          // real stage, and summoned cards are always two-tier regardless. (Fix #1)
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        console.error("[Wingman] kb-signal request failed:", res.status);
        window.wingman?.sendSummonState({ state: "error", slot: direction });
        return;
      }

      const data = await res.json();

      // Gate on the card CONTENT, not signal_header — the objection card is headless
      // (signal_header:"" with the line in signal_text), so gating on the header would
      // treat a real card as a failure and show the retry pill. (Plan review C2/C3.)
      const cardText = data.signal_text || data.signal_header;
      if (cardText && typeof window !== "undefined" && window.wingman) {
        // Card arrived — the HUD clears the pill as showSignal's first action.
        window.wingman.sendSignal({
          header: data.signal_header ?? "",
          text:   data.signal_text   ?? "",
          type:   data.signal_type   ?? "Handle",
        });
      } else {
        // res.ok but NO card: server rate-limit drop, empty/oversized transcript,
        // or both generation paths failed — all return a bare { ok: true }.
        // Without this branch the pill would tick to its 15s failsafe (BLOCKER 1).
        console.warn("[Wingman] kb-signal returned no card — showing retry pill");
        window.wingman?.sendSummonState({ state: "error", slot: direction });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.warn("[Wingman] kb-signal timed out after 12s — compass freed for next press.");
      } else {
        console.error("[Wingman] handleMenuPick error:", err);
      }
      window.wingman?.sendSummonState({ state: "error", slot: direction });
    } finally {
      clearTimeout(timeoutId);
      isGeneratingRef.current = false;
    }
  }, [callId, getRecentTranscript, liveSummary]);

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
