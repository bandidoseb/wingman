"use client";
import { useState } from "react";

// ─── Shared styles (match electron/tray-popover/index.html exactly) ──────────
const shell: React.CSSProperties = {
  width: 228,
  borderRadius: 14,
  background: "rgba(22, 22, 24, 0.94)",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.35)",
  padding: 12,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
};

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  paddingBottom: 10,
  borderBottom: "1px solid rgba(255,255,255,0.07)",
};

const logoBox: React.CSSProperties = {
  width: 20, height: 20,
  borderRadius: 5,
  background: "#000",
  display: "flex", alignItems: "center", justifyContent: "center",
  overflow: "hidden", flexShrink: 0,
};

const appName: React.CSSProperties = {
  fontSize: 13, fontWeight: 600,
  color: "rgba(255,255,255,0.88)",
  letterSpacing: "-0.01em",
};

const liveDot: React.CSSProperties = {
  width: 6, height: 6,
  borderRadius: "50%",
  background: "#34c759",
  boxShadow: "0 0 5px rgba(52,199,89,0.7)",
  marginLeft: "auto",
};

const btnBase: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  border: "none",
  borderRadius: 8,
  fontSize: 13, fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  textAlign: "center",
};

const deployBtn: React.CSSProperties = { ...btnBase, background: "#fff", color: "#1c1c1e" };

const liveBadge: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7,
  padding: "7px 10px",
  background: "rgba(52,199,89,0.1)",
  border: "1px solid rgba(52,199,89,0.2)",
  borderRadius: 8,
  color: "#34c759",
  fontSize: 13, fontWeight: 600,
};

const liveBadgeDot: React.CSSProperties = {
  width: 7, height: 7,
  borderRadius: "50%",
  background: "#34c759",
  flexShrink: 0,
};

const endBtn: React.CSSProperties = {
  ...btnBase,
  background: "#ff3b30",
  color: "#fff",
  border: "none",
};

const dashboardBtn: React.CSSProperties = {
  ...btnBase,
  background: "transparent",
  color: "rgba(255,255,255,0.35)",
  fontWeight: 500,
  fontSize: 12,
  border: "none",
  padding: "5px 12px",
};

// ─── Popover component ────────────────────────────────────────────────────────
function TrayPopover({ isLive }: { isLive: boolean }) {
  return (
    <div style={shell}>
      {/* Header */}
      <div style={header}>
        <div style={logoBox}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Wingman.png" alt="W" style={{ width: "72%", height: "72%", objectFit: "contain" }} />
        </div>
        <span style={appName}>Wingman</span>
        {isLive && <div style={liveDot} />}
      </div>

      {/* State-dependent content */}
      {isLive ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={liveBadge}>
            <div style={liveBadgeDot} />
            Wingman is live
          </div>
          <button style={endBtn}>End Call</button>
        </div>
      ) : (
        <button style={deployBtn}>Deploy Wingman</button>
      )}

      {/* Always visible */}
      <button style={dashboardBtn}>Open Dashboard</button>
    </div>
  );
}

// ─── Preview page ─────────────────────────────────────────────────────────────
export default function TrayPreviewPage() {
  const [isLive, setIsLive] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 40,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          TRAY POPOVER PREVIEW
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#fff" }}>
          {isLive ? "Live State — call active" : "Idle State — no call"}
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 4 }}>
          Appears below the Wingman icon in the macOS menu bar
        </div>
      </div>

      {/* Simulated menu bar context */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
        {/* Fake menu bar strip */}
        <div style={{
          width: 260,
          height: 26,
          background: "rgba(255,255,255,0.06)",
          borderRadius: "8px 8px 0 0",
          border: "1px solid rgba(255,255,255,0.1)",
          borderBottom: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingRight: 18,
          gap: 14,
        }}>
          {/* Fake icons */}
          {["wifi", "batt", "time"].map(k => (
            <div key={k} style={{ width: 14, height: 10, background: "rgba(255,255,255,0.25)", borderRadius: 2 }} />
          ))}
          {/* Wingman tray icon highlighted */}
          <div style={{
            width: 16, height: 16,
            background: "rgba(255,255,255,0.9)",
            borderRadius: 3,
            display: "flex", alignItems: "center", justifyContent: "center",
            outline: "2px solid rgba(255,255,255,0.4)",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Wingman.png" alt="W" style={{ width: "80%", height: "80%", objectFit: "contain", filter: "invert(1)" }} />
          </div>
        </div>

        {/* Arrow pointing up from popover */}
        <div style={{
          width: 0, height: 0,
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderBottom: "6px solid rgba(22,22,24,0.94)",
          marginRight: 20,
        }} />

        {/* The actual popover */}
        <TrayPopover isLive={isLive} />
      </div>

      {/* Toggle control */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => setIsLive(false)}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: !isLive ? "rgba(255,255,255,0.15)" : "transparent",
            color: !isLive ? "#fff" : "rgba(255,255,255,0.45)",
            fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          Idle (no call)
        </button>
        <button
          onClick={() => setIsLive(true)}
          style={{
            padding: "8px 20px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.2)",
            background: isLive ? "rgba(52,199,89,0.2)" : "transparent",
            color: isLive ? "#34c759" : "rgba(255,255,255,0.45)",
            fontSize: 13, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer",
          }}
        >
          Live (call active)
        </button>
      </div>
    </div>
  );
}
