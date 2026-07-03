/**
 * recall.ts — Recall AI Desktop SDK integration
 *
 * ─── How it works ────────────────────────────────────────────────────────────
 * 1. setupRecallAI()  — called once at app startup. Initializes the SDK and
 *    listens for meeting windows (Zoom, Teams, Meet, etc.).
 *
 * 2. initRecallAI()   — called when user clicks "Start Call". Fetches a
 *    short-lived upload token from Recall AI, then starts recording the
 *    detected meeting window. Real transcript chunks flow into onChunk().
 *
 * 3. stopRecallAI()   — called when user ends the call. Stops recording.
 *
 * ─── Auto-stop safeguards ─────────────────────────────────────────────────────
 * Three layers prevent Wingman from running up API costs accidentally:
 *
 * Layer 1 — meeting-closed event: If the Zoom/Teams/Meet window closes while
 *   a call is active, the SDK fires "meeting-closed" and we stop automatically.
 *
 * Layer 2 — Inactivity timeout: If no transcript chunks arrive for 20 minutes
 *   during an active call, we assume the call ended and stop automatically.
 *
 * Layer 3 — Hard cap: No call can run longer than 2 hours. Auto-stops at
 *   the limit regardless of activity.
 */

import { startMeasurementLog, logMeasurement, endMeasurementLog } from "./measurement-log";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AutoStopReason = "inactivity" | "max_duration" | "meeting_lost";

