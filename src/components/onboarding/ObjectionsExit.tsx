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

export default function ObjectionsExit({ onNext }: { onNext: (objections: string[], exitLine: string) => void }) {
  const [objections, setObjections] = useState(["I need to think about it", "It's too expensive", "I need to talk to my spouse"]);
  const [exitLine, setExitLine] = useState("");

  const exitPlaceholder = "e.g. I completely understand — let me send over some information and we can revisit when you're ready…";

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>Brief your Wingman.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>What objections do you hear most? And how do you like to exit a dead-end call?</div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>Top objections you hear</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
          {objections.map((o, i) => <TagPill key={i} label={o} color="#1a4a7a" onRemove={() => setObjections(objections.filter((_, j) => j !== i))} />)}
        </div>
        <AddTagInput placeholder="Add an objection…" color="#1a4a7a" onAdd={(o) => setObjections([...objections, o])} />
      </div>

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>How do you exit a DQ'd call?</div>
        <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 10, lineHeight: 1.5 }}>Your Wingman will use your own words when it suggests an exit line.</div>
        <textarea
          value={exitLine}
          onChange={(e) => setExitLine(e.target.value)}
          placeholder={exitPlaceholder}
          rows={3}
          style={{ width: "100%", background: "#e5e5ea", border: "2px solid transparent", borderRadius: 12, padding: "12px 14px", fontSize: 13, fontFamily: "inherit", color: "#1c1c1e", outline: "none", resize: "none", lineHeight: 1.6 }}
        />
      </div>

      <button onClick={() => onNext(objections, exitLine)} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#1c1c1e", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>Continue</button>
    </div>
  );
}
