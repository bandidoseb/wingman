"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import type { Profile, SalesDna, SalesSyntax } from "@/types";
import { formatPrice } from "@/lib/utils";

interface Props {
  profile: Profile;
  userId: string;
}

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

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{
        marginTop: 14,
        padding: "10px 20px",
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

  if (!loaded) return <Card style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: "#8e8e93" }}>Loading…</div></Card>;

  const mainOffer   = offers.find((o) => o.is_main) ?? offers[0];
  const otherOffers = offers.filter((o) => !o.is_main);

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Your Offer</SectionLabel>

      {/* Main offer */}
      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Main offer</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={mainOffer?.name ?? ""}
          onChange={(e) => updateOffer(0, "name", e.target.value)}
          placeholder="Offer name"
          style={{ ...inputStyle, flex: 1 }}
        />
        <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#aeaeb2", pointerEvents: "none" }}>$</span>
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
          <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Downsells & other offers</div>
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
                    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#aeaeb2", pointerEvents: "none" }}>$</span>
                    <input
                      value={o.price}
                      onChange={(e) => updateOffer(realIdx, "price", e.target.value)}
                      placeholder="5,000"
                      style={{ ...inputStyle, paddingLeft: 24 }}
                    />
                  </div>
                  <button onClick={() => removeOffer(realIdx)} style={{ background: "none", border: "none", color: "#aeaeb2", fontSize: 18, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {offers.length < 5 && (
        <button onClick={addOffer} style={{ background: "none", border: "none", color: "#8e8e93", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
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
    <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 16, lineHeight: 1.55 }}>
      The more you dump here, the smarter your Wingman gets — don&apos;t hold back, Wingman will make sense of it.
    </div>
  );
}

function DnaField({ label, star, sub, example, value, onChange }: {
  label: string; star?: boolean; sub?: string; example: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, color: "#1c1c1e", fontWeight: 600, marginBottom: sub ? 3 : 6, lineHeight: 1.45 }}>
        {label}{star && <span style={{ color: "#ff9500", marginLeft: 5 }}>★</span>}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: "#8e8e93", marginBottom: 7, lineHeight: 1.5 }}>{sub}</div>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={example ? `e.g. ${example}` : ""}
        rows={3}
        style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 64 }}
      />
    </div>
  );
}

type DnaFieldConfig = { key: keyof SalesDna; label: string; star?: boolean; sub?: string; example: string };

const OFFER_CORE_FIELDS: DnaFieldConfig[] = [
  { key: "transformation", label: "What do you sell, and what changes for someone after working with you?",
    example: "People go from stuck at a W2 to doing land deals full-time" },
  { key: "root_driver", star: true, label: "Boil it all down — what's the ONE thing every client is really chasing?",
    example: "A monthly cash-flow number that replaces their job" },
  { key: "emotional_root", label: "Underneath the numbers, what are they really after?",
    example: "Freedom — being their own boss" },
  { key: "guarantee", label: "Your guarantee, if you have one",
    example: "Full refund if you don't get results in 90 days" },
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
    } else {
      setError("Couldn't save — check your connection and try again.");
    }
  };

  const errorLine = error
    ? <div style={{ fontSize: 12, color: "#c0392b", marginTop: 10 }}>⚠ {error}</div>
    : null;

  return (
    <>
      {/* The Core — offer essence (+ URL auto-fill) */}
      <Card style={{ marginBottom: 12 }}>
        <SectionLabel>The Core</SectionLabel>
        <BrainDumpNote />

        {/* Offer URL → overview (reference only) */}
        <div style={{ fontSize: 11.5, color: "#8e8e93", marginBottom: 7, lineHeight: 1.5 }}>
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
              background: crawling || !url.trim() ? "#e5e5ea" : "#1c1c1e",
              color: crawling || !url.trim() ? "#8e8e93" : "#fff",
              border: "none", borderRadius: 10, padding: "0 16px",
              fontSize: 13, fontWeight: 600, fontFamily: "inherit",
              cursor: crawling || !url.trim() ? "not-allowed" : "pointer",
              flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {crawling ? "Reading…" : "Analyze ↑"}
          </button>
        </div>
        {crawlError && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 12 }}>⚠ {crawlError}</div>}
        {overview && (
          <div style={{ background: "#f7f7fb", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 10, padding: "12px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: 10.5, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 6 }}>
              What Wingman found on your page · reference only
            </div>
            <div style={{ fontSize: 12.5, color: "#3a3a3c", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{overview}</div>
          </div>
        )}

        {OFFER_CORE_FIELDS.map((f) => (
          <DnaField key={f.key} label={f.label} star={f.star} sub={f.sub} example={f.example}
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
          <div style={{ fontSize: 12.5, color: "#1c1c1e", fontWeight: 600, marginBottom: 3, lineHeight: 1.45 }}>
            On a call, do you open on their problems or their goals first?
          </div>
          <div style={{ fontSize: 11.5, color: "#8e8e93", marginBottom: 9, lineHeight: 1.5 }}>
            Some reps start with what&apos;s going wrong; others start with the dream. Both work — we just match how you run it.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {SYNTAX_OPTIONS.map((opt) => {
              const active = dna.syntax === opt.value;
              return (
                <button key={opt.value} onClick={() => set("syntax", opt.value)}
                  style={{
                    padding: "7px 14px", borderRadius: 20,
                    border: active ? "1.5px solid #1c1c1e" : "1.5px solid rgba(0,0,0,0.12)",
                    background: active ? "#1c1c1e" : "transparent",
                    color: active ? "#fff" : "#3a3a3c",
                    fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
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
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em" }}>Sales DNA.</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>The more Wingman knows your offer and how you sell, the sharper every card gets.</div>
      </div>

      <OfferSection userId={userId} />
      <SalesDnaCapture profile={profile} />
    </div>
  );
}
