/**
 * POST /api/wingman/kb-signal
 *
 * RAG-powered signal card endpoint.
 * Fires on trigger detection (keyword match or classifier hit) — NOT on a timer.
 *
 * Flow:
 *   searchKnowledge(chunk) → embed → pgvector → top 3 matches
 *   generateSignalCard(results, chunk) → Haiku → first-person card
 *
 * Target latency: under 500ms total
 * Returns: { signal_card, signal_header } or { signal_card: null } if no match
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }              from "@/lib/supabase/server";
import { searchKnowledge }           from "@/lib/wingman/knowledge-search";
import { generateSignalCard }        from "@/lib/wingman/knowledge-signal";

// Parse a signal card string into header + text
// Card format: "HANDLE — "I totally get that — what specifically is holding you back?""
function parseCard(card: string): { header: string; text: string } {
  const dashIdx = card.indexOf(" — ");
  if (dashIdx === -1) return { header: "KB", text: card };

  const header = card.slice(0, dashIdx).trim();
  let   text   = card.slice(dashIdx + 3).trim();

  // Strip surrounding quotes if present
  text = text.replace(/^[""]/, "").replace(/[""]$/, "");

  return { header, text };
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      transcript_chunk,
      scorecard_snapshot,
    }: {
      transcript_chunk:   string;
      scorecard_snapshot?: {
        pain_detail?:               string;
        gold_moment?:               string;
        predicted_next_objection?:  string;
        objection_risk?:            string;
        prospect_anchors?:          string;
      };
    } = body;

    if (!transcript_chunk?.trim()) {
      return NextResponse.json({ signal_card: null }, { status: 200 });
    }

    // Limit chunk size
    if (transcript_chunk.length > 2_000) {
      return NextResponse.json({ signal_card: null }, { status: 200 });
    }

    // ── 1. Search knowledge base ──────────────────────────────────────────
    const knowledgeResults = await searchKnowledge(transcript_chunk);

    if (!knowledgeResults) {
      // Nothing above 0.78 similarity — return null, don't fire a card
      return NextResponse.json({ signal_card: null });
    }

    // ── 2. Generate compressed signal card via Haiku ──────────────────────
    const card = await generateSignalCard(knowledgeResults, transcript_chunk, scorecard_snapshot);

    if (!card) {
      return NextResponse.json({ signal_card: null });
    }

    const { header, text } = parseCard(card);

    return NextResponse.json({
      signal_card:   card,    // raw string e.g. "HANDLE — "I get that — what's really in the way?""
      signal_header: header,  // e.g. "HANDLE"
      signal_text:   text,    // e.g. "I get that — what's really in the way?"
      signal_type:   "Handle" as const,
    });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    return NextResponse.json({ signal_card: null }, { status: 500 });
  }
}
