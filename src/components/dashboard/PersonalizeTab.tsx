"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import type { Profile, SalesDna, SalesSyntax } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  profile: Profile;
  userId: string;
}

// --line-strong, not --line: globals.css reserves --line-strong for input borders,
// and in dark mode --line sits only 1.05:1 from --surface-sunken, so a field's edge
// disappears. --line-strong holds it at 1.31:1. Matches the Home Coach composer,
// which is the reference this page is being judged against.
const inputStyle: React.CSSProperties = {
  background: "rgb(var(--surface-sunken))",
  border: "1.5px solid rgb(var(--line-strong))",
  borderRadius: 10,
  padding: "11px 14px",
  color: "rgb(var(--ink-1))",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        marginTop: 14,
        padding: "10px 20px",
        background: saved ? "rgb(var(--positive))" : "rgb(var(--ink-1))",
        color: "rgb(var(--surface))",
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
      {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
    </button>
  );
}

// ── Your Offer Section (offers table — name/price) ─────────────────────────────
interface OfferRow { id?: string; name: string; price: string; is_main: boolean; }

function OfferSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [offers, setOffers]   = useState<OfferRow[]>([]);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    supabase
      .from("offers")
      .select("id, name, price, is_main")
      .eq("user_id", userId)
      .order("display_order")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setOffers(data);
        } else {
          setOffers([{ name: "", price: "", is_main: true }]);
        }
        setLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const updateOffer = (idx: number, field: "name" | "price", val: string) => {
    setSaved(false);
    setOffers((prev) => prev.map((o, i) => i === idx ? { ...o, [field]: field === "price" ? formatPrice(val) : val } : o));
  };

  const addOffer = () => setOffers((prev) => [...prev, { name: "", price: "", is_main: false }]);
  const removeOffer = (idx: number) => setOffers((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    setSaving(true);
    const toInsert = offers
      .filter((o) => o.name.trim())
      .map((o, i) => ({ user_id: userId, name: o.name, price: o.price, is_main: i === 0, display_order: i }));

    await supabase.from("offers").delete().eq("user_id", userId);
    if (toInsert.length > 0) await supabase.from("offers").insert(toInsert);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  if (!loaded) return <Card style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: "rgb(var(--ink-2))" }}>Loading…</div></Card>;

  const mainOffer   = offers.find((o) => o.is_main) ?? offers[0];
  const otherOffers = offers.filter((o) => !o.is_main);

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Your Offer</SectionLabel>

      {/* Main offer */}
      <div style={{ fontSize: 11, color: "rgb(var(--ink-2))", fontWeight: 500, marginBottom: 6 }}>Main offer</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={mainOffer?.name ?? ""}
          onChange={(e) => updateOffer(0, "name", e.target.value)}
          placeholder="Offer name"
          style={{ ...inputStyle, flex: 1 }}
        />
        <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgb(var(--ink-3))", pointerEvents: "none" }}>$</span>
          <input
            value={mainOffer?.price ?? ""}
            onChange={(e) => updateOffer(0, "price", e.target.value)}
            placeholder="10,000"
            style={{ ...inputStyle, paddingLeft: 24 }}
          />
        </div>
      </div>

      {/* Downsells */}
      {otherOffers.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "rgb(var(--ink-2))", fontWeight: 500, marginBottom: 6 }}>Downsells & other offers</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
            {otherOffers.map((o, i) => {
              const realIdx = offers.indexOf(o);
              return (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    value={o.name}
                    onChange={(e) => updateOffer(realIdx, "name", e.target.value)}
                    placeholder="Offer name"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "rgb(var(--ink-3))", pointerEvents: "none" }}>$</span>
                    <input
                      value={o.price}
                      onChange={(e) => updateOffer(realIdx, "price", e.target.value)}
                      placeholder="5,000"
                      style={{ ...inputStyle, paddingLeft: 24 }}
                    />
                  </div>
                  <button onClick={() => removeOffer(realIdx)} style={{ background: "none", border: "none", color: "rgb(var(--ink-3))", fontSize: 18, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {offers.length < 5 && (
        <button onClick={addOffer} style={{ background: "none", border: "none", color: "rgb(var(--ink-2))", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add another offer
        </button>
      )}

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Card>
  );
}

// ── Sales DNA Capture (the moat) ───────────────────────────────────────────────
function BrainDumpNote() {
  return (
    <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", marginBottom: 16, lineHeight: 1.55 }}>
      The more you dump here, the smarter your Wingman gets — don&apos;t hold back, Wingman will make sense of it.
    </div>
  );
}

function DnaField({ label, star, sub, example, value, onChange, quickAnswer }: {
  label: string; star?: boolean; sub?: string; example: string;
  value: string; onChange: (v: string) => void;
  /** One-click honest answer for questions where "none" is legitimate (e.g. no guarantee) — "answered" means addressed, not "has one". */
  quickAnswer?: { label: string; value: string };
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, color: "rgb(var(--ink-1))", fontWeight: 600, marginBottom: sub ? 3 : 6, lineHeight: 1.45 }}>
        {label}{star && <span style={{ color: "rgb(var(--warning))", marginLeft: 5 }}>★</span>}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginBottom: 7, lineHeight: 1.5 }}>{sub}</div>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={example ? `e.g. ${example}` : ""}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 64 }}
      />
      {quickAnswer && (
        <button
          onClick={() => onChange(quickAnswer.value)}
          style={{
            marginTop: 6, padding: "5px 12px", borderRadius: 20,
            border: value === quickAnswer.value ? "1.5px solid rgb(var(--ink-1))" : "1.5px solid rgb(var(--line-strong))",
            background: value === quickAnswer.value ? "rgb(var(--ink-1))" : "transparent",
            color: value === quickAnswer.value ? "rgb(var(--surface))" : "rgb(var(--ink-2))",
            fontSize: 11.5, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          {quickAnswer.label}
        </button>
      )}
    </div>
  );
}

