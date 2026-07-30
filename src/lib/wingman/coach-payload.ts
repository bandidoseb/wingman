import type { Call } from "@/types";

/**
 * Build the `single_call` body for /api/ai/chat — ONE definition, so every caller
 * describes the same call the same way.
 *
 * WHY IT IS SHARED: the request is prompt-cached on the context block the route
 * builds from this payload. Two callers producing two slightly different payloads
 * for the same call means a guaranteed cache MISS (a write at 1.25×, not a hit) and,
 * worse, two different truths about that call in the same session.
 */

export type TranscriptStatus = "present" | "empty" | "unknown";

export type TranscriptEntry = {
  rows: Call["call_transcript"];
  provisional: boolean;
};

/**
 * What we can HONESTLY tell the coach about the transcript.
 *
 * An empty array is ambiguous: the dashboard query drops transcripts, so "no rows"
 * usually means "not loaded", not "nothing was said". Reporting that as a proven
 * absence already shipped once and made the coach deny a real call had happened.
 *
 *  · present — we have rows.
 *  · empty   — PROVEN absence. Either a settled (non-provisional) fetch that came
 *              back with zero rows, or a server confirmation past the grace window.
 *              `noDebriefIds` is the stronger proof and the only one available on
 *              this path: a call with no transcript never gets a summary, so its
 *              cache entry stays provisional forever.
 *  · unknown — say so. Never assert absence from ignorance.
 */
export function transcriptStatusFor(
  callId: string,
  cached: TranscriptEntry | undefined,
  noDebriefIds: ReadonlySet<string>,
  rows: NonNullable<Call["call_transcript"]>
): TranscriptStatus {
  if (rows.length) return "present";
  if ((cached && !cached.provisional) || noDebriefIds.has(callId)) return "empty";
  return "unknown";
}

/**
 * The full `single_call` request body.
 *
 * `call` carries the transcript grafted back in: list rows no longer include it
 * (dropped from the dashboard query), and the route builds its TRANSCRIPT block
 * straight from this object — without the graft Wingman silently coaches from the
 * summary alone.
 */
export function buildSingleCallPayload(
  call: Call,
  cached: TranscriptEntry | undefined,
  noDebriefIds: ReadonlySet<string>
): { call: Call; transcriptStatus: TranscriptStatus } {
  const rows = cached?.rows ?? call.call_transcript ?? [];
  return {
    call: { ...call, call_transcript: rows },
    transcriptStatus: transcriptStatusFor(call.id, cached, noDebriefIds, rows),
  };
}
