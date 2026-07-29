"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, X, SquarePen } from "lucide-react";
import type { Call } from "@/types";
import { CHAT_DAILY_CAP } from "@/lib/wingman/chat-quota";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import {
  ChatContainerRoot,
  ChatContainerContent,
} from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Loader } from "@/components/ui/loader";

/**
 * Wingman Coach — collapsed bar on Home, full takeover once you engage.
 *
 * Granola's pattern (Sebastian, 2026-07-28): messages must never pile up on the
 * Home screen. Clicking the bar hands the whole content column to the
 * conversation; ✕ or Esc hands it back.
 *
 * The input is rendered in BOTH states by the same component instance, so
 * opening doesn't unmount it — no focus loss, no jump. What changes is whether
 * the conversation renders above it and whether HomeTab shows its own content.
 *
 * This adds NO new AI: it's a second entry point to the existing `/api/ai/chat`
 * in `mode: "global"` — the same payload Mission Intel already sends, the same
 * server-enforced daily cap.
 *
 * NOT built here (both live in Flight Log, which is built for them):
 *  - Persistence. Wingman stores no chat history (`chat_messages_today` is only
 *    a counter), so this is stateless by design — the thread survives closing
 *    the takeover but not a reload. A history list needs a new Supabase table.
 *  - The single-call deep dive. On `diveReady` we hand off to Flight Log rather
 *    than reimplement transcript mode here.
 */

type Msg = { role: "user" | "assistant"; text: string };

