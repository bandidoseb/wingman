"use client";
import { useState, useEffect } from "react";

type Phase =
  | "idle"
  | "cursor-up"
  | "popover-open"
  | "cursor-deploy"
  | "clicked-deploy"
  | "live"
  | "cursor-end"
  | "clicked-end"
  | "tray-reset"
  | "kb-idle"
  | "kb-ctrl"
  | "kb-ctrl-shift"
  | "kb-all"
  | "kb-success"
  | "kb-reset";

const SEQ: [Phase, number][] = [
  ["idle",           600],
  ["cursor-up",      850],
  ["popover-open",   550],
  ["cursor-deploy",  600],
  ["clicked-deploy", 350],
  ["live",           700],
  ["cursor-end",     600],
  ["clicked-end",    350],
  ["tray-reset",     450],
  ["kb-idle",        300],
  ["kb-ctrl",        360],
  ["kb-ctrl-shift",  360],
  ["kb-all",         440],
  ["kb-success",     900],
  ["kb-reset",       350],
];

const KB_PHASES: Phase[] = [
  "kb-idle", "kb-ctrl", "kb-ctrl-shift", "kb-all", "kb-success", "kb-reset",
];

/* ─────────────────────────────────────────────────────────
   macOS-accurate SVG icons (dark, for light menu bar)
   ───────────────────────────────────────────────────────── */

const IC = "rgba(0,0,0,0.7)"; // icon color in light mode

/** Standard macOS battery: body outline + nub + ~28% fill */
function BatteryIcon() {
  return (
    <svg width="14" height="7" viewBox="0 0 23 11" fill="none">
      {/* Body */}
      <rect x="0.6" y="0.6" width="18.8" height="9.8" rx="2.6"
        stroke={IC} strokeWidth="1.2" />
      {/* Nub — attached to right side, vertically centered */}
      <rect x="20" y="3.2" width="2.8" height="4.6" rx="1.4"
        fill={IC} />
      {/* Fill ~28% of interior */}
      <rect x="2" y="1.9" width="4.6" height="7.2" rx="1.3"
        fill={IC} />
    </svg>
  );
}

/**
 * Apple-accurate WiFi icon: 3 solid filled donut-sector bands.
 * Fan center at (6, 10.5) — below the 12×10 viewBox.
 * All bands cut at the same angular half-width (θ≈38.3° from vertical).
 * Each band: outer arc (sweep=1, L→R) → line → inner arc (sweep=0, R→L) → close.
 *
 * Radii:  outer 9→6.75  |  gap 1.125  |  middle 5.625→3.75  |  gap 1.125  |  inner 2.625→1.125
 */
function WifiIcon() {
  return (
    <svg width="10" height="8" viewBox="0 0 12 10" fill={IC}>
      {/* Outer band */}
      <path d="M 0.43 3.43 A 9 9 0 0 1 11.57 3.43 L 10.18 5.20 A 6.75 6.75 0 0 0 1.82 5.20 Z" />
      {/* Middle band */}
      <path d="M 2.52 6.08 A 5.625 5.625 0 0 1 9.48 6.08 L 8.32 7.56 A 3.75 3.75 0 0 0 3.68 7.56 Z" />
      {/* Inner band */}
      <path d="M 4.38 8.44 A 2.625 2.625 0 0 1 7.62 8.44 L 6.70 9.62 A 1.125 1.125 0 0 0 5.30 9.62 Z" />
    </svg>
  );
}

