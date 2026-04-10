/**
 * POST /api/wingman/post-call
 *
 * Async post-call analysis job.
 * Fired fire-and-forget by PATCH /api/wingman/session when a call ends.
 * Never blocks the call-end response — caller does not wait.
 *
 * Flow:
 *   Load transcript → Sonnet → objection upsert → update calls record
 *
 * Model: Claude Sonnet (quality over speed — this runs async, not live)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

// ── Post-call analysis system prompt ────────────────────────────────────────
const POST_CALL_SYSTEM_PROMPT = `You are analyzing a completed sales call transcript to help the rep improve.

Return valid JSON only with this exact structure:
{
  "debrief": "2-3 sentence summary. What worked, what was missed, key moments. Be specific and actionable.",
  "objections_raised": ["short objection phrase", ...],
  "missed_topics": ["topic name", ...]
}

Rules:
* debrief: plain English, 2-3 sentences, specific to this call, direct and honest
* objections_raised: only objections the prospect actually voiced (e.g. "need to think about it", "too expensive", "not the right time"). Max 8 words each. Max 8 entries. Empty array if none.
* missed_topics: gates the rep never covered (e.g. "budget", "decision maker", "timeline", "press stage", "pain depth"). Empty array if all covered.
* JSON only — no explanation, no preamble, no markdown fences`;

// ─────────────────────────────────────────────────────────────────────────────

// Status codes worth retrying — overloaded (529), rate-limited (429), server error (500)
const RETRYABLE_STATUS_CODES = new Set([429, 500, 529]);
const RETRY_DELAYS_MS         = [1_000, 2_000, 4_000]; // 3 retries: 1s, 2s, 4s
const SONNET_TIMEOUT_MS       = 60_000;                 // 60s per attempt

/**
 * Calls the Anthropic API with up to 3 retries on overload/rate-limit errors.
 * Each attempt has a 60-second timeout via AbortController.
 * Returns the final Response (caller checks res.ok).
 */
async function callSonnetWithRetry(
  apiKey:  string,
  payload: object,
): Promise<Response> {
  const maxAttempts = RETRY_DELAYS_MS.length + 1; // 4 total: 1 original + 3 retries
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), SONNET_TIMEOUT_MS);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:  "POST",
        headers: {
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body:   JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success or a non-retryable error (e.g. 400, 401) — return immediately
      if (res.ok || !RETRYABLE_STATUS_CODES.has(res.status)) {
        return res;
      }

      lastResponse = res;

      if (attempt < maxAttempts - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[post-call] Sonnet returned ${res.status} — retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (err) {
      clearTimeout(timeoutId);

      const isTimeout = (err as Error)?.name === "AbortError";
      const label     = isTimeout ? "timeout" : "network error";

      if (attempt < maxAttempts - 1) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[post-call] Sonnet ${label} — retry ${attempt + 1}/${RETRY_DELAYS_MS.length} in ${delay}ms`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        console.error(`[post-call] Sonnet ${label} — all retries exhausted:`, err);
        throw err;
      }
    }
  }

  // All retries exhausted — return the last non-OK response so the caller can log it
  console.error(`[post-call] Sonnet failed after ${maxAttempts} attempts — last status: ${lastResponse?.status}`);
  return lastResponse!;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Auth check ────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { call_id } = await req.json();
    if (!call_id) return NextResponse.json({ error: "call_id required" }, { status: 400 });

    const service = createServiceClient();

    // ── 1. Verify call belongs to this user ──────────────────────────────────
    const { data: call } = await service
      .from("calls")
      .select("id")
      .eq("id", call_id)
      .eq("user_id", user.id)
      .single();

    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    // ── 2. Load full transcript ───────────────────────────────────────────────
    const { data: transcript } = await service
      .from("call_transcript")
      .select("speaker, text, sequence_order")
      .eq("call_id", call_id)
      .order("sequence_order", { ascending: true });

    if (!transcript || transcript.length === 0) {
      console.log(`[post-call] call ${call_id} — no transcript, skipping`);
      return NextResponse.json({ skipped: "no transcript" });
    }

    // Format full transcript — Sonnet has a 200k context window so we send
    // everything. A 60-min call is ~12k tokens, well within budget.
    // Cap at 100k chars as a hard safety ceiling only.
    const transcriptText = transcript
      .map((line) => `${line.speaker}: ${line.text}`)
      .join("\n")
      .slice(0, 100_000);

    // ── 3. Load existing vault objections for deduplication ──────────────────
    const { data: existingObjections } = await service
      .from("vault_objections")
      .select("id, objection, frequency")
      .eq("user_id", user.id);

    const vault = existingObjections ?? [];

    // ── 4. Call Sonnet ────────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[post-call] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    const claudeRes = await callSonnetWithRetry(apiKey, {
      model:      "claude-sonnet-4-6",
      max_tokens: 512,
      system:     POST_CALL_SYSTEM_PROMPT,
      messages:   [{ role: "user", content: `CALL TRANSCRIPT:\n${transcriptText}` }],
    });

    if (!claudeRes.ok) {
      console.error("[post-call] Sonnet error:", await claudeRes.text());
      return NextResponse.json({ error: "AI error" }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "{}";

    let analysis: {
      debrief:           string;
      objections_raised: string[];
      missed_topics:     string[];
    };

    try {
      const cleaned = rawText
        .replace(/^```json?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
      analysis = JSON.parse(cleaned);
    } catch {
      console.error("[post-call] JSON parse error. Raw:", rawText);
      return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });
    }

    // ── 5. Upsert vault objections ────────────────────────────────────────────
    // Simple fuzzy match: substring containment (case-insensitive)
    // If detected objection ≈ existing entry → increment frequency
    // If genuinely new → insert with is_new=true so rep sees it highlighted
    const detected = analysis.objections_raised ?? [];

    for (const rawObjection of detected) {
      const normalised = rawObjection.toLowerCase().trim();
      if (!normalised) continue;

      const match = vault.find((v) => {
        const existing = v.objection.toLowerCase();
        return existing.includes(normalised) || normalised.includes(existing);
      });

      try {
        if (match) {
          const newFreq = (match.frequency ?? 1) + 1;
          await service
            .from("vault_objections")
            .update({ frequency: newFreq })
            .eq("id", match.id);
          // Keep vault in sync so subsequent iterations see the updated value
          match.frequency = newFreq;
        } else {
          await service.from("vault_objections").insert({
            user_id:   user.id,
            objection: rawObjection,
            frequency: 1,
            is_new:    true,
          });
          // Add to vault so later iterations don't insert the same objection twice
          vault.push({ id: "pending", objection: rawObjection, frequency: 1 });
        }
      } catch (objErr) {
        // Non-fatal — log and continue so the debrief still gets written
        console.error(`[post-call] vault upsert failed for "${rawObjection}":`, objErr);
      }
    }

    // ── 6. Write debrief + missed topics back to call record ─────────────────
    await service
      .from("calls")
      .update({
        summary:       analysis.debrief       ?? null,
        missed_topics: analysis.missed_topics  ?? [],
      })
      .eq("id", call_id);

    console.log(
      `[post-call] ✓ call ${call_id} — debrief written, ` +
      `${detected.length} objection(s) processed`
    );

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[post-call] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
