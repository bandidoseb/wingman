"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import type { Profile } from "@/types";
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

// ── Your Offer Section ────────────────────────────────────────────────────────
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

const WEAKNESS_OPTIONS = [
  { value: "too_much_talking", label: "I talk too much in discovery" },
  { value: "not_pressing",     label: "I don't press hard enough" },
  { value: "rush_pitch",       label: "I rush to pitch" },
  { value: "fold_price",       label: "I fold on price" },
  { value: "objections",       label: "I struggle with objections" },
];

const DEAL_LOSS_OPTIONS = [
  { value: "discovery",      label: "Discovery" },
  { value: "pressing_pain",  label: "Pressing pain" },
  { value: "pitching",       label: "Pitching" },
  { value: "price_reveal",   label: "Price reveal" },
  { value: "partner_spouse", label: "Partner / spouse" },
  { value: "follow_up",      label: "Follow-up" },
];

const LEAD_SOURCE_OPTIONS = [
  { value: "vsl_webinar", label: "VSL / Webinar" },
  { value: "referral", label: "Referral" },
  { value: "organic_content", label: "Organic Content" },
  { value: "paid_ads", label: "Paid Ads" },
  { value: "cold_outreach", label: "Cold Outreach" },
  { value: "other", label: "Other" },
];

// ── Offer Crawl Section ────────────────────────────────────────────────────────
function OfferCrawlSection({ profile, userId }: { profile: Profile; userId: string }) {
  // URL state
  const [url, setUrl] = useState(profile.offer_url ?? "");

  // Crawl state
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState("");

  // Editable fields — always visible
  const [idealClient, setIdealClient]       = useState(profile.ideal_client ?? "");
  const [differentiator, setDifferentiator] = useState(profile.unique_differentiator ?? "");
  const [guarantee, setGuarantee]           = useState(profile.guarantee ?? "");

  // Multi-select lead sources — stored as JSON array string in DB
  const [leadSources, setLeadSources]         = useState<string[]>(() => {
    try { return JSON.parse(profile.lead_source ?? "[]"); } catch { return []; }
  });
  const [leadSourceOther, setLeadSourceOther] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const toggleLeadSource = (value: string) => {
    setSaved(false);
    setLeadSources((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const handleCrawl = async () => {
    if (!url.trim()) return;
    setCrawling(true);
    setCrawlError("");
    try {
      const res = await fetch("/api/wingman/crawl-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Crawl failed");
      if (data.ideal_client)          setIdealClient(data.ideal_client);
      if (data.unique_differentiator) setDifferentiator(data.unique_differentiator);
      if (data.guarantee)             setGuarantee(data.guarantee);
      setSaved(false);
    } catch (e: unknown) {
      setCrawlError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCrawling(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Merge "other" custom text into the array
    const finalSources = leadSources.includes("other") && leadSourceOther.trim()
      ? [...leadSources.filter((v) => v !== "other"), `other:${leadSourceOther.trim()}`]
      : leadSources;

    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: {
          offer_url:             url.trim() || null,
          ideal_client:          idealClient.trim() || null,
          unique_differentiator: differentiator.trim() || null,
          guarantee:             guarantee.trim() || null,
          lead_source:           finalSources.length > 0 ? JSON.stringify(finalSources) : null,
        },
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Offer Intelligence</SectionLabel>
      <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 12, lineHeight: 1.5 }}>
        Paste your offer page URL and Wingman will auto-fill what it learns. Edit anything before saving.
      </div>

      {/* URL + crawl button */}
      <div style={{ display: "flex", gap: 8, marginBottom: crawlError ? 8 : 20 }}>
        <input
          value={url}
          onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
          placeholder="https://yoursite.com/offer"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={handleCrawl}
          disabled={crawling || !url.trim()}
          style={{
            background: crawling || !url.trim() ? "#e5e5ea" : "#1c1c1e",
            color: crawling || !url.trim() ? "#8e8e93" : "#fff",
            border: "none",
            borderRadius: 10,
            padding: "0 16px",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: crawling || !url.trim() ? "not-allowed" : "pointer",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {crawling ? "Reading…" : "Auto-fill ↑"}
        </button>
      </div>

      {crawlError && (
        <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 12 }}>
          ⚠ {crawlError}
        </div>
      )}

      <div style={{ height: 1, background: "rgba(0,0,0,0.06)", marginBottom: 16 }} />

      {/* Who you sell to */}
      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Who you sell to</div>
      <textarea
        value={idealClient}
        onChange={(e) => { setIdealClient(e.target.value); setSaved(false); }}
        placeholder="e.g. Online coaches doing $5–20k/month who want to scale without burning out"
        rows={2}
        style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 12 }}
      />

      {/* Differentiator */}
      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>What makes your offer different</div>
      <textarea
        value={differentiator}
        onChange={(e) => { setDifferentiator(e.target.value); setSaved(false); }}
        placeholder="e.g. The only program with a guaranteed signed client in 30 days or you don't pay"
        rows={2}
        style={{ ...inputStyle, resize: "none", lineHeight: 1.6, marginBottom: 12 }}
      />

      {/* Guarantee */}
      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Your guarantee (if any)</div>
      <input
        value={guarantee}
        onChange={(e) => { setGuarantee(e.target.value); setSaved(false); }}
        placeholder="e.g. Full refund if you don't get results in 90 days"
        style={{ ...inputStyle, marginBottom: 16 }}
      />

      {/* Lead source — multi-select */}
      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 10 }}>
        Where do your leads come from? <span style={{ fontWeight: 400 }}>(select all that apply)</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: leadSources.includes("other") ? 8 : 4 }}>
        {LEAD_SOURCE_OPTIONS.map((opt) => {
          const active = leadSources.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggleLeadSource(opt.value)}
              style={{
                padding: "7px 14px",
                borderRadius: 20,
                border: active ? "1.5px solid #1c1c1e" : "1.5px solid rgba(0,0,0,0.12)",
                background: active ? "#1c1c1e" : "transparent",
                color: active ? "#fff" : "#3a3a3c",
                fontSize: 12,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {leadSources.includes("other") && (
        <input
          value={leadSourceOther}
          onChange={(e) => { setLeadSourceOther(e.target.value); setSaved(false); }}
          placeholder="Describe your lead source…"
          style={{ ...inputStyle, marginTop: 4, marginBottom: 4 }}
        />
      )}

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Card>
  );
}

// ── Call Coaching Section ──────────────────────────────────────────────────────
function CallCoachingSection({ profile }: { profile: Profile }) {
  const [weaknesses,      setWeaknesses]      = useState<string[]>(() => { try { return JSON.parse(profile.call_weakness   ?? "[]"); } catch { return []; } });
  const [dealLoss,        setDealLoss]        = useState<string[]>(() => { try { return JSON.parse(profile.deal_loss_stage ?? "[]"); } catch { return []; } });

  const [weaknessInput,   setWeaknessInput]   = useState("");
  const [weaknessAdding,  setWeaknessAdding]  = useState(false);
  const [weaknessHovered, setWeaknessHovered] = useState<string | null>(null);

  const [dealLossInput,   setDealLossInput]   = useState("");
  const [dealLossAdding,  setDealLossAdding]  = useState(false);
  const [dealLossHovered, setDealLossHovered] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const toggle = (arr: string[], set: (v: string[]) => void, value: string) => {
    setSaved(false);
    set(arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]);
  };

  const addCustom = (
    arr: string[], set: (v: string[]) => void,
    input: string, setInput: (v: string) => void, setAdding: (v: boolean) => void
  ) => {
    const val = input.trim();
    if (val && !arr.includes(val)) { set([...arr, val]); setSaved(false); }
    setInput(""); setAdding(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: {
          call_weakness:   weaknesses.length > 0 ? JSON.stringify(weaknesses) : null,
          deal_loss_stage: dealLoss.length   > 0 ? JSON.stringify(dealLoss)   : null,
        },
      }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const activePillStyle: React.CSSProperties = {
    padding: "7px 14px", borderRadius: 20,
    border: "1.5px solid #1c1c1e", background: "#1c1c1e",
    color: "#fff", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
    cursor: "pointer", transition: "all 0.15s ease",
    display: "inline-flex", alignItems: "center", gap: 5,
  };
  const inactivePillStyle: React.CSSProperties = {
    ...activePillStyle, border: "1.5px solid rgba(0,0,0,0.12)",
    background: "transparent", color: "#3a3a3c",
  };
  const addPillStyle: React.CSSProperties = {
    ...inactivePillStyle, border: "1.5px dashed rgba(0,0,0,0.18)", color: "#8e8e93",
  };

  const renderPills = (
    options: { value: string; label: string }[],
    selected: string[], setSelected: (v: string[]) => void,
    adding: boolean, setAdding: (v: boolean) => void,
    inputVal: string, setInputVal: (v: string) => void,
    hovered: string | null, setHovered: (v: string | null) => void,
  ) => {
    const customItems = selected.filter(v => !options.find(o => o.value === v));
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map(opt => (
          <button key={opt.value} onClick={() => toggle(selected, setSelected, opt.value)}
            style={selected.includes(opt.value) ? activePillStyle : inactivePillStyle}>
            {opt.label}
          </button>
        ))}
        {customItems.map(v => (
          <button key={v}
            onMouseEnter={() => setHovered(v)} onMouseLeave={() => setHovered(null)}
            onClick={() => { setSaved(false); setSelected(selected.filter(x => x !== v)); }}
            style={activePillStyle}>
            {v}
            {hovered === v && <span style={{ fontSize: 10, opacity: 0.65 }}>✕</span>}
          </button>
        ))}
        {!adding ? (
          <button onClick={() => setAdding(true)} style={addPillStyle}>+ Add your own</button>
        ) : (
          <input autoFocus value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") addCustom(selected, setSelected, inputVal, setInputVal, setAdding);
              if (e.key === "Escape") { setAdding(false); setInputVal(""); }
            }}
            onBlur={() => {
              if (inputVal.trim()) addCustom(selected, setSelected, inputVal, setInputVal, setAdding);
              else { setAdding(false); setInputVal(""); }
            }}
            placeholder="Type and press enter…"
            style={{ ...inputStyle, width: 180, padding: "6px 12px", fontSize: 12 }}
          />
        )}
      </div>
    );
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Call Coaching</SectionLabel>

      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 10 }}>
        What&apos;s your biggest weakness on calls?{" "}
        <span style={{ fontWeight: 400 }}>(select all that apply)</span>
      </div>
      {renderPills(
        WEAKNESS_OPTIONS, weaknesses, setWeaknesses,
        weaknessAdding, setWeaknessAdding,
        weaknessInput, setWeaknessInput,
        weaknessHovered, setWeaknessHovered,
      )}

      <div style={{ height: 1, background: "rgba(0,0,0,0.06)", margin: "16px 0" }} />

      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 10 }}>
        Where do you lose most deals?{" "}
        <span style={{ fontWeight: 400 }}>(select all that apply)</span>
      </div>
      {renderPills(
        DEAL_LOSS_OPTIONS, dealLoss, setDealLoss,
        dealLossAdding, setDealLossAdding,
        dealLossInput, setDealLossInput,
        dealLossHovered, setDealLossHovered,
      )}

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PersonalizeTab({ profile, userId }: Props) {
  return (
    <div style={{ maxWidth: 580, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 26, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em" }}>Personalize Wingman.</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>The more it knows, the sharper it gets.</div>
      </div>

      <OfferSection userId={userId} />
      <OfferCrawlSection profile={profile} userId={userId} />
      <CallCoachingSection profile={profile} />
    </div>
  );
}
