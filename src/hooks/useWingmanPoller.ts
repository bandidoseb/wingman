"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PusherClient from "pusher-js";
import type {
  CallStageLabel,
  LiveScorecard,
  SignalType,
  WingmanSignal,
  SignalLogEntry,
  WingmanPollResponse,  // used in PusherScorecardEvent type below
} from "@/types";
import { DEFAULT_SCORECARD } from "@/types";
import { checkKeywordTriggers } from "@/lib/wingman/keyword-triggers";
import type { VaultObjection } from "@/types";

// ── Pusher event payload types ────────────────────────────────────────────────
interface PusherSignalEvent {
  signal_type:   SignalType;
  signal_header: string;
  signal_text:   string;
  source:        "poll" | "kb";
}

interface PusherScorecardEvent {
  scorecard_update: WingmanPollResponse["scorecard_update"];
  signal_type:      SignalType;
}

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

  // Pusher client — created once on mount, persists for the lifetime of the hook.
  // Initialized in a useEffect so it only runs in the browser (never during SSR).
  const pusherRef = useRef<PusherClient | null>(null);

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

  // ── Pusher client init — runs once on mount (browser only) ──────────────────
  useEffect(() => {
    const key     = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

    if (!key || !cluster) {
      console.error("[Wingman] Pusher env vars not set — real-time signal push disabled");
      return;
    }

    pusherRef.current = new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });

    return () => {
      pusherRef.current?.disconnect();
      pusherRef.current = null;
    };
  }, []);

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

  // ── Pusher channel subscription — per call ────────────────────────────────
  // Placed after fireSignal so its dep array can reference the stable callback
  // without hitting the const temporal dead zone.
  // Subscribe when a call becomes active; unsubscribe and unbind on call end.
  useEffect(() => {
    if (!isActive || !callId || !pusherRef.current) return;

    const channelName = `private-wingman-call-${callId}`;
    const channel     = pusherRef.current.subscribe(channelName);

    channel.bind("signal-card", (data: PusherSignalEvent) => {
      try {
        if (!data?.signal_header) return;
        fireSignal({
          type:    data.signal_type ?? "Handle",
          header:  data.signal_header,
          text:    data.signal_text ?? "",
          firedAt: Date.now(),
          // KB signals ("kb") use the "keyword" cooldown path so they bypass the
          // 90s cooldown — a prospect raising an objection is always urgent.
          source:  data.source === "kb" ? "keyword" : "poll",
        });
      } catch (err) {
        console.error("[Wingman] Error handling signal-card event:", err);
      }
    });

    channel.bind("scorecard-update", (data: PusherScorecardEvent) => {
      try {
        if (!data?.scorecard_update) return;
        const su = data.scorecard_update;
        const newScorecard: LiveScorecard = {
          current_stage:            su.stage,
          pain_locked:              su.pain_locked,
          pain_detail:              su.pain_detail,
          timeline_confirmed:       su.timeline_confirmed,
          finances_touched:         su.finances_touched,
          decision_maker_confirmed: su.decision_maker_confirmed,
          objection_risk:           su.objection_risk,
          gold_moment:              su.gold_moment,
          predicted_next_objection: su.predicted_next_objection,
          prospect_anchors:         su.prospect_anchors ?? scorecardRef.current.prospect_anchors,
        };
        scorecardRef.current = newScorecard;
        setScorecard(newScorecard);

        // Mark the current stage complete when Claude signals a transition.
        // "Ready" = stage done; stage mismatch = Claude advanced past it.
        if (data.signal_type === "Ready" || su.stage !== stageRef.current) {
          setCompletedStages((prev) =>
            prev.includes(stageRef.current) ? prev : [...prev, stageRef.current]
          );
        }
      } catch (err) {
        console.error("[Wingman] Error handling scorecard-update event:", err);
      }
    });

    return () => {
      channel.unbind_all();
      pusherRef.current?.unsubscribe(channelName);
    };
  }, [isActive, callId, fireSignal]);

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
      // Fire and forget — the server pushes the resulting card via Pusher.
      // No response body processing needed.
      fetch("/api/wingman/kb-signal", {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({
          transcript_chunk:   chunk,
          call_id:            callIdRef.current,
          current_stage:      stageRef.current,
          scorecard_snapshot: { pain_detail, gold_moment, predicted_next_objection, objection_risk, prospect_anchors },
        }),
      }).catch(() => { /* KB search failures are non-fatal */ });
    },
    []
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
      // Response is { ok: true } — signal cards and scorecard updates
      // arrive via the Pusher "scorecard-update" and "signal-card" events.
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
  }, []);

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

  // Persist current buffer to /transcript (no AI, no Pusher).
  // Replaces executePoll as the auto-save heartbeat so transcript rows are
  // written independently of the Sonnet poll (which Phase 1 removes).
  const executeTranscriptSave = useCallback(async () => {
    const chunk = chunkBufferRef.current.trim();
    if (!chunk || !callIdRef.current || isPollingRef.current) return;

    chunkBufferRef.current = "";
    isPollingRef.current = true;

    const restoreChunk = () => {
      chunkBufferRef.current = chunkBufferRef.current
        ? chunk + "\n" + chunkBufferRef.current
        : chunk;
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch("/api/wingman/transcript", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ call_id: callIdRef.current, transcript_chunk: chunk }),
        signal: controller.signal,
      });

      if (!res.ok) {
        restoreChunk();
        console.error("[Wingman] Transcript save failed:", (await res.json().catch(() => ({}))).error);
      }
    } catch (err) {
      restoreChunk();
      if (err instanceof Error && err.name === "AbortError") {
        console.warn("[Wingman] Transcript save timed out — will retry on next interval.");
      } else {
        console.error("[Wingman] Transcript save error:", err);
      }
    } finally {
      clearTimeout(timeoutId);
      isPollingRef.current = false;
    }
  }, []);

  // ── Transcript-save heartbeat — fixed 25s cadence, no AI cost ────────────
  // Decoupled from stage; Phase 1 removes executePoll entirely.
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isActive || !callId) return;

    intervalRef.current = setInterval(() => {
      if (chunkBufferRef.current.trim()) {
        executeTranscriptSave();
      }
    }, 25_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, callId, executeTranscriptSave]);

  /** Flush any buffered transcript chunks immediately — call on call end */
  const flushBuffer = useCallback(async () => {
    await executeTranscriptSave();
  }, [executeTranscriptSave]);

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
