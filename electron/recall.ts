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
 * Layer 1 — meeting-lost event: If the Zoom/Teams/Meet window closes while
 *   a call is active, the SDK fires "meeting-lost" and we stop automatically.
 *
 * Layer 2 — Inactivity timeout: If no transcript chunks arrive for 20 minutes
 *   during an active call, we assume the call ended and stop automatically.
 *
 * Layer 3 — Hard cap: No call can run longer than 2 hours. Auto-stops at
 *   the limit regardless of activity.
 *
 * ─── Simulation mode ─────────────────────────────────────────────────────────
 * If RECALL_AI_API_KEY is not set in .env.local, the app falls back to
 * simulation mode — fake transcript chunks fire every 4 seconds so you can
 * test the full HUD + signals flow without a real call.
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
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INACTIVITY_MS          = 20 * 60 * 1000;       // 20 minutes — no transcript activity
const APPROACHING_LIMIT_MS   = 110 * 60 * 1000;      // 1h 50m — warn 10 min before cap
const MAX_DURATION_MS        =   2 * 60 * 60 * 1000; // 2 hours — hard session cap

// ─── Module state ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sdk: any                             = null;
let isRunning                            = false;
let detectedWindowId: number | null      = null;
let simulationInterval: ReturnType<typeof setInterval> | null = null;

// Auto-stop safeguard timers
let hardCapTimer:          ReturnType<typeof setTimeout>  | null = null;
let approachingLimitTimer: ReturnType<typeof setTimeout>  | null = null;
let inactivityTimer:       ReturnType<typeof setInterval> | null = null;
let lastChunkAt            = 0;

// Stored so the meeting-lost event handler (set up in setupRecallAI) can
// reach the callback even though it's registered before initRecallAI runs.
let autoStopFn: ((reason: AutoStopReason) => void) | null = null;

// ─── Simulation data ──────────────────────────────────────────────────────────

const SIMULATED_TRANSCRIPT = [
  "Hey, thanks for taking the time to chat today.",
  "Of course! So tell me, what's the main challenge you're running into right now with your current process?",
  "Honestly, our close rate is really suffering. We're getting a ton of leads but they just aren't converting.",
  "Got it. How long has this been going on? Is this a recent thing or has it been a pattern for a while?",
  "It's been about six months. Since we scaled the team, the quality just dropped.",
  "Makes sense. And when you say 'quality dropped,' are we talking about reps missing follow-ups, or more like they don't know how to handle objections on the call?",
  "Honestly both. But the objections are the big one. Someone says 'I need to think about it' and the rep just... folds.",
  "Yep. That's one of the most common ones. So what does that cost you? If you could fix that, what does that mean for the business?",
  "I mean, we're probably leaving $50k a month on the table. At minimum.",
  "Okay, so there's a real financial pain here. And is this something you need to solve this quarter, or is there flexibility on timeline?",
  "We need to solve it now. Q2 is do-or-die for us.",
  "Perfect. And when it comes to making a decision like this, is it just you, or are there other stakeholders involved?",
  "It's mostly me. I have a partner but he defers to me on sales decisions.",
  "Got it. So just so I understand — you're losing around 50k a month, it needs to be fixed this quarter, and you're the decision maker. Does that sound right?",
  "Yeah, that's exactly right.",
  "Okay. So let me show you exactly how Wingman solves this.",
];

// ─── SDK Setup ────────────────────────────────────────────────────────────────

/**
 * Initialize the Recall AI SDK at app startup.
 * Passively watches for meeting windows so a windowId is ready when the
 * user clicks "Start Call".
 *
 * Also wires up the "meeting-lost" event (Layer 1 auto-stop): if the meeting
 * window closes while a call is active, Wingman stops automatically.
 *
 * Note: The exact event name for meeting end may vary by SDK version.
 * "meeting-lost" is the expected event; verify against Recall AI docs if needed.
 */
export function setupRecallAI(onMeetingDetected?: () => void): void {
  const apiKey = process.env.RECALL_AI_API_KEY;

  if (!apiKey) {
    console.log("[Recall AI] No API key found — will use simulation mode");
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    sdk = require("@recallai/desktop-sdk");
    sdk.init({ apiUrl: "https://us-east-1.recall.ai" });

    // Meeting started — store window ID, notify main process
    sdk.addEventListener("meeting-detected", (evt: { window: { id: number } }) => {
      detectedWindowId = evt.window.id;
      console.log("[Recall AI] Meeting detected — window ID:", detectedWindowId);
      onMeetingDetected?.();
    });

    // Layer 1 — Meeting window closed while call is active → auto-stop
    sdk.addEventListener("meeting-lost", () => {
      detectedWindowId = null;
      console.log("[Recall AI] Meeting window lost");
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

/**
 * Start audio capture when the user begins a call.
 * Production: records the detected meeting window via Recall AI.
 * Simulation: fires fake transcript chunks for testing.
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

  const apiKey = process.env.RECALL_AI_API_KEY;

  if (apiKey && sdk) {
    try {
      // 1. Get a short-lived upload token from Recall AI
      const res = await fetch("https://us-east-1.recall.ai/api/v1/sdk_upload/", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          Authorization: apiKey,
        },
        body: JSON.stringify({
          recording_config: {
            transcript: {
              provider: { assembly_ai_v3_streaming: {} },
            },
            realtime_endpoints: [
              {
                type: "desktop_sdk_callback",
                events: ["transcript.data"],
              },
            ],
          },
        }),
      });

      const data = await res.json() as { upload_token?: string };

      if (!data.upload_token) {
        throw new Error(`Recall AI did not return an upload token: ${JSON.stringify(data)}`);
      }

      if (!detectedWindowId) {
        throw new Error(
          "No meeting window detected. Make sure Zoom / Teams / Meet is open before starting."
        );
      }

      // 2. Listen for real-time transcript events — update lastChunkAt for inactivity tracking
      sdk.addEventListener(
        "realtime-event",
        (evt: { event: { type: string; data: { text: string } } }) => {
          if (evt.event.type === "transcript.data" && evt.event.data?.text) {
            lastChunkAt = Date.now(); // reset inactivity clock
            options.onChunk(evt.event.data.text);
          }
        }
      );

      // 3. Start recording the detected meeting window
      await sdk.startRecording({
        windowId:    detectedWindowId,
        uploadToken: data.upload_token,
      });

      console.log("[Recall AI] Recording started (production mode)");
    } catch (err) {
      console.error("[Recall AI] Failed to start recording — falling back to simulation:", err);
      startSimulation(options);
    }
  } else {
    console.log("[Recall AI] Running in SIMULATION MODE");
    startSimulation(options);
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

  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }

  if (sdk) {
    try {
      sdk.stopRecording?.();
    } catch (err) {
      console.error("[Recall AI] Error stopping recording:", err);
    }
  }

  console.log("[Recall AI] Stopped");
}

// ─── Simulation Mode ──────────────────────────────────────────────────────────

function startSimulation(options: RecallOptions): void {
  let index = 0;

  simulationInterval = setInterval(() => {
    if (index >= SIMULATED_TRANSCRIPT.length) {
      stopRecallAI();
      return;
    }

    const chunk = SIMULATED_TRANSCRIPT[index];
    console.log(`[Recall AI Sim] Chunk ${index + 1}/${SIMULATED_TRANSCRIPT.length}:`, chunk);
    lastChunkAt = Date.now(); // keep inactivity clock reset during simulation
    options.onChunk(chunk);
    index++;
  }, 4000);
}