type DnaFieldConfig = {
  key: keyof SalesDna; label: string; star?: boolean; sub?: string; example: string;
  quickAnswer?: { label: string; value: string };
};

const OFFER_CORE_FIELDS: DnaFieldConfig[] = [
  { key: "transformation", label: "What do you sell, and what changes for someone after working with you?",
    example: "People go from stuck at a W2 to doing land deals full-time" },
  { key: "root_driver", star: true, label: "Boil it all down — what's the ONE thing every client is really chasing?",
    example: "A monthly cash-flow number that replaces their job" },
  { key: "emotional_root", label: "Underneath the numbers, what are they really after?",
    example: "Freedom — being their own boss" },
  { key: "guarantee", label: "Your guarantee, if you have one",
    example: "Full refund if you don't get results in 90 days",
    // "Answered" means addressed — no guarantee is a legitimate answer, and the
    // all-questions completeness gate (salesDnaComplete) counts it as answered.
    quickAnswer: { label: "We don't offer one", value: "We don't offer a formal guarantee." } },
];

const DISCOVERY_FIELDS: DnaFieldConfig[] = [
  { key: "pain", label: "What's the problem almost everyone comes to you with?",
    example: "Grinding on sales calls themselves and can't scale" },
  { key: "desire", star: true, label: "People say their goal in different ways. What are the common ones — and what do they really come down to for you?",
    example: "'Quit my job,' '$10k months,' 'more freedom' — it all comes down to consistent monthly cash flow" },
  { key: "cost", label: "If nothing changes, what does staying stuck cost them?", sub: "There's never just one cost — it's all over the board. List a handful you hear a lot.",
    example: "Never retiring comfortably · staying buried in debt · stuck at a job they hate for years" },
  { key: "doubt", label: "Why can't they just fix this themselves? What've they usually already tried?",
    example: "Bought courses and watched YouTube but never had a coach in their corner" },
  { key: "trust", label: "Why is your way different from everything else they've tried?",
    example: "Everyone teaches theory — we build the system with you and roleplay it live" },
  { key: "money", label: "How do you know a prospect can actually afford your offer?", sub: "Money comes down to whether they've got the means. What do you ask or look for, so Wingman can tell a real money block from just nerves?",
    example: "I ask 'do you have money set aside to get started?' then probe the range so I've anchored it before the pitch" },
  { key: "support", label: "Who else is usually in on the decision, and how often does it come up?",
    example: "Almost always a spouse — I ask early if they're on board" },
];

const SYNTAX_OPTIONS: { value: SalesSyntax; label: string }[] = [
  { value: "problems", label: "Their problems" },
  { value: "goals",    label: "Their goals" },
  { value: "unsure",   label: "Not sure yet" },
];

