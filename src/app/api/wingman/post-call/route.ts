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
import { detectSyntax }        from "@/lib/wingman/syntax-detect";
import type { PillarCoverage, PillarResult } from "@/types";

// ── Post-call analysis system prompt ────────────────────────────────────────
const POST_CALL_SYSTEM_PROMPT = `You are analyzing a completed sales call transcript to help the rep improve.

Return valid JSON only with this exact structure:
{
  "debrief": "2-3 sentence summary. What worked, what was missed, key moments. Be specific and actionable.",
  "outcome": { "value": "Closed", "confidence": "high" },
  "objections_raised": ["short objection phrase", ...],
  "missed_topics": ["topic name", ...],
  "pillar_coverage": {
    "core_problem":         { "covered": true, "evidence": "short quote ≤100 chars or null" },
    "cant_diy":             { "covered": false, "evidence": null },
    "cost_of_waiting":      { "covered": true, "evidence": "short quote ≤100 chars or null" },
    "dream_outcome":        { "covered": true, "evidence": "short quote ≤100 chars or null" },
    "investment_readiness": { "covered": false, "evidence": null },
    "whos_involved":        { "covered": true, "evidence": "short quote ≤100 chars or null" },
    "why_you":              { "covered": false, "evidence": null }
  },
  "stages": [
    { "name": "Rapport",   "status": "complete", "note": "≤60 chars: what happened, or why it was missed" },
    { "name": "Discovery", "status": "complete", "note": "≤60 chars" },
    { "name": "Press",     "status": "skipped",  "note": "≤60 chars" },
    { "name": "Confirm",   "status": "complete", "note": "≤60 chars" },
    { "name": "Pitch",     "status": "complete", "note": "≤60 chars" },
    { "name": "Close",     "status": "skipped",  "note": "≤60 chars" }
  ]
}

Rules for pillar_coverage — evaluate each against the full transcript:
* core_problem: Rep dug into the prospect's real pain — root cause and emotional weight, not just surface symptoms
* cant_diy: Rep established why the prospect cannot solve this themselves (complexity, time, expertise gap)
* cost_of_waiting: Rep made the cost of inaction tangible — money lost, time lost, pain continuing
* dream_outcome: Prospect articulated their desired result in their own words (future-pace moment)
* investment_readiness: Rep qualified budget, price range, or financial capacity at any point
* whos_involved: Rep confirmed who has authority to make the final decision
* why_you: Rep presented their unique differentiation — why this offer over alternatives
* covered: true only if clearly and meaningfully addressed — not just briefly touched on
* evidence: a short direct quote or paraphrase (≤100 chars) showing it was covered; null if not covered
If a FLIGHT PLAN is provided, use it to inform how each pillar should have appeared on this specific call.

Rules for stages — evaluate the rep against the 6-stage high-ticket close framework:
* Output ALL SIX stages, in this exact order, with these EXACT names: Rapport, Discovery, Press, Confirm, Pitch, Close
* Rapport: built genuine peer-level connection before business · Discovery: excavated the real pain/situation · Press: made the cost of inaction tangible · Confirm: summarized/confirmed understanding before pitching · Pitch: presented the solution tied to their stated pain · Close: asked for the sale and/or handled objections
* status: exactly "complete" or "skipped" — "complete" only if the rep meaningfully reached and handled that stage; "skipped" if skipped or barely touched
* note: ≤60 chars, specific to this call — what happened in that stage, or why it was missed
* Judge only what the transcript supports — do not assume a stage happened off-transcript

Rules for outcome — predict the call's result, but ONLY from explicit evidence:
* value: exactly one of "Closed" | "Lost" | "Follow Up" | "DQ" | "No Show" | null
  - "Closed": the prospect clearly committed to buy/pay/start now (e.g. "let's do it", "send me the link", "I'm in", gave payment details)
  - "Lost": the prospect clearly declined — a definite no, not a hesitation
  - "Follow Up": they want another conversation, time to think, or to talk to someone before deciding
  - "DQ": clearly not a fit / doesn't qualify (no budget, wrong problem, not the decision maker with no path forward)
  - "No Show": the prospect never meaningfully joined or engaged
  - null: the transcript does NOT make the result clear — this is the correct answer whenever you are not certain
* confidence: "high" ONLY when a specific spoken line makes the result unambiguous. Anything inferred, hedged, or read-between-the-lines → "low", or set value to null. When unsure, choose null / "low". NEVER guess an outcome to seem helpful — a wrong guess is worse than none.

Other rules:
* debrief: plain English, 2-3 sentences, specific to this call, direct and honest
* objections_raised: only objections the prospect actually voiced. Max 8 words each. Max 8 entries. Empty array if none.
* missed_topics: call stages or topics the rep skipped (e.g. "press stage", "decision maker", "timeline"). Empty array if all covered.
* JSON only — no explanation, no preamble, no markdown fences`;

