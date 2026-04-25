"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CallStageLabel,
  LiveScorecard,
  WingmanSignal,
  SignalLogEntry,
  WingmanPollResponse,
} from "@/types";
import { DEFAULT_SCORECARD } from "@/types";
import { POLL_INTERVALS } from "@/lib/wingman/poll-intervals";
import { checkKeywordTriggers } from "@/lib/wingman/keyword-triggers";
import type { VaultObjection } from "@/types";

const NON_ALERT_COOLDOWN_MS = 90_000; // 90 seconds

interface UseWingmanPollerOptions {
  callId: string | null;
  stage: CallStageLabel;
  isActive: boolean;
  objections: VaultObjection[];
  repName?: string | null;
}

interface UseWingmanPollerReturn {
  scorecard: LiveScorecard;
  currentSignal: WingmanSignal | null;
  signalLog: SignalLogEntry[];
  isPolling: boolean;
  pollError: string | null;
  completedStages: CallStageLabel[];
  prospectName: string | null;
  addChunk: (chunk: string) => void;
  dismissSignal: () => void;
  flushBuffer: () => Promise<void>;
}

export function useWingmanPoller({
  callId,
  stage,
  isActive,
  objections,
  repName,
}: UseWingmanPollerOptions): UseWingmanPollerReturn {
  const [scorecard, setScorecard] = useState<LiveScorecard>({
    ...DEFAULT_SCORECARD,
    current_stage: stage,
  });
  const [currentSignal, setCurrentSignal] = useState<WingmanSignal | null>(null);
  const [signalLog, setSignalLog] = useState<SignalLogEntry[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);
  const [completedStages, setCompletedStages] = useState<CallStageLabel[]>([]);
  const [prospectName, setProspectName] = useState<string | null>(null);

  // Refs for stable values inside intervals/callbacks
  const scorecardRef = useRef<LiveScorecard>({ ...DEFAULT_SCORECARD, current_stage: stage });
  const chunkBufferRef = useRef<string>("");
  const lastNonAlertSignalTimeRef = useRef<number>(0);
  const currentSignalRef = useRef<WingmanSignal | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<CallStageLabel>(stage);
  const callIdRef = useRef<string | null>(callId);
  const isPollingRef = useRef(false);
  // The rep's Zoom display name — seeded from Settings, falls back to auto-detection.
  // Used to exclude the rep's lines from keyword trigger matching so cards
  // only fire when the prospect says an objection phrase, not the rep.
  const repSpeakerRef = useRef<string | null>(repName ?? null);
  // Tracks whether we've already identified the prospect's name this call.
  // Flips to true on first detection so we don't overwrite with a later speaker.
  const prospectDetectedRef = useRef(false);
  // Stable ref so the callId effect can read the latest repName without it
  // being a dependency (which would cause it to fire on every name change).
  const repNameRef = useRef<string | null>(repName ?? null);

  // Keep refs in sync
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);
  // Unconditional: handles both "Settings name changed" and "Settings name cleared".
  // Clearing zoom name (repName → null) resets repSpeakerRef so auto-detection
  // re-runs on the next transcript chunk.
  useEffect(() => {
    repNameRef.current = repName ?? null;
    repSpeakerRef.current = repName ?? null;
  }, [repName]);
  // Reset per-call speaker detection when a new call starts.
  // Seeds from Settings if available; otherwise null triggers auto-detection.
  // Prevents a stale auto-detected name from a previous call carrying into the next.
  useEffect(() => {
    if (callId) {
      repSpeakerRef.current      = repNameRef.current;
      prospectDetectedRef.current = false;
      setProspectName(null);
    }
  }, [callId]);

  /** Show a signal, respecting cooldown rules */
  const fireSignal = useCallback((signal: WingmanSignal) => {
    const now = Date.now();
    const isAlert = signal.type === "Alert";
    const isKeyword = signal.source === "keyword";
    const cooldownElapsed = now - lastNonAlertSignalTimeRef.current > NON_ALERT_COOLDOWN_MS;

    // Keyword-triggered objections always fire — bypass cooldown and any current card.
    // A prospect raising a new objection is always more urgent than what's on screen.
    // Poll-based nudges still respect the 90s cooldown and won't interrupt a live card.
    if (!isAlert && !isKeyword && !cooldownElapsed) return;
    if (!isAlert && !isKeyword && currentSignalRef.current !== null) return;

    setCurrentSignal(signal);
    currentSignalRef.current = signal;

    if (!isAlert) {
      lastNonAlertSignalTimeRef.current = now;
    }

    const entry: SignalLogEntry = {
      id: `${now}-${Math.random().toString(36).slice(2)}`,
      signal,
      firedAt: now,
    };
    setSignalLog((prev) => [entry, ...prev].slice(0, 100));
  }, []);

  /** Dismiss current signal */
  const dismissSignal = useCallback(() => {
    setCurrentSignal(null);
    currentSignalRef.current = null;
    // Start cooldown from now
    lastNonAlertSignalTimeRef.current = Date.now();
  }, []);

  /**
   * RAG-powered KB signal check — fires in parallel with keyword check.
   * Calls /api/wingman/kb-signal which runs searchKnowledge → generateSignalCard.
   * Does NOT block addChunk — fire and forget, card appears when ready (~480ms).
   * Only fires when keyword triggers also fire, to avoid over-triggering.
   * Passes a scorecard snapshot so Haiku can tailor the card to this specific call.
   */
  const runKBCheck = useCallback(
    (chunk: string) => {
      const { pain_detail, gold_moment, predicted_next_objection, objection_risk, prospect_anchors } =
        scorecardRef.current;
      fetch("/api/wingman/kb-signal", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          transcript_chunk: chunk,
          current_stage:    stageRef.current,
          scorecard_snapshot: { pain_detail, gold_moment, predicted_next_objection, objection_risk, prospect_anchors },
        }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          // Guard on signal_header (the headline) — signal_text may be intentionally
          // empty for early-stage headline-only cards. Checking signal_text would
          // suppress those cards since empty string is falsy.
          if (!data?.signal_header) return;
          fireSignal({
            type:    data.signal_type ?? "Handle",
            header:  data.signal_header,
            text:    data.signal_text ?? "",
            firedAt: Date.now(),
            source:  "keyword", // treated as instant-path for cooldown purposes
          });
        })
        .catch(() => { /* KB search failures are non-fatal */ });
    },
    [fireSignal]
  );

  /** Send current buffer to the poll API */
  const executePoll = useCallback(async () => {
    const chunk = chunkBufferRef.current.trim();
    if (!chunk || !callIdRef.current || isPollingRef.current) return;

    // Clear buffer immediately so new text accumulates in it during the request
    chunkBufferRef.current = "";
    isPollingRef.current = true;
    setIsPolling(true);

    /** Restore chunk to front of buffer on failure so it isn't lost */
    const restoreChunk = () => {
      chunkBufferRef.current = chunkBufferRef.current
        ? chunk + "\n" + chunkBufferRef.current
        : chunk;
    };

    // 10-second timeout — prevents a hung Anthropic request from locking
    // isPollingRef = true indefinitely and stalling the entire poll loop.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch("/api/wingman/poll", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          call_id: callIdRef.current,
          stage: stageRef.current,
          transcript_chunk: chunk,
          scorecard: scorecardRef.current,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        restoreChunk();
        const errData = await res.json().catch(() => ({}));
        setPollError(errData.error ?? "AI coaching unavailable. Check your subscription.");
        return;
      }
      setPollError(null);

      const data: WingmanPollResponse = await res.json();

      // Update scorecard
      const newScorecard: LiveScorecard = {
        current_stage: data.scorecard_update.stage,
        pain_locked: data.scorecard_update.pain_locked,
        pain_detail: data.scorecard_update.pain_detail,
        timeline_confirmed: data.scorecard_update.timeline_confirmed,
        finances_touched: data.scorecard_update.finances_touched,
        decision_maker_confirmed: data.scorecard_update.decision_maker_confirmed,
        objection_risk: data.scorecard_update.objection_risk,
        gold_moment: data.scorecard_update.gold_moment,
        predicted_next_objection: data.scorecard_update.predicted_next_objection,
        prospect_anchors: data.scorecard_update.prospect_anchors ?? scorecardRef.current.prospect_anchors,
      };
      scorecardRef.current = newScorecard;
      setScorecard(newScorecard);

      // Track completed stages when Ready signal fires or stage advances
      if (data.signal_type === "Ready" || data.scorecard_update.stage !== stageRef.current) {
        setCompletedStages((prev) =>
          prev.includes(stageRef.current) ? prev : [...prev, stageRef.current]
        );
      }

      // Fire signal if needed
      if (data.signal_to_fire) {
        fireSignal({
          type: data.signal_type,
          header: data.signal_header,
          text: data.signal_text,
          firedAt: Date.now(),
          source: "poll",
        });
      }
    } catch (err) {
      restoreChunk();
      if (err instanceof Error && err.name === "AbortError") {
        // Request hit the 10s timeout — log and show a transient error.
        // isPollingRef is cleared in finally so the next poll can proceed.
        console.warn("[Wingman] Poll request timed out after 10s — will retry on next poll.");
        setPollError("Response took too long — will retry.");
      } else {
        setPollError("Network error — will retry on next poll.");
        console.error("Poll error:", err);
      }
    } finally {
      clearTimeout(timeoutId);
      isPollingRef.current = false;
      setIsPolling(false);
    }
  }, [fireSignal]);

  /** Add transcript text to buffer + run KB check */
  const addChunk = useCallback(
    (chunk: string) => {
      // Capture the rep's speaker label from the very first chunk of the call.
      // The first person speaking is almost always the rep (they open the call).
      // We use their exact Zoom display name so it works regardless of format
      // (e.g. "TLG - Sebastian Perez", "Sebastian | Company", plain "Sebastian").
      if (!repSpeakerRef.current) {
        const firstLine = chunk.split("\n").find((line) => line.includes(":"));
        if (firstLine) {
          const colonIdx = firstLine.indexOf(":");
          repSpeakerRef.current = firstLine.slice(0, colonIdx).trim();
          console.log("[Wingman] Rep speaker identified:", repSpeakerRef.current);
        }
      }

      // Detect the prospect's name — first speaker who isn't the rep.
      // We compare against the rep's Zoom display name from Settings so this
      // works even if multiple people join the call.
      if (!prospectDetectedRef.current && repSpeakerRef.current) {
        const repLower = repSpeakerRef.current.toLowerCase();
        for (const line of chunk.split("\n")) {
          const colonIdx = line.indexOf(":");
          if (colonIdx === -1) continue;
          const speaker = line.slice(0, colonIdx).trim();
          if (speaker && speaker.toLowerCase() !== repLower) {
            prospectDetectedRef.current = true;
            setProspectName(speaker);
            console.log("[Wingman] Prospect speaker identified:", speaker);
            break;
          }
        }
      }

      chunkBufferRef.current += (chunkBufferRef.current ? "\n" : "") + chunk;

      // Keyword match → fire the signal immediately and run a KB check in
      // parallel so a richer card can replace it if one is found.
      const keywordHit = checkKeywordTriggers(chunk, objections, repSpeakerRef.current);
      if (keywordHit) {
        fireSignal(keywordHit);
        runKBCheck(chunk);
      }
    },
    [objections, runKBCheck, fireSignal]
  );

  // ── Auto-poll timer — restarts whenever stage or isActive changes ─────────
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isActive || !callId) return;

    const interval = POLL_INTERVALS[stage] ?? 30_000;

    intervalRef.current = setInterval(() => {
      if (chunkBufferRef.current.trim()) {
        executePoll();
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, stage, callId, executePoll]);

  /** Flush any buffered transcript chunks immediately — call on call end */
  const flushBuffer = useCallback(async () => {
    await executePoll();
  }, [executePoll]);

  return {
    scorecard,
    currentSignal,
    signalLog,
    isPolling,
    pollError,
    completedStages,
    prospectName,
    addChunk,
    dismissSignal,
    flushBuffer,
  };
}
