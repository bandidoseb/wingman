import type { Call, TranscriptLine } from "@/types";

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
/**
 * Salvage the transcript the SERVER already read during a dive.
 *
 * WHY: `/api/ai/chat`'s DIVE_NOW branch fetches the whole call plus its transcript
 * before it answers, then the reply says "Read it." If the client throws those rows
 * away and waits for Flight Log's own `?include=transcript` fetch, a rep who answers
 * the opener inside that window gets `transcriptStatus: "unknown"` — and the route's
 * honest-ignorance branch makes Wingman say it can't pull the transcript up, one turn
 * after claiming it had read it. That contradiction costs a Sonnet call and a quota
 * decrement to produce.
 *
 * The dive row is selected as `(speaker, text, sequence_order)` — no `id`, no
 * `call_id` — so those two are synthesised. They are React keys and a foreign key
 * that nothing here persists or sends back; `sequence_order` is unique per call, so
 * the synthetic id is stable and collision-free. The entry is marked PROVISIONAL, so
 * Flight Log still refetches the real rows the moment the call is opened.
 *
 * Returns null (never a partial list) when the payload isn't the expected shape —
 * a half-salvaged transcript is worse than none, because rows.length > 0 reports as
 * a PROVEN "present" to the coach.
 */
export function transcriptRowsFromDive(callId: string, callData: unknown): TranscriptLine[] | null {
  const rows = (callData as { call_transcript?: unknown } | null)?.call_transcript;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out: TranscriptLine[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") return null;
    const { speaker, text, sequence_order } = r as Record<string, unknown>;
    if (typeof speaker !== "string" || typeof text !== "string" || typeof sequence_order !== "number") return null;
    out.push({ id: `${callId}:${sequence_order}`, call_id: callId, speaker, text, sequence_order });
  }
  return out;
}

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
