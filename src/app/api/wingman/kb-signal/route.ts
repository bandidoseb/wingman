/**
 * POST /api/wingman/kb-signal
 *
 * RAG-powered signal card endpoint.
 * Fires on trigger detection (keyword match) — NOT on a timer.
 *
 * Flow:
 *   searchKnowledge(chunk) → embed → pgvector → top 3 matches
 *   generateSignalCard(results, chunk) → Haiku → first-person card
 *   pusherServer.trigger() → pushes card to client WebSocket channel
 *
 * Target latency: under 500ms total
 * Returns: { ok: true } — card is pushed via Pusher, not in the response body
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { searchKnowledge }           from "@/lib/wingman/knowledge-search";
import { generateSignalCard }        from "@/lib/wingman/knowledge-signal";
import { pusherServer }              from "@/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      transcript_chunk,
      call_id,
      scorecard_snapshot,
      current_stage,
    }: {
      transcript_chunk:   string;
      call_id?:           string;
      current_stage?:     string;
      scorecard_snapshot?: {
        pain_detail?:               string;
        gold_moment?:               string;
        predicted_next_objection?:  string;
        objection_risk?:            string;
        prospect_anchors?:          string;
      };
    } = body;

    if (!transcript_chunk?.trim()) {
      return NextResponse.json({ ok: true });
    }

    // Limit chunk size
    if (transcript_chunk.length > 2_000) {
      return NextResponse.json({ ok: true });
    }

    // ── 1. Search knowledge base ──────────────────────────────────────────
    const knowledgeResults = await searchKnowledge(transcript_chunk);

    if (!knowledgeResults) {
      // Nothing above 0.65 similarity — no card to push
      return NextResponse.json({ ok: true });
    }

    // ── 2. Generate two-tier signal card via Haiku ────────────────────────
    const card = await generateSignalCard(
      knowledgeResults,
      transcript_chunk,
      scorecard_snapshot,
      current_stage,
    );

    if (!card) {
      return NextResponse.json({ ok: true });
    }

    // Push signal card to client via Pusher.
    // KB signals use source "keyword" so they bypass the 90-second cooldown —
    // a prospect raising an objection is always urgent regardless of timing.
    if (!call_id) {
      console.warn("[kb-signal] No call_id — cannot push signal via Pusher");
      return NextResponse.json({ ok: true });
    }

    try {
      await pusherServer.trigger(`private-wingman-call-${call_id}`, "signal-card", {
        signal_type:   "Handle",
        signal_header: card.headline,
        signal_text:   card.subtext ?? "",
        source:        "kb",
      });
    } catch (pusherErr) {
      console.error("[kb-signal] Pusher push failed — signal card not delivered:", pusherErr);
    }

    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
