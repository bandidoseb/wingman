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
  const [otherMode, setOtherMode] = useState(false);
  const [otherText, setOtherText] = useState("");

  const pick = async (e: React.MouseEvent, outcome: string) => {
    e.stopPropagation();
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

  const pickOther = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!otherText.trim()) return;
    setSaving("Other");
    try {
      await fetch("/api/wingman/outcome", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: callId, outcome: otherText.trim() }),
      });
      onSaved(callId, otherText.trim());
    } catch {}
    setSaving(null);
    setOtherMode(false);
  };

  const ghostPill: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 600,
    padding: "3px 9px",
    borderRadius: 5,
    background: "transparent",
    fontFamily: "inherit",
    transition: "all 0.15s",
    cursor: saving ? "default" : "pointer",
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, marginTop: 8, marginBottom: 5, letterSpacing: "0.06em" }}>
        LOG OUTCOME
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {OUTCOMES.map((o) => (
          <button
            key={o.label}
            onClick={(e) => pick(e, o.label)}
            disabled={saving !== null}
            style={{
              ...ghostPill,
              border: `1.5px solid ${o.color}`,
              background: saving === o.label ? o.color : "transparent",
              color: saving === o.label ? o.text : o.color,
              opacity: saving && saving !== o.label ? 0.4 : 1,
            }}
          >
            {saving === o.label ? "Saving…" : o.label}
          </button>
        ))}

        {/* Other pill / inline input */}
        {!otherMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOtherMode(true); }}
            disabled={saving !== null}
            style={{ ...ghostPill, border: "1.5px solid #8e8e93", color: "#8e8e93", opacity: saving ? 0.4 : 1 }}
          >
            Other
          </button>
        ) : (
          <>
            <input
              autoFocus
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") pickOther(e);
                if (e.key === "Escape") { setOtherMode(false); setOtherText(""); }
              }}
              onClick={(e) => e.stopPropagation()}
              placeholder="Describe outcome…"
              style={{
                fontSize: 10.5,
                padding: "3px 8px",
                borderRadius: 5,
                border: "1.5px solid #8e8e93",
                outline: "none",
                fontFamily: "inherit",
                color: "#1c1c1e",
                width: 140,
              }}
            />
            <button
              onClick={pickOther}
              disabled={saving !== null || !otherText.trim()}
              style={{ ...ghostPill, border: "1.5px solid #007aff", color: "#007aff", opacity: !otherText.trim() ? 0.4 : 1 }}
            >
              {saving === "Other" ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function FlightLogTab({ calls, initialCall, onInitialCallConsumed, userId }: Props) {
  const [selectedCall, setSelectedCall] = useState<Call | null>(initialCall);
  const [activeDetailTab, setActiveDetailTab] = useState<"debrief" | "transcript">("debrief");
  // Tracks outcomes set inline (without a full page reload)
  const [localOutcomes, setLocalOutcomes] = useState<Record<string, string>>({});
  const [editingOutcomes, setEditingOutcomes] = useState<Record<string, boolean>>({});
  const [hoveredCallId, setHoveredCallId] = useState<string | null>(null);

  const handleOutcomeSaved = (callId: string, outcome: string) => {
    setLocalOutcomes((prev) => ({ ...prev, [callId]: outcome }));
    setEditingOutcomes((prev) => ({ ...prev, [callId]: false }));
  };

  // Helper: effective outcome for a call (local override wins)
  const effectiveOutcome = (call: Call) => localOutcomes[call.id] ?? call.outcome;
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [globalMessages, setGlobalMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [globalInput, setGlobalInput] = useState("");
  const [globalLoading, setGlobalLoading] = useState(false);
  const chatEndRef        = useRef<HTMLDivElement>(null);
  const globalEndRef      = useRef<HTMLDivElement>(null);
  const modalEndRef       = useRef<HTMLDivElement>(null);
  const modalInputRef     = useRef<HTMLTextAreaElement>(null);
  const callInputRef      = useRef<HTMLTextAreaElement>(null);
  const globalInFlightRef   = useRef(false); // prevents double-sends during the 2s reading delay
  const callInFlightRef     = useRef(false);
  const [userIsTyping, setUserIsTyping] = useState(false);
  const userTypingTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (initialCall) {
      setSelectedCall(initialCall);
      setChatMessages([]);
      setActiveDetailTab("debrief");
      onInitialCallConsumed();
    }
  }, [initialCall, onInitialCallConsumed]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chatMessages, chatLoading]);

  useEffect(() => {
    globalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [globalMessages, globalLoading]);

  // Auto-focus modal input when it opens
  useEffect(() => {
    if (modalOpen) setTimeout(() => modalInputRef.current?.focus(), 50);
  }, [modalOpen]);

  // Scroll modal to bottom when messages update
  useEffect(() => {
    if (modalOpen) modalEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [globalMessages, globalLoading, modalOpen]);

  // ESC closes modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setModalOpen(false); };
    if (modalOpen) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [modalOpen]);

  // Clean up debounce timer on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => { if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current); };
  }, []);

  // Restore global chat conversation from localStorage on mount (24-hour TTL)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wingman_global_chat");
      if (stored) {
        const { messages, savedAt } = JSON.parse(stored);
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (Date.now() - savedAt < oneDayMs && messages?.length > 0) {
          setGlobalMessages(messages);
        } else {
          localStorage.removeItem("wingman_global_chat");
        }
      }
    } catch { /* ignore corrupted data */ }
  }, []);

  // Save global chat conversation to localStorage whenever messages change
  useEffect(() => {
    if (globalMessages.length === 0) return;
    try {
      localStorage.setItem("wingman_global_chat", JSON.stringify({
        messages: globalMessages,
        savedAt: Date.now(),
      }));
    } catch { /* ignore if storage quota exceeded */ }
  }, [globalMessages]);

  const sendGlobalMessage = async (text: string) => {
    if (!text.trim() || globalInFlightRef.current) return;
    globalInFlightRef.current = true;
    const newMessage = { role: "user" as const, text };
    setGlobalMessages((prev) => [...prev, newMessage]);
    setGlobalInput("");
    if (modalInputRef.current) modalInputRef.current.style.height = "auto";
    // Reset typing state immediately so it doesn't mask the indicator after send
    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    setUserIsTyping(false);

    // Strip transcript data — payload would be too large for global context
    const callSummaries = calls.map((c) => ({
      prospect_name: c.prospect_name,
      outcome:       c.outcome,
      call_date:     c.call_date,
      duration:      c.duration,
      summary:       c.summary,
      missed_topics: c.missed_topics,
    }));

    // Last 9 existing turns + the new one → API receives up to 10 turns total
    const messages = [...globalMessages.slice(-9), newMessage].map((m) => ({
      role:    m.role,
      content: m.text,
    }));

    // Kick off API immediately so Wingman starts processing — but hold the typing
    // indicator for 2 seconds so it looks like Wingman is reading first
    const fetchPromise = fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "global", messages, callSummaries }),
    });

    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    setGlobalLoading(true);

    try {
      const res = await fetchPromise;
      const data = await res.json();
      if (data.limitReached) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "You've hit today's coaching limit. Come back tomorrow — or upgrade to Pro for unlimited sessions." }]);
      } else {
        const reply  = data.reply || "Couldn't get a response.";
        const chunks = reply.split("\n\n").filter(Boolean);
        if (chunks.length <= 1) {
          setGlobalMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        } else {
          // Stagger bubbles: first lands immediately, each subsequent after 1.4s
          // Typing indicator stays on until the last bubble is added
          for (let i = 0; i < chunks.length; i++) {
            if (i > 0) await new Promise<void>(resolve => setTimeout(resolve, 3000));
            setGlobalMessages((prev) => [...prev, { role: "assistant", text: chunks[i] }]);
          }
        }
      }
    } catch {
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setGlobalLoading(false);
    globalInFlightRef.current = false;
  };

  const sendCallMessage = async (text: string, call: Call) => {
    if (!text.trim() || callInFlightRef.current) return;
    callInFlightRef.current = true;
    const newMessage = { role: "user" as const, text };
    setChatMessages((prev) => [...prev, newMessage]);
    setChatInput("");
    if (callInputRef.current) callInputRef.current.style.height = "auto";
    // Reset typing state immediately so it doesn't mask the indicator after send
    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    setUserIsTyping(false);

    // Last 9 existing turns + the new one → API receives up to 10 turns total
    const messages = [...chatMessages.slice(-9), newMessage].map((m) => ({
      role:    m.role,
      content: m.text,
    }));

    // Kick off API immediately — hold typing indicator 2s so it looks like Wingman is reading
    const fetchPromise = fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "single_call", messages, call }),
    });

    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    setChatLoading(true);

    try {
      const res = await fetchPromise;
      const data = await res.json();
      if (data.limitReached) {
        setChatMessages((prev) => [...prev, { role: "assistant", text: "You've hit today's coaching limit. Come back tomorrow — or upgrade to Pro for unlimited sessions." }]);
      } else {
        const reply  = data.reply || "Couldn't get a response.";
        const chunks = reply.split("\n\n").filter(Boolean);
        if (chunks.length <= 1) {
          setChatMessages((prev) => [...prev, { role: "assistant", text: reply }]);
        } else {
          for (let i = 0; i < chunks.length; i++) {
            if (i > 0) await new Promise<void>(resolve => setTimeout(resolve, 3000));
            setChatMessages((prev) => [...prev, { role: "assistant", text: chunks[i] }]);
          }
        }
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again." }]);
    }
    setChatLoading(false);
    callInFlightRef.current = false;
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
              {chatMessages.map((m, i) =>
                m.role === "assistant"
                  ? m.text.split("\n\n").filter(Boolean).map((chunk, ci) => (
                      <div key={`${i}-${ci}`} style={{ alignSelf: "flex-start", maxWidth: "88%", background: "#e5e5ea", color: "#1c1c1e", borderRadius: "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{chunk}</div>
                    ))
                  : <div key={i} style={{ alignSelf: "flex-end", maxWidth: "88%", background: "#1c1c1e", color: "#fff", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
              )}
              {chatLoading && !userIsTyping && <div style={{ alignSelf: "flex-start", background: "#e5e5ea", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>}
              <div ref={chatEndRef} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              ref={callInputRef}
              value={chatInput}
              rows={1}
              onChange={(e) => {
                setChatInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                setUserIsTyping(true);
                if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
                userTypingTimerRef.current = setTimeout(() => setUserIsTyping(false), 1000);
              }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendCallMessage(chatInput, call); } }}
              placeholder="Ask anything about this call…"
              style={{ flex: 1, background: "#e5e5ea", border: "none", borderRadius: 9, padding: "11px 14px", color: "#1c1c1e", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", overflow: "auto", lineHeight: 1.4, boxSizing: "border-box" }}
            />
            <button onClick={() => sendCallMessage(chatInput, call)} style={{ padding: "11px 18px", background: "#1c1c1e", borderRadius: 9, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>Ask</button>
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

      {/* Mission Intel — entry point, opens modal */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <SectionLabel className="!mb-0">Mission Intel — Ask Your Wingman</SectionLabel>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
          {["Where do I lose most deals?", "What's my top objection?", "What works on wins?"].map((q) => (
            <button key={q} onClick={() => { setModalOpen(true); sendGlobalMessage(q); }} style={{ fontSize: 11.5, color: "#1c1c1e", background: "#e5e5ea", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input readOnly onClick={() => setModalOpen(true)} placeholder="Ask anything about your calls…" style={{ flex: 1, background: "#e5e5ea", border: "none", borderRadius: 9, padding: "11px 14px", color: "#8e8e93", fontSize: 13, fontFamily: "inherit", outline: "none", cursor: "pointer" }} />
          <button onClick={() => setModalOpen(true)} style={{ padding: "11px 18px", background: "#1c1c1e", borderRadius: 9, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer" }}>Ask</button>
        </div>
        {globalMessages.length > 0 && (() => {
          const lastWingman = [...globalMessages].reverse().find(m => m.role === "assistant");
          if (!lastWingman) return null;
          const preview = lastWingman.text.length > 70 ? lastWingman.text.slice(0, 70) + "…" : lastWingman.text;
          return (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 }}>
                <div style={{ flex: 1, height: 1, background: "#e5e5ea" }} />
                <span style={{ fontSize: 11, color: "#8e8e93", fontFamily: "inherit", whiteSpace: "nowrap" }}>Previous conversation from today</span>
                <div style={{ flex: 1, height: 1, background: "#e5e5ea" }} />
              </div>
              <button
                onClick={() => setModalOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", width: "100%" }}
              >
                <div style={{ background: "#dde8f5", borderRadius: 10, padding: "8px 12px", fontSize: 12.5, color: "#1c1c1e", flex: 1, textAlign: "left", lineHeight: 1.4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "inherit" }}>
                  {preview}
                </div>
                <span style={{ fontSize: 11.5, color: "#007aff", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>
                  Continue →
                </span>
              </button>
            </>
          );
        })()}
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
              onMouseEnter={() => setHoveredCallId(call.id)}
              onMouseLeave={() => setHoveredCallId(null)}
              style={{ paddingBottom: i < calls.length - 1 ? 14 : 0, marginBottom: i < calls.length - 1 ? 14 : 0, borderBottom: i < calls.length - 1 ? "1px solid rgba(0,0,0,0.06)" : "none", cursor: "pointer", borderRadius: 8, padding: "10px 8px", margin: "0 -8px", background: hoveredCallId === call.id ? "#f5f5f7" : "transparent", transition: "background 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1c1c1e" }}>{call.prospect_name}</div>
                  <div style={{ fontSize: 11.5, color: "#8e8e93", marginTop: 2 }}>
                    {new Date(call.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {call.duration}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {effectiveOutcome(call) && !editingOutcomes[call.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 10, color: "#8e8e93", fontWeight: 600, letterSpacing: "0.06em" }}>OUTCOME</span>
                      <OutcomeBadge outcome={effectiveOutcome(call)!} />
                      {hoveredCallId === call.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingOutcomes((prev) => ({ ...prev, [call.id]: true })); }}
                          className="hover:bg-blue-100 rounded transition-colors"
                          style={{ fontSize: 10, color: "#007aff", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                  <span className="hover:bg-blue-100 rounded transition-colors" style={{ fontSize: 11.5, color: "#007aff", fontWeight: 600, whiteSpace: "nowrap", padding: "2px 6px", borderRadius: 6 }}>View →</span>
                </div>
              </div>
              {call.summary && <div style={{ fontSize: 12, color: "#8e8e93", lineHeight: 1.4 }}>{call.summary}</div>}
              {(!effectiveOutcome(call) || editingOutcomes[call.id]) && (
                <OutcomePicker callId={call.id} onSaved={handleOutcomeSaved} />
              )}
            </div>
          ))
        )}
      </Card>

      {/* ── Mission Intel Chat Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div
          onClick={() => setModalOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 18, width: 520, maxWidth: "100%", height: "82vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", overflow: "hidden" }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34c759", boxShadow: "0 0 6px rgba(52,199,89,0.5)", flexShrink: 0 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1c1c1e", letterSpacing: "-0.01em" }}>Mission Intel — Ask Your Wingman</div>
              </div>
              <button onClick={() => setModalOpen(false)} style={{ background: "#e5e5ea", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: "#8e8e93", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, justifyContent: "flex-end" }}>
              {globalMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 13, color: "#8e8e93", lineHeight: 1.6, marginBottom: 16 }}>
                    Ask Wingman anything about your calls — patterns, wins, what to fix next.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {["Where do I lose most deals?", "What's my top objection?", "What works on wins?"].map((q) => (
                      <button key={q} onClick={() => sendGlobalMessage(q)} style={{ fontSize: 11.5, color: "#1c1c1e", background: "#e5e5ea", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {globalMessages.map((m, i) =>
                m.role === "assistant"
                  ? m.text.split("\n\n").filter(Boolean).map((chunk, ci) => (
                      <div key={`${i}-${ci}`} style={{ alignSelf: "flex-start", maxWidth: "85%", background: "#e5e5ea", color: "#1c1c1e", borderRadius: "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{chunk}</div>
                    ))
                  : <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "#1c1c1e", color: "#fff", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
              )}
              {globalLoading && !userIsTyping && (
                <div style={{ alignSelf: "flex-start", background: "#e5e5ea", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              )}
              <div ref={modalEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgba(0,0,0,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
              <textarea
                ref={modalInputRef}
                value={globalInput}
                rows={1}
                onChange={(e) => {
                  setGlobalInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                  setUserIsTyping(true);
                  if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
                  userTypingTimerRef.current = setTimeout(() => setUserIsTyping(false), 1000);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGlobalMessage(globalInput); } }}
                placeholder="Ask anything about your calls…"
                style={{ flex: 1, background: "#e5e5ea", border: "none", borderRadius: 9, padding: "11px 14px", color: "#1c1c1e", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", overflow: "auto", lineHeight: 1.4, boxSizing: "border-box" }}
              />
              <button onClick={() => sendGlobalMessage(globalInput)} style={{ padding: "11px 18px", background: "#1c1c1e", borderRadius: 9, color: "#fff", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>Ask</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
