"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, X, SquarePen, MessageSquare, History, ChevronDown } from "lucide-react";
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
  selectScope,
} from "@/lib/wingman/coach-scope";
import {
  EMPTY_STORE,
  activeThread,
  startThread,
  appendMessages,
  setThreadSuggestion,
  clearActive,
  selectThread,
  historyList,
  relativeAge,
  pruneStore,
  deserialize,
  migrateLegacy,
  STORAGE_KEY,
  LEGACY_STORAGE_KEY,
  type Msg,
  type Thread,
  type ThreadStore,
} from "@/lib/wingman/coach-threads";
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

/** Stable empty array — a fresh `[]` each render would invalidate every dep on it. */
const EMPTY_MESSAGES: Msg[] = [];

/**
 * Thread ids. `crypto.randomUUID` needs a SECURE CONTEXT, and it throws rather than
 * returning undefined when it isn't in one — which would fail a send with no feedback
 * at all. Every shipping path is secure (Electron → https Railway, dev → localhost),
 * so the fallback is unreachable in practice and cheap enough to have anyway. Ids are
 * local keys only: nothing persists them server-side or sends them anywhere.
 */
function newThreadId(): string {
  try {
    const id = globalThis.crypto?.randomUUID?.();
    if (id) return id;
  } catch { /* not a secure context — fall through */ }
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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

export default function CoachBar({
  calls,
  used,
  callPhase,
  enabled,
  closeSignal,
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
  /**
   * Whether this tab gets a Coach bar at all — see COACH_TABS in DashboardClient.
   *
   * The component still MOUNTS on every tab (it wraps them), so threads, scope and
   * an in-flight request all survive a trip through Settings. Only the chrome goes.
   */
  enabled: boolean;
  /**
   * A counter DashboardClient bumps on every sidebar nav click; any change closes
   * the takeover. A counter rather than a boolean so two clicks in a row both land,
   * and rather than watching `tab` so a dive's own navigation doesn't self-close.
   */
  closeSignal: number;
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
  const [store, setStore] = useState<ThreadStore>(EMPTY_STORE);
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  /**
   * Which THREAD has a request in flight — an id, not a boolean.
   *
   * A reply must be written into the conversation that asked, and the typing dots
   * must render there too. Rendering them in whatever thread is visible would show
   * a global conversation "thinking" about a question asked of a call.
   */
  const [pendingThreadId, setPendingThreadId] = useState<string | null>(null);
  /**
   * Ref, not state, so a double-submit in the same tick can't slip a second request
   * through. ONE in flight per bar: a scope switch does not unlock the composer,
   * which also serialises the daily quota so two replies can't both decrement it.
   */
  const inFlightRef = useRef<string | null>(null);

  const thread = activeThread(store, scope);
  const messages = thread?.messages ?? EMPTY_MESSAGES;
  /**
   * ANY request in flight, not just the visible thread's.
   *
   * `inFlightRef` is per-BAR, so gating the affordance on the visible thread alone
   * meant: ask a global question, click a call while it runs, and the send button
   * renders enabled while `send()` silently returns at the `inFlightRef` guard.
   * Nothing clears, nothing errors, Enter just does nothing. The dots stay scoped to
   * the asking thread (`thinking`); the LOCK is global.
   */
  const sending = pendingThreadId !== null;

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

  // A nav click means "show me that screen" — not "show me that screen with a chat
  // panel over it". Also covers navigating to a tab that has no bar at all.
  useEffect(() => {
    setOpen(false);
  }, [closeSignal, enabled]);

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
    Restore CANNOT be a lazy `useState` initialiser — this is a client component, so
    that initialiser also runs during SSR, where `localStorage` is undefined. It has
    to be an effect, which means the SAVE effect below runs once in the same commit
    with the pre-restore value. `hydratedRef` is what stops that first pass from
    writing an empty store over the one it is about to read.
  */
  /*
    `hydrated` is STATE, not a ref, and that is load-bearing.

    A ref is set synchronously, so it would already read `true` when the save effect
    below runs for the first time — in the SAME commit, before React has applied the
    restored store — and the save would write the still-empty store straight over the
    conversations it had just read. As state, `setHydrated(true)` batches into the same
    commit as `setStore(restored)`, so the save effect's first run already sees them.
  */
  const [hydrated, setHydrated] = useState(false);
  /** The legacy key is only safe to delete AFTER its content has been re-saved. */
  const legacyCleanupPendingRef = useRef(false);
  useEffect(() => {
    let restored: ThreadStore | null = null;
    try {
      restored = deserialize(localStorage.getItem(STORAGE_KEY));
      if (!restored) {
        // First run after the upgrade: carry the old single global thread across so
        // the rep doesn't lose the conversation they had open.
        restored = migrateLegacy(localStorage.getItem(LEGACY_STORAGE_KEY), newThreadId(), Date.now());
      }
      legacyCleanupPendingRef.current = true;
    } catch { /* corrupted or private mode — start fresh */ }
    if (restored) setStore(pruneStore(restored, Date.now()));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      if (Object.keys(store.threads).length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      /*
        Drop the old key only now — AFTER the migrated content has been written under
        the new one. Deleting it in the restore effect above left a window, however
        small, where the rep's pre-upgrade conversation existed in neither place.
      */
      if (legacyCleanupPendingRef.current) {
        legacyCleanupPendingRef.current = false;
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    } catch { /* quota exceeded / private mode — persistence is best-effort */ }
  }, [store, hydrated]);

  // The History menu belongs to the panel — it must not be waiting, still open,
  // the next time the rep opens it.
  useEffect(() => {
    if (!open) setHistoryOpen(false);
  }, [open]);

  // ── Send ─────────────────────────────────────────────────────────────────────
  /** Append into the thread that ASKED — by id, so "New chat" can't misroute it. */
  const appendTo = useCallback((threadId: string, ...msgs: Msg[]) => {
    setStore((prev) => appendMessages(prev, threadId, msgs, Date.now()));
  }, []);

  /** `preset` is a quick-prompt chip; a normal send reads (and clears) the composer. */
  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || inFlightRef.current || disabled) return;

    /*
      Resolve the target THREAD once, here, and address every write below by its id.
      A thread id is stable in a way a scope key is not: "New chat" starts a new
      thread rather than emptying this one, so a reply that lands afterwards goes to
      the conversation that asked for it — which is still on the History list — and
      the rep's fresh thread is left alone. That is why there is no generation
      counter any more; there is simply nowhere for a reply to be misfiled.
    */
    const key = scope;
    const existing = activeThread(store, key);
    const threadId = existing?.id ?? newThreadId();
    // Prune as we grow. Hydration prunes too, but a rep who never reloads would
    // otherwise accumulate threads all session. The thread we just started is
    // active, so it can never be the one pruned.
    if (!existing) {
      const now = Date.now();
      setStore((prev) => pruneStore(startThread(prev, key, threadId, now), now));
    }

    inFlightRef.current = threadId;
    setPendingThreadId(threadId);
    if (!preset) setInput("");
    setOpen(true);

    const priorMessages = existing?.messages ?? EMPTY_MESSAGES;
    const userMsg: Msg = { role: "user", text, timestamp: Date.now() };
    appendTo(threadId, userMsg);
    const write = (...msgs: Msg[]) => appendTo(threadId, ...msgs);

    try {
      // Body construction lives INSIDE the try on purpose: `inFlightRef` is already
      // set, so a throw out here would strand it and `pendingThreadId` forever —
      // permanent dots and a dead composer, recoverable only by reloading.
      const wire = [...priorMessages, userMsg].slice(-10).map((m) => ({ role: m.role, content: m.text }));
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
          ...(existing?.suggestion ? { pendingCallId: existing.suggestion.call_id } : {}),
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
      if (key === GLOBAL_SCOPE) {
        setStore((prev) =>
          setThreadSuggestion(prev, threadId, nextSuggestion(prev.threads[threadId]?.suggestion ?? null, data))
        );
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
          /*
            Seed the opener into that call's conversation, starting one if this is the
            first time. ONE functional update so the create and the append can't
            interleave with anything else — but the id and timestamp are generated
            OUTSIDE it: React may double-invoke an updater in StrictMode, and an
            updater that mints a fresh id each invocation is a trap waiting for the
            next person to extend it.
          */
          const seedId = newThreadId();
          const seedAt = Date.now();
          setStore((prev) => {
            const cur = activeThread(prev, dive.callId);
            const id = cur?.id ?? seedId;
            const withThread = cur ? prev : pruneStore(startThread(prev, dive.callId, id, seedAt), seedAt);
            return appendMessages(withThread, id, [{ role: "assistant", text: dive.openerReply, timestamp: seedAt }], seedAt);
          });
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
      setPendingThreadId((cur) => (cur === threadId ? null : cur));
    }
  };

  /**
   * "New chat" — start a fresh conversation in this scope, and KEEP the old one.
   *
   * Not a delete: the previous thread moves to History, which is the whole point of
   * individual chats. It also means a reply still in flight has somewhere to land,
   * so there is no orphaned-answer case to guard against.
   *
   * The scope deliberately does not change (see `dismissScope`): dropping it would
   * change which conversation is visible, and "start over on this call" would dump
   * the rep into their global thread. The chip's ✕ is the way out of a call scope.
   */
  const newChat = () => {
    setStore((prev) => clearActive(prev, scope));
    setInput("");
    setHistoryOpen(false);
  };

  /** Resume a saved conversation from History — switching scope to match it. */
  const resumeThread = (t: Thread) => {
    setStore((prev) => selectThread(prev, t.id));
    setScopeState((s) => selectScope(s, t.scope));
    setHistoryOpen(false);
    setOpen(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  /**
   * Name a conversation by WHAT IT IS ABOUT, from data we already have.
   *
   * No AI-generated titles: that would be a second model call per thread, for a
   * label, and it would occasionally be wrong about the rep's own call.
   */
  const labelForScope = useCallback(
    (s: string) => {
      if (s === GLOBAL_SCOPE) return "All calls";
      const c = calls.find((x) => x.id === s);
      return c ? `Your call with ${c.prospect_name ?? "an unknown prospect"}` : "A call no longer in your list";
    },
    [calls]
  );

  const scopeLabel = scope === GLOBAL_SCOPE ? null : labelForScope(scope);

  /*
    `sending` without `thinking` = a request is running for a conversation that is no
    longer the visible one. The commonest way in is hitting "New chat" while waiting:
    the dots belong to the old thread, so the rep is left looking at an empty panel
    with a greyed-out send button and nothing explaining why, for up to 45 seconds.
    The reply is not lost — it lands in the previous chat, which is why the copy says
    where to find it.
  */
  const waitingElsewhere = sending && pendingThreadId !== thread?.id;

  const placeholder =
    disabledReason ??
    (waitingElsewhere ? "Finishing your last message — it'll be in History" :
     scopedCall ? `Ask about ${scopedCall.prospect_name ?? "this call"}…` : "Ask Wingman about your calls…");

  const chips = scope === GLOBAL_SCOPE ? GLOBAL_CHIPS : CALL_CHIPS;
  const thinking = pendingThreadId !== null && pendingThreadId === thread?.id;

  const history = useMemo(() => historyList(store), [store]);
  // Display-only, and deliberately not state: History ages are coarse (`34m`, `1d`),
  // so a ticking clock would buy nothing but a re-render a second.
  const now = Date.now();
  /**
   * What the closed bar offers to reopen: the conversation in THIS scope if it has
   * one, otherwise the most recent anywhere. Without the fallback, a rep whose only
   * chats are on other screens sees no way back into History at all.
   */
  const resumeTarget = (messages.length > 0 ? thread : history[0]) ?? null;
  const lastLine = resumeTarget?.messages[resumeTarget.messages.length - 1]?.text ?? "";

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
      /*
        Clicking the composer reopens a conversation that ALREADY has messages — but
        never opens an empty one. That distinction is the whole rule: opening empty
        is what made the takeover "flash over to this blank screen" (Sebastian,
        2026-07-29), while refusing to reopen a real thread meant the only way back
        to your own messages was to send another one.
      */
      onClick={() => { if (messages.length > 0) setOpen(true); }}
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

  /*
    Tabs that get no bar render their children bare — no wrapper, no height floor,
    nothing. The component itself stays mounted (it wraps every tab), so threads,
    scope and any in-flight request survive a trip through Settings untouched.
  */
  if (!enabled) return <>{children}</>;

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
            /*
              `bottom-6` + `-mb-6` is what makes the bar sit at the SAME height on
              every screen. The two states resolve their position differently and
              used to disagree by 40px:

               · SHORT page (Home) — the column never scrolls, so the bar rests at
                 its natural place: the end of a `min-h-[calc(100vh-96px)]` column,
                 i.e. 48px up (the page's own bottom padding).
               · LONG page (Flight Log) — the page scrolls, so sticky pins it to
                 `bottom`, i.e. hard against the viewport edge.

              `-mb-6` pulls the natural resting place down 24px (48 → 24) and
              `bottom-6` lifts the pinned one up 24px (0 → 24). Both land at 24px,
              which is the midpoint Sebastian asked for — Home's gap felt right,
              Flight Log's was "way too low".

              Change one, change the other, or the two screens drift apart again.

              z-10: the Sales DNA banner has z-indexed children in the root stacking
              context and would otherwise paint over the bar as it scrolls past.
            */
            : "sticky bottom-6 -mb-6 z-10 w-full max-w-[640px] mx-auto"
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
                  {/* History — every saved conversation, newest first. Anchored to
                      this button so the menu can't drift from it. */}
                  {history.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setHistoryOpen((v) => !v)}
                        title="Past conversations"
                        aria-label="History"
                        aria-expanded={historyOpen}
                        className="h-8 px-2 rounded-pill inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-3 hover:text-ink-1 hover:bg-surface-sunken transition-colors duration-2 ease-wm"
                      >
                        <History className="h-3.5 w-3.5" />
                        History
                        <ChevronDown className={`h-3 w-3 transition-transform duration-2 ease-wm ${historyOpen ? "rotate-180" : ""}`} />
                      </button>

                      {historyOpen && (
                        <>
                          {/* Full-screen catcher: clicking anywhere else closes the
                              menu WITHOUT that click also hitting what's underneath. */}
                          <div className="fixed inset-0 z-20" onClick={() => setHistoryOpen(false)} />
                          <div className="absolute right-0 top-9 z-30 w-[300px] max-h-[320px] overflow-y-auto no-scrollbar rounded-card border border-line bg-surface shadow-float p-1">
                            {history.map((t) => {
                              const active = t.id === thread?.id;
                              return (
                                <button
                                  key={t.id}
                                  onClick={() => resumeThread(t)}
                                  className={`w-full text-left rounded-control px-2.5 py-2 transition-colors duration-2 ease-wm ${active ? "bg-surface-sunken" : "hover:bg-surface-sunken"}`}
                                >
                                  <div className="flex items-baseline gap-2">
                                    <span className="flex-1 truncate text-[12.5px] font-medium text-ink-1">
                                      {labelForScope(t.scope)}
                                    </span>
                                    <span className="shrink-0 text-[11px] tabular-nums text-ink-3">
                                      {relativeAge(t.updatedAt, now)}
                                    </span>
                                  </div>
                                  {/* The first thing the rep ASKED — what actually
                                      tells two chats about the same call apart. */}
                                  <div className="truncate text-[11.5px] text-ink-3 mt-0.5">
                                    {t.messages.find((m) => m.role === "user")?.text ?? "…"}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

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
                  {messages.length === 0 && !thinking && (
                    <p className="text-body text-ink-3">
                      {scopedCall
                        ? "Ask anything about this call — what landed, what didn't, what to do next time."
                        : "Ask about a call, an objection you keep hitting, or what to do differently next time."}
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
          {messages.length === 0 && !disabled && !sending && (
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

          {/* The way back INTO a conversation you closed.
              Without it the thread is invisible once the takeover is dismissed and
              the only way to see your own messages again is to send another one —
              which costs a Sonnet call and a quota decrement to re-read something
              you already have (Sebastian, 2026-07-30). Shows the last reply so the
              row says WHICH conversation, the way Granola's chat entry does. */}
          {!layoutOpen && resumeTarget && (
            <button
              // `resumeThread`, not a bare `setOpen(true)`: when this row is the
              // FALLBACK it points at another scope's conversation, and just opening
              // the panel would show the current (empty) one instead of the chat the
              // row previewed. It also has to say which conversation that is, or the
              // scope appears to change on its own.
              onClick={() => resumeThread(resumeTarget)}
              className="group/resume flex w-full items-center gap-2 rounded-control bg-surface-sunken border border-line px-2.5 py-1.5 mb-2 text-left hover:border-line-strong transition-colors duration-2 ease-wm"
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-ink-3" />
              <span className="flex-1 truncate text-[11.5px] text-ink-2">
                {resumeTarget.scope !== scope && (
                  <span className="text-ink-3">{labelForScope(resumeTarget.scope)} · </span>
                )}
                {lastLine}
              </span>
              <span className="shrink-0 text-[11px] font-semibold text-signal">Continue →</span>
            </button>
          )}

          {composer}
        </div>
      </div>
    </div>
  );
}
