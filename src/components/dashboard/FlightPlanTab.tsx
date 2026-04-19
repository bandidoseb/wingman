"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import type { FlightPlan } from "@/types";

const inputStyle: React.CSSProperties = {
  background: "#f2f2f7",
  border: "1.5px solid rgba(0,0,0,0.07)",
  borderRadius: 10,
  padding: "11px 14px",
  color: "#1c1c1e",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "vertical" as const,
  minHeight: 88,
  lineHeight: 1.55,
};

type FormState = {
  syntax: "problems-first" | "goals-first";
  target_market: string;
  core_problem: string;
  dream_outcome: string;
  investment_min: string;
  investment_max: string;
  involves_partner: boolean;
  method_differentiation: string;
  custom_checkpoints: string[];
};

function emptyForm(): FormState {
  return {
    syntax: "problems-first",
    target_market: "",
    core_problem: "",
    dream_outcome: "",
    investment_min: "",
    investment_max: "",
    involves_partner: false,
    method_differentiation: "",
    custom_checkpoints: [],
  };
}

function planToForm(plan: FlightPlan): FormState {
  return {
    syntax: plan.syntax,
    target_market: plan.target_market ?? "",
    core_problem: plan.core_problem ?? "",
    dream_outcome: plan.dream_outcome ?? "",
    investment_min: plan.investment_min != null ? String(plan.investment_min) : "",
    investment_max: plan.investment_max != null ? String(plan.investment_max) : "",
    involves_partner: plan.involves_partner,
    method_differentiation: plan.method_differentiation ?? "",
    custom_checkpoints: plan.custom_checkpoints ?? [],
  };
}

function hasContent(plan: FlightPlan): boolean {
  return !!(
    plan.target_market ||
    plan.core_problem ||
    plan.dream_outcome ||
    plan.method_differentiation
  );
}

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1e", marginBottom: hint ? 3 : 0 }}>
        {label}
      </div>
      {hint && (
        <div style={{ fontSize: 12, color: "#aeaeb2", lineHeight: 1.45 }}>{hint}</div>
      )}
    </div>
  );
}

const STEP_LABELS = ["Call Approach", "Offer Context", "Investment Profile", "Custom Checkpoints"];
const STEP_DESCRIPTIONS = [
  "Who you sell to and how you structure your calls.",
  "What you solve, what success looks like, and why you're the right choice.",
  "Your typical price range and decision-making dynamics.",
  "Optional — anything extra you want Wingman to check post-call.",
];

function StepNav({
  step,
  total,
  onNext,
  onBack,
  isLast,
  saving,
  saved,
}: {
  step: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  isLast: boolean;
  saving: boolean;
  saved: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          fontSize: 13,
          color: step === 0 ? "transparent" : "#8e8e93",
          cursor: step === 0 ? "default" : "pointer",
          fontFamily: "inherit",
          padding: 0,
        }}
        disabled={step === 0}
      >
        ← Back
      </button>
      <span style={{ fontSize: 12, color: "#aeaeb2", fontWeight: 500 }}>
        {step + 1} of {total}
      </span>
      <button
        onClick={onNext}
        disabled={isLast && saving}
        style={{
          padding: "9px 20px",
          background: isLast ? (saved ? "#34c759" : "#1c1c1e") : "#1c1c1e",
          color: "#fff",
          border: "none",
          borderRadius: 9,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: isLast && saving ? "not-allowed" : "pointer",
          opacity: isLast && saving ? 0.6 : 1,
          transition: "background 0.2s",
        }}
      >
        {isLast
          ? saving ? "Saving…" : saved ? "Saved ✓" : "Save Flight Plan"
          : `Next: ${STEP_LABELS[step + 1]} →`}
      </button>
    </div>
  );
}

