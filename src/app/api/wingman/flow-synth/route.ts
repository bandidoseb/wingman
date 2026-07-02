/**
 * POST /api/wingman/flow-synth
 *
 * Objection Flow rolling synthesis (Phase B, Step 2).
 *
 * During a LONG objection exchange, the client's flow-synth timer (~40s cadence, gated on the
 * flow crossing SYNTH_THRESHOLD) sends the verbatim turns to absorb; Sonnet folds them into a
 * rolling STRATEGIC recap (angles tried → reactions, trajectory, concessions, dead angles).
 * The recap rides in the card prompt's volatile tail at press time — pre-computed in the
 * prospect's talk time, so it adds ~zero press-time latency.
 *
 * Deliberately a SEPARATE route from /summarize (plan-review decision, blast radius):
 *   - own rate-limit Map — a synth tick must never starve a legitimate Belief Ladder tick
 *   - own input caps — different shapes, one handler each, no mode-branch bloat
 *   - NO DB write — the recap is client-hot-path state only (the ledger owns it);
 *     the load-bearing summarize route (calls.live_summary) stays untouched.
 *
 * Body:    { call_id, prior_recap?, belief?, new_exchange }
 * Returns: { recap }
 *
 * NOTE on oversized input: caps TRIM (slice) rather than reject. A hard 400 would put the
 * client's rolling tick into a permanent failure loop (same oversized slice re-sent forever);
 * trimming matches the kb-signal defensive-cap pattern and self-heals on the next tick.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  FLOW_SYNTH_SYSTEM_PROMPT,
  FLOW_SYNTH_MODEL,
  FLOW_SYNTH_MAX_TOKENS,
  buildFlowSynthUserMessage,
} from "@/lib/wingman/flow-synth-prompt.mjs";

// Per-user rate limit — each tick is a paid Sonnet call. The legitimate client ticks every
// ~40s; 30s is the safety floor so a runaway loop or tampered session can't multiply costs.
// In-memory Map is fine single-instance on Railway (same trade-off as summarize).
const synthRateLimit = new Map<string, number>();
const SYNTH_RATE_LIMIT_MS = 30_000;

// Input caps (chars). new_exchange is the client's ≤2,500-char absorb slice; prior_recap is
// the fixed-size recap (~700 chars nominal); belief is the frozen Belief Ladder snapshot.
const EXCHANGE_CAP = 3_000;
const RECAP_CAP    = 1_500;
const BELIEF_CAP   = 4_000;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { call_id, prior_recap, belief, new_exchange } = body as {
      call_id?:     string;
      prior_recap?: string | null;
      belief?:      string | null;
      new_exchange?: string;
    };

    if (!call_id || typeof call_id !== "string") {
      return NextResponse.json({ error: "call_id required" }, { status: 400 });
    }
    // Nothing to absorb — no-op (not an error; the client's threshold gate should prevent this).
    if (typeof new_exchange !== "string" || !new_exchange.trim()) {
      return NextResponse.json({ recap: prior_recap ?? "" });
    }

    // ── Rate limit — before any AI or DB work ─────────────────────────────────
    const now  = Date.now();
    const last = synthRateLimit.get(user.id) ?? 0;
    if (now - last < SYNTH_RATE_LIMIT_MS) {
      console.warn(`[flow-synth] Rate limit hit for user ${user.id}`);
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    synthRateLimit.set(user.id, now);
    if (synthRateLimit.size > 500) {
      for (const [uid, t] of synthRateLimit) {
        if (now - t > SYNTH_RATE_LIMIT_MS) synthRateLimit.delete(uid);
      }
    }

    // ── Ownership check before any AI work ────────────────────────────────────
    const { data: call, error: callError } = await supabase
      .from("calls")
      .select("id")
      .eq("id", call_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (callError || !call) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[flow-synth] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
    }

    const userMessage = buildFlowSynthUserMessage({
      priorRecap:  typeof prior_recap === "string" ? prior_recap.slice(0, RECAP_CAP) : undefined,
      belief:      typeof belief === "string" ? belief.slice(0, BELIEF_CAP) : undefined,
      newExchange: new_exchange.slice(0, EXCHANGE_CAP),
    });

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 25_000);

    let recap = "";
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key":         apiKey,
          "anthropic-version": "2023-06-01",
          "content-type":      "application/json",
        },
        body: JSON.stringify({
          model:      FLOW_SYNTH_MODEL,
          max_tokens: FLOW_SYNTH_MAX_TOKENS,
          system: [
            { type: "text", text: FLOW_SYNTH_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          ],
          messages: [{ role: "user", content: userMessage }],
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error(`[flow-synth] Anthropic error ${resp.status}:`, errText);
        return NextResponse.json({ error: "AI inference failed" }, { status: 502 });
      }

      const data = await resp.json();
      recap = (data.content?.[0]?.text ?? "").trim();
      const usage = data.usage ?? {};
      console.log(
        `[flow-synth] in=${usage.input_tokens} out=${usage.output_tokens} ` +
        `cacheRead=${usage.cache_read_input_tokens ?? 0} exchange=${new_exchange.length} call=${call_id}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!recap) {
      return NextResponse.json({ error: "Empty response from AI" }, { status: 502 });
    }

    // NO DB write — the recap lives in the client's flow ledger only (by design).
    return NextResponse.json({ recap });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[flow-synth] Sonnet call timed out after 25s");
      return NextResponse.json({ error: "Request timed out" }, { status: 504 });
    }
    console.error("[flow-synth] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
