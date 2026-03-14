"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CallStageLabel, VaultObjection } from "@/types";
import { getStagesForRole, getDefaultStage } from "@/lib/wingman/poll-intervals";
import { useWingmanPoller } from "@/hooks/useWingmanPoller";
import { useRecallTranscript } from "@/hooks/useRecallTranscript";
import TranscriptInput from "@/components/wingman/TranscriptInput";
import LiveCallView from "@/components/wingman/LiveCallView";

interface Props {
  objections: VaultObjection[];
  /** Called when the API returns trial_ended — triggers the full-screen paywall */
  onLimitReached: () => void;
}

export default function SimulatorTab({ objections, onLimitReached }: Props) {
  const router = useRouter();
  const stages = getStagesForRole();
  const defaultStage = getDefaultStage();

  const [callId, setCallId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [stage, setStage] = useState<CallStageLabel>(defaultStage);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  const {
    scorecard,
    currentSignal,
    signalLog,
    isPolling,
    pollError,
    completedStages,
    addChunk,
    triggerPollNow,
    dismissSignal,
  } = useWingmanPoller({
    callId,
    stage,
    isActive,
    objections,
  });

  const handleStartCall = useCallback(async (prospectName: string) => {
    setStartError(null);
    try {
      const res = await fetch("/api/wingman/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prospect_name: prospectName || "Simulator Session" }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error === "trial_ended") {
          // Trigger the full-screen paywall overlay — no inline banner
          onLimitReached();
        } else if (data.error === "call_limit_reached") {
          setStartError(`📊 You've hit your monthly call limit (${data.call_limit} calls). Purchase additional calls to continue.`);
        } else if (data.error === "subscription_required") {
          setStartError("💳 An active subscription is required. Go to Settings → Plan & Billing to subscribe.");
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
  }, []);

  const handleEndCall = useCallback(async () => {
    setIsActive(false);
    if (!callId) return;

    try {
      await fetch("/api/wingman/session", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callId,
          outcome: "Follow Up",
          summary: `Simulator session. Stages covered: ${completedStages.join(", ") || "N/A"}.`,
          stages: completedStages.map((s, idx) => ({
            name: s,
            status: "complete",
            display_order: idx,
          })),
        }),
      });
      setSavedMessage("Saved to Flight Log ✓");
      setTimeout(() => setSavedMessage(null), 4000);
      router.refresh(); // re-fetch server data so Flight Log shows the new call
    } catch {
      // fail silently — call still saved in DB
    }

    setCallId(null);
    setStage(defaultStage);
  }, [callId, completedStages, defaultStage]);

  // ── Recall AI auto-transcript (Electron only) ───────────────────────────────
  // When running in the desktop app, Recall AI sends chunks automatically.
  // isElectron will be false in a regular browser tab (simulator mode still works).
  const { isElectron, chunkCount } = useRecallTranscript({ isActive, addChunk });

  // ── Sync signals / scorecard / stage → Floating HUD (Electron only) ─────────
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

  // ── F5 shortcut: toggle call start/stop (Electron only) ─────────────────────
  useEffect(() => {
    if (!isElectron) return;
    const toggle = () => {
      if (isActive) {
        handleEndCall();
      } else {
        handleStartCall("Live Call");
      }
    };
    window.wingman?.onToggleCall(toggle);
    return () => { window.wingman?.offToggleCall(); };
  }, [isElectron, isActive, handleEndCall, handleStartCall]);

  // ── Dismiss from HUD syncs back to web app state ─────────────────────────────
  useEffect(() => {
    if (!isElectron) return;
    window.wingman?.onSignalDismiss(() => dismissSignal());
    return () => { window.wingman?.offSignalDismiss(); };
  }, [isElectron, dismissSignal]);

  const handleSendChunk = useCallback(
    (chunk: string) => {
      addChunk(chunk);
      triggerPollNow();
    },
    [addChunk, triggerPollNow]
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>
            {isElectron ? "Live Call" : "Flight Simulator"}
          </div>
          {isActive && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0faf4", border: "1px solid #34c759", borderRadius: 20, padding: "4px 12px" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34c759", animation: "blink 1.2s infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#34c759" }}>
                {isElectron ? "Recording" : "Live"}
              </span>
            </div>
          )}
          {isElectron && isActive && chunkCount > 0 && (
            <div style={{ fontSize: 11, color: "#8e8e93", background: "#f2f2f7", padding: "3px 10px", borderRadius: 20 }}>
              🎙 {chunkCount} chunk{chunkCount !== 1 ? "s" : ""} received
            </div>
          )}
          {savedMessage && (
            <div style={{ fontSize: 12, fontWeight: 600, color: "#34c759" }}>{savedMessage}</div>
          )}
        </div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>
          {isElectron
            ? "Recall AI is listening. Start a call and Wingman will coach you in real time."
            : "Test the AI engine without live audio. Paste transcript chunks and see Wingman respond in real time."}
        </div>
      </div>

      {startError && (
        <div style={{ background: "#fff0f0", border: "1px solid #ffd5d5", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#ff3b30" }}>
          {startError}
        </div>
      )}

      {pollError && (
        <div style={{ background: "#fff8ee", border: "1px solid #ffd5a0", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "#cc7700" }}>
          ⚠️ {pollError}
        </div>
      )}

      {/* Split layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Left — Transcript Input */}
        <TranscriptInput
          stages={stages}
          currentStage={stage}
          isActive={isActive}
          isPolling={isPolling}
          onStageChange={setStage}
          onSendChunk={handleSendChunk}
          onStartCall={handleStartCall}
          onEndCall={handleEndCall}
        />

        {/* Right — Live Call View */}
        <LiveCallView
          stages={stages}
          currentStage={scorecard.current_stage}
          completedStages={completedStages}
          scorecard={scorecard}
          currentSignal={currentSignal}
          signalLog={signalLog}
          isPolling={isPolling}
          onDismissSignal={dismissSignal}
        />
      </div>

      {!isActive && (
        <div
          style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 14,
            padding: "20px",
            border: "1px solid #e5e5ea",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1c1e", marginBottom: 10 }}>How to use the Simulator</div>
          <ol style={{ paddingLeft: 20, margin: 0, color: "#3a3a3c", fontSize: 13, lineHeight: 2 }}>
            <li>Enter a prospect name (optional) and select your starting stage</li>
            <li>Click <strong>Start Call</strong> — this creates a real call record in your database</li>
            <li>Type or paste transcript lines using <code style={{ background: "#f2f2f7", padding: "1px 4px", borderRadius: 3 }}>Rep: text</code> / <code style={{ background: "#f2f2f7", padding: "1px 4px", borderRadius: 3 }}>Prospect: text</code> format</li>
            <li>Click <strong>Send Chunk</strong> (or ⌘↵) — Wingman polls Claude and keyword triggers fire instantly</li>
            <li>Watch the right panel: signals appear, scorecard updates, log fills in</li>
            <li>Change the stage dropdown mid-call to test different polling intervals</li>
            <li>Click <strong>End Call &amp; Save</strong> to save to your Flight Log</li>
          </ol>
        </div>
      )}
    </div>
  );
}
