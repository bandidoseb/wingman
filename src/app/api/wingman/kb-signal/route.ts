/**
 * POST /api/wingman/kb-signal
 *
 * Hotkey-summoned signal card endpoint (Phase 3).
 *
 * The rep presses a direction key → DashboardClient calls this route with:
 *   - transcript_chunk  : last ~120 s of raw transcript (rolling buffer)
 *   - live_summary      : full Belief Ladder text from the Phase 2 summarizer
 *   - slot              : "objection" | "answer" | "dig" | "close"
 *   - current_stage     : active call stage label
 *
 * Flow (Phase 3.5 — ↑ objection slot):
 *   distillObjection(chunk)                       → Groq llama-3.1-8b-instant, ≤1.5s
 *     found    → searchKnowledge(distilledPhrase, 0.60) → KB match → generateSignalCard
 *                 (card still written from the FULL 120s chunk — the distilled phrase
 *                 is only the search query) · no match → generateFallbackCard grounded
 *                 in the distilled objection
 *     not found → generateNudgeCard — honest "No objection caught" + one true pointer
 *                 (ALWAYS returns a card; quality gate against guess cards)
 *     null      → Groq down/timeout → degraded raw-chunk search (cache skipped)
 *   Other slots (answer/dig/close): raw-chunk path unchanged until Phase 4.
 *   → returns { ok, signal_header, signal_text, signal_type } in the HTTP body
 *
 * The card is delivered synchronously in the response (not via Pusher).
 * DashboardClient awaits the response and calls window.wingman.sendSignal().
 *
 * Instrumentation (#38): every request logs
 *   [kb-signal] TIMING distill= search= generate= total= branch= idleGap=
 * idleGap = seconds since this user's previous press ("first" if none) — this is the
 * connection-cooling probe: if slow presses correlate with long gaps, build the
 * periodic keep-warm (see tasks/todo.md, Phase 3.5 plan).
 *
 * Warm latency goal: 1.5–2s press-to-card (Sebastian, 2026-06-11).
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@/lib/supabase/server";
import { searchKnowledge }             from "@/lib/wingman/knowledge-search";
import { distillObjection }            from "@/lib/wingman/query-distill";
import { generateSignalCard,
         generateFallbackCard,
         generateNudgeCard,
         NUDGE_HEADLINE,
         NUDGE_STATIC_SUBTEXT,
         type SignalCardResult }       from "@/lib/wingman/knowledge-signal";

// Similarity threshold for DISTILLED queries. Lower than the raw path's 0.65 on
// purpose: the distilled phrase is short + objection-shaped (same shape as the KB
// triggers) and only exists when Groq confirmed a real objection — probes 2026-06-11
// put honest matches at 0.60–0.75 and noise at ≤0.51. Dial: Beta Tuning Parameters.md.
const DISTILLED_SIMILARITY_THRESHOLD = 0.60;

// Valid slot values — anything else defaults to "objection"
const VALID_SLOTS = ["objection", "answer", "dig", "close"] as const;
type Slot = typeof VALID_SLOTS[number];

// Per-user rate limit — prevents a runaway client loop or direct API abuse from
// multiplying Haiku costs. 3 s minimum between requests per user.
// The client-side isGeneratingRef is the UX guard; this is the cost boundary.
const RATE_LIMIT_MS = 3_000;
const rateLimitMap  = new Map<string, number>();

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Per-user rate limit ──────────────────────────────────────────────────
    const now  = Date.now();
    const last = rateLimitMap.get(user.id) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true }); // silently drop — client guard handles UX
    }
    rateLimitMap.set(user.id, now);
    // Opportunistic prune so the map can't grow unbounded across many users.
    if (rateLimitMap.size > 500) {
      for (const [uid, t] of rateLimitMap) {
        if (now - t > RATE_LIMIT_MS) rateLimitMap.delete(uid);
      }
    }

    const body = await req.json();
    const {
      transcript_chunk,
      live_summary,
      slot,
      current_stage,
    }: {
      transcript_chunk:  string;
      live_summary?:     string;
      slot?:             string;
      current_stage?:    string;
    } = body;

    const activeSlot: Slot = VALID_SLOTS.includes(slot as Slot)
      ? (slot as Slot)
      : "objection";

    // Empty transcript — nothing to work with. For the objection slot, answer
    // with the honest static nudge (the rep pressed before anyone spoke — that
    // is not an error, so don't trigger the client's retry pill).
    if (!transcript_chunk?.trim()) {
      if (activeSlot === "objection") {
        return NextResponse.json({
          ok:            true,
          signal_header: NUDGE_HEADLINE,
          signal_text:   NUDGE_STATIC_SUBTEXT,
          signal_type:   "Nudge",
        });
      }
      return NextResponse.json({ ok: true });
    }

    // Server-side size guard — the rolling buffer is capped at ~2,400 chars
    // upstream, but guard here as well against unexpected payloads.
    if (transcript_chunk.length > 3_500) {
      console.warn("[kb-signal] transcript_chunk exceeded 3,500 chars — rejecting");
      return NextResponse.json({ ok: true });
    }

    // Cap the Belief Ladder summary defensively. The summarizer caps its OUTPUT at
    // 600 tokens (~2,400 chars); 4,000 chars is comfortable headroom that never
    // truncates a real summary but stops an oversized/abusive payload from inflating
    // the Haiku bill. See Wingman Brain/Beta Tuning Parameters.md. (Fix #2)
    const summary = typeof live_summary === "string"
      ? live_summary.slice(0, 4_000)
      : undefined;

    // ── Generate the card (Phase 3.5 branching for the ↑ objection slot) ────
    const tPipeline  = Date.now();
    let   distillMs  = 0;
    let   searchMs   = 0;
    let   generateMs = 0;
    let   branch: "kb" | "fallback-grounded" | "nudge" | "raw-fallback" | "raw-kb" = "raw-kb";
    let   card: SignalCardResult | null = null;

    if (activeSlot === "objection") {
      const t0 = Date.now();
      const distilled = await distillObjection(transcript_chunk);
      distillMs = Date.now() - t0;

      if (distilled === null) {
        // Groq down/timeout — degrade to the raw-chunk path. Cache is skipped:
        // the near-static raw-buffer cache key can serve the PREVIOUS objection's
        // technique for a new one (see knowledge-search.ts).
        branch = "raw-fallback";
        const t1 = Date.now();
        const knowledgeResults = await searchKnowledge(transcript_chunk, { skipCache: true });
        searchMs = Date.now() - t1;

        const t2 = Date.now();
        if (knowledgeResults) {
          card = await generateSignalCard(knowledgeResults, transcript_chunk, summary, current_stage);
        }
        if (!card) {
          card = await generateFallbackCard(activeSlot, transcript_chunk, summary, current_stage);
        }
        generateMs = Date.now() - t2;

      } else if (!distilled.found) {
        // Quality gate: NO standing objection in the window — honest nudge.
        // generateNudgeCard ALWAYS returns a card (static fallback inside), so
        // this branch can never fall through to an empty response.
        branch = "nudge";
        const t2 = Date.now();
        card = await generateNudgeCard(transcript_chunk, summary);
        generateMs = Date.now() - t2;

      } else {
        // Real objection extracted — search the KB with the distilled phrase.
        // The card is still WRITTEN from the full 120s chunk + summary.
        const t1 = Date.now();
        const knowledgeResults = await searchKnowledge(distilled.phrase, {
          threshold: DISTILLED_SIMILARITY_THRESHOLD,
        });
        searchMs = Date.now() - t1;

        const t2 = Date.now();
        if (knowledgeResults) {
          branch = "kb";
          card = await generateSignalCard(knowledgeResults, transcript_chunk, summary, current_stage);
        }
        if (!card) {
          branch = "fallback-grounded";
          card = await generateFallbackCard(
            activeSlot, transcript_chunk, summary, current_stage, distilled.phrase,
          );
        }
        generateMs = Date.now() - t2;
      }
    } else {
      // answer / dig / close — raw-chunk path, unchanged until Phase 4.
      const t1 = Date.now();
      const knowledgeResults = await searchKnowledge(transcript_chunk);
      searchMs = Date.now() - t1;

      const t2 = Date.now();
      if (knowledgeResults) {
        card = await generateSignalCard(knowledgeResults, transcript_chunk, summary, current_stage);
      }
      if (!card) {
        branch = "raw-fallback";
        card = await generateFallbackCard(activeSlot, transcript_chunk, summary, current_stage);
      }
      generateMs = Date.now() - t2;
    }

    // ── #38 instrument: one line per press, grep-able on Railway ────────────
    const totalMs = Date.now() - tPipeline;
    const idleGap = last === 0 ? "first" : `${Math.round((now - last) / 1000)}s`;
    console.log(
      `[kb-signal] TIMING distill=${distillMs}ms search=${searchMs}ms ` +
      `generate=${generateMs}ms total=${totalMs}ms branch=${branch} idleGap=${idleGap}`,
    );

    if (!card) {
      // Both paths failed (e.g. Haiku timeout / API error) — return empty ok.
      // DashboardClient treats a missing signal_header as an error and shows
      // the retry pill (never silent dead air).
      console.error("[kb-signal] Both KB and fallback generation failed");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({
      ok:            true,
      signal_header: card.headline,
      signal_text:   card.subtext ?? "",
      signal_type:   branch === "nudge" ? "Nudge" : "Handle",
    });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
