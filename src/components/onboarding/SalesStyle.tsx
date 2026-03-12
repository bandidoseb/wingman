"use client";
import { useState, useEffect } from "react";

const STYLES = ["Direct & assertive", "Warm & conversational", "Consultative", "Challenger"];
const LENGTHS = ["Under 30 min", "30–45 min", "45–60 min", "60+ min"];

function ChipGrid({ options, selected, onSelect }: { options: string[]; selected: string | null; onSelect: (o: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
      {options.map((o) => (
        <div
          key={o}
          onClick={() => onSelect(o)}
          style={{
            background: "#fff", borderRadius: 10, padding: "13px 14px",
            border: `2px solid ${selected === o ? "#000" : "transparent"}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            cursor: "pointer", fontSize: 13, fontWeight: 500,
            color: selected === o ? "#1c1c1e" : "#8e8e93",
            transition: "border-color 0.15s",
          }}
        >
          {o}
        </div>
      ))}
    </div>
  );
}

export default function SalesStyle({ onNext }: { onNext: (style: string, length: string) => void }) {
  const [style, setStyle] = useState<string | null>(null);
  const [length, setLength] = useState<string | null>(null);

  useEffect(() => {
    if (style && length) {
      const styleShort = style.split(" ")[0];
      const t = setTimeout(() => onNext(styleShort, length), 250);
      return () => clearTimeout(t);
    }
  }, [style, length, onNext]);

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>How do you fly?</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>Tell us your style so Wingman can match your energy on every call.</div>
      <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Your sales style</div>
      <ChipGrid options={STYLES} selected={style} onSelect={setStyle} />
      <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Typical call length</div>
      <ChipGrid options={LENGTHS} selected={length} onSelect={setLength} />
      {(!style || !length) && (
        <div style={{ fontSize: 12, color: "#8e8e93", textAlign: "center", marginTop: 4 }}>
          {!style && !length ? "Pick a style and call length above" : !style ? "Pick your sales style above" : "Pick your typical call length above"}
        </div>
      )}
    </div>
  );
}
