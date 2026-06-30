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
 * Flow (↑ objection slot — context-driven, NO KB, NO Groq since 2026-06-30):
 *   generateObjectionCard(chunk, summary) → Sonnet reads the Belief Ladder summary + 120s
 *                 buffer, infers the objection itself, and returns ONE of:
 *     status:"line"    → headless card (signal_header:"" + line in signal_text, type:"Objection")
 *     status:"abstain" → nothing standing → static "No objection detected" nudge (type:"Nudge").
 *                        This IS the honesty gate now — Sonnet's own call, no extra paid request.
 *     status:"error"   → empty { ok:true } → the client shows the retry pill (never dead air).
 *   Other slots (answer/dig/close): raw-chunk KB path unchanged until Phase 4.
 *   → returns { ok, signal_header, signal_text, signal_type } in the HTTP body
 *
 * The card is delivered synchronously in the response (not via Pusher).
 * DashboardClient awaits the response and calls window.wingman.sendSignal().
 *
 * Instrumentation (#38): every request logs
 *   [kb-signal] TIMING search= generate= total= branch= idleGap=
 * idleGap = seconds since this user's previous press ("first" if none) — this is the
 * connection-cooling probe: if slow presses correlate with long gaps, build the
 * periodic keep-warm (see tasks/todo.md, Phase 3.5 plan).
 *
 * Warm latency goal: 1.5–2s press-to-card (Sebastian, 2026-06-11).
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@/lib/supabase/server";
import { searchKnowledge }             from "@/lib/wingman/knowledge-search";
import { generateSignalCard,
         generateFallbackCard,
         NUDGE_HEADLINE,
         NUDGE_STATIC_SUBTEXT,
         type SignalCardResult }       from "@/lib/wingman/knowledge-signal";
import { generateObjectionCard }       from "@/lib/wingman/objection-signal";

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
    let   searchMs   = 0;
    let   generateMs = 0;
    let   branch: "objection" | "objection-error" | "kb" | "fallback-grounded" | "nudge" | "raw-fallback" | "raw-kb" = "raw-kb";
    let   card: SignalCardResult | null = null;
    let   objectionLine: string | null = null;   // headless single-line objection card

    if (activeSlot === "objection") {
      // NO Groq, NO KB. Sonnet reads the buffer, infers the objection itself, and either
      // writes the line, abstains (nothing standing), or errors. The Groq distiller that
      // used to hand in the objection + gate the nudge was removed 2026-06-30 — the eval
      // showed the hint added nothing and Sonnet abstains reliably (7/7, 0 false-silence).
      const t2 = Date.now();
      const objCard = await generateObjectionCard(transcript_chunk, summary);
      generateMs = Date.now() - t2;

      if (objCard.status === "line") {
        branch = "objection";
        objectionLine = objCard.line;
      } else if (objCard.status === "abstain") {
        // Honesty gate, now Sonnet's own judgment: nothing to handle → the static
        // "No objection detected" nudge. Never a guess card, and no extra paid call.
        branch = "nudge";
        card = { headline: NUDGE_HEADLINE, subtext: NUDGE_STATIC_SUBTEXT, source: "" };
      }
      // else objCard.status === "error": card + objectionLine stay null → falls through
      // to the failure return below → the client shows the retry pill (never dead air).
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
      `[kb-signal] TIMING search=${searchMs}ms ` +
      `generate=${generateMs}ms total=${totalMs}ms branch=${branch} idleGap=${idleGap}`,
    );

    // Objection slot with a real objection → the headless single-line card.
    if (objectionLine) {
      return NextResponse.json({
        ok:            true,
        signal_type:   "Objection",
        signal_text:   objectionLine,
        signal_header: "",
      });
    }

    if (!card) {
      // Generation failed (timeout / API error / unparseable) — return empty ok.
      // DashboardClient gates on card content and shows the retry pill (never dead air).
      console.error("[kb-signal] Card generation failed");
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
