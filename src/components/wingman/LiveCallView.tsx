"use client";

import type { WingmanSignal, LiveScorecard, SignalLogEntry, CallStageLabel } from "@/types";
import SignalCard from "./SignalCard";
import LiveScorecardWidget from "./LiveScorecard";
import StageBar from "./StageBar";
import SignalLog from "./SignalLog";

interface Props {
  stages: CallStageLabel[];
  currentStage: CallStageLabel;
  completedStages: CallStageLabel[];
  scorecard: LiveScorecard;
  currentSignal: WingmanSignal | null;
  signalLog: SignalLogEntry[];
  isPolling: boolean;
  onDismissSignal: () => void;
}

export default function LiveCallView({
  stages,
  currentStage,
  completedStages,
  scorecard,
  currentSignal,
  signalLog,
  isPolling,
  onDismissSignal,
}: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Stage bar */}
      <StageBar
        stages={stages}
        currentStage={currentStage}
        completedStages={completedStages}
      />

      {/* Signal card — only one at a time */}
      <div style={{ minHeight: 80 }}>
        {currentSignal ? (
          <SignalCard signal={currentSignal} onDismiss={onDismissSignal} />
        ) : (
          <div
            style={{
              background: "#f9f9f9",
              borderRadius: 14,
              padding: "20px 16px",
              border: "1.5px dashed #e5e5ea",
              textAlign: "center",
            }}
          >
            {isPolling ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span style={{ fontSize: 12, color: "#8e8e93", marginLeft: 4 }}>Wingman thinking…</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#c7c7cc" }}>Wingman is watching…</div>
            )}
          </div>
        )}
      </div>

      {/* Live scorecard */}
      <LiveScorecardWidget scorecard={scorecard} />

      {/* Signal log */}
      <SignalLog entries={signalLog} />
    </div>
  );
}
