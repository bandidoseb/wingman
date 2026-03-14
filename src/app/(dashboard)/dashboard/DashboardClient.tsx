"use client";

import { useState, useCallback, useEffect } from "react";
import type { Profile, Call, VaultObjection, VaultSignal } from "@/types";
import Sidebar from "@/components/dashboard/Sidebar";
import HomeTab from "@/components/dashboard/HomeTab";
import FlightLogTab from "@/components/dashboard/FlightLogTab";
import ObjectionVaultTab from "@/components/dashboard/ObjectionVaultTab";
import SignalVaultTab from "@/components/dashboard/SignalVaultTab";
import IntelTab from "@/components/dashboard/IntelTab";
import SettingsTab from "@/components/dashboard/SettingsTab";
import SimulatorTab from "@/components/dashboard/SimulatorTab";
import PaywallModal from "@/components/ui/PaywallModal";
import { FREE_CALL_LIMIT } from "@/lib/constants";

export type DashboardTab = "home" | "library" | "objections" | "signals" | "intel" | "simulator" | "settings";

interface Props {
  profile: Profile;
  initialCalls: Call[];
  initialObjections: VaultObjection[];
  initialSignals: VaultSignal[];
  userId: string;
}

/**
 * Returns true when the user has hit their free call limit and hasn't subscribed.
 * Checked on mount so the paywall appears immediately if they're at the limit.
 */
function isPaywallActive(profile: Profile): boolean {
  const isSubscribed = profile.subscription_status === "active";
  const hitLimit     = (profile.calls_used ?? 0) >= FREE_CALL_LIMIT;
  return !isSubscribed && hitLimit;
}

export default function DashboardClient({
  profile,
  initialCalls,
  initialObjections,
  initialSignals,
  userId,
}: Props) {
  const [tab, setTab] = useState<DashboardTab>("home");
  const [collapsed, setSidebarCollapsed] = useState(false);
  const [badges, setBadges] = useState({
    objections: initialObjections.filter((o) => o.is_new).length,
    signals:    initialSignals.filter((s) => s.is_new).length,
  });
  const [pendingCall, setPendingCall] = useState<Call | null>(null);
  // Incremented each time a toggle-call IPC arrives so SimulatorTab can react
  // regardless of which dashboard tab is currently active.
  const [triggerToggle, setTriggerToggle] = useState(0);

  // Listen for shortcut:toggle-call at the dashboard level so it works even
  // when the user is on a different tab (SimulatorTab not yet mounted).
  useEffect(() => {
    if (typeof window === "undefined" || !window.wingman) return;
    window.wingman.onToggleCall(() => {
      setTab("simulator");
      setTriggerToggle((n) => n + 1);
    });
    return () => { window.wingman?.offToggleCall(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Paywall state ─────────────────────────────────────────────────────────
  // Initialized from profile.calls_used on load.
  // Also triggered in real time when SimulatorTab hits the limit mid-session.
  const [showPaywall, setShowPaywall] = useState<boolean>(() => isPaywallActive(profile));

  const handleLimitReached = useCallback(() => {
    setShowPaywall(true);
  }, []);

  const handleTabClick = useCallback((id: DashboardTab) => {
    setTab(id);
    if (id === "objections" || id === "signals") {
      setBadges((b) => ({ ...b, [id]: 0 }));
    }
  }, []);

  const goToDebrief = useCallback((call: Call) => {
    setPendingCall(call);
    setTab("library");
  }, []);

  const clearPendingCall = useCallback(() => setPendingCall(null), []);

  const sidebarWidth = collapsed ? 56 : 220;

  return (
    <div
      style={{
        minHeight:  "100vh",
        background: "#f2f2f7",
        fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box }
        button { cursor: pointer; transition: opacity 0.15s; border: none }
        button:hover { opacity: 0.75 }
        @keyframes accordionDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        .accordion-body { animation: accordionDown 0.22s cubic-bezier(0.22,1,0.36,1) both }
        @keyframes typingBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-5px);opacity:1} }
        .typing-dot { width:7px;height:7px;border-radius:50%;background:#aaa;display:inline-block;animation:typingBounce 1.2s infinite ease-in-out; }
        .typing-dot:nth-child(1){animation-delay:0s}
        .typing-dot:nth-child(2){animation-delay:0.2s}
        .typing-dot:nth-child(3){animation-delay:0.4s}
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        <Sidebar
          tab={tab}
          onTabClick={handleTabClick}
          collapsed={collapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          badges={badges}
          role={profile.role || "closer"}
          salesStyle={profile.sales_style || ""}
          subscriptionStatus={profile.subscription_status || "trialing"}
          userId={userId}
        />

        <div
          style={{
            marginLeft: sidebarWidth,
            flex:       1,
            padding:    "28px 32px",
            minHeight:  "100vh",
            background: "#f2f2f7",
            transition: "margin-left 0.28s cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {tab === "home" && (
            <HomeTab
              profile={profile}
              calls={initialCalls}
              onDebrief={goToDebrief}
            />
          )}
          {tab === "library" && (
            <FlightLogTab
              calls={initialCalls}
              initialCall={pendingCall}
              onInitialCallConsumed={clearPendingCall}
              userId={userId}
            />
          )}
          {tab === "objections" && (
            <ObjectionVaultTab
              initialObjections={initialObjections}
              userId={userId}
            />
          )}
          {tab === "signals" && (
            <SignalVaultTab
              initialSignals={initialSignals}
              role={profile.role || "closer"}
              userId={userId}
              displayMode={profile.signal_display_mode || "short"}
            />
          )}
          {tab === "intel"     && <IntelTab calls={initialCalls} />}
          {tab === "simulator" && (
            <SimulatorTab
              objections={initialObjections}
              onLimitReached={handleLimitReached}
              triggerToggle={triggerToggle}
            />
          )}
          {tab === "settings" && (
            <SettingsTab
              profile={profile}
              calls={initialCalls}
            />
          )}
        </div>
      </div>

      {/* ── Paywall overlay — covers everything, cannot be dismissed ────────
           Position: fixed, z-index 9999, full viewport. No close button.
           Disappears only after a successful Stripe checkout reloads the page
           with subscription_status === "active".                             */}
      {showPaywall && <PaywallModal role={profile.role || "closer"} />}
    </div>
  );
}
