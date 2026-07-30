"use client";

interface ToggleProps {
  on: boolean;
  onToggle: () => void;
  /** Accessible name. Required so the switch isn't an unlabelled control. */
  label?: string;
}

/**
 * Switch. Colors are tokens — the track is --positive when on and --line-strong
 * when off; the knob is --knob, which stays near-white in BOTH themes (see the
 * note on --knob in globals.css).
 *
 * Rendered as a real <button role="switch"> rather than a clickable <div>:
 * Design Language §6 ("what's interactive looks interactive"), and a div with an
 * onClick is invisible to keyboard and screen-reader users.
 */
export default function Toggle({ on, onToggle, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      style={{
        width: 44,
        height: 26,
        padding: 0,
        borderRadius: 13,
        background: on ? "rgb(var(--positive))" : "rgb(var(--line-strong))",
        position: "relative",
        cursor: "pointer",
        border: "none",
        transition: "background 0.2s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "rgb(var(--knob))",
          transition: "left 0.2s",
          // A cast shadow is black-based in BOTH themes — the dark --e-sm token in
          // globals.css is too. There is no shadow token sized for a 20px knob, and
          // one would only ever hold this single value.
          // token-lint-disable-next-line
          boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        }}
      />
    </button>
  );
}
