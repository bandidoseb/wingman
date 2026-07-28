"use client";

import { useRef, useState } from "react";
import type { Call } from "@/types";
import { CHAT_DAILY_CAP } from "@/lib/wingman/chat-quota";

/**
 * Wingman Coach bar — the Granola-style ask-anything bar pinned to the bottom of Home.
 *
 * This adds NO new AI. It is a second entry point to the existing `/api/ai/chat`
 * route in `mode: "global"` — the same payload Mission Intel in Flight Log already
 * sends. Same prompt, same model, same server-side daily cap (CHAT_DAILY_CAP = 20).
 *
 * DELIBERATELY NOT BUILT HERE (both live in Flight Log, which is built for them):
 *  - Conversation persistence. Wingman stores no chat history — `chat_messages_today`
 *    is only a counter — so this bar is stateless by design. Reload and it's empty.
 *    A history list would need a new Supabase table.
 *  - The single-call "deep dive". When the Coach decides to dive into one call, the
 *    route returns `diveReady`; we hand off to Flight Log rather than reimplement the
 *    transcript-mode machinery on Home.
 */

type Msg = { role: "user" | "assistant"; text: string };

export default function CoachBar({
  calls,
  usedToday,
  onOpenCall,
}: {
  calls: Call[];
  usedToday: number;
  /** Hand off to Flight Log for a specific call. Returns false if the id isn't known. */
  onOpenCall: (callId: string) => boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [suggestion, setSuggestion] = useState<{ call_id: string; name: string } | null>(null);

  // Ref (not state) so a double-submit in the same tick can't slip a second request through.
  const inFlight = useRef(false);

  const used = usedToday + sentCount;
  const atLimit = used >= CHAT_DAILY_CAP;

  const send = async () => {
    const text = input.trim();
    if (!text || inFlight.current || atLimit) return;

    inFlight.current = true;
    setLoading(true);
    setInput("");
    const nextMessages: Msg[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "global",
          // Last 10 turns only — matches the route's own history cap.
          messages: nextMessages.slice(-10).map((m) => ({
            role: m.role,
            content: m.text,
          })),
          callSummaries: calls.map((c) => ({
            id: c.id,
            prospect_name: c.prospect_name,
            outcome: c.outcome,
            outcome_source: c.outcome_source ?? null,
            call_date: c.call_date,
            duration: c.duration,
            summary: c.summary,
            missed_topics: c.missed_topics,
          })),
          // Sending this keeps the Coach's dive flow coherent: without it the route
          // answers a "yes, dive in" with a soft error and the user gets stuck in a
          // retry loop.
          ...(suggestion ? { pendingCallId: suggestion.call_id } : {}),
        }),
        // The route puts no timeout on its Anthropic call, so without this a hung
        // upstream leaves `loading`/`inFlight` true forever — dots spinning, send
        // button dead, only a reload recovers.
        signal: AbortSignal.timeout(45_000),
      });

      const data = await res.json();

      if (data.limitReached) {
        setMessages((p) => [...p, {
          role: "assistant",
          text: "That's today's coaching limit. Resets at midnight.",
        }]);
        // Lock the client to match. `usedToday` is a page-load snapshot, so a rep
        // who used Mission Intel in Flight Log first arrives here with a stale low
        // count — without this they can keep pressing send and keep collecting
        // identical "limit reached" bubbles.
        setSentCount(CHAT_DAILY_CAP - usedToday);
        return;
      }

      // Any other non-OK (401 session expired, 403 subscription required, 500).
      // Without this the route's real `error` string is dropped and the rep gets
      // a generic "couldn't get a response" for a problem they could actually fix.
      if (!res.ok) {
        setMessages((p) => [...p, {
          role: "assistant",
          text: data.error || "Something went wrong. Try again in a moment.",
        }]);
        return;
      }

      // The Coach is ready to go deep on one call — Flight Log owns that experience.
      if (data.diveReady?.callData?.id) {
        const opened = onOpenCall(data.diveReady.callData.id);
        setSuggestion(null);
        // If the id isn't in our list we'd otherwise return having rendered
        // nothing at all — the rep says "yes, dive in" and the UI just sits there.
        if (!opened) {
          setMessages((p) => [...p, {
            role: "assistant",
            text: "Couldn't open that call from here — it's in your Flight Log.",
          }]);
        }
        return;
      }

      if (data.callSuggestion?.call_id) setSuggestion(data.callSuggestion);

      setMessages((p) => [...p, { role: "assistant", text: data.reply || "Couldn't get a response." }]);
      setSentCount((n) => n + 1);
    } catch (err) {
      console.error("[CoachBar] /api/ai/chat failed", err);
      setMessages((p) => [...p, {
        role: "assistant",
        text: "Couldn't reach Wingman just then. Try again.",
      }]);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  return (
    // z-10: the Sales DNA banner above has z-indexed children (scrim, dismiss ✕)
    // in the root stacking context — without this they paint OVER the bar as it
    // scrolls past, drawing a dark band across the input and stealing clicks.
    <div className="sticky bottom-0 z-10 pt-6 pb-2 bg-linear-to-t from-paper via-paper to-transparent">
      {/* Conversation — only present once there's something to show. */}
      {messages.length > 0 && (
        <div className="mb-3 max-h-80 overflow-y-auto flex flex-col gap-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "self-end max-w-[80%] bg-signal text-signal-on rounded-card px-3.5 py-2 text-body"
                  : "self-start max-w-[90%] bg-surface border border-line rounded-card px-3.5 py-2 text-body text-ink-1 whitespace-pre-wrap"
              }
            >
              {m.text}
            </div>
          ))}

          {loading && (
            <div className="self-start bg-surface border border-line rounded-card px-3.5 py-2.5">
              <span className="typing-dot" />
              <span className="typing-dot ml-1" />
              <span className="typing-dot ml-1" />
            </div>
          )}

          {suggestion && !loading && (
            <button
              onClick={() => onOpenCall(suggestion.call_id)}
              className="self-start text-small font-medium text-signal hover:text-signal-hover transition-colors duration-2 ease-wm"
            >
              Open {suggestion.name} in Flight Log →
            </button>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 bg-surface border border-line-strong rounded-pill pl-4 pr-1.5 py-1.5 shadow-float focus-within:border-signal transition-colors duration-2 ease-wm">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={atLimit}
          placeholder={atLimit ? "Daily coaching limit reached — resets at midnight" : "Ask Wingman about your calls…"}
          className="flex-1 bg-transparent border-0 outline-hidden text-body text-ink-1 placeholder:text-ink-3 disabled:cursor-not-allowed"
          aria-label="Ask Wingman"
        />
        <span className="text-[11px] text-ink-3 tabular-nums shrink-0" title="Coaching messages used today">
          {used}/{CHAT_DAILY_CAP}
        </span>
        <button
          onClick={send}
          disabled={!input.trim() || loading || atLimit}
          aria-label="Send"
          className="h-8 w-8 shrink-0 rounded-pill grid place-items-center bg-signal text-signal-on hover:bg-signal-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-2 ease-wm"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
