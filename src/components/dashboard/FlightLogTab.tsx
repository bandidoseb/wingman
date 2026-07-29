"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import OutcomePill, { outcomeTone } from "@/components/ui/wm/OutcomePill";
import type { Call, TranscriptLine } from "@/types";
import { confirmedOutcome, NO_DEBRIEF_GRACE_MS } from "@/lib/wingman/outcome-stats";

const PILLAR_DISPLAY: Array<{ key: string; label: string; description: string }> = [
  { key: "core_problem",         label: "Core Problem",      description: "Rep dug into the real pain" },
  { key: "cant_diy",             label: "Can't DIY",         description: "Why they can't solve it themselves" },
  { key: "cost_of_waiting",      label: "Cost of Waiting",   description: "Made inaction feel expensive" },
  { key: "dream_outcome",        label: "Dream Outcome",     description: "Prospect named their desired result" },
  { key: "investment_readiness", label: "Investment",        description: "Budget/capacity qualified" },
  { key: "whos_involved",        label: "Who's Deciding",    description: "Decision maker confirmed" },
  { key: "why_you",              label: "Why You",           description: "Rep's unique differentiation landed" },
];

interface Props {
  calls: Call[];
  initialCall: Call | null;
  onInitialCallConsumed: () => void;
  /** Deep-link from the HUD "View call →" pill — an id (or null → just the tab). */
  initialCallId?: string | null;
  onInitialCallIdConsumed?: () => void;
  userId: string;
  isActive?: boolean;
  isPendingOutcome?: boolean;
}

// Outcome options shown in the inline picker
// Colours live in OutcomePill so the picker and the resulting chip can never drift.
const OUTCOMES = ["Closed", "Follow Up", "DQ", "No Show", "Lost"] as const;

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
      <div style={{ fontSize: 10, color: "rgb(var(--ink-2))", fontWeight: 600, marginTop: 8, marginBottom: 5, letterSpacing: "0.06em" }}>
        LOG OUTCOME
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
        {OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={(e) => pick(e, o)}
            disabled={saving !== null}
            className={`${outcomeTone(o)} text-paper rounded-pill px-2.5 h-6 text-[11px] font-semibold transition-opacity duration-2 ease-wm ${saving === o ? "opacity-100" : saving ? "opacity-30" : "opacity-55 hover:opacity-100"}`}
          >
            {saving === o ? "Saving…" : o}
          </button>
        ))}

        {/* Other pill / inline input */}
        {!otherMode ? (
          <button
            onClick={(e) => { e.stopPropagation(); setOtherMode(true); }}
            disabled={saving !== null}
            className={`bg-ink-3 text-paper rounded-pill px-2.5 h-6 text-[11px] font-semibold transition-opacity duration-2 ease-wm ${saving ? "opacity-30" : "opacity-55 hover:opacity-100"}`}
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
                border: "1px solid rgb(var(--line-strong))",
                background: "rgb(var(--surface))",
                outline: "none",
                fontFamily: "inherit",
                color: "rgb(var(--ink-1))",
                width: 140,
              }}
            />
            <button
              onClick={pickOther}
              disabled={saving !== null || !otherText.trim()}
              className={`bg-signal text-paper rounded-pill px-2.5 h-6 text-[11px] font-semibold transition-opacity duration-2 ease-wm ${!otherText.trim() ? "opacity-30" : "opacity-100"}`}
            >
              {saving === "Other" ? "Saving…" : "Save"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const d   = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  if (d.toDateString() === now.toDateString()) return `Today ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "long" })} ${time}`;
}

/**
 * True while a call could still legitimately be waiting on its post-call debrief.
 *
 * A missing `summary` is NOT proof the job is running: post-call skips any call with
 * no transcript (a test deploy, a mic-only session, a failed job), so those rows stay
 * summary-less forever. Treating them as "pending" meant a permanent fake spinner and
 * a 2s `router.refresh()` — the dashboard's full-transcript query for 20 calls — for
 * six minutes, re-armed every time the rep reopened the entry.
 *
 * The window is deliberately generous: `call_date` is the call's START time, so even a
 * maxed-out 2-hour recording plus job time lands well inside it.
 */
const DEBRIEF_WINDOW_MS = 4 * 60 * 60 * 1000;
function awaitingDebrief(call: Call | null | undefined): boolean {
  if (!call || call.summary) return false;
  const started = new Date(call.call_date).getTime();
  if (!Number.isFinite(started)) return false;
  return Date.now() - started < DEBRIEF_WINDOW_MS;
}