function SalesDnaCapture({ profile }: { profile: Profile }) {
  const router = useRouter();
  const initial: SalesDna = profile.sales_dna ?? {};
  const [dna, setDna] = useState<SalesDna>({
    ...initial,
    // Legacy pre-fills until the rep sets these in the Sales DNA form itself.
    guarantee: initial.guarantee ?? profile.guarantee ?? null,
    trust: initial.trust ?? profile.unique_differentiator ?? null,
  });

  const [url, setUrl]           = useState(profile.offer_url ?? "");
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState("");
  const [overview, setOverview] = useState("");   // reference only — never stored, never sent to cards

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState("");

  // Syntax auto-detect (the "Not sure yet" fast-follow). The SELF-UPDATE happens in the
  // post-call job (it sets an "unsure" rep's syntax from how their recent calls actually
  // opened). This page just re-derives the same detection to EXPLAIN what was found:
  //   • syntax still "unsure" (post-call hasn't caught up) → an actionable "set it?" chip
  //   • syntax matches the detection → a passive "here's what we noticed" note
  const [syntaxHint, setSyntaxHint] = useState<{ detected: "problems" | "goals"; problems: number; goals: number; sample: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/wingman/detect-syntax")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setSyntaxHint(d?.detected ? d : null); })
      .catch(() => { /* non-fatal — the toggle just stays as-is */ });
    return () => { cancelled = true; };
  }, []);

  const set = (key: keyof SalesDna, val: string) => {
    setSaved(false);
    setError("");
    setDna((d) => ({ ...d, [key]: val }));
  };

  // Paste an offer URL → Wingman reads the page and returns a short OVERVIEW as a
  // memory-jogger. It does NOT fill the fields and is never stored or sent to live
  // cards — the rep's own words below are the only source of truth. A landing page
  // never has the insight the rep does; auto-filling from it would just be wrong.
  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setCrawling(true);
    setCrawlError("");
    setOverview("");
    try {
      const res = await fetch("/api/wingman/crawl-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that page");
      setOverview(typeof data.overview === "string" ? data.overview : "");
    } catch (e: unknown) {
      setCrawlError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCrawling(false);
    }
  };

  // Full-blob save: only non-empty fields are sent, and the server REPLACES the
  // whole jsonb — so clearing a field here removes it from storage. Saving from
  // either card persists both (shared state), so no card can clobber the other.
  const handleSave = async () => {
    setSaving(true);
    setError("");
    const payload: Record<string, string> = {};
    (Object.keys(dna) as (keyof SalesDna)[]).forEach((k) => {
      const v = dna[k];
      if (typeof v === "string" && v.trim()) payload[k] = v.trim();
    });
    let ok = false;
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { sales_dna: payload, offer_url: url.trim() || null } }),
      });
      ok = res.ok;
      if (!ok) console.error("[SalesDna] save failed:", res.status, await res.text().catch(() => ""));
    } catch (err) {
      console.error("[SalesDna] save network error:", err);
    }
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      // Phase 1b — the stale-copy fix (plan-review gap #1): the dashboard's
      // `profile` prop is a server snapshot from page mount, and the live-call
      // rails (summarize / dig press / warm-at-deploy) all read profile.sales_dna
      // from it. Without this refresh, "fill Sales DNA → Deploy in the same
      // session" would silently send the OLD (empty) DNA → generic cards with no
      // error. router.refresh() re-runs the server component and flows the fresh
      // profile down; local form state (this component) is untouched.
      router.refresh();
    } else {
      setError("Couldn't save — check your connection and try again.");
    }
  };

  const errorLine = error
    ? <div style={{ fontSize: 12, color: "rgb(var(--critical))", marginTop: 10 }}>⚠ {error}</div>
    : null;

  return (
    <>
      {/* The Core — offer essence (+ URL auto-fill) */}
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>The Core</SectionLabel>
        <BrainDumpNote />

        {/* Offer URL → overview (reference only) */}
        <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginBottom: 7, lineHeight: 1.5 }}>
          Got an offer page? Paste it and Wingman will pull a quick overview to jog your memory. It&apos;s just a reference — only what you write below reaches your live Wingman.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: crawlError ? 8 : (overview ? 12 : 20) }}>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
            placeholder="https://yoursite.com/offer"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            onClick={handleAnalyze}
            disabled={crawling || !url.trim()}
            style={{
              background: crawling || !url.trim() ? "rgb(var(--line))" : "rgb(var(--ink-1))",
              color: crawling || !url.trim() ? "rgb(var(--ink-2))" : "rgb(var(--surface))",
              border: "none", borderRadius: 10, padding: "0 16px",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: crawling || !url.trim() ? "not-allowed" : "pointer",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {crawling ? "Reading…" : "Analyze ↑"}
          </button>
        </div>
        {crawlError && <div style={{ fontSize: 12, color: "rgb(var(--critical))", marginBottom: 12 }}>⚠ {crawlError}</div>}
        {overview && (
          <div style={{ background: "rgb(var(--surface-sunken))", border: "1px solid rgb(var(--line-strong))", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, color: "rgb(var(--ink-3))", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              What Wingman found on your page · reference only
            </div>
            <div style={{ fontSize: 12.5, color: "rgb(var(--ink-2))", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{overview}</div>
          </div>
        )}

        {OFFER_CORE_FIELDS.map((f) => (
          <DnaField key={f.key} label={f.label} star={f.star} sub={f.sub} example={f.example}
            quickAnswer={f.quickAnswer}
            value={String(dna[f.key] ?? "")} onChange={(v) => set(f.key, v)} />
        ))}
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        {errorLine}
      </Card>

      {/* Your Discovery — how the beliefs show up (Q4–Q11) */}
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>Your Discovery</SectionLabel>
        <BrainDumpNote />

        {/* Syntax toggle */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12.5, color: "rgb(var(--ink-1))", fontWeight: 600, marginBottom: 3, lineHeight: 1.45 }}>
            On a call, do you open on their problems or their goals first?
          </div>
          <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginBottom: 9, lineHeight: 1.5 }}>
            Some reps start with what&apos;s going wrong; others start with the dream. Both work — we just match how you run it.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SYNTAX_OPTIONS.map((opt) => {
              const active = dna.syntax === opt.value;
              return (
                <button key={opt.value} onClick={() => set("syntax", opt.value)}
                  style={{
                    padding: "7px 14px", borderRadius: 20,
                    border: active ? "1.5px solid rgb(var(--ink-1))" : "1.5px solid rgb(var(--line-strong))",
                    background: active ? "rgb(var(--ink-1))" : "transparent",
                    color: active ? "rgb(var(--surface))" : "rgb(var(--ink-2))",
                    fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Fallback chip — post-call self-updates an "unsure" rep, but if they're on this
              page in the brief window before it catches up, let them confirm the tendency. */}
          {syntaxHint && dna.syntax === "unsure" && (
            <div style={{ marginTop: 10, background: "rgb(var(--signal-weak))", border: "1px solid rgb(var(--signal) / 0.25)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, color: "rgb(var(--ink-1))", lineHeight: 1.5, marginBottom: 8 }}>
                Based on your last {syntaxHint.sample} calls, you tended to open on{" "}
                <strong>{syntaxHint.detected === "problems" ? "their problems" : "their goals"}</strong> first
                {" "}({syntaxHint.detected === "problems" ? syntaxHint.problems : syntaxHint.goals}/{syntaxHint.sample}). Set that as your default?
              </div>
              <button
                onClick={() => { set("syntax", syntaxHint.detected); }}
                style={{
                  padding: "6px 14px", borderRadius: 20, border: "none",
                  background: "rgb(var(--ink-1))", color: "rgb(var(--surface))", fontSize: 12, fontWeight: 600,
                  fontFamily: "inherit", cursor: "pointer",
                }}
              >
                Set {syntaxHint.detected === "problems" ? "problems" : "goals"}-first
              </button>
            </div>
          )}

          {/* Passive "here's what we noticed" note — gated on the PERSISTED syntax (from the
              server-loaded profile), NOT the in-progress toggle, so it never claims "set for
              you" before a change is actually saved (reviewer 🟣). Shows once the post-call
              self-update has landed and matches the rep's real call pattern. */}
          {syntaxHint && profile.sales_dna?.syntax === syntaxHint.detected && (
            <div style={{ marginTop: 10, fontSize: 11.5, color: "rgb(var(--ink-2))", lineHeight: 1.5 }}>
              📊 Based on your last {syntaxHint.sample} calls, Wingman noticed you open on{" "}
              {syntaxHint.detected === "problems" ? "their problems" : "their goals"} first — so this is set for you. Change it anytime.
            </div>
          )}
        </div>

        {DISCOVERY_FIELDS.map((f) => (
          <DnaField key={f.key} label={f.label} star={f.star} sub={f.sub} example={f.example}
            value={String(dna[f.key] ?? "")} onChange={(v) => set(f.key, v)} />
        ))}
        <SaveButton saving={saving} saved={saved} onClick={handleSave} />
        {errorLine}
      </Card>
    </>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PersonalizeTab({ profile, userId }: Props) {
  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.03em" }}>Sales DNA.</div>
        <div style={{ fontSize: 14, color: "rgb(var(--ink-2))", marginTop: 3 }}>The more Wingman knows your offer and how you sell, the sharper every card gets.</div>
      </div>

      <OfferSection userId={userId} />
      <SalesDnaCapture profile={profile} />
    </div>
  );
}
