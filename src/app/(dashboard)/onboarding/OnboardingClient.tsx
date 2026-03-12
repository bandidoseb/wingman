"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OnboardingData, OnboardingStep } from "@/types";
import WIcon from "@/components/ui/WIcon";

// Onboarding screen components
import Welcome from "@/components/onboarding/Welcome";
import SalesStyle from "@/components/onboarding/SalesStyle";
import YourOffer from "@/components/onboarding/YourOffer";
import OfferCrawl from "@/components/onboarding/OfferCrawl";
import Qualification from "@/components/onboarding/Qualification";
import ObjectionsExit from "@/components/onboarding/ObjectionsExit";
import ActivationKey from "@/components/onboarding/ActivationKey";
import Tutorial from "@/components/onboarding/Tutorial";
import VaultNudge from "@/components/onboarding/VaultNudge";
import Building from "@/components/onboarding/Building";

const ONBOARDING_ORDER: OnboardingStep[] = [
  "welcome", "style", "offer", "crawl",
  "qualification", "objections", "activation", "tutorial", "vaultnudge", "building",
];
const DOT_SCREENS: OnboardingStep[] = [
  "welcome", "style", "offer", "crawl",
  "qualification", "objections", "activation", "tutorial",
];

interface Props {
  initialProfile: Record<string, unknown> | null;
  userId: string;
}

