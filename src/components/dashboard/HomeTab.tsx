"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import OutcomeBadge from "@/components/ui/OutcomeBadge";
import type { Profile, Call } from "@/types";
import { getGreeting } from "@/lib/utils";

interface Props {
  profile: Profile;
  calls: Call[];
  onDebrief: (call: Call) => void;
  isActive: boolean;
  savedMessage: string | null;
  onDeploy: () => void;
  onEndCall: () => void;
}

function MissionsCard({ calls, onDebrief }: { calls: Call[]; onDebrief: (call: Call) => void }) {
  const [calOpen, setCalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const today = new Date().toDateString();
  const todayCalls = calls.filter((c) => new Date(c.call_date).toDateString() === today);
  const prevCalls = calls.filter((c) => new Date(c.call_date).toDateString() !== today);

  // Group previous calls by day
  const byDay: Record<string, Call[]> = {};
  prevCalls.forEach((c) => {
    const day = new Date(c.call_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(c);
  });

  const MissionRow = ({ c }: { c: Call }) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#e5e5ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "#8e8e93", flexShrink: 0 }}>
          {(c.prospect_name || "?")[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1e" }}>{c.prospect_name}</div>
          <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 1 }}>{c.duration}</div>
        </div>
        {c.outcome && <OutcomeBadge outcome={c.outcome} />}
      </div>
      <button
        onClick={() => onDebrief(c)}
        style={{ background: "#e5e5ea", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 500, color: "#1c1c1e", fontFamily: "inherit", cursor: "pointer", marginLeft: 8, flexShrink: 0 }}
      >
        Debrief →
      </button>
    </div>
  );

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Missions</SectionLabel>
      {todayCalls.length === 0 ? (
        <div style={{ fontSize: 13, color: "#8e8e93", padding: "12px 0" }}>No calls logged today.</div>
      ) : (
        todayCalls.map((c) => <MissionRow key={c.id} c={c} />)
      )}

      {Object.keys(byDay).length > 0 && (
        <>
          <button onClick={() => { setCalOpen((o) => !o); setSelectedDay(null); }}
            style={{ width: "100%", marginTop: 14, padding: 10, background: "transparent", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", fontFamily: "inherit", transition: "border-color 0.2s" }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "#8e8e93" }}>Previous Missions</span>
            <span style={{ fontSize: 12, color: "#aeaeb2", transition: "transform 0.22s", display: "inline-block", transform: calOpen ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
          </button>

          {calOpen && (
            <div className="accordion-body" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(byDay).map(([day, dayCalls]) => {
                  const wins = dayCalls.filter((c) => c.outcome === "Closed").length;
                  const losses = dayCalls.filter((c) => c.outcome === "Lost").length;
                  const followups = dayCalls.filter((c) => c.outcome === "Follow Up").length;
                  const isSelected = selectedDay === day;
                  return (
                    <div key={day} style={{ border: `1.5px solid ${isSelected ? "#000" : "rgba(0,0,0,0.08)"}`, borderRadius: 10, overflow: "hidden", transition: "border-color 0.18s" }}>
                      <button onClick={() => setSelectedDay(isSelected ? null : day)}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", fontFamily: "inherit", border: "none", background: isSelected ? "#000" : "#fff", transition: "background 0.18s" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: isSelected ? "#fff" : "#1c1c1e" }}>{day}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {[{ l: "W", c: wins, color: "#34c759" }, { l: "L", c: losses, color: "#ff3b30" }, { l: "F", c: followups, color: "#ff9f0a" }].map((col) => (
                            <div key={col.l} style={{ display: "flex", alignItems: "center", gap: 3, width: 36, justifyContent: "center", background: `${col.color}22`, borderRadius: 6, padding: "3px 0" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: col.color }}>{col.c}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, color: col.color, opacity: 0.8 }}>{col.l}</span>
                            </div>
                          ))}
                          <span style={{ fontSize: 11, color: isSelected ? "rgba(255,255,255,0.5)" : "#aeaeb2", marginLeft: 4, display: "inline-block", transform: isSelected ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                        </div>
                      </button>
                      {isSelected && (
                        <div className="accordion-body" style={{ background: "#f2f2f7", borderTop: "1px solid rgba(0,0,0,0.06)", padding: "0 14px" }}>
                          {dayCalls.map((c) => <MissionRow key={c.id} c={c} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export default function HomeTab({ profile, calls, onDebrief, isActive, savedMessage, onDeploy, onEndCall }: Props) {
  const { greeting, sub } = getGreeting();

  const thisWeekCalls = calls.filter((c) => {
    const d = new Date(c.call_date);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });
  const closed = thisWeekCalls.filter((c) => c.outcome === "Closed").length;
  const lost = thisWeekCalls.filter((c) => c.outcome === "Lost").length;

  const totalQualifying = calls.filter((c) => c.outcome !== "DQ").length;
  const totalClosed = calls.filter((c) => c.outcome === "Closed").length;
  const closeRate = totalQualifying > 0 ? Math.round((totalClosed / totalQualifying) * 100) : 0;

  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em" }}>{greeting}.</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>{sub}</div>
      </div>

      {/* Launch card */}
      <Card style={{ marginBottom: 12, padding: "28px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div>
            {isActive ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34c759", animation: "livePulse 2s ease-in-out infinite" }} />
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Wingman is live.</div>
                </div>
                <div style={{ fontSize: 13, color: "#8e8e93", lineHeight: 1.5 }}>Recording and coaching in real time.</div>
                {savedMessage && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#34c759", marginTop: 8 }}>{savedMessage}</div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", marginBottom: 5 }}>Wingman is standing by.</div>
                <div style={{ fontSize: 13, color: "#8e8e93", lineHeight: 1.5 }}>Wingman listens live and guides you through every stage.</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10 }}>
                  {["⌃", "⇧", "W"].map((k) => (
                    <span key={k} style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      background: "#f2f2f7", border: "1px solid rgba(0,0,0,0.12)",
                      borderRadius: 5, fontSize: 11, fontWeight: 600, color: "#3c3c43",
                      width: 22, height: 20, fontFamily: "inherit",
                      boxShadow: "0 1px 0 rgba(0,0,0,0.14)",
                    }}>{k}</span>
                  ))}
                  <span style={{ fontSize: 11, color: "#aeaeb2", marginLeft: 4 }}>to deploy instantly</span>
                </div>
              </>
            )}
          </div>
          {isActive ? (
            <button
              onClick={onEndCall}
              style={{
                flexShrink: 0, padding: "12px 28px", background: "#ff3b30", color: "#fff", border: "none",
                borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(255,59,48,0.3)",
              }}
            >
              End Call
            </button>
          ) : (
            <button
              onClick={onDeploy}
              style={{
                flexShrink: 0, padding: "12px 28px", background: "#000", color: "#fff", border: "none",
                borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            >
              Deploy Wingman
            </button>
          )}
        </div>
      </Card>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 8, letterSpacing: "0.01em" }}>Close Rate</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 4 }}>{closeRate}%</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#8e8e93" }}>All time · {totalClosed}/{totalQualifying} calls</div>
        </Card>
        <Card style={{ padding: "18px 20px" }}>
          <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 8, letterSpacing: "0.01em" }}>Calls This Week</div>
          <div style={{ fontSize: 30, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 4 }}>{thisWeekCalls.length}</div>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#8e8e93" }}>{closed} closed · {lost} lost</div>
        </Card>
      </div>

      <MissionsCard calls={calls} onDebrief={onDebrief} />

      {/* Signal guide */}
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Signal Guide</SectionLabel>
        <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 14, marginTop: -6 }}>Wingman color-codes every signal so you know what's happening at a glance.</div>
        {[
          { tag: "Alert", border: "rgba(192,57,43,0.3)", bg: "#fff0f0", color: "#ff3b30", desc: "Stop — don't proceed yet" },
          { tag: "Topic", border: "rgba(255,159,10,0.3)", bg: "#fff8ee", color: "#ff9f0a", desc: "Something's missing — cover it first" },
          { tag: "Suggest", border: "rgba(0,122,255,0.3)", bg: "#eef5ff", color: "#4a90d9", desc: "Coaching nudge — helpful, not urgent" },
          { tag: "Ready", border: "rgba(52,199,89,0.3)", bg: "#f0faf4", color: "#34c759", desc: "All clear — move forward" },
        ].map((s, i, arr) => (
          <div key={s.tag} style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: i < arr.length - 1 ? 13 : 0, marginBottom: i < arr.length - 1 ? 13 : 0, borderBottom: i < arr.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
            <div style={{ minWidth: 64, height: 28, borderRadius: 8, flexShrink: 0, background: s.bg, border: `1.5px solid ${s.border}`, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 10px" }}>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: s.color, whiteSpace: "nowrap" }}>{s.tag}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1e" }}>{s.desc}</div>
          </div>
        ))}
      </Card>
    </div>
  );
}
