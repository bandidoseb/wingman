"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, X, SquarePen } from "lucide-react";
import type { Call } from "@/types";
import { CHAT_DAILY_CAP } from "@/lib/wingman/chat-quota";
import { nextSuggestion, type CallSuggestion, type ChatDiveReady } from "@/lib/wingman/dive-suggestion";
import { buildSingleCallPayload, transcriptRowsFromDive } from "@/lib/wingman/coach-payload";
import {
  GLOBAL_SCOPE,
  INITIAL_SCOPE,
  resolveScope,
  onDerivedChange,
  onDive,
  dismissScope,
} from "@/lib/wingman/coach-scope";
import { useCoachContext } from "@/components/dashboard/coach/CoachProvider";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { ChatContainerRoot, ChatContainerContent } from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import { Loader } from "@/components/ui/loader";

/**
 * The unified Coach bar — ONE entry point to Wingman's coach, on every tab.
 *
 * Sebastian, 2026-07-29: *"if we use Granola as a reference, it always just has that
 * bottom chat bar… make the entry point to talking to the wingman chatbot the same
 * everywhere."* This replaces THREE surfaces that each had their own state, their own
 * bugs and their own idea of the daily quota: Home's Coach, Flight Log's Mission Intel
 * modal, and Flight Log's per-call "Ask Wingman" card.
 *
 * WHY IT WRAPS THE TABS INSTEAD OF SITTING BESIDE THEM
 * `children` is an element created by DashboardClient, so it is referentially stable
 * across this component's own state changes — React bails out of re-rendering the
 * whole tab tree on every keystroke. Wrapping is also what lets the takeover hide the
 * tab content the way Granola's does, without lifting a single line of chat state into
 * DashboardClient (which owns the live-call handlers and the Live Hub pill machine).
 *
 * WHY `sticky bottom-0` AND NOT `position: fixed`
 * The content column is offset by `marginLeft: sidebarWidth` with a 0.28s easing
 * transition. A fixed bar would have to duplicate BOTH the width constant and the
 * easing curve, and the two would desync the moment either changed — which is exactly
 * how the sidebar collapse broke once already. Sticky needs neither, and needs no
 * bottom-padding constant on the page either.
 *
 * WHY THE TAKEOVER USES A DEFINITE HEIGHT
 * `h-[calc(100vh-96px)]` (96px = the column's 48px top+bottom padding), never `min-h-`.
 * With `min-h` the column's height stays AUTO with a floor, so a `flex-1` child's
 * content still grows the container and StickToBottom's `height:100%` scroller resolves
 * to auto. Measured at 40 messages: body scrollHeight 2070 in a 794px viewport with the
 * composer at y=2022 — the input walks off screen and the rep has to scroll the page to
 * type. A definite height makes the conversation scroll internally instead.
 */

type Msg = { role: "user" | "assistant"; text: string; timestamp?: number };
type Thread = { messages: Msg[]; suggestion: CallSuggestion | null };

const EMPTY_THREAD: Thread = { messages: [], suggestion: null };

/**
 * Per-thread history cap. There is no LRU on the threads themselves: 20 calls × 20
 * messages is ~200 KB against an already-multi-MB dashboard payload, and evicting a
 * thread creates an undefined case (a reply landing in a thread that no longer
 * exists). Capping the messages inside each thread bounds the same memory with none
 * of that risk. The wire caps independently at 10 turns.
 */
const MAX_THREAD_MESSAGES = 40;

/** Ported from Flight Log's Mission Intel, key and TTL unchanged — see `restore`. */
const STORAGE_KEY = "wingman_global_chat";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

const GLOBAL_CHIPS = [
  "Where do I lose most deals?",
  "What's my top objection?",
  "What works on wins?",
];
const CALL_CHIPS = [
  "What did I do well?",
  "What was my biggest missed opportunity?",
  "What's the one thing to fix on my next call?",
];

function capMessages(msgs: Msg[]): Msg[] {
  return msgs.length > MAX_THREAD_MESSAGES ? msgs.slice(-MAX_THREAD_MESSAGES) : msgs;
}