// ── Pillar helpers ───────────────────────────────────────────────────────────

const PILLAR_KEYS = [
  "core_problem",
  "cant_diy",
  "cost_of_waiting",
  "dream_outcome",
  "investment_readiness",
  "whos_involved",
  "why_you",
] as const;

// Canonical 6-stage order + exact names. IntelTab/FlightLog/Ask-Wingman all key
// off these EXACT names — any other name is silently dropped by the heatmap.
const STAGE_ORDER = ["Rapport", "Discovery", "Press", "Confirm", "Pitch", "Close"] as const;
// status MUST be one of the DB CHECK-constraint values: complete|partial|skipped|early|lost
// (001_initial_schema.sql). We use a binary complete/skipped — IntelTab only counts
// "complete"; FlightLogTab renders "skipped" as a grey "—".
type StageStatus = "complete" | "skipped";
type StageRow = { name: string; status: StageStatus; note: string | null };

/**
 * Validate Sonnet's derived stages into exactly the 6 canonical rows, in order.
 * Tolerant of partial/garbled output: any stage the model omits defaults to
 * "skipped". Returns null only if nothing usable came back at all.
 */
function validateStages(raw: unknown): StageRow[] | null {
  if (!Array.isArray(raw)) return null;
  const byName = new Map<string, { status: StageStatus; note: string | null }>();

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o    = item as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!(STAGE_ORDER as readonly string[]).includes(name)) continue;
    const status: StageStatus = o.status === "complete" ? "complete" : "skipped";
    const note   = typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 60) : null;
    byName.set(name, { status, note });
  }

  if (byName.size === 0) return null;

  return STAGE_ORDER.map((name) => ({
    name,
    status: byName.get(name)?.status ?? "skipped",
    note:   byName.get(name)?.note   ?? null,
  }));
}

function validatePillarCoverage(raw: unknown): PillarCoverage | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const result: Partial<PillarCoverage> = {};

  for (const key of PILLAR_KEYS) {
    const entry = obj[key];
    if (!entry || typeof entry !== "object") return null;
    const e       = entry as Record<string, unknown>;
    const covered = typeof e.covered === "boolean" ? e.covered : false;
    let evidence: string | null = typeof e.evidence === "string" ? e.evidence.trim().slice(0, 100) : null;
    if (evidence === "") evidence = null;
    (result as Record<string, PillarResult>)[key] = { covered, evidence };
  }

  return result as PillarCoverage;
}

