"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingData, OnboardingStep } from "@/types";
// Onboarding screen components
import Welcome from "@/components/onboarding/Welcome";
import YourOffer from "@/components/onboarding/YourOffer";
import Tutorial from "@/components/onboarding/Tutorial";
import VaultNudge from "@/components/onboarding/VaultNudge";
import Building from "@/components/onboarding/Building";

const ONBOARDING_ORDER: OnboardingStep[] = [
  "welcome", "offer", "tutorial", "vaultnudge", "building",
];
const DOT_SCREENS: OnboardingStep[] = [
  "welcome", "offer", "tutorial",
];

interface Props {
  initialProfile: Record<string, unknown> | null;
  userId: string;
}

export default function OnboardingClient({ initialProfile, userId }: Props) {
  // Forward legacy step values that no longer exist in the flow
  const rawStep = initialProfile?.onboarding_step as OnboardingStep | "crawl" | "qualification" | "activation" | "phone" | "role" | "objections" | undefined;
  const resolvedStep: OnboardingStep =
    rawStep === "crawl"          ? "tutorial"   :
    rawStep === "qualification"  ? "tutorial"   :
    rawStep === "objections"     ? "tutorial"   :
    rawStep === "activation"     ? "tutorial"   :
    rawStep === "phone"          ? "vaultnudge" :
    rawStep === "role"           ? "style"      :
    (rawStep ?? "welcome");

  const [screen, setScreen] = useState<OnboardingStep>(resolvedStep);
  const [, setData] = useState<OnboardingData>({
    salesStyle: (initialProfile?.sales_style as string) || undefined,
    callLength: (initialProfile?.call_length as string) || undefined,
  });

  const supabase = createClient();

  const updateProfile = useCallback(async (updates: Record<string, unknown>) => {
    const clean = Object.fromEntries(
      Object.entries(updates).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(clean).length === 0) return;

    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: clean }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[Wingman] updateProfile failed:", res.status, body, "| updates:", clean);
      }
    } catch (err) {
      console.error("[Wingman] updateProfile network error:", err, "| updates:", clean);
    }
  }, []);

  const goTo = useCallback((next: OnboardingStep, extra?: Record<string, unknown>) => {
    setScreen(next);
    updateProfile({ onboarding_step: next, ...extra });
  }, [updateProfile]);

  const handleOffer = useCallback(async (
    mainName: string,
    mainPrice: string,
    others: Array<{ name: string; price: string }>
  ) => {
    setData((d) => ({ ...d, mainOfferName: mainName, mainOfferPrice: mainPrice, otherOffers: others }));

    const offersToInsert = [
      { user_id: userId, name: mainName, price: mainPrice, is_main: true, display_order: 0 },
      ...others.map((o, i) => ({ user_id: userId, name: o.name, price: o.price, is_main: false, display_order: i + 1 })),
    ].filter((o) => o.name);

    await supabase.from("offers").delete().eq("user_id", userId);
    if (offersToInsert.length > 0) {
      await supabase.from("offers").insert(offersToInsert);
    }

    await updateProfile({ onboarding_step: "tutorial" });
    setScreen("tutorial");
  }, [supabase, userId, updateProfile]);

  const handleTutorial = useCallback(async () => {
    await updateProfile({ onboarding_step: "vaultnudge" });
    setScreen("vaultnudge");
  }, [updateProfile]);

  const handleVaultNudge = useCallback(async () => {
    await updateProfile({ onboarding_step: "building" });
    setScreen("building");
  }, [updateProfile]);

  const handleBuilding = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[Wingman] /api/onboarding/complete failed:", res.status, body);
      }
    } catch (err) {
      console.error("[Wingman] /api/onboarding/complete network error:", err);
    }

    // Seed vault signals in the background
    try {
      const { DEFAULT_CLOSER_SIGNALS } = await import("@/lib/utils");
      const signals = DEFAULT_CLOSER_SIGNALS;

      await supabase.from("vault_signals").delete().eq("user_id", userId);
      await supabase.from("vault_signals").insert(
        signals.map(({ stageColor, ...s }) => ({
          ...s,
          stage_color: stageColor,
          user_id:     userId,
          is_enabled:  true,
          is_new:      false,
        }))
      );
    } catch (err) {
      console.error("Vault seeding error (non-fatal):", err);
    }

    window.location.href = "/dashboard";
  }, [supabase, userId]);

  const screens: Partial<Record<OnboardingStep, React.ReactNode>> = {
    welcome:    <Welcome onNext={() => goTo("offer", { role: "closer" })} />,
    offer:      <YourOffer onNext={handleOffer} />,
    tutorial:   <Tutorial onNext={handleTutorial} />,
    vaultnudge: <VaultNudge onNext={handleVaultNudge} />,
    building:   <Building onNext={handleBuilding} />,
  };

  return (
    <div
      style={{
        minHeight:       "100vh",
        background:      "#f7f5f2",
        display:         "flex",
        flexDirection:   "column",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "32px 24px",
        fontFamily:      "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
      }}
    >
      <style>{`
        * { box-sizing: border-box }
        button { transition: opacity 0.15s }
        button:hover { opacity: 0.82 }
        input::placeholder { color: #aeaeb2 }
        textarea::placeholder { color: #aeaeb2 }
        textarea:focus { border-color: #1c1c1e !important }
        input:focus { border-color: #1c1c1e !important }
      `}</style>

      {/* Progress dots */}
      {DOT_SCREENS.includes(screen) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 44 }}>
          {DOT_SCREENS.map((s) => (
            <div
              key={s}
              style={{
                width:        screen === s ? 22 : 6,
                height:       6,
                borderRadius: 3,
                background:   screen === s ? "#000" : "#e5e5ea",
                transition:   "all 0.3s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          ))}
        </div>
      )}

      {screens[screen]}

      {/* Back button */}
      {!["welcome", "building", "vaultnudge"].includes(screen) && (
        <button
          onClick={() => {
            const prev = ONBOARDING_ORDER[ONBOARDING_ORDER.indexOf(screen) - 1];
            if (prev) goTo(prev);
          }}
          style={{
            marginTop:  22,
            background: "none",
            border:     "none",
            color:      "#8e8e93",
            fontSize:   13,
            fontFamily: "inherit",
            cursor:     "pointer",
          }}
        >
          ← Back
        </button>
      )}
    </div>
  );
}
