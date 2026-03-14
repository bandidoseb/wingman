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
}

interface UseWingmanPollerReturn {
  scorecard: LiveScorecard;
  currentSignal: WingmanSignal | null;
  signalLog: SignalLogEntry[];
  isPolling: boolean;
  pollError: string | null;
  completedStages: CallStageLabel[];
  addChunk: (chunk: string) => void;
  triggerPollNow: () => void;
  dismissSignal: () => void;
}

export function useWingmanPoller({
  callId,
  stage,
  isActive,
  objections,
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

  // Refs for stable values inside intervals/callbacks
  const scorecardRef = useRef<LiveScorecard>({ ...DEFAULT_SCORECARD, current_stage: stage });
  const chunkBufferRef = useRef<string>("");
  const lastNonAlertSignalTimeRef = useRef<number>(0);
  const currentSignalRef = useRef<WingmanSignal | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stageRef = useRef<CallStageLabel>(stage);
  const callIdRef = useRef<string | null>(callId);
  const isPollingRef = useRef(false);
  // Minimum gap between background KB scans (keyword hits bypass this cooldown)
  const lastKBCheckRef = useRef<number>(0);
  const KB_CHECK_COOLDOWN_MS = 10_000; // 10 seconds between background scans

  // Keep refs in sync
  useEffect(() => { stageRef.current = stage; }, [stage]);
  useEffect(() => { callIdRef.current = callId; }, [callId]);

  /** Show a signal, respecting cooldown rules */
  const fireSignal = useCallback((signal: WingmanSignal) => {
    const now = Date.now();
    const isAlert = signal.type === "Alert";
    const cooldownElapsed = now - lastNonAlertSignalTimeRef.current > NON_ALERT_COOLDOWN_MS;

    if (!isAlert && !cooldownElapsed) return; // cooldown active, skip non-alerts
    if (!isAlert && currentSignalRef.current !== null) return; // already showing something

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
          scorecard_snapshot: { pain_detail, gold_moment, predicted_next_objection, objection_risk, prospect_anchors },
        }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (!data?.signal_text) return;
          fireSignal({
            type:    data.signal_type ?? "Handle",
            header:  data.signal_header ?? "KB",
            text:    data.signal_text,
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
      setPollError("Network error — will retry on next poll.");
      console.error("Poll error:", err);
    } finally {
      isPollingRef.current = false;
      setIsPolling(false);
    }
  }, [fireSignal]);

  /** Add transcript text to buffer + run KB check */
  const addChunk = useCallback(
    (chunk: string) => {
      chunkBufferRef.current += (chunkBufferRef.current ? "\n" : "") + chunk;

      const now = Date.now();
      // Keyword match → fire KB check immediately (known important moment, no cooldown)
      // No keyword match → fire KB check if 10s have passed since last background scan
      const keywordHit = checkKeywordTriggers(chunk, objections);
      const backgroundDue = now - lastKBCheckRef.current > KB_CHECK_COOLDOWN_MS;

      if (keywordHit || backgroundDue) {
        lastKBCheckRef.current = now;
        runKBCheck(chunk);
      }
    },
    [objections, runKBCheck]
  );

  /** Manually trigger a poll right now (used by simulator Send Chunk button) */
  const triggerPollNow = useCallback(() => {
    executePoll();
  }, [executePoll]);

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

  return {
    scorecard,
    currentSignal,
    signalLog,
    isPolling,
    pollError,
    completedStages,
    addChunk,
    triggerPollNow,
    dismissSignal,
  };
}
