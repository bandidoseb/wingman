"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import type { Call } from "@/types";
import { confirmedOutcome } from "@/lib/wingman/outcome-stats";
import { thermalColor } from "@/lib/utils";

type FilterKey = "today" | "week" | "month" | "year" | "all";

interface Props {
  calls: Call[];
}

const STAGE_ORDER = ["Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close"];
const STAGE_WEIGHTS: Record<string, number> = { Rapport: 0.10, Discovery: 0.25, Press: 0.25, Confirm: 0.10, Pitch: 0.15, Close: 0.15 };

function filterCalls(calls: Call[], filter: FilterKey): Call[] {
  const now = new Date();
  const start = new Date();
  if (filter === "today") start.setHours(0, 0, 0, 0);
  else if (filter === "week") start.setDate(now.getDate() - 7);
  else if (filter === "month") start.setMonth(now.getMonth() - 1);
  else if (filter === "year") start.setFullYear(now.getFullYear() - 1);
  else return calls;
  return calls.filter((c) => new Date(c.call_date) >= start);
}

function computeStageScores(calls: Call[]): Record<string, number> {
  const qualifying = calls.filter((c) => confirmedOutcome(c) !== "DQ");
  const stageCounts: Record<string, { complete: number; total: number }> = {};
  STAGE_ORDER.forEach((s) => { stageCounts[s] = { complete: 0, total: 0 }; });

  qualifying.forEach((call) => {
    (call.call_stages || []).forEach((stage) => {
      if (stageCounts[stage.name]) {
        stageCounts[stage.name].total++;
        if (stage.status === "complete") stageCounts[stage.name].complete++;
      }
    });
  });

  const scores: Record<string, number> = {};
  STAGE_ORDER.forEach((s) => {
    const { complete, total } = stageCounts[s];
    scores[s] = total > 0 ? Math.round((complete / total) * 100) : 0;
  });
  return scores;
}

