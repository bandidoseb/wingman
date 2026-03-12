"use client";

/**
 * PaywallModal
 *
 * Full-screen dark overlay + centered modal that appears when a user has
 * used all 10 of their free calls. Cannot be dismissed — only disappears
 * after a successful Stripe subscription.
 *
 * Usage:
 *   <PaywallModal role="closer" />
 *   <PaywallModal role="setter" />
 */

import WIcon from "@/components/ui/WIcon";
import type { Role } from "@/types";

const PLANS = {
  closer: { label: "Closer — Core", price: "$149/mo", plan: "closer" },
  setter: { label: "Setter — Core", price: "$79/mo",  plan: "setter" },
} as const;

interface Props {
  role: Role;
}

export default function PaywallModal({ role }: Props) {
  const plan = PLANS[role];

  const handleSubscribe = () => {
    window.location.href = `/api/stripe/create-checkout?plan=${plan.plan}`;
  };

  return (
    // ── Full-screen overlay ─────────────────────────────────────────────────
    <div
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0,0,0,0.75)",
        zIndex:         9999,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "center",
        padding:        24,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      {/* ── Modal card ────────────────────────────────────────────────────── */}
      <div
        style={{
          background:   "#ffffff",
          borderRadius: 24,
          padding:      "40px 36px",
          maxWidth:     400,
          width:        "100%",
          textAlign:    "center",
          boxShadow:    "0 32px 80px rgba(0,0,0,0.4)",
          fontFamily:   "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <WIcon size={52} />
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize:      26,
            fontWeight:    700,
            color:         "#1c1c1e",
            letterSpacing: "-0.03em",
            marginBottom:  10,
            lineHeight:    1.2,
          }}
        >
          Your free calls are up.
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize:     14,
            color:        "#8e8e93",
            lineHeight:   1.65,
            marginBottom: 28,
            padding:      "0 4px",
          }}
        >
          You&apos;ve used all 10 of your free calls.{" "}
          Wingman helped you get here — now lock in your spot to keep flying.
        </div>

        {/* Plan card */}
        <div
          style={{
            background:    "#f2f2f7",
            borderRadius:  16,
            padding:       "20px 20px",
            marginBottom:  20,
            textAlign:     "left",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#1c1c1e" }}>{plan.label}</div>
              <div style={{ fontSize: 12, color: "#8e8e93", marginTop: 2 }}>
                Unlimited calls · Live AI coaching · Signal vault
              </div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1c1c1e", whiteSpace: "nowrap", marginLeft: 12 }}>
              {plan.price}
            </div>
          </div>

          {/* Feature pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {["Real-time signals", "Objection handling", "Live scorecard", "Flight log"].map((f) => (
              <div
                key={f}
                style={{
                  background:   "#fff",
                  border:       "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 20,
                  padding:      "3px 10px",
                  fontSize:     11,
                  color:        "#3a3a3c",
                  fontWeight:   500,
                }}
              >
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Subscribe CTA */}
        <button
          onClick={handleSubscribe}
          style={{
            width:        "100%",
            padding:      "15px 20px",
            borderRadius: 14,
            border:       "none",
            background:   "#000",
            color:        "#fff",
            fontSize:     16,
            fontWeight:   700,
            fontFamily:   "inherit",
            cursor:       "pointer",
            marginBottom: 12,
            letterSpacing: "-0.01em",
          }}
        >
          Subscribe — {plan.price}
        </button>

        {/* Fine print */}
        <div style={{ fontSize: 11, color: "#aeaeb2", lineHeight: 1.5 }}>
          Billed monthly · Cancel anytime · Secured by Stripe
        </div>
      </div>
    </div>
  );
}
