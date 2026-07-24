"use client";
import { useState, useEffect, type CSSProperties } from "react";
import { useMotionValue } from "framer-motion";
import Card from "@/components/ui/Card";
import OutcomeBadge from "@/components/ui/OutcomeBadge";
import { CardPattern, generateRandomString } from "@/components/ui/evervault-card";
import type { Profile, Call } from "@/types";
import { confirmedOutcome } from "@/lib/wingman/outcome-stats";
import { getGreeting } from "@/lib/utils";

interface Props {
  profile: Profile;
  calls: Call[];
  onDebrief: (call: Call) => void;
  isActive: boolean;
  isPendingOutcome?: boolean;
  savedMessage: string | null;
  onDeploy: () => void;
  onEndCall: () => void;
  onPersonalize: () => void;
  // #47: Deploy phase from Electron main (pre-live). "searching" = arm-and-waiting
  // for the call, "starting" = recording spinning up. Drives the button only.
  deployPhase?: "idle" | "searching" | "starting";
  stillLooking?: boolean;   // 15s into searching → nudge copy
  onCancelSearch?: () => void;
}

// #47: shared base so every Deploy-card control (Deploy / Looking / Starting / End)
// is the exact same size — the fixed-width slot + this identical box = no resizing.
const deployControlBase: CSSProperties = {
  width: "100%", boxSizing: "border-box", height: 46,
  display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
  padding: "0 16px", border: "none", borderRadius: 12,
  fontSize: 14, fontWeight: 600, fontFamily: "inherit", letterSpacing: "-0.01em", whiteSpace: "nowrap",
};
const spinnerStyle: CSSProperties = {
  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
  border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
  animation: "wmSpin 0.7s linear infinite",
};

export default function HomeTab({ profile, calls, onDebrief, isActive, isPendingOutcome = false, savedMessage, onDeploy, onEndCall, onPersonalize, deployPhase = "idle", stillLooking = false, onCancelSearch }: Props) {
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

  const totalQualifying = calls.filter((c) => confirmedOutcome(c) !== "DQ").length;
  const totalClosed     = calls.filter((c) => confirmedOutcome(c) === "Closed").length;
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
        {/* minHeight keeps the card the exact same height in every state (idle has
            the ⌃⇧W hint row; live doesn't) so it never grows/shrinks — #47 solidity */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, minHeight: 64 }}>
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
            ) : deployPhase === "searching" ? (
              // #47: Recall only detects the meeting when its window is on the
              // current desktop/Space — tell the rep to swipe to it so they don't
              // just sit there wondering why nothing happens.
              <>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em", marginBottom: 5 }}>Looking for your call…</div>
                <div style={{ fontSize: 13, color: "#8e8e93", lineHeight: 1.5, maxWidth: 380 }}>
                  Swipe to your call window — Wingman starts automatically.
                </div>
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
          {/* #47: every state fills ONE fixed-width slot so the button never changes
              size and the left text never reflows between states (solidity). */}
          <div style={{ width: 240, flexShrink: 0, display: "flex", justifyContent: "flex-end" }}>
            {isActive ? (
              <button onClick={onEndCall} style={{ ...deployControlBase, background: "#ff3b30", color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(255,59,48,0.3)" }}>
                End Call
              </button>
            ) : deployPhase === "searching" ? (
              // Arm-and-waiting for the call. The whole pill is the Cancel target.
              <button onClick={onCancelSearch} title="Cancel" style={{ ...deployControlBase, background: "#1c1c1e", color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)", gap: 8, fontSize: 13 }}>
                <span style={spinnerStyle} />
                {stillLooking ? "Still looking…" : "Looking for your call…"}
                <span style={{ marginLeft: 2, fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1 }}>✕</span>
              </button>
            ) : deployPhase === "starting" ? (
              // Meeting found, recording spinning up. Locked, no cancel.
              <div style={{ ...deployControlBase, background: "#1c1c1e", color: "#fff", opacity: 0.9 }}>
                <span style={spinnerStyle} />
                Starting…
              </div>
            ) : (
              <button onClick={onDeploy} style={{ ...deployControlBase, background: "#1c1c1e", color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
                Deploy Wingman
              </button>
            )}
          </div>
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
                Build your Sales DNA
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.55 }}>
                The more Wingman knows your offer and how you sell, the sharper every card gets. Brief it once — who you sell to, and how you run discovery.
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
        {/* Live call skeleton — green dot, actively recording */}
        {isActive && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: todayCalls.length > 0 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#e5f7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34c759", animation: "livePulse 2s ease-in-out infinite" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1e" }}>Live Call in Progress…</div>
                <div style={{ fontSize: 11, color: "#34c759", marginTop: 1, fontWeight: 500 }}>Recording now</div>
              </div>
            </div>
            <div style={{ width: 56, height: 22, borderRadius: 6, background: "#e5e5ea", animation: "livePulse 2s ease-in-out infinite" }} />
          </div>
        )}
        {/* Processing skeleton — call ended, waiting for disposition */}
        {!isActive && isPendingOutcome && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: todayCalls.length > 0 ? "1px solid rgba(0,0,0,0.06)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f2f2f7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#aeaeb2", animation: "livePulse 2s ease-in-out infinite" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1e" }}>Processing call…</div>
                <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 1 }}>Waiting for outcome</div>
              </div>
            </div>
            <div style={{ width: 56, height: 22, borderRadius: 6, background: "#e5e5ea", animation: "livePulse 2s ease-in-out infinite" }} />
          </div>
        )}
        {!isActive && todayCalls.length === 0 ? (
          <div style={{ fontSize: 13, color: "#aeaeb2", padding: "4px 0 8px" }}>No calls yet today.</div>
        ) : todayCalls.length > 0 ? (
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
                {c.outcome && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <OutcomeBadge outcome={c.outcome} />
                    {c.outcome_source === "auto" && (
                      <span title="Auto-detected by Wingman — confirm it in Flight Log"
                        style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: "#8e8e93", background: "#f2f2f7", borderRadius: 5, padding: "2px 5px", textTransform: "uppercase" }}>
                        auto
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => onDebrief(c)}
                style={{ background: "#e5e5ea", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 500, color: "#1c1c1e", fontFamily: "inherit", cursor: "pointer", marginLeft: 8, flexShrink: 0 }}
              >
                Debrief →
              </button>
            </div>
          ))
        ) : null}
      </Card>
    </div>
  );
}
