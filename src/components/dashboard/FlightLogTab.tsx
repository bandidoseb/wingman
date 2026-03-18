"use client";

import { useState, useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import OutcomeBadge from "@/components/ui/OutcomeBadge";
import type { Call } from "@/types";

interface Props {
  calls: Call[];
  initialCall: Call | null;
  onInitialCallConsumed: () => void;
  userId: string;
}

// Outcome options shown in the inline picker
const OUTCOMES = [
  { label: "Closed",     color: "#34c759", text: "#fff" },
  { label: "Follow Up",  color: "#007aff", text: "#fff" },
  { label: "DQ",         color: "#8e8e93", text: "#fff" },
  { label: "No Show",    color: "#ff9500", text: "#fff" },
] as const;

function OutcomePicker({
  callId,
  onSaved,
}: {
  callId: string;
  onSaved: (callId: string, outcome: string) => void;
}) {
  const [saving, setSaving] = useState<string | null>(null);

  const pick = async (e: React.MouseEvent, outcome: string) => {
    e.stopPropagation(); // don't open the call detail
    setSaving(outcome);
    try {
      await fetch("/api/wingman/outcome", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: callId, outcome }),
      });
      onSaved(callId, outcome);
    } catch {
      // fail silently — user can try again
    }
    setSaving(null);
  };

  return (
    <div style={{ display: "flex", gap: 5, marginTop: 7, flexWrap: "wrap" }}>
      {OUTCOMES.map((o) => (
        <button
          key={o.label}
          onClick={(e) => pick(e, o.label)}
          disabled={saving !== null}
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: 5,
            border: "none",
            background: saving === o.label ? o.color : `${o.color}22`,
            color: saving === o.label ? o.text : o.color,
            cursor: saving ? "default" : "pointer",
            fontFamily: "inherit",
            transition: "all 0.15s",
            opacity: saving && saving !== o.label ? 0.45 : 1,
          }}
        >
          {saving === o.label ? "Saving…" : o.label}
        </button>
      ))}
    </div>
  );
}