export default function FlightPlanTab() {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = show all at once; 0–3 = guided step index
  const [guidedStep, setGuidedStep] = useState<number | null>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    fetch("/api/flight-plan")
      .then((r) => r.json())
      .then(({ plan }) => {
        if (plan) {
          setForm(planToForm(plan));
          if (!hasContent(plan)) setGuidedStep(0);
        } else {
          setGuidedStep(0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Center the active section in the viewport when navigating between steps
  useEffect(() => {
    if (guidedStep === null) return;
    if (guidedStep === 0) {
      // Going back to step 0 — scroll to top so it doesn't feel cut off
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      sectionRefs.current[guidedStep]?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [guidedStep]);

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: value }));
  };

  const setCheckpoint = (idx: number, val: string) => {
    setSaved(false);
    setForm((f) => {
      const next = [...f.custom_checkpoints];
      next[idx] = val;
      return { ...f, custom_checkpoints: next };
    });
  };

  const addCheckpoint = () => {
    if (form.custom_checkpoints.length >= 3) return;
    setSaved(false);
    setForm((f) => ({ ...f, custom_checkpoints: [...f.custom_checkpoints, ""] }));
  };

  const removeCheckpoint = (idx: number) => {
    setSaved(false);
    setForm((f) => ({
      ...f,
      custom_checkpoints: f.custom_checkpoints.filter((_, i) => i !== idx),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/flight-plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          syntax: form.syntax,
          target_market: form.target_market || null,
          core_problem: form.core_problem || null,
          dream_outcome: form.dream_outcome || null,
          investment_min: form.investment_min ? parseInt(form.investment_min, 10) : null,
          investment_max: form.investment_max ? parseInt(form.investment_max, 10) : null,
          involves_partner: form.involves_partner,
          method_differentiation: form.method_differentiation || null,
          custom_checkpoints: form.custom_checkpoints.filter((c) => c.trim()),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setGuidedStep(null); // exit guided mode after saving
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const sectionStyle = (idx: number): React.CSSProperties => {
    if (guidedStep === null) return { marginBottom: 16 };
    const isActive = guidedStep === idx;
    return {
      marginBottom: 16,
      transition: "opacity 0.35s ease, filter 0.35s ease",
      opacity: isActive ? 1 : 0.18,
      filter: isActive ? "none" : "blur(1.5px)",
      pointerEvents: isActive ? "auto" : "none",
    };
  };

  if (loading) {
    return (
      <div style={{ color: "#aeaeb2", fontSize: 13, padding: "48px 0" }}>Loading…</div>
    );
  }

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          {guidedStep !== null ? (
            <>
              <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>
                Step {guidedStep + 1} of {STEP_LABELS.length} — {STEP_LABELS[guidedStep]}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", margin: 0 }}>
                Flight Plan
              </h1>
              <p style={{ fontSize: 13, color: "#8e8e93", marginTop: 5, lineHeight: 1.5 }}>
                {STEP_DESCRIPTIONS[guidedStep]}
              </p>
              <p style={{ fontSize: 12, color: "#aeaeb2", marginTop: 4, lineHeight: 1.5 }}>
                All fields are optional — the more context you give Wingman, the better he&apos;ll perform on your calls.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", margin: 0 }}>
                Flight Plan
              </h1>
              <p style={{ fontSize: 13, color: "#8e8e93", marginTop: 5, lineHeight: 1.5, maxWidth: 480 }}>
                Wingman loads this silently on every call and evaluates post-call pillar coverage in your Flight Log. All fields are optional — the more context you give, the better he&apos;ll perform.
              </p>
            </>
          )}
        </div>
        {guidedStep !== null ? (
          <button
            onClick={() => setGuidedStep(null)}
            style={{
              background: "none",
              border: "1.5px solid rgba(0,0,0,0.10)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              color: "#8e8e93",
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            Edit all at once
          </button>
        ) : (
          <button
            onClick={() => setGuidedStep(0)}
            style={{
              background: "none",
              border: "1.5px solid rgba(0,0,0,0.10)",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: 12,
              color: "#8e8e93",
              cursor: "pointer",
              fontFamily: "inherit",
              flexShrink: 0,
              marginTop: 4,
            }}
          >
            Guided setup
          </button>
        )}
      </div>

      {/* Section 0 — Call Approach (two cards, single guided step) */}
      <div ref={(el) => { sectionRefs.current[0] = el; }} style={sectionStyle(0)}>
        {/* Card A: Your ideal client */}
        <Card style={{ marginBottom: 10 }}>
          <SectionLabel>Your Market</SectionLabel>
          <FieldLabel label="Your ideal client" />
          <textarea
            style={textareaStyle}
            rows={2}
            placeholder="e.g. High-ticket fitness coaches doing $10k–$30k/month who want to break $50k+"
            value={form.target_market}
            onChange={(e) => set("target_market", e.target.value)}
          />
        </Card>

        {/* Card B: Call syntax */}
        <Card>
          <SectionLabel>Call Style</SectionLabel>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1e", marginBottom: 3 }}>
              Call syntax
            </div>
            <div style={{ fontSize: 12, color: "#aeaeb2" }}>
              How do you typically open your calls? Pick the one that feels natural — you can always change it later.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["problems-first", "goals-first"] as const).map((opt) => {
              const isActive = form.syntax === opt;
              return (
                <button
                  key={opt}
                  onClick={() => set("syntax", opt)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 9,
                    border: `1.5px solid ${isActive ? "#1c1c1e" : "rgba(0,0,0,0.10)"}`,
                    background: isActive ? "#1c1c1e" : "transparent",
                    color: isActive ? "#fff" : "#8e8e93",
                    fontSize: 13,
                    fontWeight: 500,
                    fontFamily: "inherit",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {opt === "problems-first" ? "Problem-first" : "Outcome-first"}
                  {opt === "problems-first" && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      background: isActive ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.06)",
                      color: isActive ? "#fff" : "#aeaeb2",
                      borderRadius: 4,
                      padding: "2px 5px",
                      letterSpacing: "0.03em",
                    }}>
                      DEFAULT
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{
            background: "rgba(0,0,0,0.03)",
            borderRadius: 8,
            padding: "10px 12px",
            fontSize: 12,
            color: "#636366",
            lineHeight: 1.55,
          }}>
            {form.syntax === "problems-first" ? (
              <>
                <strong style={{ color: "#1c1c1e" }}>Problem-first</strong> — You start by uncovering what&apos;s wrong before showing what&apos;s possible. Best for most high-ticket closers. If you don&apos;t know which to pick, choose this one.
              </>
            ) : (
              <>
                <strong style={{ color: "#1c1c1e" }}>Outcome-first</strong> — You open by painting the dream result, then press into the pain. Works best when your leads already believe in the category and just need to see the transformation clearly.
              </>
            )}
          </div>

          {guidedStep === 0 && (
            <StepNav
              step={0}
              total={STEP_LABELS.length}
              onNext={() => setGuidedStep(1)}
              onBack={() => {}}
              isLast={false}
              saving={saving}
              saved={saved}
            />
          )}
        </Card>
      </div>

      {/* Section 1 — Offer Context */}
      <div ref={(el) => { sectionRefs.current[1] = el; }} style={sectionStyle(1)}>
        <Card>
          <SectionLabel>Offer Context</SectionLabel>

          <div style={{ marginBottom: 18 }}>
            <FieldLabel
              label="Core problem"
              hint="What pain does your ideal client have that your offer solves?"
            />
            <textarea
              style={textareaStyle}
              rows={3}
              placeholder="e.g. Stuck under 20% close rate — working harder but losing deals they should win"
              value={form.core_problem}
              onChange={(e) => set("core_problem", e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <FieldLabel
              label="Dream outcome"
              hint="What does success look like for your ideal client after working with you?"
            />
            <textarea
              style={textareaStyle}
              rows={3}
              placeholder="e.g. Consistent 35%+ close rate, $50k+ months, confidence to handle any objection live"
              value={form.dream_outcome}
              onChange={(e) => set("dream_outcome", e.target.value)}
            />
          </div>

          <div>
            <FieldLabel
              label="Why you"
              hint="What makes your offer the right fit — what can't they get elsewhere?"
            />
            <textarea
              style={textareaStyle}
              rows={3}
              placeholder="e.g. Only program with live call reviews and real-time coaching, not pre-recorded theory"
              value={form.method_differentiation}
              onChange={(e) => set("method_differentiation", e.target.value)}
            />
          </div>

          {guidedStep === 1 && (
            <StepNav
              step={1}
              total={STEP_LABELS.length}
              onNext={() => setGuidedStep(2)}
              onBack={() => setGuidedStep(0)}
              isLast={false}
              saving={saving}
              saved={saved}
            />
          )}
        </Card>
      </div>

      {/* Section 2 — Investment Profile */}
      <div ref={(el) => { sectionRefs.current[2] = el; }} style={sectionStyle(2)}>
        <Card>
          <SectionLabel>Investment Profile</SectionLabel>

          <div style={{ marginBottom: 16 }}>
            <FieldLabel label="Typical investment range" />
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)", color: "#8e8e93", fontSize: 13, pointerEvents: "none",
                }}>$</span>
                <input
                  type="number"
                  min={0}
                  style={{ ...inputStyle, paddingLeft: 24 }}
                  placeholder="5,000"
                  value={form.investment_min}
                  onChange={(e) => set("investment_min", e.target.value)}
                />
              </div>
              <span style={{ color: "#aeaeb2", fontSize: 13, flexShrink: 0 }}>—</span>
              <div style={{ position: "relative", flex: 1 }}>
                <span style={{
                  position: "absolute", left: 12, top: "50%",
                  transform: "translateY(-50%)", color: "#8e8e93", fontSize: 13, pointerEvents: "none",
                }}>$</span>
                <input
                  type="number"
                  min={0}
                  style={{ ...inputStyle, paddingLeft: 24 }}
                  placeholder="25,000"
                  value={form.investment_max}
                  onChange={(e) => set("investment_max", e.target.value)}
                />
              </div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={form.involves_partner}
              onChange={(e) => set("involves_partner", e.target.checked)}
              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#1c1c1e" }}
            />
            <span style={{ fontSize: 13, color: "#1c1c1e" }}>
              This decision usually involves a partner or spouse
            </span>
          </label>

          {guidedStep === 2 && (
            <StepNav
              step={2}
              total={STEP_LABELS.length}
              onNext={() => setGuidedStep(3)}
              onBack={() => setGuidedStep(1)}
              isLast={false}
              saving={saving}
              saved={saved}
            />
          )}
        </Card>
      </div>

      {/* Section 3 — Custom Checkpoints */}
      <div ref={(el) => { sectionRefs.current[3] = el; }} style={sectionStyle(3)}>
        <Card style={{ marginBottom: guidedStep === null ? 28 : 16 }}>
          <SectionLabel>Custom Checkpoints</SectionLabel>
          <p style={{ fontSize: 12, color: "#aeaeb2", marginBottom: 14, lineHeight: 1.45 }}>
            Up to 3 additional things Wingman will check for in your post-call review. Optional — most reps skip this.
          </p>

          {form.custom_checkpoints.map((cp, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="e.g. Confirm decision maker was on the call"
                value={cp}
                onChange={(e) => setCheckpoint(i, e.target.value)}
              />
              <button
                onClick={() => removeCheckpoint(i)}
                style={{
                  background: "rgba(0,0,0,0.05)",
                  border: "none",
                  borderRadius: 8,
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#8e8e93",
                  fontSize: 18,
                  cursor: "pointer",
                  flexShrink: 0,
                  fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </div>
          ))}

          {form.custom_checkpoints.length < 3 && (
            <button
              onClick={addCheckpoint}
              style={{
                marginTop: 4,
                background: "none",
                border: "1.5px dashed rgba(0,0,0,0.15)",
                borderRadius: 9,
                padding: "9px 14px",
                fontSize: 13,
                color: "#8e8e93",
                cursor: "pointer",
                fontFamily: "inherit",
                width: "100%",
                textAlign: "center",
              }}
            >
              + Add checkpoint
            </button>
          )}

          {guidedStep === 3 && (
            <StepNav
              step={3}
              total={STEP_LABELS.length}
              onNext={handleSave}
              onBack={() => setGuidedStep(2)}
              isLast={true}
              saving={saving}
              saved={saved}
            />
          )}
        </Card>
      </div>

      {/* Save button — shown only in non-guided mode */}
      {guidedStep === null && (
        <>
          {error && (
            <p style={{ fontSize: 13, color: "#ff3b30", marginBottom: 12 }}>{error}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "11px 24px",
              background: saved ? "#34c759" : "#1c1c1e",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
              transition: "background 0.2s",
            }}
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Flight Plan"}
          </button>
        </>
      )}
    </div>
  );
}