export type CoachSession = {
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  sentCount: number;
  setSentCount: React.Dispatch<React.SetStateAction<number>>;
  suggestion: { call_id: string; name: string } | null;
  setSuggestion: React.Dispatch<React.SetStateAction<{ call_id: string; name: string } | null>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Coach conversation state, deliberately owned ABOVE the dashboard's tab switch.
 *
 * DashboardClient renders `{tab === "home" && <HomeTab/>}`, so anything held
 * inside Coach dies the moment the rep changes tab — including via the Coach's
 * OWN handoff ("Open Jane in Flight Log →"). The rep accepts the Coach's
 * suggestion and the conversation they were building silently evaporates.
 * Calling this hook in DashboardClient keeps the thread alive across tabs.
 */
export function useCoachSession(): CoachSession {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [suggestion, setSuggestion] = useState<{ call_id: string; name: string } | null>(null);
  const [open, setOpen] = useState(false);
  return { messages, setMessages, sentCount, setSentCount, suggestion, setSuggestion, open, setOpen };
}

export default function Coach({
  calls,
  usedToday,
  onOpenCall,
  session,
}: {
  calls: Call[];
  usedToday: number;
  /** Hand off to Flight Log. Returns false if the id isn't in the loaded list. */
  onOpenCall: (callId: string) => boolean;
  session: CoachSession;
}) {
  const { messages, setMessages, sentCount, setSentCount, suggestion, setSuggestion } = session;
  const open = session.open;
  const onOpenChange = session.setOpen;

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Ref (not state) so a double-submit in the same tick can't slip a second request through.
  const inFlight = useRef(false);

  /*
    `usedToday` is derived from `profile`, which DashboardClient re-fetches via
    router.refresh() (on debrief landing, HUD outcome saved, etc.). HomeTab is NOT
    remounted by that, so a naive `usedToday + sentCount` DOUBLE-COUNTS: the server
    has already folded our sends into chat_messages_today, and sentCount still holds
    them too. Rep sends 4, finishes a call, refresh lands → counter jumps 4/20 → 8/20
    and they're cut off at 10 real messages, disagreeing with the sidebar.

    Freeze the baseline at mount and take the max, so the count is monotonic and
    converges on the server's truth instead of drifting above it.
  */
  const baseline = useRef(usedToday);
  const used = Math.max(usedToday, baseline.current + sentCount);
  const atLimit = used >= CHAT_DAILY_CAP;

  // Esc returns to Home. Only bound while open so it can't swallow Esc elsewhere.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onOpenChange(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const send = async () => {
    const text = input.trim();
    if (!text || inFlight.current || atLimit) return;

    inFlight.current = true;
    setLoading(true);
    setInput("");
    onOpenChange(true);
    const nextMessages: Msg[] = [...messages, { role: "user", text }];
    setMessages(nextMessages);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "global",
          // Last 10 turns only — matches the route's own history cap.
          messages: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.text })),
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
          // Keeps the dive flow coherent: without it the route answers a
          // "yes, dive in" with a soft error and the rep is stuck in a retry loop.
          ...(suggestion ? { pendingCallId: suggestion.call_id } : {}),
        }),
        // The route puts no timeout on its Anthropic call, so without this a hung
        // upstream leaves loading/inFlight true forever and only a reload recovers.
        signal: AbortSignal.timeout(45_000),
      });

      const data = await res.json();

      if (data.limitReached) {
        setMessages((p) => [...p, { role: "assistant", text: "That's today's coaching limit. Resets at midnight." }]);
        // Lock the client to match. `usedToday` is a page-load snapshot, so a rep
        // who used Mission Intel first arrives with a stale low count — without
        // this they keep pressing send and keep collecting identical replies.
        // Keyed off the frozen baseline so `used` lands exactly on the cap.
        setSentCount(CHAT_DAILY_CAP - baseline.current);
        return;
      }

      // 401 session expired / 403 subscription required / 500. Without this the
      // route's real `error` is dropped and the rep gets a generic failure for a
      // problem they could actually fix.
      if (!res.ok) {
        setMessages((p) => [...p, { role: "assistant", text: data.error || "Something went wrong. Try again in a moment." }]);
        return;
      }

      // Ready to go deep on one call — Flight Log owns that experience.
      if (data.diveReady?.callData?.id) {
        const opened = onOpenCall(data.diveReady.callData.id);
        setSuggestion(null);
        if (!opened) {
          setMessages((p) => [...p, { role: "assistant", text: "Couldn't open that call from here — it's in your Flight Log." }]);
        }
        return;
      }

      if (data.callSuggestion?.call_id) setSuggestion(data.callSuggestion);

      setMessages((p) => [...p, { role: "assistant", text: data.reply || "Couldn't get a response." }]);
      setSentCount((n) => n + 1);
    } catch (err) {
      console.error("[Coach] /api/ai/chat failed", err);
      setMessages((p) => [...p, { role: "assistant", text: "Couldn't reach Wingman just then. Try again." }]);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  };

  const newChat = () => {
    setMessages([]);
    setSuggestion(null);
    setInput("");
  };

  const composer = (
    <PromptInput
      value={input}
      onValueChange={setInput}
      onSubmit={send}
      isLoading={loading}
      maxHeight={160}
      className="bg-surface border border-line-strong rounded-panel shadow-float"
      /*
        Opening can't rely on onFocus alone. Press Esc while typing: the takeover
        closes but the textarea node survives (that's the point of the single
        return) and KEEPS DOM focus — so clicking the bar calls .focus() on an
        already-focused element, which fires no focus event, and the rep is locked
        out of their own conversation until they click elsewhere first.
      */
      onClick={() => onOpenChange(true)}
    >
      <PromptInputTextarea
        // prompt-kit hardcodes `text-primary` here, and our bridge maps --primary
        // to signal blue — so typed text would come out BLUE. Override to ink.
        className="text-ink-1 placeholder:text-ink-3"
        placeholder={atLimit ? "Daily coaching limit reached — resets at midnight" : "Ask Wingman about your calls…"}
        disabled={atLimit}
        onFocus={() => onOpenChange(true)}
      />
      <PromptInputActions className="flex items-center justify-end gap-2 pt-1">
        <span className="text-[11px] text-ink-3 tabular-nums" title="Coaching messages used today">
          {used}/{CHAT_DAILY_CAP}
        </span>
        <button
          onClick={send}
          disabled={!input.trim() || loading || atLimit}
          aria-label="Send"
          className="h-8 w-8 shrink-0 rounded-pill grid place-items-center bg-signal text-signal-on hover:bg-signal-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-2 ease-wm"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </PromptInputActions>
    </PromptInput>
  );

  /*
    ONE return, not two.
    Two separate return trees (collapsed vs open) make React tear the composer
    down and rebuild it when `open` flips — which means clicking the bar opened
    the takeover and then silently ate the rep's first keystrokes, because focus
    died with the old DOM node. Measured: typed 24 chars, none landed.

    Here the outer element and the child SLOTS are constant. `{open && …}` yields
    `false` rather than collapsing the array, so the composer stays at the same
    child index in both states and React keeps the exact same <textarea> node.
    Only classNames change. Do not "simplify" this back into an early return.
  */
  return (
    <div
      className={
        open
          ? "flex-1 flex flex-col min-h-0"
          // z-10: the Sales DNA banner has z-indexed children in the root stacking
          // context and would otherwise paint over the bar as it scrolls past.
          : "sticky bottom-0 z-10 pt-6 pb-2 bg-linear-to-t from-paper via-paper to-transparent"
      }
    >
      {open && (
        <div className="flex items-center justify-between gap-3 pb-3">
          <h2 className="text-h3 text-ink-1">Wingman Coach</h2>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={newChat}
                title="New chat"
                aria-label="New chat"
                className="h-8 w-8 rounded-pill grid place-items-center text-ink-3 hover:text-ink-1 hover:bg-surface-sunken transition-colors duration-2 ease-wm"
              >
                <SquarePen className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              title="Back to Home (Esc)"
              aria-label="Back to Home"
              className="h-8 w-8 rounded-pill grid place-items-center text-ink-3 hover:text-ink-1 hover:bg-surface-sunken transition-colors duration-2 ease-wm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {open && (
        // `no-scrollbar` (globals.css) targets this element AND its descendants:
        // StickToBottom's real scroller is an inner div, not this root, and
        // scrollbar-width doesn't inherit — so scoping it here alone did nothing.
        // ScrollButton is the affordance instead.
        <ChatContainerRoot className="flex-1 min-h-0 relative no-scrollbar">
          <ChatContainerContent className="gap-3 pb-4">
            {messages.length === 0 && !loading && (
              <p className="text-body text-ink-3 py-8">
                Ask about a call, an objection you keep hitting, or what to do differently next time.
              </p>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === "user"
                    ? "self-end max-w-[80%] bg-signal text-signal-on rounded-card px-3.5 py-2 text-body"
                    : "self-start max-w-[90%] text-body text-ink-1 whitespace-pre-wrap"
                }
              >
                {m.text}
              </div>
            ))}

            {loading && (
              // The dots hardcode `bg-primary` (= signal blue) and Loader applies
              // className to the CONTAINER, so the child selector is the only way
              // to reach them. Keyframes live in globals.css — prompt-kit ships
              // `animate-[typing…]` but no @keyframes, so without it the dots are
              // a static image during a 5–20s non-streaming call.
              <div className="self-start py-1">
                <Loader variant="typing" size="md" className="[&>div]:bg-ink-3" />
              </div>
            )}

            {suggestion && !loading && (
              <button
                onClick={() => {
                  // Same contract as the diveReady path: if the id isn't in the
                  // loaded 20 this is otherwise a dead click with no feedback.
                  if (!onOpenCall(suggestion.call_id)) {
                    setMessages((p) => [...p, {
                      role: "assistant",
                      text: "Couldn't open that call from here — it's in your Flight Log.",
                    }]);
                  }
                }}
                className="self-start text-small font-medium text-signal hover:text-signal-hover transition-colors duration-2 ease-wm"
              >
                Open {suggestion.name} in Flight Log →
              </button>
            )}
          </ChatContainerContent>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <ScrollButton />
          </div>
        </ChatContainerRoot>
      )}

      <div className={open ? "pt-2" : ""}>{composer}</div>
    </div>
  );
}
