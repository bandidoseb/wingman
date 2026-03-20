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
import PaywallModal from "@/components/ui/PaywallModal";
import { FREE_CALL_LIMIT } from "@/lib/constants";
import { getStagesForRole, getDefaultStage } from "@/lib/wingman/poll-intervals";
import { useWingmanPoller } from "@/hooks/useWingmanPoller";
import { useRecallTranscript } from "@/hooks/useRecallTranscript";

export type DashboardTab = "home" | "library" | "objections" | "signals" | "intel" | "settings" | "personalize";

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
  const stages      = getStagesForRole();
  const defaultStage = getDefaultStage();

  // ── Tab / UI state ─────────────────────────────────────────────────────────
  const [tab, setTab] = useState<DashboardTab>("home");
  const [collapsed, setSidebarCollapsed] = useState(false);
  const [badges, setBadges] = useState({
    objections: initialObjections.filter((o) => o.is_new).length,
    signals:    initialSignals.filter((s) => s.is_new).length,
  });
  const [pendingCall, setPendingCall] = useState<Call | null>(null);

  // ── Call session state ─────────────────────────────────────────────────────
  const [callId, setCallId]       = useState<string | null>(null);
  const [isActive, setIsActive]   = useState(false);
  const [stage, setStage]         = useState<CallStageLabel>(defaultStage);
  const [startError, setStartError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  // Ref so IPC callback always reads latest isActive without stale closure
  const isActiveRef = useRef(false);
  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);

  // ── Paywall ────────────────────────────────────────────────────────────────
  const [showPaywall, setShowPaywall] = useState<boolean>(() => isPaywallActive(profile));
  const handleLimitReached = useCallback(() => setShowPaywall(true), []);

  // ── Wingman AI poller (always mounted, does nothing when isActive=false) ───
  const {
    scorecard,
    currentSignal,
    completedStages,
    addChunk,
    dismissSignal,
  } = useWingmanPoller({
    callId,
    stage,
    isActive,
    objections: initialObjections,
  });

  // Keep stage in sync with what the AI detects so poll intervals adapt
  useEffect(() => {
    if (scorecard.current_stage) {
      setStage(scorecard.current_stage as CallStageLabel);
    }
  }, [scorecard.current_stage]);

  // ── Recall AI transcript listener (Electron only, no-op in browser) ────────
  const { isElectron } = useRecallTranscript({ isActive, addChunk });

  // ── Start a live call ──────────────────────────────────────────────────────
  const handleStartCall = useCallback(async () => {
    setStartError(null);
    try {
      // Check meeting detection BEFORE creating a session record.
      // If no Zoom/Meet window is open, bail immediately — no DB entry created.
      if (typeof window !== "undefined" && window.wingman) {
        const result = await window.wingman.startCall() as { success: boolean; error?: string } | undefined;
        if (result && !result.success) {
          if (result.error === "no_meeting") {
            setStartError("No call detected. Open Zoom or Google Meet first.");
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
    } catch (err) {
      setStartError(err instanceof Error ? err.message : "Failed to start call");
    }
  }, [handleLimitReached]);

  // ── End the active call ────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    setIsActive(false);

    // Tell Electron to stop Recall AI and show the HUD outcome card.
    // Pass callId + access token so the HUD can save the outcome via API.
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

    if (!callId) return;

    try {
      await fetch("/api/wingman/session", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callId,
          stages: completedStages.map((s, idx) => ({
            name: s,
            status: "complete",
            display_order: idx,
          })),
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
  }, [callId, completedStages, defaultStage, router]);

  // ── Auto-ended by Recall AI (meeting lost, inactivity, 2h cap) ────────────
  // Patches the session WITHOUT calling window.wingman.endCall() — Electron
  // already stopped Recall AI on this path, so calling it again would double-stop.
  const handleAutoEnd = useCallback(async () => {
    setIsActive(false);

    if (!callId) return;

    try {
      await fetch("/api/wingman/session", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callId,
          stages: completedStages.map((s, idx) => ({
            name: s,
            status: "complete",
            display_order: idx,
          })),
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
  }, [callId, completedStages, defaultStage, router]);

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

  // ── Sync state → floating HUD (Electron only) ─────────────────────────────
  useEffect(() => {
    if (!isElectron) return;
    window.wingman?.sendStage({ current: stage, all: stages, completed: completedStages });
  }, [stage, stages, completedStages, isElectron]);

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
              savedMessage={savedMessage}
              onDeploy={handleStartCall}
              onEndCall={handleEndCall}
              onPersonalize={() => setTab("personalize")}
            />
          )}
          {tab === "library" && (
            <FlightLogTab
              calls={initialCalls}
              initialCall={pendingCall}
              onInitialCallConsumed={clearPendingCall}
              userId={userId}
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
