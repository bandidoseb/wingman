"use client";
import type { Outcome } from "@/types";

const styles: Record<string, { color: string; bg: string }> = {
  Closed:      { color: "#34c759", bg: "#f0faf4" },
  Lost:        { color: "#ff3b30", bg: "#fff0f0" },
  DQ:          { color: "#ff9f0a", bg: "#fff8ee" },
  Set:         { color: "#4a90d9", bg: "#eef5ff" },
  "Follow Up": { color: "#ff9f0a", bg: "#fff8ee" },
};

export default function OutcomeBadge({ outcome }: { outcome: Outcome | string }) {
  const s = styles[outcome] || { color: "#8e8e93", bg: "#e5e5ea" };
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 6,
        color: s.color,
        background: s.bg,
        whiteSpace: "nowrap",
      }}
    >
      {outcome}
    </div>
  );
}