interface RecallOptions {
  /** Called every time a new transcript chunk arrives */
  onChunk: (chunk: string) => void;
  /** Called when Wingman auto-stops for any reason (cost protection) */
  onAutoStop?: (reason: AutoStopReason) => void;
  /** Called 10 minutes before the 2-hour hard cap so the HUD can warn the user */
  onApproachingLimit?: () => void;
  /**
   * Base URL of the Next.js app (e.g. https://app.meetwingman.ai).
   * Used to fetch the Recall AI upload token from the server — the API key
   * lives on Railway and is never embedded in the desktop app.
   */
  appUrl: string;
  /**
   * Supabase access token for the current user.
   * Sent as Bearer auth to /api/wingman/recall-upload-token.
   */
  authToken: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INACTIVITY_MS          = 20 * 60 * 1000;       // 20 minutes — no transcript activity
const APPROACHING_LIMIT_MS   = 110 * 60 * 1000;      // 1h 50m — warn 10 min before cap
const MAX_DURATION_MS        =   2 * 60 * 60 * 1000; // 2 hours — hard session cap

// ─── Module state ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any                              = null;
let isRunning                             = false;
let detectedWindowId: string | null       = null;
// Saved at recording start so stopRecording always has the right windowId
// even if detectedWindowId is cleared by a meeting-closed event mid-call.
let recordingWindowId: string | null      = null;

// Auto-stop safeguard timers
let hardCapTimer:          ReturnType<typeof setTimeout>  | null = null;
let approachingLimitTimer: ReturnType<typeof setTimeout>  | null = null;
let inactivityTimer:       ReturnType<typeof setInterval> | null = null;
let lastChunkAt            = 0;

// Prevents double-start: set true during the async init window (token fetch +
// sdk.startRecording) so a second call:start cannot slip through before isRunning
// is set. Cleared on both success and failure.
let isStarting = false;

// Active transcript handler for the current call. Assigned by initRecallAI
// after startRecording confirms success; nulled by stopRecallAI on call end.
// The one-time delegate registered in initRecallAI routes all realtime-events
// here — null means no call is active and events are silently ignored.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let realtimeHandler: ((evt: any) => void) | null = null;

// Tracks whether the realtime-event delegate has been registered with the SDK.
// The delegate is registered once (after the first startRecording) and then
// reused across all subsequent calls by swapping realtimeHandler. Reset to
// false if the SDK process crashes and restarts, since the new SDK process
// has no knowledge of previously registered listeners.
let realtimeListenerRegistered = false;

// Stored so the meeting-closed event handler (set up in setupRecallAI) can
// reach the callback even though it's registered before initRecallAI runs.
let autoStopFn: ((reason: AutoStopReason) => void) | null = null;

// ─── SDK Setup ────────────────────────────────────────────────────────────────

/**
 * Initialize the Recall AI SDK at app startup.
 * Passively watches for meeting windows so a windowId is ready when the
 * user clicks "Start Call".
 *
 * IMPORTANT: sdk.init() returns a Promise — we must await it before registering
 * event listeners. Registering listeners before init resolves means the SDK
 * isn't ready yet and meeting-detected events are never received.
 */
export async function setupRecallAI(onMeetingDetected?: () => void): Promise<void> {
  // Guard: setupRecallAI must only run once. If called again (e.g. accidental
  // double-invoke at startup), bail immediately — re-initializing the SDK or
  // re-registering the permanent delegate listener would cause duplicate events.
  if (sdk) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = require("@recallai/desktop-sdk");

    // Must await init() before addEventListener — SDK is not ready until resolved.
    // restartOnError: true  — if the SDK's internal process crashes, it auto-restarts
    //                         instead of staying dead for the rest of the session.
    // acquirePermissionsOnStartup: [] — disable the SDK's default auto-request so we
    //                         control timing with our own requestPermission() calls below.
    await sdk.init({
      apiUrl:                    "https://us-west-2.recall.ai",
      restartOnError:            true,
      acquirePermissionsOnStartup: [],
    });

    // ── Permission status logging ─────────────────────────────────────────────
    // Fires on startup for each permission with its current state.
    // Required: accessibility (meeting detection), microphone, screen-capture.
    sdk.addEventListener("permission-status", (evt: { permission: string; status: string }) => {
      console.log(`[Recall AI] Permission "${evt.permission}": ${evt.status}`);
    });

    sdk.addEventListener("permissions-granted", () => {
      console.log("[Recall AI] All permissions granted — meeting detection active");
    });

    // ── SDK error handler ─────────────────────────────────────────────────────
    // Catches internal SDK errors. type === "process" means the SDK's helper
    // process crashed. If a call is active we auto-stop rather than hanging.
    sdk.addEventListener("error", (evt: { type: string; message: string }) => {
      console.error(`[Recall AI] SDK error — type: ${evt.type}, message: ${evt.message}`);
      if (evt.type === "process") {
        // SDK process crashed and will restart (restartOnError: true). The new
        // SDK process has no knowledge of previously registered listeners, so
        // the realtime-event delegate must be re-registered on the next call.
        realtimeListenerRegistered = false;
        if (isRunning) {
          console.error("[Recall AI] SDK process crashed — auto-stopping call");
          // autoStopFn (autoStopCall in main.ts) already calls stopRecallAI() internally.
          // If no callback is registered, call stopRecallAI() directly as a fallback.
          if (autoStopFn) autoStopFn("meeting_lost");
          else stopRecallAI();
        }
      }
    });

    // ── Network status handler ────────────────────────────────────────────────
    // Per Recall AI docs: if network disconnects during a recording it ends
    // automatically. We listen so Wingman can reflect that in the UI.
    sdk.addEventListener("network-status", (evt: { status: "disconnected" | "reconnected" }) => {
      console.log(`[Recall AI] Network: ${evt.status}`);
      if (evt.status === "disconnected" && isRunning) {
        console.log("[Recall AI] Network lost during active call — auto-stopping");
        if (autoStopFn) autoStopFn("meeting_lost");
        else stopRecallAI();
      }
    });

    // Explicitly request all three required permissions.
    // macOS will show a system dialog the first time each is requested.
    // Without accessibility in particular, meeting-detected never fires.
    sdk.requestPermission("accessibility");
    sdk.requestPermission("microphone");
    sdk.requestPermission("screen-capture");

    // Meeting started — store window ID (string), notify main process
    sdk.addEventListener("meeting-detected", (evt: { window: { id: string } }) => {
      detectedWindowId = evt.window.id;
      console.log("[Recall AI] Meeting detected — window ID:", detectedWindowId);
      onMeetingDetected?.();
    });

    // Layer 1 — Meeting window closed while call is active → auto-stop
    // Correct event name per SDK type definitions: "meeting-closed" (not "meeting-lost")
    sdk.addEventListener("meeting-closed", (evt: { window: { id: string } }) => {
      console.log("[Recall AI] Meeting window closed — ID:", evt.window.id);
      if (detectedWindowId === evt.window.id) detectedWindowId = null;
      if (isRunning) {
        console.log("[Recall AI] Auto-stopping — meeting window closed");
        // autoStopFn (autoStopCall in main.ts) already calls stopRecallAI() internally.
        if (autoStopFn) autoStopFn("meeting_lost");
        else stopRecallAI();
      }
    });

    console.log("[Recall AI] SDK initialized, listening for meetings");
  } catch (err) {
    console.error("[Recall AI] SDK init failed:", err);
    sdk = null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns true if a meeting window (Zoom/Meet/Teams) has been detected */
export function hasMeetingDetected(): boolean {
  return detectedWindowId !== null;
}

/**
 * Start audio capture when the user begins a call.
 * Records the detected meeting window via Recall AI.
 *
 * Returns true if recording started successfully, false if it failed.
 * Timers only start after a confirmed successful startRecording() call —
 * this prevents orphaned timers and lets call:start in main.ts cleanly
 * surface failures to the web app before a DB session is created.
 */
export async function initRecallAI(options: RecallOptions): Promise<boolean> {
  // Guard against both an already-running call AND a call that is mid-init
  // (token fetch + sdk.startRecording can take ~500ms — a double-click or
  // keyboard shortcut fired twice would slip through without isStarting).
  if (isRunning || isStarting) return false;
  isStarting = true;
  autoStopFn = options.onAutoStop ?? null;

  if (!sdk) {
    console.error("[Recall AI] Cannot start — SDK failed to initialize at startup");
    autoStopFn = null;
    isStarting  = false;
    return false;
  }

  try {
    // 1. Fetch a short-lived upload token from our Next.js API route.
    //    The Recall AI API key lives on the server (Railway) — it is never
    //    embedded in the desktop app binary.
    const res = await fetch(`${options.appUrl}/api/wingman/recall-upload-token`, {
      method: "POST",
      headers: {
        "content-type":  "application/json",
        "Authorization": `Bearer ${options.authToken}`,
      },
    });

    const data = await res.json() as { upload_token?: string; error?: string };

    if (!res.ok || !data.upload_token) {
      throw new Error(
        `Failed to get upload token from server: ${data.error ?? res.status}`
      );
    }

    if (!detectedWindowId) {
      throw new Error(
        "No meeting window detected. Make sure Zoom / Teams / Meet is open before starting."
      );
    }

    // Save windowId for use in stopRecallAI — detectedWindowId may be
    // cleared by a meeting-closed event while a call is still being wrapped up.
    recordingWindowId = detectedWindowId;

    // 2. Start recording the detected meeting window
    await sdk.startRecording({
      windowId:    recordingWindowId,
      uploadToken: data.upload_token,
    });

    // 3. Assign the transcript handler AFTER startRecording confirms success.
    //    A failed startRecording attempt leaves realtimeHandler null — no stale
    //    handler from a failed attempt can accidentally process events.
    //
    // Dedup map: tracks the last emitted text per speaker.
    // Recall.ai fires the same utterance event multiple times as the transcript
    // engine processes it — sometimes milliseconds apart, sometimes 600ms+ apart.
    // A time-based window misses the slower duplicates, so we track last emitted
    // text and only emit when the text changes for that speaker.
    //
    // Genuine repeats (e.g. "Yes." said twice) re-emit correctly because other
    // speech from that speaker between the repeats resets the tracker.
    //
    // Map is scoped here — GC'd with the handler when the call ends.
    //
    // Event shape per Recall.ai docs:
    //   evt.event                      — string, e.g. "transcript.data"
    //   evt.data.data.words            — array of { text: string } word objects
    //   evt.data.data.participant.name — speaker display name
    const lastChunkPerSpeaker = new Map<string, string>();

    // #41 measurement diagnostics — a provider that silently sends nothing
    // (or a payload shape we don't parse) must be VISIBLE in the log, not
    // indistinguishable from "no partials arrived". Bounded per call:
    // unknown event names once each, unparseable payloads five max.
    const seenOtherEvents = new Set<string>();
    let emptyTextLogged = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtimeHandler = (evt: any) => {
      const isFinal   = evt.event === "transcript.data";
      const isPartial = evt.event === "transcript.partial_data";
      if (!isFinal && !isPartial) {
        const name = typeof evt?.event === "string" ? evt.event : "(unnamed)";
        if (!seenOtherEvents.has(name)) {
          seenOtherEvents.add(name);
          logMeasurement({ kind: "other_event", event: name });
        }
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const words: Array<{ text: string; start_timestamp?: any; end_timestamp?: any }> =
        evt.data?.data?.words ?? [];
      const text = words.map((w) => w.text).join(" ").trim();
      if (!text) {
        if (emptyTextLogged < 5) {
          emptyTextLogged++;
          let raw = "";
          try { raw = JSON.stringify(evt).slice(0, 600); } catch { raw = "(unserializable)"; }
          logMeasurement({ kind: "empty_event", event: evt.event, raw });
        }
        return;
      }
      const speaker: string = evt.data?.data?.participant?.name ?? "Speaker";

      // #41 measurement: record BOTH streams with word-level timing so the
      // analyzer can compare "when was it spoken" vs "when did it arrive".
      // Timestamp fields are provider-dependent — log defensively.
      const lastWord = words[words.length - 1];
      logMeasurement({
        kind: isPartial ? "partial" : "final",
        speaker,
        text,
        word_count: words.length,
        first_word_start_rel: words[0]?.start_timestamp?.relative ?? null,
        first_word_start_abs: words[0]?.start_timestamp?.absolute ?? null,
        last_word_end_rel:    lastWord?.end_timestamp?.relative ?? null,
        last_word_end_abs:    lastWord?.end_timestamp?.absolute ?? null,
      });

      // Partials are measurement-only for now — the live pipeline stays
      // finals-only until the #41 reconciliation rule is chosen from real
      // call data. Nothing below this line changes behavior.
      if (isPartial) return;

      // Always reset inactivity clock — duplicate events still represent real
      // call activity and must prevent a false inactivity auto-stop.
      lastChunkAt = Date.now();

      // Drop consecutive duplicates — only emit when text changes per speaker
      if (lastChunkPerSpeaker.get(speaker) === text) return;
      lastChunkPerSpeaker.set(speaker, text);

      options.onChunk(`${speaker}: ${text}`);
    };

    // Register the delegate once — on the first call after startRecording.
    // Subsequent calls reuse the same delegate by swapping realtimeHandler above.
    // This prevents listener stacking across call start/stop cycles while
    // respecting the SDK requirement that listeners be registered post-startRecording.
    if (!realtimeListenerRegistered) {
      sdk.addEventListener("realtime-event", (evt: unknown) => {
        realtimeHandler?.(evt);
      });
      realtimeListenerRegistered = true;
      console.log("[Recall AI] Realtime-event delegate registered");
    }

    // ── Recording is confirmed active — now start all safeguard timers ────────
    isRunning   = true;
    isStarting  = false; // clear the init semaphore now that we're fully running
    lastChunkAt = Date.now();

    // Layer 3: Hard cap — stop after 2 hours no matter what
    hardCapTimer = setTimeout(() => {
      if (!isRunning) return;
      console.log("[Recall AI] Hard cap reached (2 hours) — auto-stopping");
      options.onAutoStop?.("max_duration");
      stopRecallAI();
    }, MAX_DURATION_MS);

    // 10-minute warning — fires at 1h 50m
    approachingLimitTimer = setTimeout(() => {
      if (!isRunning) return;
      console.log("[Recall AI] Approaching 2-hour limit — warning user");
      options.onApproachingLimit?.();
    }, APPROACHING_LIMIT_MS);

    // Layer 2: Inactivity — stop if 20 minutes pass without a transcript chunk
    inactivityTimer = setInterval(() => {
      if (!isRunning) return;
      if (Date.now() - lastChunkAt > INACTIVITY_MS) {
        console.log("[Recall AI] Inactivity timeout (20 min) — auto-stopping");
        options.onAutoStop?.("inactivity");
        stopRecallAI();
      }
    }, 60 * 1000);

    // #41 measurement: open the per-call partials log. Failure is non-fatal —
    // the call runs normally, we just lose measurement data for this session.
    const measurePath = startMeasurementLog();
    if (measurePath) {
      console.log(`[Measure] #41 partials log → ${measurePath}`);
    }

    console.log("[Recall AI] Recording started");
    return true;

  } catch (err) {
    console.error("[Recall AI] Failed to start recording:", err);
    // Clean up — recording never started so no timers to clear
    autoStopFn        = null;
    recordingWindowId = null;
    isStarting        = false;
    return false;
  }
}

/**
 * Stop audio capture and clean up all timers.
 * Safe to call multiple times — guards with isRunning flag.
 */
export function stopRecallAI(): void {
  if (!isRunning) return;
  isRunning  = false;
  isStarting = false; // safety reset in case stop is called during an edge-case init
  autoStopFn = null;

  // Clear all safeguard timers
  if (hardCapTimer)          { clearTimeout(hardCapTimer);          hardCapTimer          = null; }
  if (approachingLimitTimer) { clearTimeout(approachingLimitTimer); approachingLimitTimer = null; }
  if (inactivityTimer)       { clearInterval(inactivityTimer);      inactivityTimer       = null; }

  // Null the handler — the one-time delegate registered in initRecallAI will
  // no-op on incoming events until initRecallAI assigns a new handler next call.
  realtimeHandler = null;

  if (sdk && recordingWindowId) {
    try {
      // stopRecording requires { windowId } — passing no args is a SDK error
      sdk.stopRecording({ windowId: recordingWindowId });
    } catch (err) {
      console.error("[Recall AI] Error stopping recording:", err);
    }
  }

  recordingWindowId = null;

  // #41 measurement: close the per-call partials log (idempotent).
  endMeasurementLog();

  console.log("[Recall AI] Stopped");
}
