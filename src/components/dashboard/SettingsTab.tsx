"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import Toggle from "@/components/ui/Toggle";
import { useTheme } from "@/hooks/useTheme";
import type { ThemePref } from "@/lib/theme";
import type { Profile, Call, AiModelPreference } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { PLANS, TOPOFF_PACKAGES } from "@/lib/stripe";
import { formatPhone } from "@/lib/utils";

interface Props {
  profile: Profile;
  calls: Call[];
  onZoomNameSaved?: (name: string) => void;
}

const ROLE_LABELS: Record<string, string> = {
  closer: "Closer",
  setter: "Setter",
};

/**
 * Theme choices. "system" is first because it is the default and the one most
 * people want — the dashboard then follows the Mac's appearance live.
 */
const THEME_OPTIONS: ReadonlyArray<{ pref: ThemePref; icon: string; title: string }> = [
  { pref: "system", icon: "🖥️", title: "System" },
  { pref: "light",  icon: "☀️", title: "Light" },
  { pref: "dark",   icon: "🌙", title: "Dark" },
];

const STYLE_LABELS: Record<string, string> = {
  direct: "Direct & assertive",
  empathetic: "Empathetic & consultative",
  challenger: "Challenger — reframes everything",
  social: "Social & rapport-heavy",
  systematic: "Systematic & process-driven",
};

