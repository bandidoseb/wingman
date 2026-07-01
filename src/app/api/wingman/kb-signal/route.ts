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
 * Flow (↑ objection slot — context-driven, NO KB, NO Groq since 2026-06-30; STREAMING since
 * 2026-06-30 Step 4): this slot returns a Server-Sent-Events stream, NOT JSON. We return the
 * Response immediately and run streamObjectionCard() inside the stream's start(), emitting:
 *     event:delta {textSoFar}  → the spoken line so far (decoder strips the JSON envelope)
 *     event:done  {line}       → authoritative final line (headless Objection card)
 *     event:nudge {header,text}→ Sonnet abstained → static "No objection detected" (honesty gate)
 *     event:error {}           → API/timeout/unparseable → client shows the retry pill
 *   The pre-Sonnet cases (auth, rate-limit, empty/oversized transcript) still return JSON; the
 *   client branches on Content-Type, so those keep working. Other slots (answer/dig/close):
 *   raw-chunk KB path, JSON, unchanged until Phase 4.
 *
 * Instrumentation (#38): every request logs
 *   [kb-signal] TIMING ... branch= idleGap=   (objection logs `stream branch=objection`)
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
import { streamObjectionCard }         from "@/lib/wingman/objection-signal";

// The objection slot streams (SSE). force-dynamic keeps it off any cached/static path;
// nodejs runtime so the ReadableStream + per-request abort behave predictably on Railway.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
      // Pressed faster than the cost guard allows. This is NOT a failure — return a
      // distinct 429 so the client resolves the pill QUIETLY (no "couldn't pull that"
      // error). The client also throttles before sending, so this is the edge backstop.
      return NextResponse.json({ ok: false, throttled: true }, { status: 429 });
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

    const idleGap = last === 0 ? "first" : `${Math.round((now - last) / 1000)}s`;

    // ── ↑ Objection slot → STREAMING (SSE) ──────────────────────────────────
    // NO Groq, NO KB. Sonnet reads the buffer, infers the objection, and streams the
    // ONE spoken line as it writes it. We return the Response IMMEDIATELY and run Sonnet
    // INSIDE the stream's start() — nothing is awaited before return, so Next/Railway
    // can't buffer it. The decoder yields only the inner line chars; abstain → a single
    // `nudge` event (zero deltas); error → a single `error` event (client shows retry).
    if (activeSlot === "objection") {
      console.log(`[kb-signal] TIMING stream branch=objection idleGap=${idleGap}`);

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          // When the client disconnects mid-stream the controller is already closed, so
          // every enqueue must be guarded — otherwise it throws "Controller is already
          // closed". Returns false once the pipe is gone so we can stop the loop + Sonnet.
          const send = (event: string, data: unknown): boolean => {
            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
              return true;
            } catch { return false; } // client gone — stop trying to write
          };
          try { controller.enqueue(encoder.encode(": ok\n\n")); } catch { return; } // flush; bail if already closed

          let sawTerminal = false;
          try {
            // req.signal aborts on client disconnect / dismiss / call-end → stops Sonnet (W6).
            for await (const ev of streamObjectionCard(transcript_chunk, summary, req.signal)) {
              let alive = true;
              if (ev.kind === "delta") {
                alive = send("delta", { textSoFar: ev.textSoFar });
              } else if (ev.kind === "done") {
                alive = send("done", { line: ev.line });
                sawTerminal = true;
              } else if (ev.kind === "abstain") {
                // Static "No objection detected" — server owns the copy (single source).
                alive = send("nudge", { header: NUDGE_HEADLINE, text: NUDGE_STATIC_SUBTEXT });
                sawTerminal = true;
              } else {
                alive = send("error", {});
                sawTerminal = true;
              }
              if (!alive) break; // client disconnected — abort the generator (its finally stops Sonnet)
            }
            if (!sawTerminal) send("error", {}); // generator ended w/o terminal
          } catch (err) {
            console.error("[kb-signal] objection stream error:", err);
            send("error", {}); // guarded — no-op if the client already left
          } finally {
            try { controller.close(); } catch { /* already closed */ }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type":      "text/event-stream; charset=utf-8",
          "Cache-Control":     "no-cache, no-transform",  // no-transform defeats Next gzip on this route
          "Connection":        "keep-alive",
          "X-Accel-Buffering": "no",                      // tell Railway's edge proxy not to buffer
        },
      });
    }

    // ── answer / dig / close — raw-chunk KB path, unchanged until Phase 4. ──
    const tPipeline  = Date.now();
    let   branch: "kb" | "raw-fallback" = "raw-fallback";
    let   card: SignalCardResult | null = null;

    const t1 = Date.now();
    const knowledgeResults = await searchKnowledge(transcript_chunk);
    const searchMs = Date.now() - t1;

    const t2 = Date.now();
    if (knowledgeResults) {
      branch = "kb";
      card = await generateSignalCard(knowledgeResults, transcript_chunk, summary, current_stage);
    }
    if (!card) {
      branch = "raw-fallback";
      card = await generateFallbackCard(activeSlot, transcript_chunk, summary, current_stage);
    }
    const generateMs = Date.now() - t2;

    console.log(
      `[kb-signal] TIMING search=${searchMs}ms ` +
      `generate=${generateMs}ms total=${Date.now() - tPipeline}ms branch=${branch} idleGap=${idleGap}`,
    );

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
      signal_type:   "Handle",
    });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
