"use client";
import { useState, useEffect } from "react";

const TOASTS = [
  { id: "3A", label: "Detection Toast — Recall AI auto-detects a call" },
  { id: "3B", label: "Manual Trigger Toast — Ctrl+Shift+W before a call" },
  { id: "3C", label: "End Call Confirmation — Ctrl+Shift+W during a call" },
  { id: "3D-inactivity", label: "Auto-Stop Toast — no activity for 20 min" },
  { id: "3D-maxduration", label: "Auto-Stop Toast — 2 hour limit reached" },
  { id: "3E", label: "Approaching Limit Warning — 10 min before cap" },
];

const DURATION = 5000;

export default function HudPreviewPage() {
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const [animKey, setAnimKey] = useState(0);

  useEffect(() => {
    setProgress(0);
    setAnimKey((k) => k + 1);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) return 100;
        return p + (100 / (DURATION / 100));
      });
    }, 100);
    const timeout = setTimeout(() => {
      setCurrent((c) => (c + 1) % TOASTS.length);
    }, DURATION);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [current]);

  const toast = TOASTS[current];

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      padding: "40px 24px",
      position: "relative",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
          HUD Toast Preview
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>
          Component {toast.id}
        </div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 6 }}>
          {toast.label}
        </div>
      </div>

      {/* Simulated screen with toast in top-right */}
      <div style={{
        width: "100%",
        maxWidth: 800,
        aspectRatio: "16/9",
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(4px)",
      }}>
        {/* Fake desktop content */}
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.15 }}>
          <div style={{ color: "#fff", fontSize: 18, fontWeight: 500, letterSpacing: "-0.01em" }}>Zoom · Active Call</div>
        </div>

        {/* Stage bar hint (simulating HUD context) */}
        <div style={{
          position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
          background: "rgba(255,255,255,0.92)", borderRadius: 10, padding: "6px 14px",
          display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 600,
          color: "#1c1c1e", boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34c759", boxShadow: "0 0 6px rgba(52,199,89,0.7)" }} />
          Rapport · Discovery · Press · Confirm · Pitch · Close
        </div>

        {/* The toast — top right */}
        <div
          key={animKey}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 300,
            background: "rgba(16, 16, 18, 0.92)",
            backdropFilter: "blur(28px)",
            WebkitBackdropFilter: "blur(28px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 16,
            padding: "16px 20px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            animation: "slideDown 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
          }}
        >
          <ToastContent id={toast.id} />
        </div>
      </div>

      {/* Progress bar + navigation */}
      <div style={{ width: "100%", maxWidth: 800, marginTop: 20 }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.1)", borderRadius: 2, overflow: "hidden", marginBottom: 16 }}>
          <div style={{
            height: "100%", background: "#fff", borderRadius: 2,
            width: `${progress}%`, transition: "width 0.1s linear",
          }} />
        </div>

        {/* Dot indicators */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {TOASTS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 24 : 8, height: 8, borderRadius: 4,
                background: i === current ? "#fff" : "rgba(255,255,255,0.25)",
                border: "none", cursor: "pointer", padding: 0,
                transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.3)" }}>
          Click a dot to jump to a toast · auto-advances every 5s
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        button:hover { opacity: 0.8; }
      `}</style>
    </div>
  );
}

function ToastContent({ id }: { id: string }) {
  // Shared icon styles
  const pulseStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: "50%",
    background: "#34c759", boxShadow: "0 0 10px rgba(52,199,89,0.7)",
    flexShrink: 0, animation: "pulse 1.6s ease-in-out infinite",
  };
  const headerStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9 };
  const titleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" };
  const actionsStyle: React.CSSProperties = { display: "flex", gap: 8 };
  const deployBtnStyle: React.CSSProperties = {
    flex: 1, padding: "8px 0", borderRadius: 9, background: "#fff", border: "none",
    color: "#1c1c1e", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
    cursor: "pointer", letterSpacing: "-0.01em",
  };
  const dismissBtnStyle: React.CSSProperties = {
    padding: "8px 16px", borderRadius: 9, background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)",
    fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
  };
  const iconBase: React.CSSProperties = {
    width: 20, height: 20, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  };

  if (id === "3A") return (
    <>
      <div style={headerStyle}>
        <div style={pulseStyle} />
        <span style={titleStyle}>Wingman detected a call</span>
      </div>
      <div style={actionsStyle}>
        <button style={deployBtnStyle}>Deploy Wingman</button>
        <button style={dismissBtnStyle}>Dismiss</button>
      </div>
      <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 6px rgba(52,199,89,0.5)} 50%{box-shadow:0 0 14px rgba(52,199,89,0.9)} }`}</style>
    </>
  );

  if (id === "3B") return (
    <>
      <div style={headerStyle}>
        <div style={{ ...iconBase, borderRadius: 6, background: "#000", overflow: "hidden" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Wingman.png" alt="Wingman" style={{ width: "72%", height: "72%", objectFit: "contain" }} />
        </div>
        <span style={titleStyle}>Ready to deploy Wingman?</span>
      </div>
      <div style={actionsStyle}>
        <button style={deployBtnStyle}>Deploy Wingman</button>
        <button style={dismissBtnStyle}>Cancel</button>
      </div>
    </>
  );

  if (id === "3C") return (
    <>
      <div style={headerStyle}>
        <div style={{
          ...iconBase, background: "rgba(255,59,48,0.2)",
          border: "1px solid rgba(255,59,48,0.35)", fontSize: 10, color: "#ff3b30",
        }}>■</div>
        <span style={titleStyle}>End this call?</span>
      </div>
      <div style={actionsStyle}>
        <button style={{
          flex: 1, padding: "8px 0", borderRadius: 9, background: "#ff3b30", border: "none",
          color: "#fff", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
        }}>End Call</button>
        <button style={dismissBtnStyle}>Keep Going</button>
      </div>
    </>
  );

  if (id === "3D-inactivity" || id === "3D-maxduration") return (
    <>
      <div style={headerStyle}>
        <div style={{
          ...iconBase, background: "rgba(255,159,10,0.2)",
          border: "1px solid rgba(255,159,10,0.35)", fontSize: 11, color: "#ff9f0a",
        }}>!</div>
        <span style={{ ...titleStyle, fontSize: 13, fontWeight: 500, color: "rgba(255,255,255,0.65)" }}>
          {id === "3D-inactivity"
            ? "No activity for 20 minutes — Wingman stopped."
            : "2 hour limit reached — Wingman stopped."}
        </span>
      </div>
    </>
  );

  if (id === "3E") return (
    <>
      <div style={headerStyle}>
        <div style={{
          ...iconBase, background: "rgba(255,159,10,0.25)",
          border: "1px solid rgba(255,159,10,0.5)", fontSize: 12, fontWeight: 700, color: "#ff9f0a",
        }}>⚠</div>
        <span style={titleStyle}>Wingman stops in 10 minutes</span>
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", paddingLeft: 29, marginTop: -4, lineHeight: 1.4 }}>
        2 hour session limit — wrap up or restart after
      </div>
    </>
  );

  return null;
}