export default function FlightLogTab({ calls, initialCall, onInitialCallConsumed, userId }: Props) {
  const [selectedCall, setSelectedCall] = useState<Call | null>(initialCall);
  const [activeDetailTab, setActiveDetailTab] = useState<"debrief" | "transcript">("debrief");
  // Tracks outcomes set inline (without a full page reload)
  const [localOutcomes, setLocalOutcomes] = useState<Record<string, string>>({});

  const handleOutcomeSaved = (callId: string, outcome: string) => {
    setLocalOutcomes((prev) => ({ ...prev, [callId]: outcome }));
  };

  // Helper: effective outcome for a call (local override wins)
  const effectiveOutcome = (call: Call) => localOutcomes[call.id] ?? call.outcome;
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [globalMessages, setGlobalMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [globalInput, setGlobalInput] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const globalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialCall) {
      setSelectedCall(initialCall);
      setChatMessages([]);
      setActiveDetailTab("debrief");
      onInitialCallConsumed();
    }
  }, [initialCall, onInitialCallConsumed]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    globalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [globalMessages, globalLoading]);

  const sendGlobalMessage = async (text: string) => {
    if (!text.trim()) return;
    setGlobalMessages((prev) => [...prev, { role: "user", text }]);
    setGlobalInput("");
    setGlobalLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: "calls", calls }),
      });
      const data = await res.json();
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: data.reply || "Couldn't get a response." }]);
    } catch {
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setGlobalLoading(false);
  };

  const sendCallMessage = async (text: string, call: Call) => {
    if (!text.trim()) return;
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, context: "single_call", call }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { role: "assistant", text: data.reply || "Couldn't get a response." }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setChatLoading(false);
  };

  if (selectedCall) {
    const call = selectedCall;
    const stages = call.call_stages || [];
    const transcript = call.call_transcript || [];

    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => { setSelectedCall(null); setChatMessages([]); setActiveDetailTab("debrief"); }}
          style={{ background: "none", border: "none", color: "#8e8e93", fontSize: 13, fontFamily: "inherit", fontWeight: 500, marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          ← All Calls
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>{call.prospect_name}</div>
            <div style={{ fontSize: 13, color: "#8e8e93", marginTop: 3 }}>
              {new Date(call.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {call.duration}
            </div>
          </div>
          {effectiveOutcome(call)
            ? <OutcomeBadge outcome={effectiveOutcome(call)!} />
            : <OutcomePicker callId={call.id} onSaved={handleOutcomeSaved} />
          }
        </div>

        {call.summary && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "16px 18px", marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Debrief</div>
            <div style={{ fontSize: 13.5, color: "#1c1c1e", lineHeight: 1.6 }}>{call.summary}</div>
          </div>
        )}

        {/* Detail tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#e5e5ea", borderRadius: 10, padding: 4 }}>
          {[{ id: "debrief", label: "Debrief" }, { id: "transcript", label: "Transcript" }].map((t) => (
            <button key={t.id} onClick={() => setActiveDetailTab(t.id as "debrief" | "transcript")}
              style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", background: activeDetailTab === t.id ? "#fff" : "transparent", color: activeDetailTab === t.id ? "#1c1c1e" : "#8e8e93", boxShadow: activeDetailTab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.18s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {activeDetailTab === "debrief" && stages.length > 0 && (
          <Card>
            <SectionLabel>Stage Breakdown</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[...stages].sort((a, b) => a.display_order - b.display_order).map((s) => {
                const done = s.status === "complete";
                const skip = s.status === "skipped";
                const early = s.status === "early" || s.status === "partial";
                const lostStage = s.status === "lost";
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: done ? "#34c759" : skip ? "#e5e5ea" : early ? "#fff3cd" : lostStage ? "#fff0f0" : "#e5e5ea", color: done ? "#fff" : skip ? "#8e8e93" : early ? "#856404" : lostStage ? "#ff3b30" : "#8e8e93", border: done ? "none" : `1.5px solid ${skip ? "#e5e5ea" : early ? "#ffc107" : lostStage ? "#ff3b30" : "#e5e5ea"}` }}>
                      {done ? "✓" : skip ? "—" : early ? "!" : lostStage ? "✗" : "○"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1c1c1e" }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: "#8e8e93", marginLeft: 8 }}>{s.note}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {call.missed_topics && call.missed_topics.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <SectionLabel>Topics Missed Before Pitch</SectionLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {call.missed_topics.map((m) => (
                    <div key={m} style={{ fontSize: 11.5, color: "#ff3b30", background: "#fff0f0", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>{m}</div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {activeDetailTab === "transcript" && (
          <Card>
            <SectionLabel>Transcript</SectionLabel>
            {transcript.length === 0 ? (
              <div style={{ fontSize: 13, color: "#8e8e93" }}>No transcript available.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...transcript].sort((a, b) => a.sequence_order - b.sequence_order).map((line) => (
                  <div key={line.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: line.speaker === "You" ? "#1c1c1e" : "#8e8e93", flexShrink: 0, marginTop: 2, minWidth: 60, textAlign: "right" }}>{line.speaker}</div>
                    <div style={{ fontSize: 13, color: "#1c1c1e", lineHeight: 1.5, background: line.speaker === "You" ? "#e5e5ea" : "transparent", borderRadius: 8, padding: line.speaker === "You" ? "6px 10px" : "0", flex: 1 }}>{line.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Ask Wingman about this call */}
        <Card style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34c759", boxShadow: "0 0 6px rgba(52,199,89,0.5)", flexShrink: 0 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ask Wingman — About This Call</div>
          </div>
          {chatMessages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {["What did I do well?", "What was my biggest missed opportunity?", "What's the one thing to fix on my next call?"].map((q) => (
                <button key={q} onClick={() => sendCallMessage(q, call)} style={{ fontSize: 11.5, color: "#1c1c1e", background: "#e5e5ea", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
              ))}
            </div>
          )}
          {chatMessages.length > 0 && (
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%", background: m.role === "user" ? "#000" : "#e5e5ea", color: m.role === "user" ? "#fff" : "#1c1c1e", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
              ))}
              {chatLoading && <div style={{ alignSelf: "flex-start", background: "#e5e5ea", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>}
              <div ref={chatEndRef} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCallMessage(chatInput, call)} placeholder="Ask anything about this call…" style={{ flex: 1, background: "#e5e5ea", border: "none", borderRadius: 9, padding: "11px 14px", color: "#1c1c1e", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button onClick={() => sendCallMessage(chatInput, call)} style={{ padding: "11px 18px", background: "#1c1c1e", borderRadius: 9, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer" }}>Ask</button>
          </div>
        </Card>
      </div>
    );
  }

  // Call list view
  const wins = calls.filter((c) => c.outcome === "Closed").length;
  const qualifying = calls.filter((c) => c.outcome !== "DQ").length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.02em" }}>Flight Log</div>
        <div style={{ fontSize: 14, color: "#8e8e93", marginTop: 3 }}>Every call. Every transcript. All yours.</div>
      </div>

      {/* Mission Intel Chat */}
      <Card style={{ marginBottom: 14 }}>
        <SectionLabel>Mission Intel — Ask Your Wingman</SectionLabel>
        {globalMessages.length > 0 && (
          <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {globalMessages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "#000" : "#e5e5ea", color: m.role === "user" ? "#fff" : "#1c1c1e", borderRadius: m.role === "user" ? "12px 12px 3px 12px" : "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.45 }}>{m.text}</div>
            ))}
            {globalLoading && <div style={{ alignSelf: "flex-start", background: "#e5e5ea", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>}
            <div ref={globalEndRef} />
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {["Where do I lose most deals?", "What's my top objection?", "What works on wins?"].map((q) => (
            <button key={q} onClick={() => sendGlobalMessage(q)} style={{ fontSize: 11.5, color: "#1c1c1e", background: "#e5e5ea", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={globalInput} onChange={(e) => setGlobalInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendGlobalMessage(globalInput)} placeholder="Ask anything about your calls…" style={{ flex: 1, background: "#e5e5ea", border: "none", borderRadius: 9, padding: "11px 14px", color: "#1c1c1e", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          <button onClick={() => sendGlobalMessage(globalInput)} style={{ padding: "11px 18px", background: "#1c1c1e", borderRadius: 9, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer" }}>Ask</button>
        </div>
      </Card>

      {/* Call list */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionLabel className="!mb-0">All Calls — {calls.length}</SectionLabel>
          <div style={{ fontSize: 11.5, color: "#8e8e93", fontWeight: 500 }}>{wins}/{qualifying} closed</div>
        </div>
        {calls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#1c1c1e", marginBottom: 6 }}>No calls yet</div>
            <div style={{ fontSize: 13, color: "#8e8e93" }}>Your calls will appear here after your first session with Wingman.</div>
          </div>
        ) : (
          calls.map((call, i) => (
            <div key={call.id}
              onClick={() => { setSelectedCall(call); setChatMessages([]); setChatInput(""); setActiveDetailTab("debrief"); }}
              style={{ paddingBottom: i < calls.length - 1 ? 14 : 0, marginBottom: i < calls.length - 1 ? 14 : 0, borderBottom: i < calls.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1c1c1e" }}>{call.prospect_name}</div>
                  <div style={{ fontSize: 11.5, color: "#8e8e93", marginTop: 2 }}>
                    {new Date(call.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {call.duration}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {effectiveOutcome(call) && <OutcomeBadge outcome={effectiveOutcome(call)!} />}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#8e8e93" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
              </div>
              {call.summary && <div style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.4 }}>{call.summary}</div>}
              {!effectiveOutcome(call) && (
                <OutcomePicker callId={call.id} onSaved={handleOutcomeSaved} />
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
