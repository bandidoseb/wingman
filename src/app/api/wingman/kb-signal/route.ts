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
 * Flow:
 *   searchKnowledge(chunk) → embed → pgvector → top match
 *   if match  → generateSignalCard(results, chunk, summary, stage) → Haiku
 *   if no match → generateFallbackCard(slot, chunk, summary, stage)  → Haiku
 *   → returns { ok, signal_header, signal_text, signal_type } in the HTTP body
 *
 * The card is delivered synchronously in the response (not via Pusher).
 * DashboardClient awaits the response and calls window.wingman.sendSignal().
 *
 * Target latency: < 1 s end-to-end
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@/lib/supabase/server";
import { searchKnowledge }             from "@/lib/wingman/knowledge-search";
import { generateSignalCard,
         generateFallbackCard }        from "@/lib/wingman/knowledge-signal";

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

    // Empty transcript — nothing to work with
    if (!transcript_chunk?.trim()) {
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

    const activeSlot: Slot = VALID_SLOTS.includes(slot as Slot)
      ? (slot as Slot)
      : "objection";

    // ── 1. Search knowledge base ────────────────────────────────────────────
    const knowledgeResults = await searchKnowledge(transcript_chunk);

    let card = null;

    if (knowledgeResults) {
      // ── 2a. KB match — generate with technique context ──────────────────
      card = await generateSignalCard(
        knowledgeResults,
        transcript_chunk,
        summary,
        current_stage,
      );
    }

    if (!card) {
      // ── 2b. No KB match (or generation failed) — always return a card ───
      // The rep pressed a key — they always get something back.
      card = await generateFallbackCard(
        activeSlot,
        transcript_chunk,
        summary,
        current_stage,
      );
    }

    if (!card) {
      // Both paths failed (e.g. Haiku timeout / API error) — return empty ok.
      // DashboardClient checks for signal_header before calling sendSignal.
      console.error("[kb-signal] Both KB and fallback generation failed");
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({
      ok:            true,
      signal_header: card.headline,
      signal_text:   card.subtext ?? "",
      signal_type:   "Handle",
    });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
