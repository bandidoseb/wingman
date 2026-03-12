"use client";

import type { LiveScorecard } from "@/types";

interface Props {
  scorecard: LiveScorecard;
}

const RISK_COLORS: Record<string, string> = {
  low: "#34c759",
  medium: "#ff9f0a",
  high: "#ff3b30",
};

function BoolRow({ label, value, detail }: { label: string; value: boolean; detail?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingBottom: 8, borderBottom: "1px solid #f2f2f7" }}>
      <div
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: value ? "#34c759" : "#e5e5ea",
          flexShrink: 0,
          marginTop: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {value && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: value ? "#1c1c1e" : "#8e8e93" }}>{label}</div>
        {detail && value && (
          <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 2, fontStyle: "italic" }}>
            &ldquo;{detail}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveScorecard({ scorecard }: Props) {
  const riskColor = RISK_COLORS[scorecard.objection_risk] ?? "#8e8e93";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px",
        border: "1px solid #e5e5ea",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#8e8e93", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Live Scorecard
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <BoolRow label="Pain Locked" value={scorecard.pain_locked} detail={scorecard.pain_detail} />
        <BoolRow label="Timeline Confirmed" value={scorecard.timeline_confirmed} />
        <BoolRow label="Finances Touched" value={scorecard.finances_touched} />
        <BoolRow label="Decision Maker Confirmed" value={scorecard.decision_maker_confirmed} />

        {/* Objection Risk */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid #f2f2f7" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93" }}>Objection Risk</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: riskColor, textTransform: "capitalize", background: `${riskColor}18`, padding: "2px 8px", borderRadius: 4 }}>
            {scorecard.objection_risk}
          </div>
        </div>

        {/* Gold moment */}
        {scorecard.gold_moment && (
          <div style={{ paddingBottom: 8, borderBottom: "1px solid #f2f2f7" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93", marginBottom: 4 }}>Gold Moment</div>
            <div style={{ fontSize: 12, color: "#1c1c1e", fontStyle: "italic" }}>
              &ldquo;{scorecard.gold_moment}&rdquo;
            </div>
          </div>
        )}

        {/* Predicted next objection */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93", marginBottom: 4 }}>Predicted Next Objection</div>
          <div style={{ fontSize: 12, color: scorecard.predicted_next_objection ? "#ff9f0a" : "#c7c7cc", fontWeight: scorecard.predicted_next_objection ? 600 : 400 }}>
            {scorecard.predicted_next_objection ?? "None predicted"}
          </div>
        </div>
      </div>
    </div>
  );
}
