"use client";

import { createClient } from "@/lib/supabase/client";
import type { DashboardTab } from "@/app/(dashboard)/dashboard/DashboardClient";

interface SidebarProps {
  tab: DashboardTab;
  onTabClick: (id: DashboardTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  badges: { objections: number; signals: number };
  role: string;
  salesStyle: string;
  subscriptionStatus: string;
  userId: string;
}

/* ─────────────────────────────────────────────────────────────
   Sidebar icon hover animations
   ───────────────────────────────────────────────────────────── */
const SIDEBAR_STYLES = `
  /* ── Home: door swings open from left hinge ── */
  .sb-door {
    transform-box: fill-box;
    transform-origin: 0% 50%;
  }
  .sb-door-light { opacity: 0; }

  button[data-tab="home"]:hover .sb-door {
    animation: sbDoorOpen 0.38s cubic-bezier(0.22,1,0.36,1) forwards;
  }
  button[data-tab="home"]:hover .sb-door-light {
    animation: sbDoorGlow 0.38s ease forwards;
  }
  @keyframes sbDoorOpen {
    from { transform: scaleX(1); }
    to   { transform: scaleX(0.04); }
  }
  @keyframes sbDoorGlow {
    0%   { opacity: 0; }
    45%  { opacity: 0; }
    100% { opacity: 1; }
  }

  /* ── Flight Log: lines write in left-to-right, staggered ── */
  .sb-line1, .sb-line2 { stroke-dasharray: 8; }
  .sb-line3            { stroke-dasharray: 4; }

  button[data-tab="library"]:hover .sb-line1 {
    animation: sbWriteLong  0.28s 0ms   ease-out forwards;
  }
  button[data-tab="library"]:hover .sb-line2 {
    animation: sbWriteLong  0.28s 85ms  ease-out forwards;
  }
  button[data-tab="library"]:hover .sb-line3 {
    animation: sbWriteShort 0.28s 170ms ease-out forwards;
  }
  @keyframes sbWriteLong  { from { stroke-dashoffset: 8; } to { stroke-dashoffset: 0; } }
  @keyframes sbWriteShort { from { stroke-dashoffset: 4; } to { stroke-dashoffset: 0; } }

  /* ── Objection Vault: exclamation pops in with spring bounce ── */
  .sb-exclaim {
    transform-box: fill-box;
    transform-origin: 50% 50%;
  }
  button[data-tab="objections"]:hover .sb-exclaim {
    animation: sbExclaimPop 0.38s cubic-bezier(0.34,1.56,0.64,1) forwards;
  }
  @keyframes sbExclaimPop {
    0%   { transform: scale(0.3); opacity: 0.2; }
    100% { transform: scale(1);   opacity: 1;   }
  }

  /* ── Signal Vault: bolt jolts like an electric shock ── */
  .sb-bolt {
    transform-box: view-box;
    transform-origin: 12px 12px;
  }
  button[data-tab="signals"]:hover .sb-bolt {
    animation: sbBoltJolt 0.44s ease-in-out;
  }
  @keyframes sbBoltJolt {
    0%   { transform: translate(0,    0)    rotate(0deg);  }
    16%  { transform: translate(-2px, -1px) rotate(-9deg); }
    33%  { transform: translate( 2px,  1px) rotate( 9deg); }
    50%  { transform: translate(-1px, -1px) rotate(-5deg); }
    67%  { transform: translate( 1px,  1px) rotate( 5deg); }
    83%  { transform: translate(-0.5px, 0)  rotate(-2deg); }
    100% { transform: translate(0,    0)    rotate(0deg);  }
  }

  /* ── Intel: three bars pop up one by one from the bottom ── */
  .sb-bar1, .sb-bar2, .sb-bar3 {
    transform-box: fill-box;
    transform-origin: 50% 100%;
  }
  button[data-tab="intel"]:hover .sb-bar1 {
    animation: sbBarRise 0.3s 0ms   cubic-bezier(0.34,1.56,0.64,1) both;
  }
  button[data-tab="intel"]:hover .sb-bar2 {
    animation: sbBarRise 0.3s 90ms  cubic-bezier(0.34,1.56,0.64,1) both;
  }
  button[data-tab="intel"]:hover .sb-bar3 {
    animation: sbBarRise 0.3s 180ms cubic-bezier(0.34,1.56,0.64,1) both;
  }
  @keyframes sbBarRise {
    from { transform: scaleY(0); }
    to   { transform: scaleY(1); }
  }

  @keyframes sbCheckDraw {
    from { stroke-dashoffset: 10; }
    to   { stroke-dashoffset: 0;  }
  }

  /* ── Settings: gear rotates 180° ── */
  .sb-gear-group {
    transform-box: view-box;
    transform-origin: 12px 12px;
  }
  button[data-tab="settings"]:hover .sb-gear-group {
    animation: sbGearSpin 0.5s cubic-bezier(0.22,1,0.36,1) forwards;
  }
  @keyframes sbGearSpin {
    to { transform: rotate(180deg); }
  }
`;

const NAV_ITEMS: Array<{ id: DashboardTab; label: string; icon: (active: boolean) => React.ReactNode }> = [
  {
    id: "home", label: "Home",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {/* House outline — drawn first so rects layer on top */}
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H15v-5h-6v5H4a1 1 0 01-1-1V9.5z"
          fill={active ? "#1c1c1e" : "none"}
          stroke={active ? "#1c1c1e" : "#8e8e93"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Warm amber light revealed as door swings open */}
        <rect className="sb-door-light" x="9" y="16" width="6" height="5" fill="#FFB347" />
        {/* Door panel — swings open from left hinge on hover */}
        <rect
          className="sb-door"
          x="9" y="16" width="6" height="5"
          fill={active ? "#ffffff" : "#8e8e93"}
          opacity={active ? 0.18 : 0.72}
        />
      </svg>
    ),
  },
  {
    id: "library", label: "Flight Log",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2"
          stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" />
        <line className="sb-line1" x1="8" y1="8" x2="16" y2="8"
          stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" strokeLinecap="round" />
        <line className="sb-line2" x1="8" y1="12" x2="16" y2="12"
          stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" strokeLinecap="round" />
        <line className="sb-line3" x1="8" y1="16" x2="12" y2="16"
          stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "objections", label: "Objection Vault",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"
          stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6"
        />
        {/* Exclamation mark — pops in on hover */}
        <path
          className="sb-exclaim"
          d="M12 8v4M12 16h.01"
          stroke={active ? "#1c1c1e" : "#8e8e93"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "signals", label: "Signal Vault",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {/* Lightning bolt — jolts on hover */}
        <path
          className="sb-bolt"
          d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
          fill={active ? "#1c1c1e" : "none"}
          stroke={active ? "#1c1c1e" : "#8e8e93"}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "intel", label: "Intel",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {/* Three bars rise from bottom, staggered, on hover */}
        <rect className="sb-bar1" x="3" y="12" width="4" height="9" rx="1"
          fill={active ? "#1c1c1e" : "none"} stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" />
        <rect className="sb-bar2" x="10" y="7" width="4" height="14" rx="1"
          fill={active ? "#1c1c1e" : "none"} stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" />
        <rect className="sb-bar3" x="17" y="3" width="4" height="18" rx="1"
          fill={active ? "#1c1c1e" : "none"} stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    id: "settings", label: "Settings",
    icon: (active) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        {/* Wrap entire gear in a group that spins on hover */}
        <g className="sb-gear-group">
          <circle cx="12" cy="12" r="3"
            stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" />
          <path
            d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            stroke={active ? "#1c1c1e" : "#8e8e93"} strokeWidth="1.6" strokeLinecap="round"
          />
        </g>
      </svg>
    ),
  },
];

