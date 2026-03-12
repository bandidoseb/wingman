"use client";

interface ToggleProps {
  on: boolean;
  onToggle: () => void;
}

export default function Toggle({ on, onToggle }: ToggleProps) {
  return (
    <div
      onClick={onToggle}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        background: on ? "#34c759" : "#e5e5ea",
        position: "relative",
        cursor: "pointer",
        border: `1px solid ${on ? "#34c759" : "rgba(0,0,0,0.06)"}`,
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 2,
          left: on ? 19 : 2,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </div>
  );
}
