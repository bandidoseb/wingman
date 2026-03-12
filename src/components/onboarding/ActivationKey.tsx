"use client";
import { useState, useEffect } from "react";

const SHORTCUT_STRING = "Ctrl+Shift+W";

type KeyName = "Ctrl" | "Shift" | "W";

const KEY_MAP: Record<string, KeyName> = {
  Control: "Ctrl",
  Shift:   "Shift",
  w:       "W",
  W:       "W",
};

export default function ActivationKey({ onNext }: { onNext: (key: string | null) => void }) {
  const [pressed, setPressed]   = useState<Set<KeyName>>(new Set());
  const [success, setSuccess]   = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const name = KEY_MAP[e.key];
      if (name) setPressed(p => new Set([...p, name]));

      // Full combo detected — trigger success
      if ((e.key === "w" || e.key === "W") && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setSuccess(true);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const name = KEY_MAP[e.key];
      if (name) setPressed(p => { const n = new Set(p); n.delete(name); return n; });
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
    };
  }, []);

  // Advance after brief success animation
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => onNext(SHORTCUT_STRING), 650);
    return () => clearTimeout(t);
  }, [success, onNext]);

  const keyState = (k: KeyName) => {
    if (success)       return "success";
    if (pressed.has(k)) return "active";
    return "idle";
  };

  const keyStyle = (k: KeyName): React.CSSProperties => {
    const state = keyState(k);
    if (state === "success") return {
      background: "#34c759", color: "#fff",
      boxShadow: "0 3px 0 rgba(52,199,89,0.4)",
      transform: "translateY(1px)",
    };
    if (state === "active") return {
      background: "#1c1c1e", color: "#fff",
      boxShadow: "0 1px 0 rgba(0,0,0,0.35)",
      transform: "translateY(2px)",
    };
    return {
      background: "#e5e5ea", color: "#aeaeb2",
      boxShadow: "0 3px 0 rgba(0,0,0,0.12)",
      transform: "translateY(0)",
    };
  };

  const hint = success
    ? "Shortcut saved! Moving on…"
    : pressed.size === 0
    ? "Press each key to continue"
    : pressed.size === 3
    ? "Hold it…"
    : `Keep going — ${3 - pressed.size} more`;

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>
        Your trigger shortcut.
      </div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>
        Use this keyboard shortcut to deploy Wingman when your call starts.
      </div>

      {/* Interactive shortcut display */}
      <div style={{
        background: "#fff", borderRadius: 16, padding: "28px 20px 20px",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center", marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 14 }}>
          {(["Ctrl", "Shift", "W"] as KeyName[]).map((k, i, arr) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <kbd style={{
                borderRadius: 8, padding: "7px 13px",
                fontSize: 15, fontWeight: 600, fontFamily: "monospace", letterSpacing: 0.5,
                display: "inline-block", userSelect: "none",
                transition: "background 0.12s, color 0.12s, box-shadow 0.12s, transform 0.08s",
                ...keyStyle(k),
              }}>{k}</kbd>
              {i < arr.length - 1 && (
                <span style={{ color: "#aeaeb2", fontSize: 16, fontWeight: 400 }}>+</span>
              )}
            </span>
          ))}
        </div>
        <div style={{
          fontSize: 12, letterSpacing: 0.2,
          color: success ? "#34c759" : "#aeaeb2",
          transition: "color 0.2s",
          minHeight: 16,
        }}>{hint}</div>
      </div>
    </div>
  );
}
