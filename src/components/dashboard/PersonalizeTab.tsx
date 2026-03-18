"use client";

import { useState, useEffect, useCallback } from "react";
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

const STYLE_OPTIONS = [
  "Challenger", "Consultative", "Solution-Based", "Relationship-Based",
  "SPIN", "Sandler", "Inbound", "Other",
];
const LENGTH_OPTIONS = ["< 30 min", "30–45 min", "45–60 min", "60–90 min", "90+ min"];

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

// ── Sales Style Section ────────────────────────────────────────────────────────
function StyleSection({ profile }: { profile: Profile }) {
  const [style, setStyle]   = useState(profile.sales_style || "");
  const [length, setLength] = useState(profile.call_length || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await fetch("/api/profile/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: { sales_style: style, call_length: length } }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Sales Style</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Approach</div>
          <select
            value={style}
            onChange={(e) => { setStyle(e.target.value); setSaved(false); }}
            style={{ ...inputStyle }}
          >
            <option value="">Select style…</option>
            {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Typical Call Length</div>
          <select
            value={length}
            onChange={(e) => { setLength(e.target.value); setSaved(false); }}
            style={{ ...inputStyle }}
          >
            <option value="">Select length…</option>
            {LENGTH_OPTIONS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Card>
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

// ── Objections Section ─────────────────────────────────────────────────────────
function ObjectionsSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [objections, setObjections] = useState<string[]>([]);
  const [exitLine, setExitLine]     = useState("");
  const [input, setInput]           = useState("");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [loaded, setLoaded]         = useState(false);

  useEffect(() => {
    supabase
      .from("user_onboarding_data")
      .select("objections, exit_line")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setObjections(data.objections ?? []);
          setExitLine(data.exit_line ?? "");
        }
        setLoaded(true);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addObjection = () => {
    if (!input.trim()) return;
    setSaved(false);
    setObjections((prev) => [...prev, input.trim()]);
    setInput("");
  };

  const removeObjection = (i: number) => {
    setSaved(false);
    setObjections((prev) => prev.filter((_, j) => j !== i));
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    await supabase
      .from("user_onboarding_data")
      .upsert({ user_id: userId, objections, exit_line: exitLine }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, objections, exitLine]);

  if (!loaded) return <Card style={{ marginBottom: 12 }}><div style={{ fontSize: 13, color: "#8e8e93" }}>Loading…</div></Card>;

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Common Objections</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10, minHeight: 28 }}>
        {objections.map((o, i) => (
          <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(26,74,122,0.08)", border: "1px solid rgba(26,74,122,0.18)", borderRadius: 20, padding: "5px 10px 5px 12px", fontSize: 12, color: "#1a4a7a", fontWeight: 500 }}>
            {o}
            <button onClick={() => removeObjection(i)} style={{ background: "none", border: "none", color: "#1a4a7a", fontSize: 14, cursor: "pointer", padding: 0, lineHeight: 1, opacity: 0.6 }}>×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addObjection()}
          placeholder="Add an objection…"
          style={inputStyle}
        />
        <button onClick={addObjection} style={{ background: input.trim() ? "#1c1c1e" : "#e5e5ea", color: input.trim() ? "#fff" : "#8e8e93", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}>
          Add
        </button>
      </div>

      <div style={{ fontSize: 11, color: "#8e8e93", fontWeight: 500, marginBottom: 6 }}>Exit line (DQ'd calls)</div>
      <textarea
        value={exitLine}
        onChange={(e) => { setExitLine(e.target.value); setSaved(false); }}
        placeholder="How do you wrap up a call that's not moving forward?"
        rows={3}
        style={{ ...inputStyle, resize: "none", lineHeight: 1.6 }}
      />

      <SaveButton saving={saving} saved={saved} onClick={handleSave} />
    </Card>
  );
}

// ── Website URL Section ────────────────────────────────────────────────────────
function UrlSection({ userId }: { userId: string }) {
  const supabase = createClient();
  const [url, setUrl]       = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  useEffect(() => {
    supabase
      .from("user_onboarding_data")
      .select("offer_url")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => { if (data?.offer_url) setUrl(data.offer_url); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    await supabase
      .from("user_onboarding_data")
      .upsert({ user_id: userId, offer_url: url }, { onConflict: "user_id" });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <SectionLabel>Website URL</SectionLabel>
      <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 10, lineHeight: 1.5 }}>
        Wingman will learn from this page to give sharper advice about your offer.
      </div>
      <input
        value={url}
        onChange={(e) => { setUrl(e.target.value); setSaved(false); }}
        placeholder="https://yoursite.com"
        style={inputStyle}
      />
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

      <StyleSection profile={profile} />
      <OfferSection userId={userId} />
      <ObjectionsSection userId={userId} />
      <UrlSection userId={userId} />
    </div>
  );
}
