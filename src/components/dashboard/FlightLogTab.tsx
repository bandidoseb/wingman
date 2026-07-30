"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/ui/SectionLabel";
import { outcomeTone } from "@/components/ui/wm/OutcomePill";
import OutcomeControl from "@/components/ui/wm/OutcomeControl";
import CopyButton from "@/components/ui/wm/CopyButton";
import type { Call, TranscriptLine } from "@/types";
import { confirmedOutcome, NO_DEBRIEF_GRACE_MS } from "@/lib/wingman/outcome-stats";
import { useCoachContext, useTranscriptMeta } from "@/components/dashboard/coach/CoachProvider";

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

export default function FlightLogTab({ calls: callsProp, initialCall, onInitialCallConsumed, initialCallId, onInitialCallIdConsumed, userId, isActive = false, isPendingOutcome = false }: Props) {
  const router = useRouter();
  const {
    setSessionOutcome, applySessionOutcomes,
    getTranscript, setTranscript, noDebriefIds, markNoDebrief,
    setOpenCallId,
  } = useCoachContext();
  // Separate context on purpose — this is the one subscription that must re-render
  // when a transcript lands, and the Coach bar deliberately does not share it.
  const transcriptMeta = useTranscriptMeta();
  // Overlay this session's confirmations ONCE, here, so every consumer below —
  // the list, the header count, the detail view and the coach payload — reads the
  // same rows. Previously each did its own `localOutcomes[id] ?? …` lookup.
  const calls = useMemo(() => applySessionOutcomes(callsProp), [callsProp, applySessionOutcomes]);
  const [selectedCall, setSelectedCall] = useState<Call | null>(initialCall);
  // The overlay has to reach the fallback row too — see the note where it is used.
  const selectedCallOverlaid = useMemo(
    () => (selectedCall ? applySessionOutcomes([selectedCall])[0] : null),
    [selectedCall, applySessionOutcomes]
  );
  const [activeDetailTab, setActiveDetailTab] = useState<"debrief" | "transcript">("debrief");

  // Opening a call (or going back to the list) replaces the page body but leaves the
  // window scrolled where it was — click a call from far down the list and the detail
  // view opens somewhere in its middle. Keyed on the id so it fires for open, back,
  // AND the HUD "View call →" deep-link, which sets selectedCall without a click.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [selectedCall?.id]);
  const [editingOutcomes, setEditingOutcomes] = useState<Record<string, boolean>>({});
  const [hoveredCallId, setHoveredCallId] = useState<string | null>(null);

  const handleOutcomeSaved = (callId: string, outcome: string) => {
    setSessionOutcome(callId, outcome);
    setEditingOutcomes((prev) => ({ ...prev, [callId]: false }));
  };

  // `calls` already carries this session's confirmations (applySessionOutcomes runs
  // on the prop below), so the old `localOutcomes[id] ?? …` reads are now just reads.
  const effectiveOutcome = (call: Call) => call.outcome;

  /*
    Tell the Coach bar which call is on screen — its `derived` scope.

    The CLEANUP is the load-bearing half. This tab unmounts on every tab change
    (DashboardClient renders it conditionally), so without it the bar would keep
    answering about a call that is no longer visible anywhere. It also fires when the
    rep goes back to the list, and on the HUD deep-link path, because both change
    `selectedCall`.
  */
  useEffect(() => {
    setOpenCallId(selectedCall?.id ?? null);
    return () => setOpenCallId(null);
  }, [selectedCall?.id, setOpenCallId]);

  useEffect(() => {
    if (initialCall) {
      setSelectedCall(initialCall);
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
  const [transcriptLoadingId, setTranscriptLoadingId] = useState<string | null>(null);
  useEffect(() => {
    const id = selectedCall?.id;
    if (!id) return;
    const fresh = calls.find((c) => c.id === id) ?? selectedCall;
    // The META, not the rows — rows live in a ref and never re-run this effect.
    const meta = transcriptMeta[id];
    // Skip when cached — unless the entry is provisional and the debrief has since
    // landed, which means the full transcript is now available.
    if (meta && !(meta.provisional && fresh?.summary)) return;
    let cancelled = false;
    setTranscriptLoadingId(id);
    (async () => {
      try {
        const res = await fetch(`/api/calls/${id}?include=transcript`);
        if (!res.ok) return;  // keep "No transcript available." — never a stuck spinner
        const body = (await res.json()) as { transcript?: TranscriptLine[] };
        if (!cancelled) {
          setTranscript(id, { rows: body.transcript ?? [], provisional: awaitingDebrief(fresh) });
        }
      } catch {
        // Network hiccup → fall through to the empty state; reopening retries.
      } finally {
        if (!cancelled) setTranscriptLoadingId((cur) => (cur === id ? null : cur));
      }
    })();
    return () => { cancelled = true; };
    // `transcriptMeta` in deps is what re-arms the provisional refetch; the write
    // inside is loop-safe because the guard above skips every settled entry, AND
    // `setTranscript` returns the same meta object when nothing observable changed.
  }, [selectedCall, calls, transcriptMeta, setTranscript]);

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
          markNoDebrief(id);
        }
      } catch {
        // Poll tick lost to a network blip — the next tick retries.
      } finally {
        inFlight = false;
      }
    }, 2000);  // 2s to match the pill/skeleton poll — fills the open entry in sooner
    return () => clearInterval(iv);
  }, [selectedCall, calls, router]);

  if (selectedCall) {
    // Derive from the LIVE `calls` prop by id so an open entry fills in as the
    // post-call job lands (router.refresh updates `calls`). `selectedCall` is only
    // the identity anchor + fallback for a deep-linked row not yet loaded. Reading
    // the frozen snapshot here would leave the skeleton stuck forever (SEV-5).
    // `selectedCallOverlaid`, not raw `selectedCall`: on the HUD deep-link path this
    // fallback is a SYNTHETIC row (outcome: null) for a call not yet in `calls`, so a
    // confirmation made right here would be applied to the shared map and then read
    // straight past — the picker would re-render as "LOG OUTCOME" as if the click
    // never happened, and the rep would click again. The old code was immune because
    // it read `localOutcomes[id] ?? call.outcome` at every site.
    const call = calls.find((c) => c.id === selectedCall.id) ?? selectedCallOverlaid!;
    const stages = call.call_stages || [];
    // Cache first (the on-open fetch), then any transcript already on the row
    // (e.g. a snapshot passed via initialCall) as a fallback.
    // Reading the ref during render is safe here BECAUSE every write to it is paired
    // with a `transcriptMeta` state write in the same call — this component only
    // renders in response to that meta, so it can never show rows without their meta.
    const transcript = getTranscript(call.id)?.rows ?? call.call_transcript ?? [];
    const transcriptLoading = transcriptLoadingId === call.id && transcript.length === 0;
    // Debrief still in flight → Granola-style skeleton that fills in. An OLD call with
    // no summary never got one (no transcript / failed job) and gets a plain note
    // instead, so the spinner can't hang forever. Same predicate drives the poll above.
    const debriefPending = awaitingDebrief(call) && !noDebriefIds.has(call.id);
    const debriefMissing = !call.summary && !debriefPending;

    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <button onClick={() => { setSelectedCall(null); setActiveDetailTab("debrief"); }}
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
            <OutcomeControl
              outcome={effectiveOutcome(call)!}
              isAuto={call.outcome_source === "auto"}
              onEdit={() => setEditingOutcomes((prev) => ({ ...prev, [call.id]: true }))}
            />
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
            {/* SectionLabel carries its own bottom margin, so the row zeroes it out
                and owns the spacing — otherwise the copy button sits 14px high. */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <SectionLabel className="mb-0">Transcript</SectionLabel>
              {transcript.length > 0 && (
                <CopyButton
                  getText={() =>
                    [...transcript]
                      .sort((a, b) => a.sequence_order - b.sequence_order)
                      .map((l) => `${l.speaker}: ${l.text}`)
                      .join("\n")
                  }
                />
              )}
            </div>
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

      </div>
    );
  }

  // Call list view. Close-rate counts only CONFIRMED outcomes — an AI auto-mark
  // (outcome_source='auto') is excluded until the rep confirms it, and a local
  // pick made this session counts immediately (it's a manual confirmation).
  const listOutcome = (c: Call): string | null => confirmedOutcome(c);
  const wins = calls.filter((c) => listOutcome(c) === "Closed").length;
  const qualifying = calls.filter((c) => listOutcome(c) !== "DQ").length;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "rgb(var(--ink-1))", letterSpacing: "-0.02em" }}>Flight Log</div>
        <div style={{ fontSize: 14, color: "rgb(var(--ink-2))", marginTop: 3 }}>Every call. Every transcript. All yours.</div>
      </div>

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
              onClick={() => { setSelectedCall(call); setActiveDetailTab("debrief"); }}
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
                    <OutcomeControl
                      outcome={effectiveOutcome(call)!}
                      isAuto={call.outcome_source === "auto"}
                      onEdit={() => setEditingOutcomes((prev) => ({ ...prev, [call.id]: true }))}
                    />
                  )}
                  <span className="text-signal font-semibold text-[11.5px] whitespace-nowrap px-1.5 py-0.5 rounded-control">View →</span>
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

    </div>
  );
}
