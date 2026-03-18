"use client";
import { useState, useEffect } from "react";
import { useMotionValue } from "framer-motion";
import Card from "@/components/ui/Card";
import OutcomeBadge from "@/components/ui/OutcomeBadge";
import { CardPattern, generateRandomString } from "@/components/ui/evervault-card";
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
  onPersonalize: () => void;
}

export default function HomeTab({ profile, calls, onDebrief, isActive, savedMessage, onDeploy, onEndCall, onPersonalize }: Props) {
  const { greeting, sub } = getGreeting();
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const [randomString, setRandomString] = useState("");
  const [cardHovered, setCardHovered] = useState(false);
  const [btnHovered, setBtnHovered] = useState(false);

  useEffect(() => {
    setRandomString(generateRandomString(1500));
  }, []);

  function onPersonalizeMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
    setRandomString(generateRandomString(1500));
  }

  // ── Stats ────────────────────────────────────────────────────────────────
  const thisWeekCalls = calls.filter((c) => {
    const d = new Date(c.call_date);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  });

  const totalQualifying = calls.filter((c) => c.outcome !== "DQ").length;
  const totalClosed     = calls.filter((c) => c.outcome === "Closed").length;
  const closeRate       = totalQualifying > 0 ? Math.round((totalClosed / totalQualifying) * 100) : 0;

  // ── Today's calls ────────────────────────────────────────────────────────
  const today      = new Date().toDateString();
  const todayCalls = calls.filter((c) => new Date(c.call_date).toDateString() === today);

  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em" }}>{greeting}.</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>{sub}</div>
      </div>

      {/* Stats strip — 3 pills */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
        {[
          { label: "Total Closes",    value: totalClosed },
          { label: "Close Rate",      value: `${closeRate}%` },
          { label: "Calls This Week", value: thisWeekCalls.length },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: "14px 16px",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em" }}>{stat.value}</div>
            <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginTop: 3 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Deploy / End Call card */}
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
                flexShrink: 0, padding: "12px 28px", background: "#1c1c1e", color: "#fff", border: "none",
                borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
              }}
            >
              Deploy Wingman
            </button>
          )}
        </div>
      </Card>

      {/* Personalize Wingman hero card — Evervault hover effect */}
      <div style={{ marginBottom: 12 }} className="group/card" onMouseMove={onPersonalizeMouseMove} onMouseEnter={() => setCardHovered(true)} onMouseLeave={() => setCardHovered(false)}>
        <Card style={{ padding: 0, overflow: "hidden", border: "none", position: "relative", background: "#1c1c1e" }}>
          {/* Evervault pattern — invisible at rest, reveals on hover following the mouse */}
          <CardPattern mouseX={mouseX} mouseY={mouseY} randomString={randomString} />
          {/* Readability scrim — dark on text side, fades out toward button so effect still shows */}
          <div style={{
            position: "absolute", inset: 0, zIndex: 5, pointerEvents: "none",
            background: "linear-gradient(to right, rgba(28,28,30,0.95) 0%, rgba(28,28,30,0.92) 35%, rgba(28,28,30,0.5) 65%, rgba(28,28,30,0.1) 100%)",
          }} />
          {/* Content */}
          <div style={{ position: "relative", zIndex: 10, isolation: "isolate", padding: "24px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 6 }}>
                Personalize Wingman
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
                The more Wingman knows about your offer and close style, the sharper it gets. Tell it who you&apos;re selling to and how you fly.
              </div>
            </div>
            <button
              onClick={onPersonalize}
              onMouseEnter={() => setBtnHovered(true)}
              onMouseLeave={() => setBtnHovered(false)}
              style={{
                flexShrink: 0,
                padding: "10px 18px",
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                whiteSpace: "nowrap",
                // 3 states: dark (card idle) → frosted (card hovered) → solid white (button hovered)
                background: !cardHovered ? "rgba(255,255,255,0.10)" : btnHovered ? "#fff" : "rgba(255,255,255,0.18)",
                color: !cardHovered ? "#fff" : btnHovered ? "#1c1c1e" : "#fff",
                border: !cardHovered ? "1px solid rgba(255,255,255,0.15)" : btnHovered ? "none" : "1px solid rgba(255,255,255,0.3)",
                transition: "background 0.15s ease, color 0.15s ease, border 0.15s ease",
              }}
            >
              Go →
            </button>
          </div>
        </Card>
      </div>

      {/* Today section */}
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
          Today
        </div>
        {todayCalls.length === 0 ? (
          <div style={{ fontSize: 13, color: "#aeaeb2", padding: "4px 0 8px" }}>No calls yet today.</div>
        ) : (
          todayCalls.map((c, i) => (
            <div
              key={c.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "11px 0",
                borderBottom: i < todayCalls.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none",
              }}
            >
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
          ))
        )}
      </Card>
    </div>
  );
}