export default function Sidebar({
  tab, onTabClick, collapsed, onToggleCollapse, badges, role, salesStyle, subscriptionStatus, userId,
}: SidebarProps) {
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const badgesMap: Record<string, number> = {
    objections: badges.objections,
    signals: badges.signals,
  };

  return (
    <div
      style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        background: "rgba(255,255,255,0.65)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(0,0,0,0.06)",
        display: "flex",
        flexDirection: "column",
        padding: collapsed ? "28px 8px 20px" : "28px 12px 20px",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
        transition: "width 0.28s cubic-bezier(0.22,1,0.36,1), padding 0.28s cubic-bezier(0.22,1,0.36,1)",
        overflow: "hidden",
      }}
    >
      {/* Inject animation styles once */}
      <style dangerouslySetInnerHTML={{ __html: SIDEBAR_STYLES }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", marginBottom: 28, paddingLeft: collapsed ? 0 : 8 }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Wingman</div>
            <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginTop: 2 }}>● Standby</div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          style={{
            background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 7,
            width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", flexShrink: 0, transition: "background 0.15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            {collapsed
              ? <path d="M9 18l6-6-6-6" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              : <path d="M15 18l-6-6 6-6" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            }
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = tab === item.id;
          const badge = badgesMap[item.id] || 0;
          return (
            <button
              key={item.id}
              data-tab={item.id}
              onClick={() => onTabClick(item.id)}
              title={collapsed ? item.label : ""}
              style={{
                background: isActive ? "rgba(0,0,0,0.06)" : "transparent",
                border: "none",
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: collapsed ? "center" : "flex-start",
                gap: 10,
                padding: collapsed ? "9px 0" : "9px 10px",
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
                transition: "background 0.18s",
                position: "relative",
              }}
            >
              <div style={{ width: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
                {item.icon(isActive)}
                {badge > 0 && !isActive && (
                  <div style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ff3b30", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #f2f2f7" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: "#fff", lineHeight: 1 }}>{badge}</span>
                  </div>
                )}
              </div>
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "#1c1c1e" : "#8e8e93", letterSpacing: "-0.01em", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              )}
              {!collapsed && badge > 0 && !isActive && (
                <div style={{ marginLeft: "auto", background: "#ff3b30", borderRadius: 10, minWidth: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px", flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{badge} new</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      {!collapsed && (
        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 14, paddingLeft: 8 }}>
          <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 500 }}>
            {role === "closer" ? "Closer" : "Setter"} · {salesStyle || ""}
          </div>
          <div style={{ fontSize: 11, color: "#aeaeb2", marginTop: 2, textTransform: "capitalize" }}>
            {subscriptionStatus}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 12, marginBottom: 2 }}>
            {["⌃", "⇧", "W"].map((k) => (
              <span key={k} style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.10)",
                borderRadius: 4, fontSize: 9, fontWeight: 600, color: "#8e8e93",
                width: 17, height: 15, fontFamily: "inherit",
                boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
              }}>{k}</span>
            ))}
            <span style={{ fontSize: 10, color: "#aeaeb2", marginLeft: 3 }}>Deploy Wingman</span>
          </div>
          <button
            onClick={handleSignOut}
            style={{ marginTop: 8, background: "none", border: "none", color: "#aeaeb2", fontSize: 11, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
          >
            Sign out →
          </button>
        </div>
      )}
    </div>
  );
}
