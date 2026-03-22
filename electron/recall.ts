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
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = require("@recallai/desktop-sdk");

    // Must await init() before addEventListener — SDK is not ready until resolved
    await sdk.init({ apiUrl: "https://us-east-1.recall.ai" });

    // ── Permission status logging ─────────────────────────────────────────────
    // Fires on startup for each permission with its current state.
    // Required: accessibility (meeting detection), microphone, screen-capture.
    sdk.addEventListener("permission-status", (evt: { permission: string; status: string }) => {
      console.log(`[Recall AI] Permission "${evt.permission}": ${evt.status}`);
    });

    sdk.addEventListener("permissions-granted", () => {
      console.log("[Recall AI] All permissions granted — meeting detection active");
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
      if (isRunning && autoStopFn) {
        console.log("[Recall AI] Auto-stopping — meeting window closed");
        autoStopFn("meeting_lost");
        stopRecallAI();
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
 * Starts all three auto-stop safeguards immediately on recording start.
 */
export async function initRecallAI(options: RecallOptions): Promise<void> {
  if (isRunning) return;
  isRunning  = true;
  lastChunkAt = Date.now();
  autoStopFn  = options.onAutoStop ?? null;

  // ── Layer 3: Hard cap — stop after 2 hours no matter what ─────────────────
  hardCapTimer = setTimeout(() => {
    if (!isRunning) return;
    console.log("[Recall AI] Hard cap reached (2 hours) — auto-stopping");
    options.onAutoStop?.("max_duration");
    stopRecallAI();
  }, MAX_DURATION_MS);

  // ── 10-minute warning — fires at 1h 50m ────────────────────────────────────
  approachingLimitTimer = setTimeout(() => {
    if (!isRunning) return;
    console.log("[Recall AI] Approaching 2-hour limit — warning user");
    options.onApproachingLimit?.();
  }, APPROACHING_LIMIT_MS);

  // ── Layer 2: Inactivity — stop if 20 minutes pass without a transcript chunk ─
  inactivityTimer = setInterval(() => {
    if (!isRunning) return;
    if (Date.now() - lastChunkAt > INACTIVITY_MS) {
      console.log("[Recall AI] Inactivity timeout (20 min) — auto-stopping");
      options.onAutoStop?.("inactivity");
      stopRecallAI();
    }
  }, 60 * 1000); // check once per minute

  if (sdk) {
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

      // Save windowId for use in stopRecordingAI — detectedWindowId may be
      // cleared by meeting-closed while a call is still being wrapped up.
      recordingWindowId = detectedWindowId;

      // 2. Listen for real-time transcript events — update lastChunkAt for inactivity tracking
      // Event shape per Recall.ai docs:
      //   evt.event          — string, e.g. "transcript.data"
      //   evt.data.data.words — array of { text: string } word objects
      //   evt.data.data.participant.name — speaker display name
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sdk.addEventListener("realtime-event", (evt: any) => {
        if (evt.event !== "transcript.data") return;
        const words: Array<{ text: string }> = evt.data?.data?.words ?? [];
        const text = words.map((w) => w.text).join(" ").trim();
        if (!text) return;
        const speaker: string = evt.data?.data?.participant?.name ?? "Speaker";
        lastChunkAt = Date.now(); // reset inactivity clock
        options.onChunk(`${speaker}: ${text}`);
      });

      // 3. Start recording the detected meeting window
      await sdk.startRecording({
        windowId:    recordingWindowId,
        uploadToken: data.upload_token,
      });

      console.log("[Recall AI] Recording started (production mode)");
    } catch (err) {
      console.error("[Recall AI] Failed to start recording:", err);
      options.onAutoStop?.("meeting_lost");
      stopRecallAI();
    }
  } else {
    console.error("[Recall AI] Cannot start — SDK failed to initialize at startup");
    options.onAutoStop?.("meeting_lost");
    stopRecallAI();
  }
}

/**
 * Stop audio capture and clean up all timers.
 * Safe to call multiple times — guards with isRunning flag.
 */
export function stopRecallAI(): void {
  if (!isRunning) return;
  isRunning  = false;
  autoStopFn = null;

  // Clear all safeguard timers
  if (hardCapTimer)          { clearTimeout(hardCapTimer);          hardCapTimer          = null; }
  if (approachingLimitTimer) { clearTimeout(approachingLimitTimer); approachingLimitTimer = null; }
  if (inactivityTimer)       { clearInterval(inactivityTimer);      inactivityTimer       = null; }

  if (sdk && recordingWindowId) {
    try {
      // stopRecording requires { windowId } — passing no args is a SDK error
      sdk.stopRecording({ windowId: recordingWindowId });
    } catch (err) {
      console.error("[Recall AI] Error stopping recording:", err);
    }
  }

  recordingWindowId = null;
  console.log("[Recall AI] Stopped");
}