function formatFlightPlanForEval(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const p     = snapshot as Record<string, unknown>;
  const lines: string[] = ["REP'S FLIGHT PLAN:"];

  if (p.target_market)          lines.push(`Target market: ${p.target_market}`);
  if (p.core_problem)           lines.push(`Core problem to address: ${p.core_problem}`);
  if (p.dream_outcome)          lines.push(`Dream outcome to surface: ${p.dream_outcome}`);
  if (p.method_differentiation) lines.push(`Why choose them: ${p.method_differentiation}`);

  const min = typeof p.investment_min === "number" ? p.investment_min : null;
  const max = typeof p.investment_max === "number" ? p.investment_max : null;
  if (min !== null && max !== null)      lines.push(`Investment range: $${min.toLocaleString()}–$${max.toLocaleString()}`);
  else if (min !== null)                 lines.push(`Investment: $${min.toLocaleString()}+`);
  else if (max !== null)                 lines.push(`Investment: up to $${max.toLocaleString()}`);

  if (p.involves_partner === true)
    lines.push("Decision maker: involves a partner/spouse — rep should have confirmed both on call");

  const checkpoints = Array.isArray(p.custom_checkpoints) ? (p.custom_checkpoints as string[]) : [];
  if (checkpoints.length > 0) lines.push(`Custom checkpoints: ${checkpoints.join("; ")}`);

  return lines.length > 1 ? lines.join("\n") : "";
}

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

    // ── 1. Verify call belongs to this user + load flight plan snapshot ────────
    const { data: call } = await service
      .from("calls")
      .select("id, flight_plan_snapshot")
      .eq("id", call_id)
      .eq("user_id", user.id)
      .single();

    if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 });

    const flightPlanContext = formatFlightPlanForEval(call.flight_plan_snapshot);

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
      // 1900 (was 1536): the schema grew by the `outcome` object, and the whole
      // response is a single JSON.parse — a truncated tail loses EVERYTHING
      // (debrief, pillars, stages). Headroom is near-zero cost on an async job.
      max_tokens: 1_900,
      system:     POST_CALL_SYSTEM_PROMPT,
      messages:   [{
        role:    "user",
        content: `${flightPlanContext ? `${flightPlanContext}\n\n` : ""}CALL TRANSCRIPT:\n${transcriptText}`,
      }],
    });

    if (!claudeRes.ok) {
      console.error("[post-call] Sonnet error:", await claudeRes.text());
      return NextResponse.json({ error: "AI error" }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "{}";

    let analysis: {
      debrief:           string;
      outcome?:          { value?: string | null; confidence?: string };
      objections_raised: string[];
      missed_topics:     string[];
      pillar_coverage?:  unknown;
      stages?:           unknown;
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

    // ── 5b. Outcome auto-detect (v0.1.29) ────────────────────────────────────
    //        Predict the result from the SAME Sonnet pass and mark it — but ONLY
    //        on HIGH confidence AND only when the rep hasn't dispositioned it
    //        (`.is("outcome", null)` → a manual pick always wins; a concurrent
    //        manual save makes this match 0 rows, which is correct, not an error).
    //        Tagged `outcome_source='auto'` so the dashboard shows an "auto" chip
    //        and keeps it OUT of close-rate math until the rep confirms (Sebastian's
    //        "a wrong auto-guess must never poison stats" rule). Values are gated to
    //        the live `calls_outcome_check` set. supabase-js does NOT throw on a
    //        constraint violation — we read `error` or a bad value fails silently.
    //        Runs BEFORE the debrief write so the auto mark is present the moment
    //        the dashboard sees `summary` land.
    const AI_OUTCOME_VALUES = new Set(["Closed", "Lost", "Follow Up", "DQ", "No Show"]);
    try {
      const oc   = analysis.outcome;
      const val  = oc && typeof oc.value === "string" ? oc.value.trim() : null;
      const conf = oc && typeof oc.confidence === "string" ? oc.confidence : null;
      if (val && conf === "high" && AI_OUTCOME_VALUES.has(val)) {
        const { data: outRows, error: outErr } = await service
          .from("calls")
          .update({ outcome: val, outcome_source: "auto" })
          .eq("id", call_id)
          .eq("user_id", user.id)
          .is("outcome", null)          // never clobber a manual pick
          .select("id");
        if (outErr) console.error(`[post-call] outcome auto-detect write failed for call ${call_id}:`, outErr.message);
        else console.log(`[post-call] outcome ${outRows?.length ? `auto-set → ${val}` : "left as-is (already marked)"} for call ${call_id}`);
      }
    } catch (outErr) {
      console.error(`[post-call] outcome auto-detect threw for call ${call_id}:`, outErr);
    }

    // ── 6a. Write debrief + missed topics back to call record ────────────────
    await service
      .from("calls")
      .update({
        summary:       analysis.debrief       ?? null,
        missed_topics: analysis.missed_topics  ?? [],
      })
      .eq("id", call_id);

    // ── 6b. Write pillar_coverage — independent so a parse failure here never
    //        blocks the debrief that was just saved above ─────────────────────
    const pillarCoverage = validatePillarCoverage(analysis.pillar_coverage);
    if (pillarCoverage) {
      try {
        await service
          .from("calls")
          .update({ pillar_coverage: pillarCoverage })
          .eq("id", call_id);
      } catch (pillarErr) {
        console.error(`[post-call] pillar_coverage write failed for call ${call_id}:`, pillarErr);
      }
    } else {
      console.warn(`[post-call] pillar_coverage malformed or missing for call ${call_id} — skipping write`);
    }

    // ── 6c. Write call_stages — derived from the transcript by Sonnet ─────────
    //        Independent step (a failure here never blocks the debrief above).
    //        Delete-then-insert makes the job idempotent — a re-run (e.g. a
    //        double End Call) can never create duplicate stage rows.
    const stageRows = validateStages(analysis.stages);
    let stagesSaved = false;
    if (stageRows) {
      try {
        // supabase-js does NOT throw on a constraint/DB error — it returns it in
        // `error`. We must read it explicitly, or a rejected insert (e.g. a bad
        // status value) fails silently and the heatmap goes blank with no log.
        const { error: delErr } = await service.from("call_stages").delete().eq("call_id", call_id);
        if (delErr) console.error(`[post-call] call_stages delete failed for call ${call_id}:`, delErr);

        const { error: insErr } = await service.from("call_stages").insert(
          stageRows.map((s, idx) => ({
            call_id,
            name:          s.name,
            status:        s.status,
            note:          s.note,
            display_order: idx,
          }))
        );
        if (insErr) console.error(`[post-call] call_stages insert failed for call ${call_id}:`, insErr);
        else        stagesSaved = true;
      } catch (stageErr) {
        console.error(`[post-call] call_stages write threw for call ${call_id}:`, stageErr);
      }
    } else {
      console.warn(`[post-call] stages malformed or missing for call ${call_id} — skipping write`);
    }

    // ── 6d. Syntax auto-detect — "I'm not sure" is not a dead end ─────────────
    //        A rep who answered "not sure" on their opening syntax at onboarding
    //        never comes back to the Sales DNA page to fix it — so we infer it from
    //        how their recent calls ACTUALLY opened and self-update their Sales DNA.
    //        Only touches an "unsure" rep (never overwrites a deliberate pick), only
    //        acts on a clear, well-sampled tendency. Independent + non-blocking, like
    //        6a–6c: any failure here never affects the debrief that already succeeded.
    //
    //        The WRITE is an atomic single-key update via the `set_sales_dna_syntax_if_unsure`
    //        RPC (jsonb_set of only the '{syntax}' key, guarded on `sales_dna->>'syntax'
    //        = 'unsure'` IN THE DB). That closes the read-modify-write race with the client
    //        save path (reviewer 2026-07-11): jsonb_set operates on the row's freshest value
    //        under its lock, so a concurrent save of a sibling field (e.g. `pain`) is preserved,
    //        and a concurrent deliberate syntax pick makes the guard fail (0 rows) — neither is
    //        clobbered. The `.select("sales_dna")` below is only a cheap gate so we don't run
    //        the calls query + detection for reps who already have a real syntax; the RPC's
    //        WHERE is the correctness guarantee. REQUIRES the SQL function (Supabase) to exist.
    let syntaxSet: string | null = null;
    try {
      const { data: prof } = await service
        .from("profiles")
        .select("sales_dna")
        .eq("id", user.id)
        .maybeSingle();
      const dna = (prof?.sales_dna ?? {}) as Record<string, unknown>;
      if (dna.syntax === "unsure") {
        const { data: recent } = await service
          .from("calls")
          .select("live_summary")
          .eq("user_id", user.id)
          .not("live_summary", "is", null)
          .order("call_date", { ascending: false })
          .limit(10);
        const { detected, sample } = detectSyntax((recent ?? []).map((c) => c.live_summary as string | null));
        if (detected) {
          const { error: synErr } = await service.rpc("set_sales_dna_syntax_if_unsure", {
            p_user_id: user.id,
            p_syntax:  detected,
          });
          if (synErr) console.error(`[post-call] syntax auto-detect write failed for user ${user.id}:`, synErr.message);
          else { syntaxSet = detected; console.log(`[post-call] syntax auto-detected for user ${user.id}: ${detected} (from ${sample} calls)`); }
        }
      }
    } catch (synErr) {
      console.error(`[post-call] syntax auto-detect threw for user ${user.id}:`, synErr);
    }

    console.log(
      `[post-call] ✓ call ${call_id} — debrief written, ` +
      `${detected.length} objection(s) processed, ` +
      `pillar_coverage ${pillarCoverage ? "saved" : "skipped"}, ` +
      `stages ${stagesSaved ? "saved" : "skipped"}` +
      `${syntaxSet ? `, syntax→${syntaxSet}` : ""}`
    );

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[post-call] Unexpected error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
