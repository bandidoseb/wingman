"use client";
import { useState } from "react";

function TagPill({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: color + "18", border: `1px solid ${color}40`, borderRadius: 20, padding: "6px 10px 6px 12px", fontSize: 13, color, fontWeight: 500 }}>
      {label}
      <button onClick={onRemove} style={{ background: "none", border: "none", color, fontSize: 15, cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.6 }}>×</button>
    </div>
  );
}

function AddTagInput({ placeholder, onAdd, color }: { placeholder: string; onAdd: (v: string) => void; color: string }) {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) { onAdd(val.trim()); setVal(""); } };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
      <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={placeholder}
        style={{ flex: 1, background: "#e5e5ea", border: "2px solid transparent", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", color: "#1c1c1e", outline: "none" }} />
      <button onClick={submit} style={{ background: val.trim() ? "#000" : "#e5e5ea", color: val.trim() ? "#fff" : "#8e8e93", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Add</button>
    </div>
  );
}

export default function Qualification({ onNext }: { onNext: (green: string[], dq: string[]) => void }) {
  const [green, setGreen] = useState([
    "Has a clear, specific problem they want solved",
    "Has buy-in from the people around them",
    "Has a timeline — wants to solve this now",
    "Has invested in themselves or their business before",
  ]);
  const [dq, setDq] = useState([
    "Genuinely no money and no way to access it",
    "Offer has nothing to do with their situation",
    "No pain — nothing to solve, no urgency whatsoever",
    "Completely checked out — no engagement at all",
  ]);

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>Brief your Wingman.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>Tell your Wingman what makes a great lead — and what makes someone a no-go.</div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>✅ Green Flags — Signs of a great lead</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {green.map((g, i) => <TagPill key={i} label={g} color="#1a7a4a" onRemove={() => setGreen(green.filter((_, j) => j !== i))} />)}
        </div>
        <AddTagInput placeholder="Add a green flag…" color="#1a7a4a" onAdd={(g) => setGreen([...green, g])} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>🚫 Hard DQ Signals — Instant disqualifiers</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {dq.map((d, i) => <TagPill key={i} label={d} color="#c0392b" onRemove={() => setDq(dq.filter((_, j) => j !== i))} />)}
        </div>
        <AddTagInput placeholder="Add a DQ signal…" color="#c0392b" onAdd={(d) => setDq([...dq, d])} />
      </div>

      <button onClick={() => onNext(green, dq)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#000", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Continue</button>
    </div>
  );
}