export default function FlightLogTab({ calls, initialCall, onInitialCallConsumed, initialCallId, onInitialCallIdConsumed, userId, isActive = false, isPendingOutcome = false }: Props) {
  const router = useRouter();
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
  type GlobalMessage = { role: "user" | "assistant"; text: string; timestamp?: number };

  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [globalMessages, setGlobalMessages] = useState<GlobalMessage[]>([]);
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

  // Deep dive state — set when Claude identifies a specific call, cleared on modal close
  const [pendingCallSuggestion, setPendingCallSuggestion] = useState<{ call_id: string; name: string; date: string } | null>(null);
  const [activeSingleCall, setActiveSingleCall]           = useState<object | null>(null);
  const singleCallHistoryRef = useRef<Array<{ role: string; content: string }>>([]);

  useEffect(() => {
    if (initialCall) {
      setSelectedCall(initialCall);
      setChatMessages([]);
      setActiveDetailTab("debrief");
      onInitialCallConsumed();
    }
  }, [initialCall, onInitialCallConsumed]);

  // Deep-link by id (HUD "View call →"). The row may not be loaded yet on a
  // just-ended call, so open a light placeholder that fills in from `calls` as
  // router.refresh lands the debrief (the detail view derives from the live prop).
  useEffect(() => {
    if (!initialCallId) return;
    const found = calls.find((c) => c.id === initialCallId);
    setSelectedCall(found ?? {
      id: initialCallId, user_id: userId, prospect_name: null, outcome: null,
      outcome_source: null, duration: null, summary: null, missed_topics: [],
      call_date: new Date().toISOString(), created_at: new Date().toISOString(),
    });
    setChatMessages([]);
    setActiveDetailTab("debrief");
    onInitialCallIdConsumed?.();
  // Only react to a NEW deep-link id, not to every calls refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCallId]);

  // Transcripts no longer arrive with the dashboard load (they're the heavy half of
  // a call — see dashboard/page.tsx). Fetched per call when its detail view opens,
  // cached for the life of the tab so reopening is instant.
  //
  // `provisional` marks a transcript fetched while the call was still generating:
  // transcript rows flush every ~25s, so a fetch racing the final flush can miss the
  // tail of the call. A provisional entry is refetched once the call's summary lands
  // (the debrief only exists after the transcript is fully written) — whether the
  // rep kept the call open (detail poll refresh) or closed and reopened it later.
  const [transcriptCache, setTranscriptCache] = useState<Record<string, { rows: TranscriptLine[]; provisional: boolean }>>({});
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  // Calls the server has confirmed will never get a debrief (no transcript captured).
  // Server-confirmed, so it beats awaitingDebrief's time-based guess immediately.
  const [noDebriefIds, setNoDebriefIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const id = selectedCall?.id;
    if (!id) return;
    const fresh = calls.find((c) => c.id === id) ?? selectedCall;
    const entry = transcriptCache[id];
    // Skip when cached — unless the entry is provisional and the debrief has since
    // landed, which means the full transcript is now available.
    if (entry && !(entry.provisional && fresh?.summary)) return;
    let cancelled = false;
    setTranscriptLoadingId(id);
    (async () => {
      try {
        const res = await fetch(`/api/calls/${id}?include=transcript`);
        if (!res.ok) return;  // keep "No transcript available." — never a stuck spinner
        const body = (await res.json()) as { transcript?: TranscriptLine[] };
        if (!cancelled) {
          setTranscriptCache((prev) => ({
            ...prev,
            [id]: { rows: body.transcript ?? [], provisional: awaitingDebrief(fresh) },
          }));
        }
      } catch {
        // Network hiccup → fall through to the empty state; reopening retries.
      } finally {
        if (!cancelled) setTranscriptLoadingId((cur) => (cur === id ? null : cur));
      }
    })();
    return () => { cancelled = true; };
    // transcriptCache in deps is what re-arms the provisional refetch; the write
    // inside is loop-safe because the guard above skips every settled entry.
  }, [selectedCall, calls, transcriptCache]);

  // While an open call has no debrief yet, poll for it so the skeleton fills in
  // even when the parent isn't already polling (e.g. a deep-link opened later).
  // Polls the LIGHT endpoint (~1KB) — never router.refresh(), which re-runs the
  // full dashboard load. One real refresh fires when the debrief lands.
  // Caps at ~6 min via a start-time ref so a stuck job can't poll forever.
  const detailPollStartRef = useRef<number | null>(null);
  const detailPollIdRef    = useRef<string | null>(null);   // which call the clock belongs to
  useEffect(() => {
    const id = selectedCall?.id;
    if (!id) { detailPollStartRef.current = null; return; }
    // Fall back to the selected anchor for a deep-linked row not in `calls` yet.
    const fresh = calls.find((c) => c.id === id) ?? selectedCall;
    // Covers both "debrief already landed" and "this call will never get one".
    if (!awaitingDebrief(fresh)) { detailPollStartRef.current = null; return; }
    // The server already told us nothing is coming — don't re-poll on reopen.
    if (noDebriefIds.has(id)) { detailPollStartRef.current = null; return; }
    // A different call than last tick → restart the grace clock. Carrying the previous
    // call's start over would make this one's 30s window already expired on tick one.
    if (detailPollIdRef.current !== id) {
      detailPollIdRef.current = id;
      detailPollStartRef.current = null;
    }
    if (detailPollStartRef.current === null) detailPollStartRef.current = Date.now();
    let inFlight = false;
    const iv = setInterval(async () => {
      if (Date.now() - (detailPollStartRef.current ?? 0) > 6 * 60 * 1000) { clearInterval(iv); return; }
      if (inFlight) return;  // a slow response must not stack requests
      inFlight = true;
      try {
        const res = await fetch(`/api/calls/${id}`);
        if (!res.ok) return;
        const body = (await res.json()) as {
          call?: { summary?: string | null };
          transcriptRows?: number | null;
        };
        if (body.call?.summary) {
          clearInterval(iv);
          router.refresh();  // the one full refresh — flows the debrief into `calls`
        } else if (
          body.transcriptRows === 0 &&
          Date.now() - (detailPollStartRef.current ?? 0) >= NO_DEBRIEF_GRACE_MS
        ) {
          // Zero rows, and long enough after the call that no save is still landing →
          // swap the skeleton for the honest note instead of spinning to the 6-min cap.
          clearInterval(iv);
          setNoDebriefIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
        }
      } catch {
        // Poll tick lost to a network blip — the next tick retries.
      } finally {
        inFlight = false;
      }
    }, 2000);  // 2s to match the pill/skeleton poll — fills the open entry in sooner
    return () => clearInterval(iv);
  }, [selectedCall, calls, router]);

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

  // ESC closes modal and clears deep dive state
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalOpen(false);
        setPendingCallSuggestion(null);
        setActiveSingleCall(null);
        singleCallHistoryRef.current = [];
      }
    };
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
    const newMessage: GlobalMessage = { role: "user", text, timestamp: Date.now() };
    setGlobalMessages((prev) => [...prev, newMessage]);
    setGlobalInput("");
    if (modalInputRef.current) modalInputRef.current.style.height = "auto";
    if (userTypingTimerRef.current) clearTimeout(userTypingTimerRef.current);
    setUserIsTyping(false);

    // ── Build request body based on current mode ─────────────────────────────
    const isInSingleCallMode = activeSingleCall !== null;
    let body: object;

    if (isInSingleCallMode) {
      // Body size guard — full transcript can be large
      const callDataStr = JSON.stringify(activeSingleCall);
      if (callDataStr.length > 800_000) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "That transcript is too large to process. Try asking about a shorter call.", timestamp: Date.now() }]);
        setGlobalLoading(false);
        globalInFlightRef.current = false;
        return;
      }
      const newTurn = { role: "user" as const, content: text };
      singleCallHistoryRef.current = [...singleCallHistoryRef.current, newTurn];
      body = {
        mode:     "single_call",
        messages: singleCallHistoryRef.current.slice(-10),
        call:     activeSingleCall,
      };
    } else {
      // Global mode — strip transcript data, include pendingCallId if set
      const callSummaries = calls.map((c) => ({
        id:             c.id,
        prospect_name:  c.prospect_name,
        outcome:        c.outcome,
        outcome_source: c.outcome_source ?? null,
        call_date:      c.call_date,
        duration:       c.duration,
        summary:        c.summary,
        missed_topics:  c.missed_topics,
      }));
      const messages = [...globalMessages.slice(-9), newMessage].map((m) => ({
        role:    m.role,
        content: m.text,
      }));
      body = {
        mode: "global",
        messages,
        callSummaries,
        ...(pendingCallSuggestion ? { pendingCallId: pendingCallSuggestion.call_id } : {}),
      };
    }

    // Kick off API immediately — hold typing indicator 2s so it looks like Wingman is reading
    const fetchPromise = fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    setGlobalLoading(true);

    try {
      const res  = await fetchPromise;
      const data = await res.json();

      if (data.limitReached) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: "You've hit today's coaching limit. Come back tomorrow — or upgrade to Pro for unlimited sessions.", timestamp: Date.now() }]);
        setGlobalLoading(false);
        globalInFlightRef.current = false;
        return;
      }

      const reply      = data.reply || "Couldn't get a response.";
      const diveReady  = data.diveReady  ?? null;
      const suggestion = data.callSuggestion ?? null;

      // ── Store callSuggestion silently (no button shown) ───────────────────
      if (suggestion) {
        setPendingCallSuggestion(suggestion);
      }

      // ── Handle diveReady: transcript fetched, switch to single-call mode ──
      if (diveReady) {
        // Show Claude's "reading transcript" reply (staggered bubbles)
        const chunks = reply.split("\n\n").filter(Boolean);
        for (let i = 0; i < chunks.length; i++) {
          if (i > 0) await new Promise<void>((r) => setTimeout(r, 3000));
          setGlobalMessages((prev) => [...prev, { role: "assistant", text: chunks[i], timestamp: Date.now() }]);
        }

        // 2-second pause, then the personalized opener
        await new Promise<void>((r) => setTimeout(r, 2000));
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: diveReady.openerReply, timestamp: Date.now() }]);

        // Switch to single-call mode
        setActiveSingleCall(diveReady.callData);
        setPendingCallSuggestion(null);
        singleCallHistoryRef.current = [{ role: "assistant", content: diveReady.openerReply }];

        setGlobalLoading(false);
        globalInFlightRef.current = false;
        return;
      }

      // ── Normal staggered bubble display ───────────────────────────────────
      const chunks = reply.split("\n\n").filter(Boolean);
      if (chunks.length <= 1) {
        setGlobalMessages((prev) => [...prev, { role: "assistant", text: reply, timestamp: Date.now() }]);
      } else {
        for (let i = 0; i < chunks.length; i++) {
          if (i > 0) await new Promise<void>((resolve) => setTimeout(resolve, 3000));
          setGlobalMessages((prev) => [...prev, { role: "assistant", text: chunks[i], timestamp: Date.now() }]);
        }
      }

      // Track conversation history when in single-call mode
      if (isInSingleCallMode) {
        singleCallHistoryRef.current = [
          ...singleCallHistoryRef.current,
          { role: "assistant", content: reply },
        ];
      }

    } catch {
      setGlobalMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again.", timestamp: Date.now() }]);
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

    // The list rows no longer carry call_transcript (dropped from the dashboard
    // query) — but the single_call coach builds its TRANSCRIPT block from this
    // payload. Graft the on-open fetch back in, or Wingman silently coaches from
    // the summary alone.
    const cached = transcriptCache[call.id];
    const rows = cached?.rows ?? call.call_transcript ?? [];
    const callWithTranscript: Call = { ...call, call_transcript: rows };

    // Tell the coach what we actually KNOW, because an empty array is ambiguous now
    // that list rows don't carry transcripts. "empty" is a proven absence — a settled
    // (non-provisional) fetch that returned zero rows. A provisional entry was fetched
    // while the call was still being written, so its emptiness proves nothing yet.
    // noDebriefIds is SERVER-confirmed zero rows past the grace window — strictly
    // stronger proof than a settled cache entry, and the only proof available on this
    // exact path: a no-transcript call never gets a summary, so its cache entry stays
    // provisional forever. Without it the UI would show "no transcript was captured"
    // while the coach said "it may still be saving — try reopening", on the primary
    // scenario this whole feature exists for.
    const transcriptStatus: "present" | "empty" | "unknown" =
      rows.length ? "present"
      : (cached && !cached.provisional) || noDebriefIds.has(call.id) ? "empty"
      : "unknown";

    // Kick off API immediately — hold typing indicator 2s so it looks like Wingman is reading
    const fetchPromise = fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "single_call", messages, call: callWithTranscript, transcriptStatus }),
    });

    await new Promise<void>(resolve => setTimeout(resolve, 2000));
    setChatLoading(true);

    try {
      const res = await fetchPromise;
      const data = await res.json();
      if (data.limitReached) {
        setChatMessages((prev) => [...prev, { role: "assistant", text: "You've hit today's coaching limit. Come back tomorrow — or upgrade to Pro for unlimited sessions.", timestamp: Date.now() }]);
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
      setChatMessages((prev) => [...prev, { role: "assistant", text: "Connection error. Try again.", timestamp: Date.now() }]);
    }
    setChatLoading(false);
    callInFlightRef.current = false;
  };

  if (selectedCall) {
    // Derive from the LIVE `calls` prop by id so an open entry fills in as the
    // post-call job lands (router.refresh updates `calls`). `selectedCall` is only
    // the identity anchor + fallback for a deep-linked row not yet loaded. Reading
    // the frozen snapshot here would leave the skeleton stuck forever (SEV-5).
    const call = calls.find((c) => c.id === selectedCall.id) ?? selectedCall;
    const stages = call.call_stages || [];
    // Cache first (the on-open fetch), then any transcript already on the row
    // (e.g. a snapshot passed via initialCall) as a fallback.
    const transcript = transcriptCache[call.id]?.rows ?? call.call_transcript ?? [];
    const transcriptLoading = transcriptLoadingId === call.id && transcript.length === 0;
    // Debrief still in flight → Granola-style skeleton that fills in. An OLD call with
    // no summary never got one (no transcript / failed job) and gets a plain note
    // instead, so the spinner can't hang forever. Same predicate drives the poll above.
    const debriefPending = awaitingDebrief(call) && !noDebriefIds.has(call.id);
    const debriefMissing = !call.summary && !debriefPending;

    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => { setSelectedCall(null); setChatMessages([]); setActiveDetailTab("debrief"); }}
          style={{ background: "none", border: "none", color: "rgb(var(--ink-2))", fontSize: 13, fontFamily: "inherit", fontWeight: 500, marginBottom: 20, padding: 0, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
          ← All Calls
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.02em" }}>{call.prospect_name}</div>
            <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", marginTop: 3 }}>
              {new Date(call.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {call.duration}
            </div>
          </div>
          {effectiveOutcome(call) && !editingOutcomes[call.id] ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <OutcomePill outcome={effectiveOutcome(call)!} />
              {!localOutcomes[call.id] && call.outcome_source === "auto" && (
                <span title="Auto-detected by Wingman — confirm or change it"
                  style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.05em", color: "rgb(var(--ink-2))", background: "rgb(var(--surface-sunken))", borderRadius: 5, padding: "2px 5px", textTransform: "uppercase" }}>
                  auto
                </span>
              )}
              <button onClick={() => setEditingOutcomes((prev) => ({ ...prev, [call.id]: true }))}
                style={{ fontSize: 10, color: "rgb(var(--signal))", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}>
                {!localOutcomes[call.id] && call.outcome_source === "auto" ? "Confirm" : "Edit"}
              </button>
            </div>
          ) : (
            <OutcomePicker callId={call.id} onSaved={handleOutcomeSaved} />
          )}
        </div>

        {call.summary && (
          <div style={{ background: "rgb(var(--surface))", borderRadius: 14, padding: "16px 18px", marginBottom: 20, boxShadow: "var(--e-sm)", border: "1px solid rgb(var(--line))" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--ink-2))", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Debrief</div>
            <div style={{ fontSize: 13.5, color: "rgb(var(--ink-1))", lineHeight: 1.6 }}>{call.summary}</div>
          </div>
        )}

        {/* Loading skeleton — the debrief hasn't landed yet. Fills in via the
            self-refresh poll above; each section appears as its data arrives. */}
        {debriefPending && (
          <div style={{ background: "rgb(var(--surface))", borderRadius: 14, padding: "16px 18px", marginBottom: 20, boxShadow: "var(--e-sm)", border: "1px solid rgb(var(--line))" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgb(var(--ink-3))", animation: "livePulse 2s ease-in-out infinite", flexShrink: 0 }} />
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--ink-2))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Generating debrief…</div>
            </div>
            {[100, 92, 78].map((w, i) => (
              <div key={i} style={{ height: 11, width: `${w}%`, borderRadius: 5, background: "rgb(var(--line))", marginBottom: i < 2 ? 9 : 0, animation: "livePulse 2s ease-in-out infinite" }} />
            ))}
          </div>
        )}

        {/* No debrief was ever generated for this call (no transcript captured). */}
        {debriefMissing && (
          <div style={{ background: "rgb(var(--surface))", borderRadius: 14, padding: "16px 18px", marginBottom: 20, boxShadow: "var(--e-sm)", border: "1px solid rgb(var(--line))" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--ink-2))", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Debrief</div>
            <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", lineHeight: 1.5 }}>No debrief for this call — no transcript was captured.</div>
          </div>
        )}

        {/* Detail tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgb(var(--line))", borderRadius: 10, padding: 4 }}>
          {[{ id: "debrief", label: "Debrief" }, { id: "transcript", label: "Transcript" }].map((t) => (
            <button key={t.id} onClick={() => setActiveDetailTab(t.id as "debrief" | "transcript")}
              style={{ flex: 1, padding: "7px 0", borderRadius: 7, border: "none", fontFamily: "inherit", fontSize: 12, fontWeight: 600, cursor: "pointer", background: activeDetailTab === t.id ? "rgb(var(--surface))" : "transparent", color: activeDetailTab === t.id ? "rgb(var(--ink-1))" : "rgb(var(--ink-2))", boxShadow: activeDetailTab === t.id ? "var(--e-sm)" : "none", transition: "all 0.18s" }}>
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
                    <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: done ? "rgb(var(--positive))" : skip ? "rgb(var(--line))" : early ? "rgb(var(--warning-weak))" : lostStage ? "rgb(var(--critical-weak))" : "rgb(var(--line))", color: done ? "rgb(var(--surface))" : skip ? "rgb(var(--ink-2))" : early ? "rgb(var(--warning))" : lostStage ? "rgb(var(--critical))" : "rgb(var(--ink-2))", border: done ? "none" : `1.5px solid ${skip ? "rgb(var(--line))" : early ? "rgb(var(--warning))" : lostStage ? "rgb(var(--critical))" : "rgb(var(--line))"}` }}>
                      {done ? "✓" : skip ? "—" : early ? "!" : lostStage ? "✗" : "○"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "rgb(var(--ink-1))" }}>{s.name}</span>
                      <span style={{ fontSize: 12, color: "rgb(var(--ink-2))", marginLeft: 8 }}>{s.note}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {call.missed_topics && call.missed_topics.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgb(var(--line))" }}>
                <SectionLabel>Topics Missed Before Pitch</SectionLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {call.missed_topics.map((m) => (
                    <div key={m} style={{ fontSize: 11.5, color: "rgb(var(--critical))", background: "rgb(var(--critical-weak))", borderRadius: 6, padding: "4px 10px", fontWeight: 500 }}>{m}</div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        )}

        {activeDetailTab === "debrief" && call.pillar_coverage && (() => {
          const coverage = call.pillar_coverage as unknown as Record<string, { covered: boolean; evidence: string | null }>;
          const coveredCount = PILLAR_DISPLAY.filter(({ key }) => coverage[key]?.covered).length;
          return (
            <Card style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <SectionLabel className="mb-0!">Framework Coverage</SectionLabel>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: coveredCount >= 6 ? "rgb(var(--positive))" : coveredCount >= 4 ? "rgb(var(--warning))" : "rgb(var(--critical))" }}>
                  {coveredCount}/{PILLAR_DISPLAY.length}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {PILLAR_DISPLAY.map(({ key, label, description }) => {
                  const result   = coverage[key];
                  const covered  = result?.covered ?? false;
                  const evidence = result?.evidence ?? null;
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, background: covered ? "rgb(var(--positive))" : "rgb(var(--line))", color: covered ? "rgb(var(--surface))" : "rgb(var(--ink-3))" }}>
                        {covered ? "✓" : "—"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: covered ? "rgb(var(--ink-1))" : "rgb(var(--ink-3))" }}>{label}</div>
                        {covered && evidence ? (
                          <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginTop: 2, lineHeight: 1.45, fontStyle: "italic" }}>"{evidence}"</div>
                        ) : !covered ? (
                          <div style={{ fontSize: 11.5, color: "rgb(var(--line-strong))", marginTop: 2 }}>{description}</div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })()}

        {activeDetailTab === "transcript" && (
          <Card>
            <SectionLabel>Transcript</SectionLabel>
            {transcriptLoading ? (
              <div style={{ fontSize: 13, color: "rgb(var(--ink-2))" }}>Loading transcript…</div>
            ) : transcript.length === 0 ? (
              <div style={{ fontSize: 13, color: "rgb(var(--ink-2))" }}>No transcript available.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[...transcript].sort((a, b) => a.sequence_order - b.sequence_order).map((line) => (
                  <div key={line.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: line.speaker === "You" ? "rgb(var(--ink-1))" : "rgb(var(--ink-2))", flexShrink: 0, marginTop: 2, minWidth: 60, textAlign: "right" }}>{line.speaker}</div>
                    <div style={{ fontSize: 13, color: "rgb(var(--ink-1))", lineHeight: 1.5, background: line.speaker === "You" ? "rgb(var(--line))" : "transparent", borderRadius: 8, padding: line.speaker === "You" ? "6px 10px" : "0", flex: 1 }}>{line.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Ask Wingman about this call */}
        <Card style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgb(var(--positive))", boxShadow: "0 0 6px rgb(var(--positive) / 0.5)", flexShrink: 0 }} />
            <div style={{ fontSize: 11, fontWeight: 600, color: "rgb(var(--ink-2))", textTransform: "uppercase", letterSpacing: "0.06em" }}>Ask Wingman — About This Call</div>
          </div>
          {chatMessages.length === 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {["What did I do well?", "What was my biggest missed opportunity?", "What's the one thing to fix on my next call?"].map((q) => (
                <button key={q} onClick={() => sendCallMessage(q, call)} style={{ fontSize: 11.5, color: "rgb(var(--ink-1))", background: "rgb(var(--line))", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
              ))}
            </div>
          )}
          {chatMessages.length > 0 && (
            <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.map((m, i) =>
                m.role === "assistant"
                  ? m.text.split("\n\n").filter(Boolean).map((chunk, ci) => (
                      <div key={`${i}-${ci}`} style={{ alignSelf: "flex-start", maxWidth: "88%", background: "rgb(var(--line))", color: "rgb(var(--ink-1))", borderRadius: "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{chunk}</div>
                    ))
                  : <div key={i} style={{ alignSelf: "flex-end", maxWidth: "88%", background: "rgb(var(--ink-1))", color: "rgb(var(--surface))", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
              )}
              {chatLoading && !userIsTyping && <div style={{ alignSelf: "flex-start", background: "rgb(var(--line))", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}><span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" /></div>}
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
              style={{ flex: 1, background: "rgb(var(--line))", border: "none", borderRadius: 9, padding: "11px 14px", color: "rgb(var(--ink-1))", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", overflow: "auto", lineHeight: 1.4, boxSizing: "border-box" }}
            />
            <button onClick={() => sendCallMessage(chatInput, call)} style={{ padding: "11px 18px", background: "rgb(var(--ink-1))", borderRadius: 9, color: "rgb(var(--surface))", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>Ask</button>
          </div>
        </Card>
      </div>
    );
  }

  // Call list view. Close-rate counts only CONFIRMED outcomes — an AI auto-mark
  // (outcome_source='auto') is excluded until the rep confirms it, and a local
  // pick made this session counts immediately (it's a manual confirmation).
  const listOutcome = (c: Call): string | null => localOutcomes[c.id] ?? confirmedOutcome(c);
  const wins = calls.filter((c) => listOutcome(c) === "Closed").length;
  const qualifying = calls.filter((c) => listOutcome(c) !== "DQ").length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.02em" }}>Flight Log</div>
        <div style={{ fontSize: 14, color: "rgb(var(--ink-2))", marginTop: 3 }}>Every call. Every transcript. All yours.</div>
      </div>

      {/* Mission Intel — entry point, opens modal */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ marginBottom: 10 }}>
          <SectionLabel className="mb-0!">Mission Intel — Ask Your Wingman</SectionLabel>
        </div>

        {/* Quick-send buttons — always visible */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {["Where do I lose most deals?", "What's my top objection?", "What works on wins?"].map((q) => (
            <button key={q} onClick={() => { setModalOpen(true); sendGlobalMessage(q); }} style={{ fontSize: 11.5, color: "rgb(var(--ink-1))", background: "rgb(var(--line))", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
          ))}
        </div>

        {/* Chat thread entry point */}
        <button
          onClick={() => setModalOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: "rgb(var(--surface-sunken))", border: "none", borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}
        >
          {/* Avatar */}
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgb(var(--ink-1))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
            <span style={{ color: "rgb(var(--surface))", fontSize: 15, fontWeight: 700, fontFamily: "inherit" }}>W</span>
            <div style={{ position: "absolute", bottom: 1, right: 1, width: 9, height: 9, borderRadius: "50%", background: "rgb(var(--positive))", border: "1.5px solid rgb(var(--surface-sunken))" }} />
          </div>
          {/* Name + preview */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "rgb(var(--ink-1))", marginBottom: 2, fontFamily: "inherit" }}>Wingman</div>
            <div style={{ fontSize: 12.5, color: "rgb(var(--ink-2))", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", fontFamily: "inherit" }}>
              {globalMessages.length > 0
                ? (() => {
                    const last = [...globalMessages].reverse().find(m => m.role === "assistant");
                    return last ? last.text.slice(0, 60) + (last.text.length > 60 ? "…" : "") : "Tap to start chatting";
                  })()
                : "Tap to start chatting"
              }
            </div>
          </div>
          {/* CTA */}
          <span style={{ fontSize: 12, color: "rgb(var(--signal))", fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0, fontFamily: "inherit" }}>
            {globalMessages.length > 0 ? "Continue →" : "Open →"}
          </span>
        </button>
      </Card>

      {/* Call list */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <SectionLabel className="mb-0!">All Calls — {calls.length}</SectionLabel>
          <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", fontWeight: 500 }}>{wins}/{qualifying} closed</div>
        </div>
        {/* Live call skeleton — green dot, actively recording */}
        {isActive && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", margin: "0 -8px", borderBottom: calls.length > 0 ? "1px solid rgb(var(--line))" : "none", marginBottom: calls.length > 0 ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgb(var(--positive-weak))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgb(var(--positive))", animation: "livePulse 2s ease-in-out infinite" }} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--ink-1))" }}>Live Call in Progress…</div>
                <div style={{ fontSize: 11.5, color: "rgb(var(--positive))", marginTop: 2, fontWeight: 500 }}>Recording now</div>
              </div>
            </div>
            <div style={{ width: 56, height: 22, borderRadius: 6, background: "rgb(var(--line))", animation: "livePulse 2s ease-in-out infinite" }} />
          </div>
        )}
        {/* Processing skeleton — call ended, waiting for disposition */}
        {!isActive && isPendingOutcome && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 8px", margin: "0 -8px", borderBottom: calls.length > 0 ? "1px solid rgb(var(--line))" : "none", marginBottom: calls.length > 0 ? 14 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgb(var(--surface-sunken))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgb(var(--ink-3))", animation: "livePulse 2s ease-in-out infinite" }} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--ink-1))" }}>Processing call…</div>
                <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginTop: 2 }}>Waiting for outcome</div>
              </div>
            </div>
            <div style={{ width: 56, height: 22, borderRadius: 6, background: "rgb(var(--line))", animation: "livePulse 2s ease-in-out infinite" }} />
          </div>
        )}
        {!isActive && calls.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "rgb(var(--ink-1))", marginBottom: 6 }}>No calls yet</div>
            <div style={{ fontSize: 13, color: "rgb(var(--ink-2))" }}>Your calls will appear here after your first session with Wingman.</div>
          </div>
        ) : calls.length > 0 ? (
          calls.map((call, i) => (
            <div key={call.id}
              onClick={() => { setSelectedCall(call); setChatMessages([]); setChatInput(""); setActiveDetailTab("debrief"); }}
              onMouseEnter={() => setHoveredCallId(call.id)}
              onMouseLeave={() => setHoveredCallId(null)}
              style={{ paddingBottom: i < calls.length - 1 ? 14 : 0, marginBottom: i < calls.length - 1 ? 14 : 0, borderBottom: i < calls.length - 1 ? "1px solid rgb(var(--line))" : "none", cursor: "pointer", borderRadius: 8, padding: "10px 8px", margin: "0 -8px", background: hoveredCallId === call.id ? "rgb(var(--surface-sunken))" : "transparent", transition: "background 0.15s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "rgb(var(--ink-1))" }}>{call.prospect_name}</div>
                  <div style={{ fontSize: 11.5, color: "rgb(var(--ink-2))", marginTop: 2 }}>
                    {new Date(call.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {call.duration}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {effectiveOutcome(call) && !editingOutcomes[call.id] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: 10, color: "rgb(var(--ink-2))", fontWeight: 600, letterSpacing: "0.06em" }}>OUTCOME</span>
                      <OutcomePill outcome={effectiveOutcome(call)!} />
                      {!localOutcomes[call.id] && call.outcome_source === "auto" && (
                        <span title="Auto-detected by Wingman — confirm or change it"
                          style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", color: "rgb(var(--ink-2))", background: "rgb(var(--surface-sunken))", borderRadius: 5, padding: "2px 5px", textTransform: "uppercase" }}>
                          auto
                        </span>
                      )}
                      {hoveredCallId === call.id && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingOutcomes((prev) => ({ ...prev, [call.id]: true })); }}
                          className="hover:bg-blue-100 rounded-sm transition-colors"
                          style={{ fontSize: 10, color: "rgb(var(--signal))", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 6px" }}
                        >
                          {!localOutcomes[call.id] && call.outcome_source === "auto" ? "Confirm" : "Edit"}
                        </button>
                      )}
                    </div>
                  )}
                  <span className="hover:bg-blue-100 rounded-sm transition-colors" style={{ fontSize: 11.5, color: "rgb(var(--signal))", fontWeight: 600, whiteSpace: "nowrap", padding: "2px 6px", borderRadius: 6 }}>View →</span>
                </div>
              </div>
              {call.summary && <div style={{ fontSize: 12, color: "rgb(var(--ink-2))", lineHeight: 1.4 }}>{call.summary}</div>}
              {(!effectiveOutcome(call) || editingOutcomes[call.id]) && (
                <OutcomePicker callId={call.id} onSaved={handleOutcomeSaved} />
              )}
            </div>
          ))
        ) : null}
      </Card>

      {/* ── Mission Intel Chat Modal ─────────────────────────────────────────── */}
      {modalOpen && (
        <div
          onClick={() => { setModalOpen(false); setPendingCallSuggestion(null); setActiveSingleCall(null); singleCallHistoryRef.current = []; }}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgb(var(--scrim) / 0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "rgb(var(--surface))", borderRadius: 18, width: 520, maxWidth: "100%", height: "82vh", display: "flex", flexDirection: "column", boxShadow: "var(--e-lg)", overflow: "hidden" }}
          >
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid rgb(var(--line))", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgb(var(--positive))", boxShadow: "0 0 6px rgb(var(--positive) / 0.5)", flexShrink: 0 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.01em" }}>Mission Intel — Ask Your Wingman</div>
              </div>
              <button onClick={() => { setModalOpen(false); setPendingCallSuggestion(null); setActiveSingleCall(null); singleCallHistoryRef.current = []; }} style={{ background: "rgb(var(--line))", border: "none", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13, color: "rgb(var(--ink-2))", fontFamily: "inherit", flexShrink: 0 }}>✕</button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Spacer pushes messages to bottom when chat is short; collapses when full so scroll works */}
              <div style={{ flex: 1 }} />
              {globalMessages.length === 0 && (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <div style={{ fontSize: 13, color: "rgb(var(--ink-2))", lineHeight: 1.6, marginBottom: 16 }}>
                    Ask Wingman anything about your calls — patterns, wins, what to fix next.
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
                    {["Where do I lose most deals?", "What's my top objection?", "What works on wins?"].map((q) => (
                      <button key={q} onClick={() => sendGlobalMessage(q)} style={{ fontSize: 11.5, color: "rgb(var(--ink-1))", background: "rgb(var(--line))", border: "none", borderRadius: 7, padding: "6px 11px", fontFamily: "inherit", fontWeight: 500, cursor: "pointer" }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
              {globalMessages.flatMap((m, i) => {
                const items: React.ReactNode[] = [];
                // Show timestamp if: first message, or 10+ min gap from previous
                const prevTs = i > 0 ? globalMessages[i - 1].timestamp : undefined;
                const showTs = m.timestamp && (i === 0 || (prevTs && m.timestamp - prevTs >= 10 * 60 * 1000));
                if (showTs) {
                  items.push(
                    <div key={`ts-${i}`} style={{ textAlign: "center", fontSize: 11, color: "rgb(var(--ink-2))", margin: "2px 0", fontFamily: "inherit" }}>
                      {formatTimestamp(m.timestamp!)}
                    </div>
                  );
                }
                if (m.role === "assistant") {
                  items.push(
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgb(var(--ink-1))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ color: "rgb(var(--surface))", fontSize: 12, fontWeight: 700, fontFamily: "inherit" }}>W</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start", maxWidth: "calc(85% - 36px)" }}>
                        {m.text.split("\n\n").filter(Boolean).map((chunk, ci) => (
                          <div key={ci} style={{ background: "rgb(var(--line))", color: "rgb(var(--ink-1))", borderRadius: "12px 12px 12px 3px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{chunk}</div>
                        ))}
                      </div>
                    </div>
                  );
                } else {
                  items.push(
                    <div key={i} style={{ alignSelf: "flex-end", maxWidth: "85%", background: "rgb(var(--ink-1))", color: "rgb(var(--surface))", borderRadius: "12px 12px 3px 12px", padding: "9px 13px", fontSize: 13, lineHeight: 1.5 }}>{m.text}</div>
                  );
                }
                return items;
              })}
              {globalLoading && !userIsTyping && (
                <div style={{ alignSelf: "flex-start", background: "rgb(var(--line))", borderRadius: "12px 12px 12px 3px", padding: "11px 14px", display: "flex", gap: 5, alignItems: "center" }}>
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </div>
              )}
              <div ref={modalEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "14px 20px", borderTop: "1px solid rgb(var(--line))", display: "flex", gap: 8, flexShrink: 0 }}>
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
                style={{ flex: 1, background: "rgb(var(--line))", border: "none", borderRadius: 9, padding: "11px 14px", color: "rgb(var(--ink-1))", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "none", overflow: "auto", lineHeight: 1.4, boxSizing: "border-box" }}
              />
              <button onClick={() => sendGlobalMessage(globalInput)} style={{ padding: "11px 18px", background: "rgb(var(--ink-1))", borderRadius: 9, color: "rgb(var(--surface))", fontSize: 12, fontFamily: "inherit", fontWeight: 600, border: "none", cursor: "pointer", alignSelf: "flex-end" }}>Ask</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
