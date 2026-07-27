/**
 * devlog-client.ts — Flight Recorder emitter for the RENDERER (DEV-ONLY).
 *
 * The browser can't touch the fs, so client-side events POST to /api/wingman/devlog,
 * which appends them to the same per-call JSONL the server routes write. Spec:
 * tasks/plan-flight-recorder.md.
 *
 * GATE: NEXT_PUBLIC_WINGMAN_DEVLOG === "1". This is a build-time-inlined public env
 * var, so in a production build the check folds to a constant `false` and the fetch
 * is dead-code-eliminated — a real user's client never calls this. (The server route
 * is ALSO gated + 404s in prod; this is the client-side half of defense-in-depth.)
 *
 * Fire-and-forget: never awaited, never throws. Losing an event is always preferable
 * to perturbing a live call.
 */
export function logDevEvent(
  callId: string | null | undefined,
  kind: string,
  payload?: Record<string, unknown>,
): void {
  if (process.env.NEXT_PUBLIC_WINGMAN_DEVLOG !== "1") return;
  if (!callId) return;
  try {
    void fetch("/api/wingman/devlog", {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ callId, kind, payload: payload ?? {} }),
      keepalive: true, // still sends if fired as the call ends / page unloads
    }).catch(() => { /* telemetry loss is fine — never surface */ });
  } catch {
    // never let instrumentation throw into a render/handler path
  }
}
