"use client";
import { useState } from "react";
import { formatPrice } from "@/lib/utils";

const inputStyle: React.CSSProperties = {
  background: "#e5e5ea", border: "2px solid transparent",
  borderRadius: 10, padding: "12px 14px", color: "#1c1c1e",
  fontSize: 13, fontFamily: "inherit", outline: "none", width: "100%",
};

function PriceInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: "relative", width: 110, flexShrink: 0 }}>
      <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: value ? "#1c1c1e" : "#aeaeb2", pointerEvents: "none" }}>$</span>
      <input
        value={value}
        onChange={(e) => onChange(formatPrice(e.target.value))}
        placeholder="10,000"
        style={{ ...inputStyle, paddingLeft: 24 }}
      />
    </div>
  );
}

interface OtherOffer { id: number; name: string; price: string; }

export default function YourOffer({
  onNext,
}: {
  onNext: (mainName: string, mainPrice: string, others: Array<{ name: string; price: string }>) => void;
}) {
  const [mainName, setMainName] = useState("");
  const [mainPrice, setMainPrice] = useState("");
  const [others, setOthers] = useState<OtherOffer[]>([{ id: 1, name: "", price: "" }]);

  const addOffer = () => setOthers((o) => [...o, { id: Date.now(), name: "", price: "" }]);
  const updateOther = (id: number, field: "name" | "price", val: string) =>
    setOthers((o) => o.map((x) => x.id === id ? { ...x, [field]: val } : x));
  const removeOther = (id: number) => setOthers((o) => o.filter((x) => x.id !== id));

  const handleNext = () => {
    if (!mainName) return;
    onNext(mainName, mainPrice, others.filter((o) => o.name));
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>Brief your Wingman.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>The best co-pilots study the mission before takeoff. Tell us what you're selling.</div>

      <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Your main offer</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input value={mainName} onChange={(e) => setMainName(e.target.value)} placeholder="Offer name" style={{ ...inputStyle, flex: 1 }} />
        <PriceInput value={mainPrice} onChange={setMainPrice} />
      </div>

      <div style={{ fontSize: 11, color: "#aeaeb2", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 14 }}>Downsells & other offers</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {others.map((o) => (
          <div key={o.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={o.name} onChange={(e) => updateOther(o.id, "name", e.target.value)} placeholder="Offer name" style={{ ...inputStyle, flex: 1 }} />
            <PriceInput value={o.price} onChange={(v) => updateOther(o.id, "price", v)} />
            {others.length > 1 && (
              <button onClick={() => removeOther(o.id)} style={{ background: "none", border: "none", color: "#aeaeb2", fontSize: 20, cursor: "pointer", padding: "0 2px", flexShrink: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        ))}
      </div>

      {others.length < 4 && (
        <button onClick={addOffer} style={{ background: "none", border: "none", color: "#8e8e93", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: 28, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add another offer
        </button>
      )}
      {others.length >= 4 && <div style={{ marginBottom: 28 }} />}

      <button
        onClick={handleNext}
        style={{
          width: "100%", padding: 14, borderRadius: 12, border: "none",
          background: "#1c1c1e", color: "#fff", fontSize: 15, fontWeight: 600,
          fontFamily: "inherit", cursor: mainName ? "pointer" : "not-allowed",
          opacity: mainName ? 1 : 0.35,
        }}
      >
        Build my Wingman
      </button>
    </div>
  );
}