export default function SettingsTab({ profile, calls, onZoomNameSaved }: Props) {
  const supabase = createClient();
  // pref = what the rep picked; resolved = what's actually on screen right now
  // (they differ only while pref is "system").
  const { pref: themePref, resolved: resolvedTheme, setPref: setThemePref } = useTheme();

  const [aiModel, setAiModel] = useState<AiModelPreference>(
    profile.ai_model_preference ?? "smart"
  );
  const [assistEnabled, setAssistEnabled] = useState(profile.assist_enabled);
  const [zoomDisplayName, setZoomDisplayName] = useState(profile.zoom_display_name ?? "");
  const [zoomNameDirty, setZoomNameDirty] = useState(false);
  const [alerts, setAlerts] = useState({
    pitching_early: profile.alert_pitching_early,
    missed_topics: profile.alert_missed_topics,
    post_call_debrief: profile.alert_post_call_debrief,
    weekly_summary: profile.alert_weekly_summary,
  });
  const [portalLoading, setPortalLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plan = profile.subscription_plan as "closer" | "setter" | null;
  const planInfo = plan ? PLANS[plan] : null;

  // Calls this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const callsThisMonth = calls.filter((c) => new Date(c.call_date) >= monthStart).length;
  const callLimit = planInfo && "calls" in planInfo ? (planInfo as typeof PLANS.closer).calls : null;

  async function handleAssistToggle(val: boolean) {
    setAssistEnabled(val);
    setSaving("assist");
    const { error } = await supabase
      .from("profiles")
      .update({ assist_enabled: val })
      .eq("id", profile.id);
    if (error) {
      setAssistEnabled(!val);
      setError("Failed to save. Try again.");
    }
    setSaving(null);
  }

  async function handleAlertToggle(key: keyof typeof alerts, val: boolean) {
    setAlerts((prev) => ({ ...prev, [key]: val }));
    setSaving(key);
    const { error } = await supabase
      .from("profiles")
      .update({ [`alert_${key}`]: val })
      .eq("id", profile.id);
    if (error) {
      setAlerts((prev) => ({ ...prev, [key]: !val }));
      setError("Failed to save. Try again.");
    }
    setSaving(null);
  }

  async function handlePortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/customer-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not open billing portal.");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setPortalLoading(false);
  }

  async function handleAiModelSelect(pref: AiModelPreference) {
    setAiModel(pref);
    setSaving("ai_model");
    const { error } = await supabase
      .from("profiles")
      .update({ ai_model_preference: pref })
      .eq("id", profile.id);
    if (error) {
      setAiModel(aiModel);
      setError("Failed to save. Try again.");
    }
    setSaving(null);
  }

  async function handleZoomNameSave() {
    setError(null);
    setSaving("zoom_name");
    try {
      const trimmed = zoomDisplayName.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ zoom_display_name: trimmed || null })
        .eq("id", profile.id);
      if (error) {
        setError("Failed to save. Try again.");
      } else {
        setZoomDisplayName(trimmed); // sync to trimmed value so dirty check is accurate
        setZoomNameDirty(false);
        onZoomNameSaved?.(trimmed);  // notify DashboardClient so the deploy gate updates
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSaving(null);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.02em" }}>Settings</div>
        <div style={{ fontSize: 14, color: "rgb(var(--ink-2))", marginTop: 3 }}>Manage your profile, billing, and preferences</div>
      </div>

      {error && (
        <div style={{ background: "rgb(var(--critical-weak))", border: "1px solid rgb(var(--critical) / 0.25)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: "rgb(var(--critical))" }}>
          {error}
        </div>
      )}

      {/* Profile Card */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Your Profile</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Email", value: profile.email || "—" },
            { label: "Phone", value: profile.phone ? formatPhone(profile.phone) : "Not verified" },
            { label: "Role", value: profile.role ? ROLE_LABELS[profile.role] || profile.role : "—" },
            { label: "Sales Style", value: profile.sales_style ? (STYLE_LABELS[profile.sales_style] || profile.sales_style) : "—" },
            { label: "Avg Call Length", value: profile.call_length || "—" },
          ].map((row) => (
            <div key={row.label} style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingBottom: 10, borderBottom: "1px solid rgb(var(--line))" }}>
              <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", fontWeight: 600, width: 110, flexShrink: 0, paddingTop: 1 }}>{row.label}</div>
              <div style={{ fontSize: 13, color: "rgb(var(--ink-1))", fontWeight: 500, flex: 1 }}>{row.value}</div>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", fontWeight: 600, width: 110, flexShrink: 0, paddingTop: 1 }}>Member Since</div>
            <div style={{ fontSize: 13, color: "rgb(var(--ink-1))", fontWeight: 500 }}>
              {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
          </div>

          {/* Zoom Display Name — required for keyword trigger exclusion */}
          <div style={{ paddingTop: 14, borderTop: "1px solid rgb(var(--line))" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", fontWeight: 600 }}>Zoom Display Name</div>
              {!zoomDisplayName.trim() && (
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgb(var(--critical))", background: "rgb(var(--critical-weak))", padding: "2px 7px", borderRadius: 5, letterSpacing: "0.03em" }}>
                  REQUIRED
                </div>
              )}
            </div>
            <input
              type="text"
              value={zoomDisplayName}
              placeholder="e.g. Johnny Appleseed"
              onChange={(e) => { setZoomDisplayName(e.target.value); setZoomNameDirty(true); }}
              style={{
                width: "100%",
                padding: "9px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                border: `1.5px solid ${!zoomDisplayName.trim() ? "rgb(var(--warning))" : "rgb(var(--line-strong))"}`,
                borderRadius: 9,
                outline: "none",
                background: "rgb(var(--surface-sunken))",
                color: "rgb(var(--ink-1))",
                boxSizing: "border-box",
                transition: "border-color 0.2s",
              }}
            />
            <div style={{ fontSize: 11, color: "rgb(var(--ink-2))", marginTop: 6, lineHeight: 1.5 }}>
              Enter your name exactly as it appears on your Zoom profile — you can find it in the top right corner of the Zoom app.
              Wingman uses this to know which voice is yours so it only fires cards for your prospect, not you.
            </div>
            {zoomNameDirty && (
              <button
                onClick={handleZoomNameSave}
                disabled={saving === "zoom_name"}
                style={{
                  marginTop: 10,
                  padding: "8px 18px",
                  background: "rgb(var(--ink-1))",
                  color: "rgb(var(--surface))",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving === "zoom_name" ? "not-allowed" : "pointer",
                  opacity: saving === "zoom_name" ? 0.6 : 1,
                  fontFamily: "inherit",
                  transition: "opacity 0.2s",
                }}
              >
                {saving === "zoom_name" ? "Saving…" : "Save Name"}
              </button>
            )}
            {saving === null && !zoomNameDirty && zoomDisplayName.trim() && (
              <div style={{ fontSize: 11, color: "rgb(var(--positive))", marginTop: 6, fontWeight: 600 }}>✓ Saved</div>
            )}
          </div>
        </div>
      </Card>

      {/* Appearance */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Appearance</SectionLabel>
        <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", marginBottom: 14 }}>
          How the dashboard looks. Your in-call display always stays dark so it disappears
          against your video — this setting doesn&apos;t change it.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {THEME_OPTIONS.map((opt) => {
            const isSelected = themePref === opt.pref;
            return (
              <button
                key={opt.pref}
                onClick={() => setThemePref(opt.pref)}
                aria-pressed={isSelected}
                style={{
                  // Same selected/unselected treatment as AI Performance below, on
                  // purpose: --ink-1 flips with the theme, so the "filled" state reads
                  // correctly in BOTH. A track/thumb segmented control would NOT — in
                  // dark, --surface is darker than --surface-sunken, so the thumb would
                  // read as recessed instead of raised.
                  background: isSelected ? "rgb(var(--ink-1))" : "rgb(var(--surface-sunken))",
                  border: isSelected ? "2px solid rgb(var(--ink-1))" : "2px solid rgb(var(--line-strong))",
                  borderRadius: 12,
                  padding: "12px 10px",
                  cursor: "pointer",
                  textAlign: "center",
                  fontFamily: "inherit",
                  transition: "all 0.18s",
                }}
              >
                <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "rgb(var(--surface))" : "rgb(var(--ink-1))" }}>
                  {opt.title}
                </div>
              </button>
            );
          })}
        </div>
        {themePref === "system" && (
          <div style={{ fontSize: 11, color: "rgb(var(--ink-3))", marginTop: 10 }}>
            Following your Mac — currently {resolvedTheme}.
          </div>
        )}
      </Card>

      {/* Plan & Billing Card */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Plan & Billing</SectionLabel>
        {planInfo ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "rgb(var(--ink-1))" }}>{planInfo.name}</div>
                <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", marginTop: 2 }}>{"price" in planInfo ? planInfo.price : ""} · {profile.subscription_status === "active" ? "Active" : profile.subscription_status}</div>
              </div>
              <div style={{ background: profile.subscription_status === "active" ? "rgb(var(--positive-weak))" : "rgb(var(--warning-weak))", color: profile.subscription_status === "active" ? "rgb(var(--positive))" : "rgb(var(--warning))", fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 6 }}>
                {profile.subscription_status === "active" ? "Active" : "Inactive"}
              </div>
            </div>

            {callLimit && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", fontWeight: 600 }}>Calls This Month</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: callsThisMonth >= callLimit ? "rgb(var(--critical))" : "rgb(var(--ink-1))" }}>
                    {callsThisMonth} / {callLimit}
                  </div>
                </div>
                <div style={{ height: 6, background: "rgb(var(--surface-sunken))", borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (callsThisMonth / callLimit) * 100)}%`, borderRadius: 3, background: callsThisMonth >= callLimit ? "rgb(var(--critical))" : callsThisMonth >= callLimit * 0.8 ? "rgb(var(--warning))" : "rgb(var(--positive))", transition: "width 0.4s ease" }} />
                </div>
              </div>
            )}

            {/* Extra (rollover) calls balance + top-off packages */}
            {plan && plan in TOPOFF_PACKAGES && (() => {
              const packages = TOPOFF_PACKAGES[plan as "closer" | "setter"];
              const extraCalls = profile.extra_calls_remaining ?? 0;
              return (
                <div style={{ marginBottom: 14, padding: "12px 14px", background: extraCalls > 0 ? "rgb(var(--positive-weak))" : "rgb(var(--surface-sunken))", borderRadius: 10, border: `1px solid ${extraCalls > 0 ? "rgb(var(--positive) / 0.25)" : "rgb(var(--line-strong))"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: extraCalls > 0 ? 4 : 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "rgb(var(--ink-2))" }}>Extra Calls (Rollover)</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: extraCalls > 0 ? "rgb(var(--positive))" : "rgb(var(--ink-2))" }}>
                      {extraCalls} remaining
                    </div>
                  </div>
                  {extraCalls > 0 && (
                    <div style={{ fontSize: 11, color: "rgb(var(--ink-2))", marginBottom: 10 }}>
                      These carry over every month until fully used.
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {packages.map((pkg) => (
                      <button
                        key={pkg.calls}
                        onClick={() => {
                          window.location.href = `/api/stripe/create-checkout?type=topoff&plan=${plan}&package=${pkg.calls}`;
                        }}
                        style={{
                          flex: 1,
                          padding: "9px 0",
                          background: "rgb(var(--surface))",
                          border: "1px solid rgb(var(--line-strong))",
                          borderRadius: 9,
                          fontSize: 12,
                          fontWeight: 600,
                          color: "rgb(var(--ink-1))",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          transition: "border-color 0.15s, background 0.15s",
                        }}
                      >
                        +{pkg.calls} calls
                        <div style={{ fontSize: 11, fontWeight: 400, color: "rgb(var(--ink-2))", marginTop: 2 }}>{pkg.price}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}

            <button
              onClick={handlePortal}
              disabled={portalLoading}
              style={{ width: "100%", padding: "11px 0", background: "rgb(var(--ink-1))", color: "rgb(var(--surface))", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: portalLoading ? "not-allowed" : "pointer", opacity: portalLoading ? 0.6 : 1, fontFamily: "inherit", transition: "opacity 0.2s" }}
            >
              {portalLoading ? "Opening Portal…" : "Manage Billing"}
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 14, color: "rgb(var(--ink-2))", marginBottom: 14 }}>No active subscription</div>
            <button
              onClick={() => window.location.href = "/api/stripe/create-checkout?plan=" + (profile.role || "closer")}
              style={{ padding: "10px 24px", background: "rgb(var(--signal))", color: "rgb(var(--signal-on))", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Subscribe Now
            </button>
          </div>
        )}
      </Card>

      {/* Wingman Assist */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Wingman Assist</SectionLabel>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--ink-1))", marginBottom: 3 }}>Enable Wingman Assist</div>
            <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", lineHeight: 1.5 }}>
              AI-powered real-time coaching during calls. +$50/mo add-on.
              {saving === "assist" && <span style={{ color: "rgb(var(--signal))", marginLeft: 8 }}>Saving…</span>}
            </div>
          </div>
          <Toggle on={assistEnabled} onToggle={() => handleAssistToggle(!assistEnabled)} label="Enable Wingman Assist" />
        </div>
      </Card>

      {/* Alerts */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Alerts & Notifications</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { key: "pitching_early" as const, label: "Pitching Too Early", desc: "Alert when you pitch before the qualification is complete." },
            { key: "missed_topics" as const, label: "Missed Topics", desc: "Flag call topics you typically cover but skipped." },
            { key: "post_call_debrief" as const, label: "Post-Call Debrief", desc: "AI summary and coaching notes after each call." },
            { key: "weekly_summary" as const, label: "Weekly Summary", desc: "Weekly performance email with trends and highlights." },
          ].map((item, idx, arr) => (
            <div
              key={item.key}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingTop: idx === 0 ? 0 : 14, paddingBottom: idx < arr.length - 1 ? 14 : 0, borderBottom: idx < arr.length - 1 ? "1px solid rgb(var(--line))" : "none" }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--ink-1))", marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", lineHeight: 1.5 }}>
                  {item.desc}
                  {saving === item.key && <span style={{ color: "rgb(var(--signal))", marginLeft: 6 }}>Saving…</span>}
                </div>
              </div>
              <Toggle on={alerts[item.key]} onToggle={() => handleAlertToggle(item.key, !alerts[item.key])} label={item.label} />
            </div>
          ))}
        </div>
      </Card>

      {/* AI Performance */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>AI Performance</SectionLabel>
        <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", marginBottom: 14 }}>
          Choose how Wingman thinks during your calls.
          {saving === "ai_model" && <span style={{ color: "rgb(var(--signal))", marginLeft: 8 }}>Saving…</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {([
            { pref: "fast" as AiModelPreference, icon: "⚡", title: "Fast Mode", desc: "Snappier responses. Optimized for speed.", recommended: false },
            { pref: "smart" as AiModelPreference, icon: "🧠", title: "Smart Mode", desc: "Deeper reasoning. Best for complex calls.", recommended: true },
          ] as const).map((opt) => {
            const isSelected = aiModel === opt.pref;
            return (
              <button
                key={opt.pref}
                onClick={() => handleAiModelSelect(opt.pref)}
                style={{
                  background: isSelected ? "rgb(var(--ink-1))" : "rgb(var(--surface-sunken))",
                  border: isSelected ? "2px solid rgb(var(--ink-1))" : "2px solid rgb(var(--line-strong))",
                  borderRadius: 12,
                  padding: "14px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.18s",
                  position: "relative",
                }}
              >
                {opt.recommended && (
                  <div style={{ position: "absolute", top: 8, right: 8, background: "rgb(var(--signal))", color: "rgb(var(--signal-on))", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, letterSpacing: "0.04em" }}>
                    REC
                  </div>
                )}
                <div style={{ fontSize: 18, marginBottom: 6 }}>{opt.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? "rgb(var(--surface))" : "rgb(var(--ink-1))", marginBottom: 4 }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: 11, color: isSelected ? "rgb(var(--surface) / 0.65)" : "rgb(var(--ink-2))", lineHeight: 1.4 }}>
                  {opt.desc}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Account</SectionLabel>
        <button
          onClick={handleSignOut}
          style={{ width: "100%", padding: "11px 0", background: "rgb(var(--critical-weak))", color: "rgb(var(--critical))", border: "1px solid rgb(var(--critical) / 0.25)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "background 0.2s" }}
        >
          Sign Out
        </button>
      </Card>

      <div style={{ textAlign: "center", fontSize: 11, color: "rgb(var(--ink-3))", paddingBottom: 24 }}>
        Wingman v1.0 · Built for closers.
      </div>
    </div>
  );
}
