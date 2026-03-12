"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import type { VaultObjection } from "@/types";

interface Props {
  initialObjections: VaultObjection[];
  userId: string;
}

export default function ObjectionVaultTab({ initialObjections, userId }: Props) {
  const [objections, setObjections] = useState<VaultObjection[]>(initialObjections);
  const [editing, setEditing] = useState<string | null>(null);
  const [editVals, setEditVals] = useState<{ handle1: string; handle2: string }>({ handle1: "", handle2: "" });
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newObjText, setNewObjText] = useState("");

  const supabase = createClient();
  const newCount = objections.filter((o) => o.is_new).length;

  const startEdit = (obj: VaultObjection) => {
    setEditing(obj.id);
    setEditVals({ handle1: obj.handle1 || "", handle2: obj.handle2 || "" });
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("vault_objections")
      .update({ handle1: editVals.handle1, handle2: editVals.handle2, is_new: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    if (!error) {
      setObjections((os) => os.map((o) => o.id === id ? { ...o, ...editVals, is_new: false } : o));
    }
    setEditing(null);
    setSaving(false);
  };

  const addObjection = async () => {
    if (!newObjText.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("vault_objections")
      .insert({ user_id: userId, objection: newObjText.trim(), frequency: 0, handle1: "", handle2: "", is_new: false })
      .select()
      .single();

    if (!error && data) {
      setObjections((os) => [...os, data as VaultObjection]);
    }
    setNewObjText("");
    setAdding(false);
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Objection Vault</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>Every objection Wingman has heard across your calls. Edit any handle to match your voice.</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, marginTop: 16 }}>
        <div style={{ background: "#e5e5ea", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#8e8e93", fontWeight: 500 }}>{objections.length} objections tracked</div>
        {newCount > 0 && (
          <div style={{ background: "#ff3b30", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#fff", fontWeight: 600 }}>
            {newCount} new {newCount === 1 ? "item" : "items"} added by Wingman ↓
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[...objections].sort((a, b) => b.frequency - a.frequency).map((obj) => (
          <Card key={obj.id} style={{ padding: "16px 18px", border: obj.is_new ? "2px solid #ff3b30" : "2px solid transparent", transition: "border-color 0.3s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: editing === obj.id ? 14 : 10 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1c1c1e" }}>{obj.objection}</div>
                  {obj.is_new && <div style={{ background: "#ff3b30", borderRadius: 6, padding: "2px 7px", fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>New</div>}
                </div>
                <div style={{ fontSize: 11, color: "#8e8e93", marginTop: 3 }}>Heard {obj.frequency} times</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                {editing !== obj.id ? (
                  <button onClick={() => startEdit(obj)} style={{ fontSize: 11, fontWeight: 500, color: "#007aff", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Edit</button>
                ) : (
                  <>
                    <button onClick={() => saveEdit(obj.id)} disabled={saving} style={{ fontSize: 11, fontWeight: 600, color: "#34c759", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={() => setEditing(null)} style={{ fontSize: 11, fontWeight: 500, color: "#8e8e93", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>Cancel</button>
                  </>
                )}
              </div>
            </div>

            {editing !== obj.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[obj.handle1, obj.handle2].map((h, i) => h && (
                  <div key={i} style={{ background: "#e5e5ea", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1c1c1e", lineHeight: 1.5 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#8e8e93", marginRight: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Option {i + 1}</span>
                    {h}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(["handle1", "handle2"] as const).map((key, i) => (
                  <div key={key}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#8e8e93", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Option {i + 1}</div>
                    <textarea
                      value={editVals[key]}
                      onChange={(e) => setEditVals((v) => ({ ...v, [key]: e.target.value }))}
                      style={{ width: "100%", background: "#e5e5ea", border: "1.5px solid rgba(0,0,0,0.06)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "#1c1c1e", fontFamily: "inherit", resize: "vertical", minHeight: 60, outline: "none", lineHeight: 1.5 }}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add new objection */}
      {adding ? (
        <Card style={{ marginTop: 10, padding: "14px 18px" }}>
          <div style={{ fontSize: 12, color: "#8e8e93", marginBottom: 8 }}>New objection text</div>
          <input
            value={newObjText}
            onChange={(e) => setNewObjText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addObjection()}
            placeholder="e.g. I need to check with my team"
            style={{ width: "100%", background: "#e5e5ea", border: "1.5px solid rgba(0,0,0,0.06)", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#1c1c1e", fontFamily: "inherit", outline: "none", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addObjection} disabled={saving} style={{ background: "#000", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              {saving ? "Adding…" : "Add"}
            </button>
            <button onClick={() => { setAdding(false); setNewObjText(""); }} style={{ background: "#e5e5ea", color: "#8e8e93", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontFamily: "inherit", cursor: "pointer" }}>Cancel</button>
          </div>
        </Card>
      ) : (
        <div onClick={() => setAdding(true)} style={{ marginTop: 10, padding: "14px 18px", border: "1.5px dashed rgba(0,0,0,0.12)", borderRadius: 18, background: "transparent", display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#e5e5ea", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: "#8e8e93", lineHeight: 1 }}>+</span>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#1c1c1e" }}>Add objection manually</div>
            <div style={{ fontSize: 12, color: "#8e8e93" }}>Wingman will also add new ones automatically as it hears them</div>
          </div>
        </div>
      )}
    </div>
  );
}