export default function OnboardingClient({ initialProfile, userId }: Props) {
  // Forward legacy step values that no longer exist in the flow
  // "phone" was removed in favour of vaultnudge; "role" was removed when we
  // went closer-only — anyone stuck there should start at "style".
  const rawStep = initialProfile?.onboarding_step as OnboardingStep | "phone" | "role" | undefined;
  const resolvedStep: OnboardingStep =
    rawStep === "phone" ? "vaultnudge" :
    rawStep === "role"  ? "style"      :
    (rawStep ?? "welcome");

  const [screen, setScreen] = useState<OnboardingStep>(resolvedStep);
  const [data, setData] = useState<OnboardingData>({
    salesStyle: (initialProfile?.sales_style as string) || undefined,
    callLength: (initialProfile?.call_length as string) || undefined,
  });

  const supabase = createClient();

  // All profile writes go through the server-side API route, NOT the browser
  // Supabase client.  The browser client's `.update()` silently does nothing
  // when the profile row doesn't exist (0 rows updated, no error), which was
  // the root cause of the onboarding loop.  The server route uses the service
  // role, making every write unconditionally reliable.
  const updateProfile = useCallback(async (updates: Record<string, unknown>) => {
    // Strip undefined values — JSON.stringify drops them silently which would
    // produce an empty body {}  and cause a confusing 400/500 on the server.
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

  const handleStyle = useCallback(async (style: string, length: string) => {
    setData((d) => ({ ...d, salesStyle: style, callLength: length }));
    await updateProfile({ sales_style: style, call_length: length, onboarding_step: "offer" });
    setScreen("offer");
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

    await updateProfile({ onboarding_step: "crawl" });
    setScreen("crawl");
  }, [supabase, userId, updateProfile]);

  const handleCrawl = useCallback(async (url?: string) => {
    if (url) {
      await supabase.from("user_onboarding_data").upsert({ user_id: userId, offer_url: url }, { onConflict: "user_id" });
    }
    await updateProfile({ onboarding_step: "qualification" });
    setScreen("qualification");
  }, [supabase, userId, updateProfile]);

  const handleQualification = useCallback(async (greenFlags: string[], dqSignals: string[]) => {
    setData((d) => ({ ...d, greenFlags, dqSignals }));

    await supabase.from("qualification_criteria").delete().eq("user_id", userId);
    const toInsert = [
      ...greenFlags.map((text, i) => ({ user_id: userId, type: "green_flag" as const, text, display_order: i })),
      ...dqSignals.map((text, i) => ({ user_id: userId, type: "dq_signal" as const, text, display_order: i })),
    ];
    if (toInsert.length > 0) await supabase.from("qualification_criteria").insert(toInsert);

    await updateProfile({ onboarding_step: "objections" });
    setScreen("objections");
  }, [supabase, userId, updateProfile]);

  const handleObjections = useCallback(async (objections: string[], exitLine: string) => {
    setData((d) => ({ ...d, objections, exitLine }));
    await supabase.from("user_onboarding_data").upsert(
      { user_id: userId, objections, exit_line: exitLine },
      { onConflict: "user_id" }
    );
    await updateProfile({ onboarding_step: "activation" });
    setScreen("activation");
  }, [supabase, userId, updateProfile]);

  // Activation now goes to tutorial (how Wingman works), then vaultnudge
  const handleActivation = useCallback(async (key: string | null) => {
    setData((d) => ({ ...d, activationKey: key || undefined }));
    await updateProfile({ activation_key: key, onboarding_step: "tutorial" });
    setScreen("tutorial");
  }, [updateProfile]);

  const handleTutorial = useCallback(async () => {
    await updateProfile({ onboarding_step: "vaultnudge" });
    setScreen("vaultnudge");
  }, [updateProfile]);

  const handleVaultNudge = useCallback(async () => {
    await updateProfile({ onboarding_step: "building" });
    setScreen("building");
  }, [updateProfile]);

  const handleBuilding = useCallback(async () => {
    // ── Mark onboarding complete via server-side API (service role) ──────────
    // We deliberately avoid the browser anon client here — any RLS or session
    // issue would silently fail and trap the user in the loop.  The API route
    // uses the service role key which bypasses all RLS and is guaranteed to
    // write regardless of the user's client-side auth state.
    try {
      const res = await fetch("/api/onboarding/complete", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("[Wingman] /api/onboarding/complete failed:", res.status, body);
      }
    } catch (err) {
      console.error("[Wingman] /api/onboarding/complete network error:", err);
    }

    // ── Seed vault data in the background ───────────────────────────────────
    try {
      const { DEFAULT_CLOSER_SIGNALS, DEFAULT_VAULT_OBJECTIONS } = await import("@/lib/utils");
      const signals = DEFAULT_CLOSER_SIGNALS;

      await supabase.from("vault_signals").delete().eq("user_id", userId);
      await supabase.from("vault_signals").insert(
        // Map camelCase stageColor → snake_case stage_color to match DB column
        signals.map(({ stageColor, ...s }) => ({
          ...s,
          stage_color: stageColor,
          user_id:     userId,
          is_enabled:  true,
          is_new:      false,
        }))
      );

      await supabase.from("vault_objections").delete().eq("user_id", userId);
      await supabase.from("vault_objections").insert(
        DEFAULT_VAULT_OBJECTIONS.map((o) => ({ ...o, user_id: userId, is_new: false }))
      );
    } catch (err) {
      // Vault seeding failed — not fatal, user can set up vault in Settings
      console.error("Vault seeding error (non-fatal):", err);
    }

    window.location.href = "/dashboard";
  }, [supabase, userId]);

  const screens: Partial<Record<OnboardingStep, React.ReactNode>> = {
    welcome:       <Welcome onNext={() => goTo("style", { role: "closer" })} />,
    style:         <SalesStyle onNext={handleStyle} />,
    offer:         <YourOffer onNext={handleOffer} />,
    crawl:         <OfferCrawl onNext={handleCrawl} />,
    qualification: <Qualification onNext={handleQualification} />,
    objections:    <ObjectionsExit onNext={handleObjections} />,
    activation:    <ActivationKey onNext={handleActivation} />,
    tutorial:      <Tutorial onNext={handleTutorial} />,
    vaultnudge:    <VaultNudge onNext={handleVaultNudge} />,
    building:      <Building onNext={handleBuilding} />,
  };

  return (
    <div
      style={{
        minHeight:       "100vh",
        background:      "#f2f2f7",
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
                width:      screen === s ? 22 : 6,
                height:     6,
                borderRadius: 3,
                background: screen === s ? "#000" : "#e5e5ea",
                transition: "all 0.3s cubic-bezier(0.22,1,0.36,1)",
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
