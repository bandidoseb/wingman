"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import type { VaultSignal, SignalDisplayMode } from "@/types";

interface Props {
  initialSignals: VaultSignal[];
  role: string;
  userId: string;
  displayMode: SignalDisplayMode;
}

export default function SignalVaultTab({ initialSignals, role, userId, displayMode: initialDisplayMode }: Props) {
  const [signals, setSignals] = useState<VaultSignal[]>(initialSignals);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [displayMode, setDisplayMode] = useState<SignalDisplayMode>(initialDisplayMode);
  const [saving, setSaving] = useState(false);
  const newCount = signals.filter((s) => s.is_new).length;

  const supabase = createClient();

  const toggleSignal = async (id: string) => {
    const signal = signals.find((s) => s.id === id);
    if (!signal) return;
    const newVal = !signal.is_enabled;
    setSignals((ss) => ss.map((s) => s.id === id ? { ...s, is_enabled: newVal } : s));
    await supabase.from("vault_signals").update({ is_enabled: newVal }).eq("id", id).eq("user_id", userId);
  };

  const startEdit = (sig: VaultSignal) => {
    setEditing(sig.id);
    setEditText(sig.text || "");
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("vault_signals")
      .update({ text: editText, is_new: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      setSignals((ss) => ss.map((s) => s.id === id ? { ...s, text: editText, is_new: false } : s));
    }
    setEditing(null);
    setSaving(false);
  };

  const updateDisplayMode = async (mode: SignalDisplayMode) => {
    setDisplayMode(mode);
    await supabase.from("profiles").update({ signal_display_mode: mode }).eq("id", userId);
  };

  // Group by stage
  const stages = [...new Set(signals.map((s) => s.stage))];

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Signal Vault</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>Every signal Wingman can surface. Toggle, edit, and tailor each one to your style.</div>
        {newCount > 0 && (
          <div style={{ marginTop: 10, background: "#ff3b30", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#fff", fontWeight: 600, display: "inline-block" }}>
            {newCount} new {newCount === 1 ? "signal" : "signals"} added by Wingman ↓
          </div>
        )}
      </div>

      {/* Display mode */}
      <Card style={{ marginBottom: 16, padding: "14px 18px" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Signal Display Mode</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          {[
            { id: "header" as SignalDisplayMode, label: "Header Only", desc: "Just the signal name" },
            { id: "short" as SignalDisplayMode, label: "Header + Short", desc: "Name + one suggested line" },
            { id: "full" as SignalDisplayMode, label: "Header + Full", desc: "Name + full battle card" },
          ].map((m) => (
            <div key={m.id} onClick={() => updateDisplayMode(m.id)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: `2px solid ${displayMode === m.id ? "#000" : "transparent"}`, background: "#e5e5ea", cursor: "pointer", transition: "border-color 0.15s" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e" }}>{m.label}</div>
              <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 2, lineHeight: 1.4 }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#f0faf0", borderRadius: 10, padding: "12px 14px", border: "1px solid #d1fae5" }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Preview — what pops up mid-call</div>
          <div style={{ display: "inline-flex", flexDirection: "column", gap: 6, background: "#fff", borderRadius: 10, padding: "12px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", maxWidth: 280 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#ff6b35", textTransform: "uppercase", letterSpacing: "0.06em" }}>Cost of Waiting</div>
            {(displayMode === "short" || displayMode === "full") && (
              <div style={{ fontSize: 13, color: "#1c1c1e", lineHeight: 1.4 }}>What would it cost you to still be in this same spot 12 months from now?</div>
            )}
            {displayMode === "full" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#8e8e93", lineHeight: 1.4, borderBottom: "1px solid rgba(0,0,0,0.06)", paddingBottom: 6 }}>Rep is gearing up to pitch without pressing on cost of inaction.</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.04em" }}>Option 2</div>
                <div style={{ fontSize: 13, color: "#1c1c1e", lineHeight: 1.4 }}>Walk me through what a bad week actually looks like for you.</div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {stages.map((stage) => {
        const stageSignals = signals.filter((s) => s.stage === stage);
        const color = stageSignals[0]?.stage_color || "#8e8e93";
        return (
          <div key={stage} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.06em" }}>{stage}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {stageSignals.map((sig) => (
                <Card key={sig.id} style={{ padding: "14px 16px", opacity: sig.is_enabled ? 1 : 0.5, transition: "opacity 0.2s, border-color 0.3s", border: sig.is_new ? "2px solid #ff3b30" : "2px solid transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: color }}>{sig.header}</div>
                        {sig.is_new && <div style={{ background: "#ff3b30", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>New</div>}
                        {editing !== sig.id && sig.text && sig.is_enabled && (
                          <button onClick={() => startEdit(sig)} style={{ fontSize: 11, color: "#007aff", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, fontWeight: 500 }}>Edit</button>
                        )}
                        {editing === sig.id && (
                          <>
                            <button onClick={() => saveEdit(sig.id)} disabled={saving} style={{ fontSize: 11, color: "#34c759", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, fontWeight: 600 }}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => setEditing(null)} style={{ fontSize: 11, color: "#8e8e93", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Cancel</button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#8e8e93", marginBottom: sig.text ? 8 : 0 }}>{sig.trigger}</div>
                      {sig.text && editing !== sig.id && (
                        <div style={{ background: "#e5e5ea", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#1c1c1e", lineHeight: 1.5 }}>"{sig.text}"</div>
                      )}
                      {editing === sig.id && (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          style={{ width: "100%", background: "#e5e5ea", border: "1.5px solid rgba(0,0,0,0.06)", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#1c1c1e", fontFamily: "inherit", resize: "vertical", minHeight: 56, outline: "none", lineHeight: 1.5 }}
                        />
                      )}
                    </div>
                    {/* Toggle */}
                    <div onClick={() => toggleSignal(sig.id)} style={{ width: 40, height: 24, borderRadius: 12, background: sig.is_enabled ? "#34c759" : "#e5e5ea", position: "relative", cursor: "pointer", border: `1px solid ${sig.is_enabled ? "#34c759" : "rgba(0,0,0,0.06)"}`, transition: "background 0.2s", flexShrink: 0, marginTop: 2 }}>
                      <div style={{ position: "absolute", top: 2, left: sig.is_enabled ? 17 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