export default function IntelTab({ calls }: Props) {
  const [filter, setFilter] = useState<FilterKey>("month");
  const [hoveredStage, setHoveredStage] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const filtered = filterCalls(calls, filter);
  const qualifying = filtered.filter((c) => confirmedOutcome(c) !== "DQ");
  const won = filtered.filter((c) => confirmedOutcome(c) === "Closed").length;
  const lost = filtered.filter((c) => confirmedOutcome(c) === "Lost").length;
  const followup = filtered.filter((c) => { const o = confirmedOutcome(c); return o === "Follow Up" || o === "Set"; }).length;
  const dq = filtered.filter((c) => confirmedOutcome(c) === "DQ").length;
  const closeRate = qualifying.length > 0 ? Math.round((won / qualifying.length) * 100) : 0;

  const stages = computeStageScores(filtered);
  const stageEntries = STAGE_ORDER.map((s) => [s, stages[s]] as [string, number]);

  // Weighted overall score
  const weightedStageScore = stageEntries.reduce((sum, [stage, score]) => sum + score * (STAGE_WEIGHTS[stage] || 0), 0) /
    Object.values(STAGE_WEIGHTS).reduce((a, b) => a + b, 0);
  const closeScore = Math.min(100, (closeRate / 50) * 100);
  const overall = Math.round(weightedStageScore * 0.60 + closeScore * 0.40);
  const label = overall >= 75 ? "Strong" : overall >= 50 ? "Good" : overall >= 30 ? "Needs Work" : "Danger Zone";
  const labelColor = overall >= 75 ? "#34c759" : overall >= 50 ? "#85c440" : overall >= 30 ? "#ff9f0a" : "#ff3b30";
  const circumference = 2 * Math.PI * 36;
  const dash = (overall / 100) * circumference;

  const FILTERS: Array<{ id: FilterKey; label: string }> = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "month", label: "This Month" },
    { id: "year", label: "This Year" },
    { id: "all", label: "All Time" },
  ];

  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Mission Intel</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>{filtered.length} calls · {won} closed · {closeRate}% close rate</div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#e5e5ea", borderRadius: 10, padding: 4 }}>
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: "none", fontFamily: "inherit", fontSize: 11, fontWeight: 600, cursor: "pointer", background: filter === f.id ? "#fff" : "transparent", color: filter === f.id ? "#1c1c1e" : "#8e8e93", boxShadow: filter === f.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.18s" }}>{f.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "48px 24px", marginBottom: 14 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1c1e", marginBottom: 6 }}>No flight data yet</div>
          <div style={{ fontSize: 13, color: "#8e8e93", maxWidth: 260, margin: "0 auto" }}>Complete some calls and your intel will appear here.</div>
        </Card>
      ) : (
        <>
          {/* Stats row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[{ label: "Calls", value: filtered.length }, { label: "Closed", value: won, color: "#34c759" }, { label: "Lost", value: lost, color: "#ff3b30" }].map((s) => (
              <Card key={s.label} style={{ padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color || "#1c1c1e", letterSpacing: "-0.02em" }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* Stats row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[{ label: "Follow Up", value: followup, color: "#ff9f0a" }, { label: "Close Rate", value: closeRate + "%", color: closeRate >= 35 ? "#34c759" : "#ff9f0a" }].map((s) => (
              <Card key={s.label} style={{ padding: "14px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: s.color, letterSpacing: "-0.02em" }}>{s.value}</div>
              </Card>
            ))}
          </div>

          {/* DQ stat */}
          <Card style={{ marginBottom: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Disqualified</div>
              <div style={{ fontSize: 11, color: "#8e8e93" }}>DQ calls excluded from stage scores</div>
            </div>
            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e" }}>{dq}</div>
              <div style={{ fontSize: 10, color: "#8e8e93", marginTop: 2 }}>Total DQs</div>
            </div>
          </Card>

          {/* Overall score */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Overall Score</SectionLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <div style={{ position: "relative", flexShrink: 0, width: 96, height: 96 }}>
                <svg width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="36" fill="none" stroke="#e5e5ea" strokeWidth="8" />
                  <circle cx="48" cy="48" r="36" fill="none" stroke={labelColor} strokeWidth="8" strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" transform="rotate(-90 48 48)" style={{ transition: "stroke-dasharray 0.6s ease" }} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#1c1c1e", letterSpacing: "-0.03em", lineHeight: 1 }}>{overall}</div>
                  <div style={{ fontSize: 9, color: "#8e8e93", fontWeight: 600, marginTop: 2 }}>/ 100</div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: labelColor, marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 11, color: "#8e8e93", marginBottom: 12 }}>Based on stage execution and close rate</div>
                {[
                  { label: "Stage Execution", score: Math.round(weightedStageScore), weight: "60%" },
                  { label: "Close Rate", score: Math.round(closeScore), weight: "40%", note: `${closeRate}% → ${Math.round(closeScore)} pts` },
                ].map((item) => (
                  <div key={item.label} style={{ marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#1c1c1e", flex: 1 }}>{item.label}</div>
                      <div style={{ fontSize: 10, color: "#8e8e93" }}>{item.weight}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: item.score >= 75 ? "#34c759" : item.score >= 50 ? "#85c440" : item.score >= 30 ? "#ff9f0a" : "#ff3b30", width: 28, textAlign: "right" }}>{item.score}</div>
                    </div>
                    <div style={{ height: 5, background: "#e5e5ea", borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${item.score}%`, borderRadius: 3, background: item.score >= 75 ? "#34c759" : item.score >= 50 ? "#85c440" : item.score >= 30 ? "#ff9f0a" : "#ff3b30", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* Stage heatmap */}
          <Card style={{ marginBottom: 14 }}>
            <SectionLabel>Stage Performance Heatmap</SectionLabel>
            <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 16, marginTop: -8 }}>Hover any stage for details</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {stageEntries.map(([stage, score]) => {
                const tc = thermalColor(score);
                const isHovered = hoveredStage === stage;
                const grade = score >= 75 ? "Strong" : score >= 50 ? "Good" : score >= 30 ? "Needs Work" : "Danger Zone";
                return (
                  <div key={stage} style={{ flex: 1, position: "relative" }} onMouseEnter={() => setHoveredStage(stage)} onMouseLeave={() => setHoveredStage(null)}>
                    <div style={{ borderRadius: 10, background: tc.solid, boxShadow: isHovered ? `0 0 18px 4px ${tc.glow}, 0 2px 8px rgba(0,0,0,0.15)` : `0 0 8px 1px ${tc.glow}`, padding: "20px 6px 14px", minHeight: 90, textAlign: "center", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all 0.2s", transform: isHovered ? "translateY(-3px) scale(1.04)" : "none" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: tc.text, opacity: 0.85, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{grade}</div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: tc.text, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.04em" }}>{stage}</div>
                    </div>
                    {isHovered && (
                      <div style={{ position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)", background: "#1c1c1e", color: "#fff", borderRadius: 10, padding: "10px 14px", fontSize: 11, lineHeight: 1.7, whiteSpace: "nowrap", zIndex: 100, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 12 }}>{stage}</div>
                        <div>Score: <b>{score}%</b></div>
                        <div style={{ position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "6px solid #1c1c1e" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <span style={{ fontSize: 10, color: "#8e8e93", fontWeight: 500 }}>Strong</span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "linear-gradient(to right, rgb(40,170,90), rgb(100,200,80), rgb(240,195,30), rgb(235,110,25), rgb(210,35,35))" }} />
              <span style={{ fontSize: 10, color: "#8e8e93", fontWeight: 500 }}>Danger Zone</span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
