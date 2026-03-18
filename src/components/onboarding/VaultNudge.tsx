"use client";

export default function VaultNudge({ onNext }: { onNext: () => void }) {
  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>One more thing.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>
        Wingman works best when it sounds like <em>you</em>. Before your first call, take 5 minutes to read through your vaults and rewrite anything that doesn't feel natural.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
        {[
          { emoji: "🛡️", title: "Objection Vault", desc: "Every objection handle is a template. Rewrite them in your own words so they flow naturally when you need them most.", color: "#ff3b30" },
          { emoji: "⚡", title: "Signal Vault", desc: "Every signal card is editable. If a suggested line doesn't sound like you — change it. Wingman should speak your language.", color: "#f59e0b" },
        ].map((item) => (
          <div key={item.title} style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", display: "flex", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 26, flexShrink: 0, marginTop: 2 }}>{item.emoji}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1c1c1e", marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "#8e8e93", lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          </div>
        ))}

        <div style={{ background: "#eff6ff", borderRadius: 14, padding: "16px 18px", border: "1px solid #bfdbfe" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#007aff", marginBottom: 4 }}>🔔 Vaults grow over time</div>
          <div style={{ fontSize: 13, color: "#1d4ed8", lineHeight: 1.5 }}>
            As Wingman hears new objections and patterns on your calls, it automatically adds them to your vaults. You'll see a red notification on the nav icon when something new is added — go review it and make it yours.
          </div>
        </div>
      </div>

      <button onClick={onNext} style={{ width: "100%", padding: 14, borderRadius: 12, border: "none", background: "#1c1c1e", color: "#fff", fontSize: 15, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
        Got it — let's fly
      </button>
    </div>
  );
}
