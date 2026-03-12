"use client";
import { useState } from "react";
import type { Role } from "@/types";

export default function PickRole({ onNext }: { onNext: (role: Role) => void }) {
  const [selected, setSelected] = useState<Role | null>(null);
  const roles = [
    { id: "closer" as Role, emoji: "🔥", title: "Closer", desc: "I run closing calls and present offers" },
    { id: "setter" as Role, emoji: "📞", title: "Setter", desc: "I qualify leads and book appointments" },
  ];

  return (
    <div style={{ maxWidth: 440, margin: "0 auto" }}>
      <div style={{ fontSize: 24, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.03em", marginBottom: 6 }}>Pick your role.</div>
      <div style={{ fontSize: 14, color: "#8e8e93", lineHeight: 1.6, marginBottom: 28 }}>Different roles, different playbooks. Pick yours.</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {roles.map((r) => (
          <div
            key={r.id}
            onClick={() => { setSelected(r.id); setTimeout(() => onNext(r.id), 250); }}
            style={{
              background: "#fff", borderRadius: 14, padding: "18px 20px",
              border: `2px solid ${selected === r.id ? "#000" : "transparent"}`,
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
              transition: "border-color 0.15s",
            }}
          >
            <div style={{ fontSize: 28 }}>{r.emoji}</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1c1c1e" }}>{r.title}</div>
              <div style={{ fontSize: 13, color: "#8e8e93", marginTop: 2 }}>{r.desc}</div>
            </div>
            <div style={{
              marginLeft: "auto", width: 22, height: 22, borderRadius: "50%",
              border: `2px solid ${selected === r.id ? "#000" : "#e5e5ea"}`,
              background: selected === r.id ? "#000" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {selected === r.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff" }} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
