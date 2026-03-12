"use client";

import type { SignalLogEntry } from "@/types";

interface Props {
  entries: SignalLogEntry[];
}

const TYPE_COLORS: Record<string, string> = {
  Alert: "#ff3b30",
  Nudge: "#007aff",
  Ready: "#34c759",
  Handle: "#007aff",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function SignalLog({ entries }: Props) {
  if (entries.length === 0) {
    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: "16px",
          border: "1px solid #e5e5ea",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 800, color: "#8e8e93", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
          Signal Log
        </div>
        <div style={{ fontSize: 12, color: "#c7c7cc", textAlign: "center", padding: "12px 0" }}>
          No signals fired yet
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "16px",
        border: "1px solid #e5e5ea",
        maxHeight: 260,
        overflowY: "auto",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: "#8e8e93", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>
        Signal Log ({entries.length})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((entry) => {
          const color = TYPE_COLORS[entry.signal.type] ?? "#8e8e93";
          return (
            <div
              key={entry.id}
              style={{
                display: "flex",
                gap: 10,
                padding: "8px 10px",
                background: `${color}08`,
                borderRadius: 8,
                borderLeft: `3px solid ${color}`,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {entry.signal.type}
                  </span>
                  {entry.signal.source === "keyword" && (
                    <span style={{ fontSize: 10, color: "#8e8e93" }}>⚡</span>
                  )}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {entry.signal.header}
                </div>
              </div>
              <div style={{ fontSize: 10, color: "#aeaeb2", flexShrink: 0, paddingTop: 2, whiteSpace: "nowrap" }}>
                {formatTime(entry.firedAt)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
