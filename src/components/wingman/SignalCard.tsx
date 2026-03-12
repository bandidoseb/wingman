"use client";

import type { WingmanSignal } from "@/types";

interface Props {
  signal: WingmanSignal;
  onDismiss: () => void;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; glow: string; badge: string; badgeBg: string }> = {
  Alert: {
    bg: "#fff5f5",
    border: "#ff3b30",
    glow: "0 0 0 3px rgba(255,59,48,0.18), 0 8px 32px rgba(255,59,48,0.22)",
    badge: "#ff3b30",
    badgeBg: "#fff0f0",
  },
  Nudge: {
    bg: "#f0f6ff",
    border: "#007aff",
    glow: "0 0 0 3px rgba(0,122,255,0.15), 0 8px 32px rgba(0,122,255,0.18)",
    badge: "#007aff",
    badgeBg: "#e8f0fe",
  },
  Ready: {
    bg: "#f0faf4",
    border: "#34c759",
    glow: "0 0 0 3px rgba(52,199,89,0.15), 0 8px 32px rgba(52,199,89,0.18)",
    badge: "#34c759",
    badgeBg: "#e8faf0",
  },
  Handle: {
    bg: "#f0f6ff",
    border: "#007aff",
    glow: "0 0 0 3px rgba(0,122,255,0.15), 0 8px 32px rgba(0,122,255,0.18)",
    badge: "#007aff",
    badgeBg: "#e8f0fe",
  },
};

export default function SignalCard({ signal, onDismiss }: Props) {
  const s = TYPE_STYLES[signal.type] ?? TYPE_STYLES.Nudge;

  return (
    <div
      style={{
        background: s.bg,
        border: `2px solid ${s.border}`,
        borderRadius: 16,
        padding: "16px 18px",
        boxShadow: s.glow,
        animation: "wingmanSignalIn 0.28s cubic-bezier(0.22,1,0.36,1) both",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes wingmanSignalIn {
          from { opacity: 0; transform: translateY(10px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Type badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div
          style={{
            background: s.badgeBg,
            color: s.badge,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.08em",
            padding: "3px 8px",
            borderRadius: 5,
            textTransform: "uppercase",
          }}
        >
          {signal.type}
        </div>
        {signal.source === "keyword" && (
          <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, letterSpacing: "0.04em" }}>
            ⚡ Instant
          </div>
        )}
      </div>

      {/* Header */}
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#1c1c1e",
          marginBottom: 6,
          lineHeight: 1.35,
        }}
      >
        {signal.header}
      </div>

      {/* Text */}
      <div
        style={{
          fontSize: 13,
          color: "#3a3a3c",
          lineHeight: 1.55,
          marginBottom: 14,
        }}
      >
        {signal.text}
      </div>

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        style={{
          background: s.border,
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "7px 16px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "inherit",
          letterSpacing: "0.02em",
        }}
      >
        Got it
      </button>
    </div>
  );
}
