import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  BELIEF_LADDER_SYSTEM_PROMPT,
  BELIEF_LADDER_MODEL,
  BELIEF_LADDER_MAX_TOKENS,
} from "@/lib/wingman/belief-ladder";
import { buildSummarizerDnaSystemBlock } from "@/lib/wingman/sales-dna.mjs";

// ── Per-user rate limit ───────────────────────────────────────────────────────
// Each summarize tick calls Claude Sonnet (paid). Reject calls faster than once
// per 30 seconds per user so a client bug or a tampered session can't run away
// with costs. The legitimate client calls every 120s — this is a safety floor.
// NOTE: in-memory Map is fine for single-instance Railway. Swap for Redis on scale.
const summarizeRateLimit    = new Map<string, number>();
const SUMMARIZE_RATE_LIMIT_MS = 30_000; // 30 s minimum between summarize calls per user

// POST /api/wingman/summarize
// Body: { call_id, current_summary?, new_transcript }
// Returns: { summary }
//
// Called by the client ~every 2 minutes during a live call (client-triggered so
// this works on both Railway and future Vercel — no long-lived server-side timer).
// Calls Sonnet to update the rolling Belief Ladder scorecard, then persists to
// calls.live_summary. The in-memory copy in the client is the live hot path;
// the DB copy powers drop-resume and cross-call prospect memory.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { call_id, current_summary, new_transcript, sales_dna } = body as {
      call_id: string;
      current_summary?: string | null;
      new_transcript: string;
      sales_dna?: unknown;
    };

    if (!call_id) {
      return NextResponse.json({ error: "call_id required" }, { status: 400 });
    }

    // No new speech — return current summary unchanged (no-op tick)
    if (!new_transcript?.trim()) {
      return NextResponse.json({ summary: current_summary ?? "" });
    }

    // ── Rate limit — must pass before any AI or DB work ───────────────────────
    const now       = Date.now();
    const lastCall  = summarizeRateLimit.get(user.id) ?? 0;
    if (now - lastCall < SUMMARIZE_RATE_LIMIT_MS) {
      console.warn(`[summarize] Rate limit hit for user ${user.id}`);
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    summarizeRateLimit.set(user.id, now);

    // ── Input size caps — bound Sonnet token spend ────────────────────────────
    // new_transcript accumulates since the last tick. If ticks fail repeatedly the
    // buffer grows — cap it before it becomes a runaway cost.
    if (new_transcript.length > 50_000) {
      return NextResponse.json({ error: "Transcript too large" }, { status: 400 });
    }
    // current_summary is the PREVIOUS tick's model output, hard-capped at
    // BELIEF_LADDER_MAX_TOKENS (~6k chars) — so a legit scorecard can never
    // approach 24k. Rejecting here used to fire at 10k, which risked the worst
    // silent failure: one oversized payload → every later tick 400s → the
    // scorecard freezes for the rest of the call while all cards read stale
    // state. The system self-heals (the next output is re-capped), so the only
    // job left for this guard is true abuse. Warn early so anomalies are visible.
    if (current_summary && current_summary.length > 8_000) {
      console.warn(
        `[summarize] ⚠️ current_summary unusually large (${current_summary.length} chars) — ` +
        `legit scorecards stay under ~6k. call=${call_id}`,
      );
    }
    if (current_summary && current_summary.length > 24_000) {
      return NextResponse.json({ error: "Summary too large" }, { status: 400 });
    }

    // Verify ownership before touching any AI or DB.
    // call_date is the call's start timestamp (stamped at session creation) — used
    // below to derive elapsed time server-side (single source of truth, can't drift).
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id, call_date")
      .eq("id", call_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[summarize] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
    }

    // Derive how far into the call we are from the start timestamp. Server-computed
    // so it's a single source of truth and survives a dropped/resumed call.
    let elapsedLabel = "";
    if (call.call_date) {
      const elapsedMin = Math.floor((Date.now() - new Date(call.call_date).getTime()) / 60_000);
      if (Number.isFinite(elapsedMin) && elapsedMin >= 0) {
        elapsedLabel = `CALL ELAPSED: ${elapsedMin}m\n\n`;
      }
    }

    const userMessage =
      elapsedLabel +
      `CURRENT SCORECARD:\n${current_summary?.trim() || "(empty — this is the start of the call)"}\n\n` +
      `NEW TRANSCRIPT (only what was said since the last update):\n${new_transcript}`;

    // ── Phase 1b (offer-aware): the rep's Sales DNA as an interpretive LENS ──
    // Client-passed (same untrusted rail as new_transcript); the builder sanitizes
    // (shared caps with the save path) and gates on completeness — a partial blob
    // returns null and the system below is byte-identical to pre-1b. The lens text
    // (AVERAGES-NOT-GOSPEL fence + never-evidence rules) lives in sales-dna.mjs so
    // scripts/test-belief-ladder.mjs grades the exact bytes shipped here.
    const dnaSystemBlock = buildSummarizerDnaSystemBlock(sales_dna);

    // System block assembly — the cache breakpoint sits on the LAST system block.
    // Both blocks are call-stable, so the ~2-min summarize tick re-hits the same
    // prefix and keeps the cache warm the whole call (5-min TTL refreshes on use).
    // Bonus: the DNA block finally pushes the prefix over Sonnet's ~1,024-token
    // cache minimum, which the bare prompt sat under (see the cache log below).
    const systemBlocks = dnaSystemBlock
      ? [
          { type: "text" as const, text: BELIEF_LADDER_SYSTEM_PROMPT },
          { type: "text" as const, text: dnaSystemBlock, cache_control: { type: "ephemeral" as const } },
        ]
      : [
          { type: "text" as const, text: BELIEF_LADDER_SYSTEM_PROMPT, cache_control: { type: "ephemeral" as const } },
        ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    let summary = "";

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: BELIEF_LADDER_MODEL,
          max_tokens: BELIEF_LADDER_MAX_TOKENS,
          system: systemBlocks,
          messages: [{ role: "user", content: userMessage }],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`[summarize] Anthropic error ${resp.status}:`, errText);
        return NextResponse.json({ error: "AI inference failed" }, { status: 502 });
      }

      const data = await resp.json();
      summary = (data.content?.[0]?.text ?? "").trim();

      // Log cache stats so we can verify caching is actually engaging (never assume).
      // Anthropic only caches prefixes above ~1,024 tokens (Sonnet). With Sales DNA
      // present the prefix comfortably clears it; the bare prompt (~300 tok) may not.
      // Expected pattern with DNA: creation>0 on the first tick, read>0 on every tick
      // after (the ~2-min cadence keeps the 5-min TTL warm all call).
      const usage = data.usage ?? {};
      const dnaTag = dnaSystemBlock ? "dna=present" : "dna=absent";
      if ((usage.cache_creation_input_tokens ?? 0) > 0 || (usage.cache_read_input_tokens ?? 0) > 0) {
        console.log(
          `[summarize] ✅ Cache hit: created=${usage.cache_creation_input_tokens ?? 0} ` +
          `read=${usage.cache_read_input_tokens ?? 0} ${dnaTag} ` +
          `in=${usage.input_tokens} out=${usage.output_tokens} call=${call_id}`,
        );
      } else {
        console.warn(
          `[summarize] ⚠️ Cache NOT engaged (created=0 read=0) ${dnaTag} — prefix likely under ` +
          `the ~1,024-token minimum for Sonnet. ` +
          `in=${usage.input_tokens} out=${usage.output_tokens} call=${call_id}`,
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!summary) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
    }

    // Persist to DB — non-fatal if it fails (the client holds the in-memory copy
    // which is the live hot path; the DB copy is for drop-resume + prospect memory)
    const { error: updateError } = await supabase
      .from("calls")
      .update({ live_summary: summary })
      .eq("id", call_id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[summarize] Failed to persist live_summary:", updateError.message);
    }

    return NextResponse.json({ summary });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[summarize] Sonnet call timed out after 25s");
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[summarize] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