export default function CoachBar({
  calls,
  used,
  callPhase,
  onOpenCall,
  markSent,
  onQuotaReported,
  children,
}: {
  /** The dashboard's server rows. Overlaid with this session's outcomes below. */
  calls: Call[];
  /** Coaching messages used today — computed once upstream, shared with the sidebar. */
  used: number;
  /**
   * `"live"` = a call is running or spinning up · `"processing"` = it ended and the
   * debrief is still landing · `"idle"` = neither.
   *
   * BOTH non-idle states disable the bar, but they are separate values because they
   * need separate copy: `"processing"` can last minutes, and telling a rep staring at
   * "Processing call…" that "coaching chat pauses during a live call" is just wrong.
   *
   * THE LIVE GATE IS A SAFETY GATE, NOT POLISH. `electron/main.ts` registers BARE
   * ARROW KEYS as global shortcuts during a call: `Up` for the whole call, and
   * Left/Down/Right while the compass is open, as direct picks during flow mode, and
   * after a close chip. `globalShortcut` fires BEFORE the focused textarea gets the
   * key — so a rep typing a message mid-call who presses ↑ opens the compass, and the
   * next arrow fires a slot: a billed Sonnet stream and a card on the HUD, in front
   * of the prospect. It also settles the z-fight with the Live Hub pill, which floats
   * at `bottom:80px; left:32px` in an always-on-top screen-saver-level window.
   */
  callPhase: "idle" | "live" | "processing";
  /** Open a call in Flight Log. Returns false when the id isn't in the loaded list. */
  onOpenCall: (callId: string) => boolean;
  /** Record a send the server accepted. */
  markSent: () => void;
  /** Fold a server-reported count into the shared quota. */
  onQuotaReported: (count: number, day?: string) => void;
  children: React.ReactNode;
}) {
  /*
    `transcriptMeta` is deliberately NOT read here. The bar never renders transcript
    rows — it only reads them at SEND time, through `getTranscript`, which returns the
    live ref contents whether or not this component has re-rendered since. Subscribing
    to the meta would re-render the bar every time a transcript landed, for nothing.
  */
  const { applySessionOutcomes, getTranscript, setTranscript, noDebriefIds, openCallId } = useCoachContext();
  const busy = callPhase !== "idle";

  // ── Scope ────────────────────────────────────────────────────────────────────
  const [scopeState, setScopeState] = useState(INITIAL_SCOPE);
  // Flight Log reports the call it has open through the provider; fold it in.
  useEffect(() => {
    setScopeState((s) => onDerivedChange(s, openCallId));
  }, [openCallId]);
  const scope = resolveScope(scopeState);

  // ── Threads ──────────────────────────────────────────────────────────────────
  const [threads, setThreads] = useState<Record<string, Thread>>({});
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  /**
   * Which thread has a request in flight — NOT a boolean.
   *
   * A reply must be written into the thread that ASKED, and the typing dots must
   * render there too. Rendering them in whatever thread is visible would show a
   * global conversation "thinking" about a question asked of a call.
   */
  const [pendingScope, setPendingScope] = useState<string | null>(null);
  /**
   * Ref, not state, so a double-submit in the same tick can't slip a second request
   * through. ONE in flight per bar: a scope switch does not unlock the composer,
   * which also serialises the daily quota so two replies can't both decrement it.
   */
  const inFlightRef = useRef<string | null>(null);
  /**
   * Bumped whenever "New chat" resets a thread. A request captures the generation it
   * was sent under and drops its writes if the thread was cleared while it was in
   * flight — otherwise the reply lands in the fresh thread as an answer with no
   * question above it.
   */
  const threadGenRef = useRef<Record<string, number>>({});

  const thread = threads[scope] ?? EMPTY_THREAD;
  /**
   * ANY request in flight, not just the visible thread's.
   *
   * `inFlightRef` is per-BAR, so gating the affordance on the visible thread alone
   * meant: ask a global question, click a call while it runs, and the send button
   * renders enabled while `send()` silently returns at the `inFlightRef` guard.
   * Nothing clears, nothing errors, Enter just does nothing. The dots stay scoped to
   * the asking thread (`thinking`); the LOCK is global.
   */
  const sending = pendingScope !== null;

  /*
    Overlay this session's outcome confirmations ONCE, here, for both the global
    call list AND the per-send call lookup below. A call resolved by id that skips
    the overlay answers "what's my close rate" ignoring a ✓ the rep made two seconds
    ago — the exact bug PR 3 shipped on the detail view's fallback row.
  */
  const callsOverlaid = useMemo(() => applySessionOutcomes(calls), [calls, applySessionOutcomes]);

  /*
    Re-derived on every render (and therefore at send time), never captured when the
    scope was set: the HUD deep-link path opens a SYNTHETIC Call row
    (`prospect_name: null, summary: null`) which fills in from the server moments
    later, and a snapshot would keep describing the placeholder forever.
  */
  const scopedCall = scope === GLOBAL_SCOPE ? null : callsOverlaid.find((c) => c.id === scope) ?? null;
  /*
    The row is gone — deleted, or fallen out of the dashboard's 20-row window. Sending
    anyway produces the worst possible answer: `mode:"single_call"` with no `call`
    fails the route's `mode === "single_call" && call` guard, so `contextStr` stays
    empty, the model gets CORE_PROMPT alone, and it asks "which call do you mean?"
    while the rep is looking at that call. Disable, and say why.
  */
  const scopeMissing = scope !== GLOBAL_SCOPE && !scopedCall;

  const atLimit = used >= CHAT_DAILY_CAP;
  /*
    TWO disable reasons with DISTINCT copy. One shared string would tell a rep in the
    middle of a live call that they had hit their daily limit.
  */
  const disabledReason =
    callPhase === "live"       ? "Coaching chat pauses during a live call"
  : callPhase === "processing" ? "Finishing up your last call — one moment"
  : atLimit                    ? "Daily limit reached — resets at midnight"
  : scopeMissing               ? "That call isn't loaded here — open it from Flight Log"
  : null;
  const disabled = disabledReason !== null;

  // ── Takeover layout ──────────────────────────────────────────────────────────
  /*
    Hold the "open" LAYOUT until the exit animation has actually finished. `open`
    flips instantly but the panel takes 260ms to fade; without this the column snaps
    to its closed height at t=0, the tab content pops back in underneath, and the
    composer visibly jumps while the panel is still on screen. `wasOpen` stops this
    firing on first mount, when `open` is already false.
  */
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) { wasOpen.current = true; setClosing(false); }
    else if (wasOpen.current) { setClosing(true); }
  }, [open]);
  const layoutOpen = open || closing;

  /*
    Anything call-related pulls the dashboard back into view. The takeover hides the
    tab content — including the live status strip, the ONLY web-side End Call button,
    "Processing call…" and the outcome prompt — so a rep who left the panel open and
    then deployed would be staring at a chat with no live indicator and no way to end
    the call. The composer is disabled while busy, so it can't be reopened either.
  */
  useEffect(() => {
    if (busy) setOpen(false);
  }, [busy]);

  /*
    Esc closes the takeover. Bound only while open, which is also what makes it safe:
    the takeover hides the tab content, so Flight Log's OutcomePicker "Other" input —
    the dashboard's only other Escape consumer — cannot be on screen at the same time.
  */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ── Persistence (global thread only) ─────────────────────────────────────────
  /*
    Ported verbatim from Mission Intel — same key, same 24h TTL. Wingman stores no
    chat history server-side (`chat_messages_today` is only a counter), so this is the
    only thing that survives a reload. Dropping it in the merge would have quietly
    regressed a shipped behaviour and orphaned the key. Only the GLOBAL thread is
    persisted: a call thread without its transcript cache (which is in-memory) would
    restore as a conversation the coach can no longer see the subject of.
  */
  /*
    `lastPersisted` holds the exact array instance currently in storage, and it is
    seeded with the one restore just put into state.

    Without it the two effects fight on mount. Restore CANNOT be a lazy `useState`
    initialiser — this is a client component, so that initialiser also runs during
    SSR where `localStorage` is undefined — so it has to be an effect, and the save
    effect below runs in the same commit with the pre-restore value. It would remove
    the key it had just read (recoverable, but a tab closed inside that window loses
    the thread), and then rewrite it with a fresh `savedAt`, so the 24h TTL would
    reset on every dashboard load and a stale thread would never expire.
  */
  const lastPersistedRef = useRef<Msg[] | null>(null);
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const { messages, savedAt } = JSON.parse(stored);
      if (Date.now() - savedAt < STORAGE_TTL_MS && Array.isArray(messages) && messages.length > 0) {
        const restored = capMessages(messages);
        lastPersistedRef.current = restored;
        setThreads((prev) => ({ ...prev, [GLOBAL_SCOPE]: { messages: restored, suggestion: null } }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* corrupted or private mode — start fresh */ }
  }, []);

  const globalMessages = threads[GLOBAL_SCOPE]?.messages;
  useEffect(() => {
    // `undefined` = the thread has never been touched this session. An EMPTY array is
    // different: it only happens after "New chat", which must clear storage too, or a
    // reload resurrects the conversation the rep just cleared.
    if (globalMessages === undefined) return;
    if (globalMessages === lastPersistedRef.current) return;
    lastPersistedRef.current = globalMessages;
    try {
      if (globalMessages.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: globalMessages, savedAt: Date.now() }));
    } catch { /* quota exceeded / private mode — persistence is best-effort */ }
  }, [globalMessages]);

  // ── Send ─────────────────────────────────────────────────────────────────────
  const appendTo = useCallback((key: string, ...msgs: Msg[]) => {
    setThreads((prev) => {
      const cur = prev[key] ?? EMPTY_THREAD;
      return { ...prev, [key]: { ...cur, messages: capMessages([...cur.messages, ...msgs]) } };
    });
  }, []);

  /** `preset` is a quick-prompt chip; a normal send reads (and clears) the composer. */
  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || inFlightRef.current || disabled) return;

    // The key is captured HERE and used for every write below. The rep can switch
    // scope while this is in flight; the answer still belongs to the thread that asked.
    const key = scope;
    // Captured now; every write below is dropped if "New chat" bumps it meanwhile.
    const gen = threadGenRef.current[key] ?? 0;
    inFlightRef.current = key;
    setPendingScope(key);
    if (!preset) setInput("");
    setOpen(true);

    const cur = threads[key] ?? EMPTY_THREAD;
    const userMsg: Msg = { role: "user", text, timestamp: Date.now() };
    appendTo(key, userMsg);

    /** Write into the thread that ASKED — and only if it is still that conversation. */
    const write = (...msgs: Msg[]) => {
      if ((threadGenRef.current[key] ?? 0) !== gen) return;
      appendTo(key, ...msgs);
    };

    try {
      // Body construction lives INSIDE the try on purpose: `inFlightRef` is already
      // set, so a throw out here would strand it and `pendingScope` forever —
      // permanent dots and a dead composer, recoverable only by reloading.
      const wire = [...cur.messages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.text }));
      let body: object;
      if (key === GLOBAL_SCOPE) {
        body = {
          mode: "global",
          messages: wire,
          callSummaries: callsOverlaid.map((c) => ({
            id: c.id,
            prospect_name: c.prospect_name,
            outcome: c.outcome,
            outcome_source: c.outcome_source ?? null,
            call_date: c.call_date,
            duration: c.duration,
            summary: c.summary,
            missed_topics: c.missed_topics,
          })),
          // Keeps the dive flow coherent: without it the route answers a "yes, dive in"
          // with a soft error and the rep is stuck in a retry loop.
          ...(cur.suggestion ? { pendingCallId: cur.suggestion.call_id } : {}),
        };
      } else {
        // `scopedCall` is non-null here — `scopeMissing` is part of `disabled`.
        // ONE builder, shared with nothing else now: two callers producing two slightly
        // different payloads for the same call is a guaranteed prompt-cache miss AND
        // two different truths about that call.
        const { call, transcriptStatus } = buildSingleCallPayload(scopedCall!, getTranscript(key), noDebriefIds);
        body = { mode: "single_call", messages: wire, call, transcriptStatus };
      }

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // The route puts no timeout on its Anthropic call, so without this a hung
        // upstream leaves the composer locked forever and only a reload recovers.
        signal: AbortSignal.timeout(45_000),
      });

      const data = await res.json();

      /*
        Every reply that carries a count folds in — 429 included. This is what keeps
        the client honest when a 200 is lost to a timeout or a closed tab: the server
        counted it, and the next reply tells us so.

        ⚠️ ORDER IS LOAD-BEARING on the success path: `markSent()` FIRST, reconcile
        SECOND. `quotaReconcile` re-anchors on a day change, so a send at 23:59:59 that
        lands at 00:00:00 comes back as `{used: 1, day: <new>}` → reconcile resets to
        `{baseline:1, sent:0}` → a `markSent()` after that adds a phantom `sent:1` on
        top, and `max(serverLive, baseline+sent)` stays permanently one ahead for the
        rest of the day. Reconciling last wipes the stale `sent` instead. In the normal
        same-day case the two orders are identical.
      */
      const report = () => {
        if (typeof data.messagesUsedToday === "number") {
          onQuotaReported(data.messagesUsedToday, typeof data.quotaDay === "string" ? data.quotaDay : undefined);
        }
      };

      if (data.limitReached) {
        report();
        write({ role: "assistant", text: "That's today's coaching limit. Resets at midnight.", timestamp: Date.now() });
        return;
      }

      // 401 session expired / 403 subscription required / 500. Without this the
      // route's real `error` is dropped and the rep gets a generic failure for a
      // problem they could actually fix.
      if (!res.ok) {
        report();
        write({ role: "assistant", text: data.error || "Something went wrong. Try again in a moment.", timestamp: Date.now() });
        return;
      }

      write({ role: "assistant", text: data.reply || "Couldn't get a response.", timestamp: Date.now() });
      // Quota is per-ACCOUNT, not per-thread: the server counted this send whether or
      // not the rep cleared the thread, so it is recorded outside the `write` guard.
      markSent();
      report();

      /*
        The suggestion is PER-THREAD. Shared, a suggestion left over from an abandoned
        conversation rides the next global send as `pendingCallId`, the model re-fires
        DIVE_NOW, and every message pays for a full row + transcript re-read, another
        Sonnet call and another quota decrement. The lifecycle rule itself lives in
        `nextSuggestion` so it is unit-testable.
      */
      if (key === GLOBAL_SCOPE && (threadGenRef.current[key] ?? 0) === gen) {
        setThreads((prev) => {
          const t = prev[key] ?? EMPTY_THREAD;
          const next = nextSuggestion(t.suggestion, data);
          return next === t.suggestion ? prev : { ...prev, [key]: { ...t, suggestion: next } };
        });
      }

      /*
        A dive. Unlike Home's old hand-off, the bar really does switch into single-call
        mode with the transcript, so the route's own opener ("Read it. Your call with
        X…") is finally TRUE here and is seeded into the call's thread.

        Scope is set ONLY when the call actually opened. A deliberate departure from the
        plan's "fall back to scope-only": a scope whose row we can't resolve is exactly
        `scopeMissing`, which disables the composer — the rep would land in a thread they
        cannot type in. `onOpenCall` returns false for precisely that condition.
      */
      const dive = data.diveReady as ChatDiveReady | undefined;
      if (dive?.callId) {
        if (onOpenCall(dive.callId)) {
          /*
            Salvage the transcript the SERVER already read for this dive, BEFORE the
            scope switches. Without it there is a window where the opener says "Read
            it." and the very next turn — sent before Flight Log's own fetch lands —
            goes out with `transcriptStatus: "unknown"`, which makes the route tell the
            rep it can't pull the transcript up. Marked provisional, so Flight Log
            still replaces these rows with the real ones.
          */
          const rows = transcriptRowsFromDive(dive.callId, dive.callData);
          if (rows) setTranscript(dive.callId, { rows, provisional: true });

          setScopeState((s) => onDive(s, dive.callId));
          appendTo(dive.callId, { role: "assistant", text: dive.openerReply, timestamp: Date.now() });
        } else {
          write({
            role: "assistant",
            text: "Couldn't open that call from here — it's further back in your Flight Log.",
            timestamp: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error("[CoachBar] /api/ai/chat failed", err);
      write({ role: "assistant", text: "Couldn't reach Wingman just then. Try again.", timestamp: Date.now() });
    } finally {
      inFlightRef.current = null;
      setPendingScope((cur) => (cur === key ? null : cur));
    }
  };

  /**
   * Clear the conversation the rep is looking at — and STAY in this scope.
   *
   * The scope deliberately does not change here (see `dismissScope`): dropping it
   * would change which thread is visible, so New chat would have to clear the
   * landing thread too — and "start over on this call" would silently wipe the
   * global coaching history and its 24h localStorage entry. The chip's ✕ is the
   * explicit, visible way out of a call scope.
   */
  const newChat = () => {
    // Bump first: a reply already in flight for this thread must not land in the
    // fresh one as an answer with no question above it.
    threadGenRef.current[scope] = (threadGenRef.current[scope] ?? 0) + 1;
    setThreads((prev) => ({ ...prev, [scope]: EMPTY_THREAD }));
    setInput("");
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const scopeLabel = scopedCall
    ? `Your call with ${scopedCall.prospect_name ?? "an unknown prospect"}`
    : scopeMissing ? "That call" : null;

  const placeholder =
    disabledReason ??
    (scopedCall ? `Ask about ${scopedCall.prospect_name ?? "this call"}…` : "Ask Wingman about your calls…");

  const chips = scope === GLOBAL_SCOPE ? GLOBAL_CHIPS : CALL_CHIPS;
  const thinking = pendingScope === scope;

  /*
    ONE return, not two.
    Two separate trees (collapsed vs open) make React tear the composer down and
    rebuild it when `open` flips — which silently ate the rep's first keystrokes,
    because focus died with the old DOM node. Measured: typed 24 chars, none landed.
    `{open && …}` yields `false` rather than collapsing the array, so the composer
    stays at the same child index in both states and React keeps the exact same
    <textarea>. Only classNames change. Do not "simplify" this into an early return.
  */
  const composer = (
    <PromptInput
      value={input}
      onValueChange={setInput}
      onSubmit={() => send()}
      // `sending`, not `thinking` — the lock is per-bar. See the note on `sending`.
      isLoading={sending}
      maxHeight={140}
      className="bg-surface border border-line-strong rounded-panel px-3 py-2 shadow-raised transition-[box-shadow,border-color] duration-2 ease-wm focus-within:border-signal focus-within:shadow-float"
    >
      <PromptInputActions className="flex items-end gap-2">
        <PromptInputTextarea
          // prompt-kit hardcodes `text-primary` here, and our bridge maps --primary
          // to signal blue — so typed text would come out BLUE. Override to ink.
          // min-h-0 + rows=1 keeps it to a single line until the text wraps.
          // dark:bg-transparent: shadcn's Textarea ships `dark:bg-input/30`, which
          // paints a lighter box INSIDE our composer in dark mode.
          className="flex-1 min-h-0! py-1 text-ink-1 placeholder:text-ink-3 bg-transparent dark:bg-transparent"
          placeholder={placeholder}
          disabled={disabled}
        />
        <span className="text-[11px] text-ink-3 tabular-nums pb-1.5 shrink-0" title="Coaching messages used today">
          {used}/{CHAT_DAILY_CAP}
        </span>
        <button
          onClick={() => send()}
          disabled={!input.trim() || sending || disabled}
          aria-label="Send"
          className="h-7 w-7 shrink-0 rounded-pill grid place-items-center bg-signal text-signal-on hover:bg-signal-hover disabled:opacity-25 disabled:cursor-not-allowed transition-colors duration-2 ease-wm"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
      </PromptInputActions>
    </PromptInput>
  );

  return (
    <div className={`flex flex-col ${layoutOpen ? "h-[calc(100vh-96px)]" : "min-h-[calc(100vh-96px)]"}`}>
      {/* Hidden entirely while the takeover is open — that IS the takeover. When
          closed the bar is sticky but stays in flow, so nothing is unreachable at
          full scroll; content just fades under it on the way down. */}
      <div className={layoutOpen ? "hidden" : "flex-1 pb-2"}>{children}</div>

      <div
        className={
          layoutOpen
            ? "flex-1 min-h-0 flex flex-col w-full max-w-[640px] mx-auto"
            // z-10: the Sales DNA banner has z-indexed children in the root stacking
            // context and would otherwise paint over the bar as it scrolls past.
            : "sticky bottom-0 z-10 w-full max-w-[640px] mx-auto"
        }
      >
        <AnimatePresence initial={false} onExitComplete={() => setClosing(false)}>
          {open && (
            <motion.div
              key="coach-panel"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              // Design Language §5: one easing curve, 260ms.
              transition={{ duration: 0.26, ease: [0.2, 0.6, 0.2, 1] }}
              className="flex-1 min-h-0 flex flex-col pb-2"
              // Clicking the empty space around the card drops back, the way clicking
              // beside Granola's panel does. Guarded on currentTarget so clicks inside
              // the conversation don't dismiss it.
              onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
            >
              <div className="flex items-center justify-between gap-3 pb-2">
                <h2 className="text-h3 text-ink-1">Wingman Coach</h2>
                <div className="flex items-center gap-1">
                  {thread.messages.length > 0 && (
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
                    onClick={() => setOpen(false)}
                    title="Close (Esc)"
                    aria-label="Close"
                    className="h-8 w-8 rounded-pill grid place-items-center text-ink-3 hover:text-ink-1 hover:bg-surface-sunken transition-colors duration-2 ease-wm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <ChatContainerRoot className="flex-1 min-h-0 relative no-scrollbar bg-surface border border-line rounded-card">
                <ChatContainerContent className="gap-3 p-4">
                  {thread.messages.length === 0 && !thinking && (
                    <p className="text-body text-ink-3">
                      {scopedCall
                        ? "Ask anything about this call — what landed, what didn't, what to do next time."
                        : "Ask about a call, an objection you keep hitting, or what to do differently next time."}
                    </p>
                  )}

                  {thread.messages.map((m, i) => (
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

                  {thinking && (
                    // The dots hardcode `bg-primary` (= signal blue) and Loader applies
                    // className to the CONTAINER, so the child selector is the only way
                    // to reach them. Keyframes live in globals.css.
                    <div className="self-start py-1">
                      <Loader variant="typing" size="md" className="[&>div]:bg-ink-3" />
                    </div>
                  )}
                </ChatContainerContent>

                <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                  <ScrollButton />
                </div>
              </ChatContainerRoot>
            </motion.div>
          )}
        </AnimatePresence>

        {/* A short fade so page content dissolves INTO the bar rather than stopping
            dead behind it. Closed state only; `false` (not a collapsed array) keeps
            the composer at the same child index in both states — see the note above.
            The gradient used to wrap the whole bar, which left the scope chip and the
            quick prompts sitting in its transparent half with the page showing through
            them. Everything below is opaque instead. */}
        {!layoutOpen && <div className="h-4 bg-linear-to-t from-paper to-transparent" />}

        {/* Padding is IDENTICAL in both states on purpose. Any difference here shifts
            the composer the instant the state flips. */}
        <div className="pt-2 pb-2 bg-paper">
          {/* Scope chip. Shown in both states so the rep can always see — and drop —
              what the next message will be about. */}
          {scopeLabel && (
            <div className="flex items-center gap-1.5 pb-2">
              <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-sunken border border-line px-2.5 py-1 text-[11px] font-medium text-ink-2 max-w-full">
                <span className="truncate">{scopeLabel}</span>
                <button
                  onClick={() => setScopeState(dismissScope)}
                  title="Ask about all your calls instead"
                  aria-label="Clear call scope"
                  className="shrink-0 text-ink-3 hover:text-ink-1 transition-colors duration-2 ease-wm"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}

          {/* Quick prompts — only on an empty thread, and never while disabled (they
              are sends, and a send during a live call is the arrow-key hazard) or
              while another thread's request is still in flight. */}
          {thread.messages.length === 0 && !disabled && !sending && (
            <div className="flex flex-wrap gap-1.5 pb-2">
              {chips.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-control bg-surface-sunken border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-ink-2 hover:text-ink-1 hover:border-line-strong transition-colors duration-2 ease-wm"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {composer}
        </div>
      </div>
    </div>
  );
}