export default function Tutorial({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    let idx = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const [p, ms] = SEQ[idx];
      setPhase(p);
      timer = setTimeout(() => {
        idx = (idx + 1) % SEQ.length;
        tick();
      }, ms);
    };
    tick();
    return () => clearTimeout(timer);
  }, []);

  const isKB   = KB_PHASES.includes(phase);
  const isTray = !isKB;

  /* ── Tray states ── */
  const popoverOpen = [
    "popover-open", "cursor-deploy", "clicked-deploy",
    "live", "cursor-end", "clicked-end",
  ].includes(phase);

  const isLive = ["live", "cursor-end", "clicked-end"].includes(phase);

  const iconHighlighted = [
    "cursor-up", "popover-open", "cursor-deploy", "clicked-deploy",
    "live", "cursor-end", "clicked-end",
  ].includes(phase);

  const isClickedDeploy = phase === "clicked-deploy";
  const isClickedEnd    = phase === "clicked-end";

  /* Show pointer/hand cursor when hovering or clicking a target */
  const isPointer = [
    "cursor-up", "popover-open", "cursor-deploy", "clicked-deploy",
    "live", "cursor-end", "clicked-end",
  ].includes(phase);

  /*
   * Cursor tip positions (% of 440 × 200 mockup).
   *
   * Right-side order: Wingman(14) | gap(5) | Battery(17) | gap(5) | WiFi(12) | gap(5) | Time(~36) | pad(12)
   * Wingman center X ≈ 440 − 12 − 36 − 5 − 12 − 5 − 17 − 5 − 7 = ~341px → 77%
   *
   * Popover: right 10, width 148 → center X = 440 − 10 − 74 = 356px → 81%
   * Deploy button Y: menu(24) + top(5) + pad(9) + header(13) + mb(7) + btn/2(13) = 71px / 200 = 35.5% → 36%
   * End Call Y: after badge(21px) + mb(5) + btn/2(11.5) = 71+37=108... let me recalc:
   *   Deploy btn top: 58px, btn height ~26px → bottom at 84px
   *   Live badge top: 58px, height 21px + mb 5 = 84px
   *   End Call center: 84 + 11.5 = 95.5px / 200 = 47.75% → 48%
   */
  const [cx, cy] = ((): [string, string] => {
    switch (phase) {
      case "cursor-up":
      case "popover-open":
        return ["80%", "6%"];          // Wingman tray icon
      case "cursor-deploy":
      case "clicked-deploy":
        return ["81%", "36%"];         // Deploy Wingman button
      case "live":
        return ["80%", "6%"];          // cursor drifts back to icon
      case "cursor-end":
      case "clicked-end":
        return ["81%", "48%"];         // End Call button
      default:
        return ["62%", "68%"];         // idle rest position
    }
  })();

  /* ── Keyboard states ── */
  const ctrlActive  = ["kb-ctrl", "kb-ctrl-shift", "kb-all", "kb-success"].includes(phase);
  const shiftActive = ["kb-ctrl-shift", "kb-all", "kb-success"].includes(phase);
  const wActive     = ["kb-all", "kb-success"].includes(phase);
  const kbSuccess   = phase === "kb-success";

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      {/* Title */}
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>
        Two ways to deploy Wingman.
      </div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 18 }}>
        Use whichever fits the moment.
      </div>

      {/* Method indicator pills */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {([["Tray icon", isTray], ["Keyboard shortcut", isKB]] as [string, boolean][]).map(([label, active]) => (
          <div key={label} style={{
            fontSize: 11, fontWeight: 600,
            padding: "4px 12px", borderRadius: 20,
            background: active ? "#1c1c1e" : "rgba(0,0,0,0.05)",
            color: active ? "#fff" : "#8e8e93",
            transition: "background 0.45s ease, color 0.45s ease",
          }}>
            {label}
          </div>
        ))}
      </div>

      {/* ── macOS Light-mode Mockup ── */}
      <div style={{
        position: "relative",
        height: 200,
        borderRadius: 12,
        overflow: "hidden",
        /* Light macOS desktop wallpaper */
        background: "linear-gradient(155deg, #b0cce4 0%, #8fb4d4 50%, #7098bc 100%)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.10)",
        marginBottom: 16,
        userSelect: "none",
      }}>
        <style>{`
          @keyframes popoverIn {
            from { opacity: 0; transform: translateY(-5px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)   scale(1); }
          }
          @keyframes liveIn {
            from { opacity: 0; transform: translateY(3px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        {/* ── Light macOS Menu bar ── */}
        <div style={{
          height: 24,
          /* Translucent frosted-glass white — matches macOS light menubar */
          background: "rgba(248,248,248,0.88)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          position: "relative",
          zIndex: 10,
        }}>
          {/* Left: apple + menus */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12 }}>🍎</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,0,0,0.80)" }}>Finder</span>
            {["File", "Edit", "View"].map((m) => (
              <span key={m} style={{ fontSize: 9, color: "rgba(0,0,0,0.40)" }}>{m}</span>
            ))}
          </div>

          {/* Right: Wingman → Battery → WiFi → Time */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {/* Wingman tray icon — black rounded square, same as the popover header */}
            <div style={{
              width: 11, height: 11,
              borderRadius: 3,
              background: iconHighlighted ? "rgba(0,0,0,0.10)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 0.2s",
            }}>
              {/* Black icon square matching the real app icon */}
              <div style={{
                width: 8, height: 8,
                borderRadius: 2,
                background: "#000",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Wingman.png"
                  alt="Wingman"
                  style={{ width: "80%", height: "80%", objectFit: "contain", display: "block" }}
                />
              </div>
            </div>
            <BatteryIcon />
            <WifiIcon />
            <span style={{ fontSize: 8, color: "rgba(0,0,0,0.60)", fontWeight: 500, letterSpacing: "-0.01em" }}>
              9:41 AM
            </span>
          </div>
        </div>

        {/* ── Desktop area ── */}
        <div style={{ position: "absolute", top: 24, left: 0, right: 0, bottom: 0 }}>

          {/* Tray popover (dark glass — matches real implementation) */}
          {popoverOpen && (
            <div style={{
              position: "absolute",
              top: 5,
              right: 10,
              width: 148,
              background: "rgba(24,24,34,0.97)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 8px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)",
              padding: "9px 9px 7px",
              zIndex: 20,
              animation: "popoverIn 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
                <div style={{
                  width: 13, height: 13, borderRadius: 3,
                  background: "#000", overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Wingman.png" alt="" style={{ width: "75%", height: "75%", objectFit: "contain" }} />
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.82)" }}>Wingman</span>
                {isLive && (
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, animation: "liveIn 0.3s ease" }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%",
                      background: "#34c759",
                      boxShadow: "0 0 5px #34c759",
                    }} />
                    <span style={{ fontSize: 7.5, color: "#34c759", fontWeight: 700 }}>LIVE</span>
                  </div>
                )}
              </div>

              {!isLive ? (
                /* Idle: Deploy button */
                <button style={{
                  width: "100%",
                  padding: "6px 0",
                  background: isClickedDeploy ? "rgba(180,180,180,0.25)" : "#ffffff",
                  color: isClickedDeploy ? "rgba(255,255,255,0.65)" : "#1c1c1e",
                  border: "none",
                  borderRadius: 7,
                  fontSize: 9.5,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "default",
                  transition: "background 0.12s, color 0.12s, transform 0.12s",
                  transform: isClickedDeploy ? "scale(0.96)" : "scale(1)",
                }}>
                  Deploy Wingman
                </button>
              ) : (
                /* Live: badge + End Call */
                <div style={{ animation: "liveIn 0.3s ease" }}>
                  <div style={{
                    padding: "4px 0",
                    marginBottom: 5,
                    background: "rgba(52,199,89,0.11)",
                    border: "1px solid rgba(52,199,89,0.28)",
                    borderRadius: 7,
                    fontSize: 9, color: "#34c759", fontWeight: 600, textAlign: "center",
                  }}>
                    Wingman is live
                  </div>
                  <button style={{
                    width: "100%", padding: "5px 0",
                    background: isClickedEnd ? "rgba(200,30,20,0.85)" : "#ff3b30",
                    color: "#fff",
                    border: "none", borderRadius: 7,
                    fontSize: 9, fontWeight: 600,
                    fontFamily: "inherit", cursor: "default",
                    transition: "background 0.12s, transform 0.12s",
                    transform: isClickedEnd ? "scale(0.96)" : "scale(1)",
                  }}>
                    End Call
                  </button>
                </div>
              )}

              <button style={{
                width: "100%", marginTop: 5, padding: "3px 0",
                background: "transparent",
                color: "rgba(255,255,255,0.32)",
                border: "none", fontSize: 8.5,
                fontFamily: "inherit", cursor: "default", textAlign: "center",
              }}>
                Open Dashboard
              </button>
            </div>
          )}

          {/* Keyboard view */}
          {isKB && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              gap: 14,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {([
                  ["Ctrl", ctrlActive],
                  ["Shift", shiftActive],
                  ["W", wActive],
                ] as [string, boolean][]).map(([key, active], i, arr) => (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{
                      padding: "8px 14px",
                      background: active
                        ? (kbSuccess ? "white" : "rgba(255,255,255,0.18)")
                        : "rgba(255,255,255,0.10)",
                      border: `1.5px solid ${
                        active
                          ? (kbSuccess ? "#1a9e3f" : "rgba(255,255,255,0.35)")
                          : "rgba(255,255,255,0.15)"
                      }`,
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      color: active
                        ? (kbSuccess ? "#1a9e3f" : "rgba(255,255,255,0.95)")
                        : "rgba(255,255,255,0.35)",
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      transition: "all 0.28s cubic-bezier(0.22,1,0.36,1)",
                      boxShadow: active && !kbSuccess ? "0 0 14px rgba(255,255,255,0.06)" : "none",
                      transform: active ? "translateY(-2px)" : "translateY(0)",
                    }}>
                      {key}
                    </div>
                    {i < arr.length - 1 && (
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)", fontWeight: 300 }}>+</span>
                    )}
                  </div>
                ))}
              </div>
              <div style={{
                fontSize: 10,
                fontWeight: 600,
                color: kbSuccess ? "#1a9e3f" : "transparent",
                transition: "color 0.35s ease",
                letterSpacing: "0.01em",
              }}>
                Wingman deployed ✓
              </div>
            </div>
          )}
        </div>

        {/* ── Animated cursor — tray phases only ── */}
        {isTray && (
          <div style={{
            position: "absolute",
            left: cx,
            top: cy,
            transition: "left 1.6s cubic-bezier(0.22,1,0.36,1), top 1.6s cubic-bezier(0.22,1,0.36,1)",
            pointerEvents: "none",
            zIndex: 40,
          }}>
            {/* Cursor: pointing hand when over a clickable target, arrow otherwise */}
            {isPointer ? (
              <svg width="14" height="16" viewBox="0 0 448 512" fill="none">
                {/* Solid white fill layer (FA solid hand-pointer) */}
                <path fill="white" d="M128 40c0-22.1 17.9-40 40-40s40 17.9 40 40l0 148.2c8.5-7.6 19.7-12.2 32-12.2c20.6 0 38.2 13 45 31.2c8.8-9.3 21.2-15.2 35-15.2c25.3 0 46 19.5 47.9 44.3c8.5-7.7 19.8-12.3 32.1-12.3c26.5 0 48 21.5 48 48l0 48 0 16 0 48c0 70.7-57.3 128-128 128l-16 0-64 0-.1 0-5.2 0c-5 0-9.9-.3-14.7-1c-55.3-5.6-106.2-34-140-79L8 336c-13.3-17.7-9.7-42.7 8-56s42.7-9.7 56 8l56 74.7L128 40zM240 304c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96zm48-16c-8.8 0-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96c0-8.8-7.2-16-16-16zm80 16c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96z" />
                {/* Outline layer (FA regular hand-pointer) */}
                <path fill="black" d="M160 64c0-8.8 7.2-16 16-16s16 7.2 16 16l0 136c0 10.3 6.6 19.5 16.4 22.8s20.6-.1 26.8-8.3c3-3.9 7.6-6.4 12.8-6.4c8.8 0 16 7.2 16 16c0 10.3 6.6 19.5 16.4 22.8s20.6-.1 26.8-8.3c3-3.9 7.6-6.4 12.8-6.4c7.8 0 14.3 5.6 15.7 13c1.6 8.2 7.3 15.1 15.1 18s16.7 1.6 23.3-3.6c2.7-2.1 6.1-3.4 9.9-3.4c8.8 0 16 7.2 16 16l0 16 0 104c0 39.8-32.2 72-72 72l-56 0-59.8 0-.9 0c-37.4 0-72.4-18.7-93.2-49.9L50.7 312.9c-4.9-7.4-2.9-17.3 4.4-22.2s17.3-2.9 22.2 4.4L116 353.2c5.9 8.8 16.8 12.7 26.9 9.7s17-12.4 17-23l0-19.9 0-256zM176 0c-35.3 0-64 28.7-64 64l0 197.7C91.2 238 55.5 232.8 28.5 250.7C-.9 270.4-8.9 310.1 10.8 339.5L78.3 440.8c29.7 44.5 79.6 71.2 133.1 71.2l.9 0 59.8 0 56 0c66.3 0 120-53.7 120-120l0-104 0-16c0-35.3-28.7-64-64-64c-4.5 0-8.8 .5-13 1.3c-11.7-15.4-30.2-25.3-51-25.3c-6.9 0-13.5 1.1-19.7 3.1C288.7 170.7 269.6 160 248 160c-2.7 0-5.4 .2-8 .5L240 64c0-35.3-28.7-64-64-64zm48 304c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96zm48-16c-8.8 0-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96c0-8.8-7.2-16-16-16zm80 16c0-8.8-7.2-16-16-16s-16 7.2-16 16l0 96c0 8.8 7.2 16 16 16s16-7.2 16-16l0-96z" />
              </svg>
            ) : (
              <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
                <path
                  d="M1 1L1 14.5L4.5 11L7 16.5L9 15.8L6.5 10.5L12 10.5L1 1Z"
                  fill="white"
                  stroke="rgba(0,0,0,0.55)"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Method cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 24 }}>
        <div style={{
          padding: "14px 14px",
          background: "#fff",
          borderRadius: 12,
          border: `1.5px solid ${isTray ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.06)"}`,
          boxShadow: isTray ? "0 2px 12px rgba(0,0,0,0.07)" : "none",
          transition: "border-color 0.45s ease, box-shadow 0.45s ease",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1c1c1e", marginBottom: 4 }}>Menu bar icon</div>
          <div style={{ fontSize: 11, color: "#8e8e93", lineHeight: 1.5 }}>
            Click the Wingman icon in your Mac menu bar, then tap Deploy.
          </div>
        </div>
        <div style={{
          padding: "14px 14px",
          background: "#fff",
          borderRadius: 12,
          border: `1.5px solid ${isKB ? "rgba(0,0,0,0.14)" : "rgba(0,0,0,0.06)"}`,
          boxShadow: isKB ? "0 2px 12px rgba(0,0,0,0.07)" : "none",
          transition: "border-color 0.45s ease, box-shadow 0.45s ease",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#1c1c1e", marginBottom: 6 }}>Keyboard shortcut</div>
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            {["⌃", "⇧", "W"].map((k) => (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "#f2f2f7", border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 4, fontSize: 10, fontWeight: 600, color: "#3c3c43",
                width: 20, height: 18,
                boxShadow: "0 1px 0 rgba(0,0,0,0.14)",
              }}>{k}</span>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={onNext}
        style={{
          width: "100%", padding: "14px 0",
          background: "#1c1c1e", color: "#fff",
          border: "none", borderRadius: 12,
          fontSize: 15, fontWeight: 600,
          fontFamily: "inherit", cursor: "pointer",
        }}
      >
        I&apos;m ready →
      </button>
    </div>
  );
}
