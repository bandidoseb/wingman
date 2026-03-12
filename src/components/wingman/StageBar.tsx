"use client";

import type { CallStageLabel } from "@/types";

interface Props {
  stages: CallStageLabel[];
  currentStage: CallStageLabel;
  completedStages: CallStageLabel[];
}

export default function StageBar({ stages, currentStage, completedStages }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "14px 16px",
        border: "1px solid #e5e5ea",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#8e8e93", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Stage
      </div>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {stages.map((stage, idx) => {
          const isCompleted = completedStages.includes(stage);
          const isCurrent = stage === currentStage;
          const isPending = !isCompleted && !isCurrent;

          return (
            <div key={stage} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "5px 10px",
                  borderRadius: 8,
                  background: isCompleted
                    ? "#f0faf4"
                    : isCurrent
                    ? "#1c1c1e"
                    : "#f2f2f7",
                  border: isCompleted
                    ? "1px solid #34c759"
                    : isCurrent
                    ? "1px solid #1c1c1e"
                    : "1px solid transparent",
                  transition: "all 0.2s ease",
                }}
              >
                {isCompleted && (
                  <svg width="10" height="10" viewBox="0 0 10 10">
                    <path d="M2 5l2.5 2.5L8 3" stroke="#34c759" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: isCurrent ? 700 : 600,
                    color: isCompleted ? "#34c759" : isCurrent ? "#fff" : "#8e8e93",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stage}
                </span>
              </div>

              {/* Connector line */}
              {idx < stages.length - 1 && (
                <div style={{ width: 12, height: 1, background: "#e5e5ea", flexShrink: 0 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
