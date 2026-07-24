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
 * Flight Recorder invariant (dev-only): EVERY terminal path that answers a press —
 * streamed card, static nudge, throttle, rejection, error — appends a "card" record
 * via devlog.append() so a logged press can never lack an outcome in the call film.
 * All appends are fire-and-forget no-ops unless WINGMAN_DEVLOG=1 outside production.
 *
 * Warm latency goal: 1.5–2s press-to-card (Sebastian, 2026-06-11).
 */

import { NextRequest, NextResponse }   from "next/server";
import { createClient }                from "@/lib/supabase/server";
import { searchKnowledge }             from "@/lib/wingman/knowledge-search";
import { generateSignalCard,
         generateFallbackCard,
         type SignalCardResult }       from "@/lib/wingman/knowledge-signal";
import { streamObjectionCard,
         type ObjectionThread,
         type ObjectionCallMemory }     from "@/lib/wingman/objection-signal";
import { streamDigCard }                from "@/lib/wingman/dig-signal";
import { sanitizeSalesDna }             from "@/lib/wingman/sales-dna.mjs";
import { normalizeConfrontation }       from "@/lib/wingman/objection-prompt.mjs";
import * as devlog                       from "@/lib/wingman/devlog";
import { isColdLadder }                  from "@/lib/wingman/close-readiness.mjs";

// ── Directive / all-clear nudge copy (server owns it — single source). ────────
// One plain-English line each, rendered as a single-line HEADLESS card (design language:
// one card format, no headline/subtext, no quotation marks). Emitted with an empty header
// so the HUD falls to its headless path. Wording Sebastian-locked 2026-07-14.
const NUDGE_LINE          = "No objection right now — keep going.";  // ↑ pressed, nothing standing
const DIG_TAKE_CLOSE_LINE = "They're ready — go for the close.";     // ↓ pressed, every belief built
// ↓ pressed before anyone has spoken (zero transcript) — the one deliberate exception to the
// always-a-question dig doctrine: there's no speech to build a question from. Generic, not scripted.
const DIG_TOO_EARLY_LINE  = "Start the conversation.";
// #52: ↓ pressed, Sonnet returned {null,null} ("take the close") but the Belief Ladder shows ZERO
// discovery (missing summary, or every belief ⬜ open). A take-close claim with nothing built is
// never real — it's the model's only escape hatch on a degenerate call (mic test, no prospect).
// Deterministic gate, deliberately NARROW: any ladder with even one touched belief passes through
// untouched, preserving the verbal-readiness doctrine ("how do we start?" early → take the close).
const DIG_START_DISCOVERY_LINE = "Start discovery.";                 // wording Sebastian-locked 2026-07-24

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

/**
 * Flight Recorder helper for the two pre-body-parse returns (401/429). Those branches
 * return before req.json() runs, so the film would lose the press outcome. Gated on
 * devlogEnabled() BEFORE touching the body — in prod (or dev without the flag) the
 * request path stays byte-identical to today (no body read, no await). Never throws.
 */
async function devlogPreBodyOutcome(req: NextRequest, outcome: string): Promise<void> {
  if (!devlog.devlogEnabled()) return;
  try {
    const b = await req.json().catch(() => null) as { call_id?: unknown; slot?: unknown } | null;
    if (typeof b?.call_id === "string") {
      devlog.append(b.call_id, "server", "card", {
        slot: typeof b.slot === "string" ? b.slot : "objection",
        outcome, line: null, ttftMs: null, totalMs: 0,
      });
    }
  } catch { /* telemetry must never affect the response */ }
}

export async function POST(req: NextRequest) {
  // Flight Recorder capture for the catch-all 500 at the bottom — hoisted out of the
  // try so the catch can attribute the error to the call/slot once the body has parsed.
  let capCallId: string | undefined;
  let capSlot:   string | undefined;
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      await devlogPreBodyOutcome(req, "unauthorized"); // dev-only no-op in prod
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Per-user rate limit ──────────────────────────────────────────────────
    const now  = Date.now();
    const last = rateLimitMap.get(user.id) ?? 0;
    if (now - last < RATE_LIMIT_MS) {
      // Pressed faster than the cost guard allows. This is NOT a failure — return a
      // distinct 429 so the client resolves the pill QUIETLY (no "couldn't pull that"
      // error). The client also throttles before sending, so this is the edge backstop.
      await devlogPreBodyOutcome(req, "throttled"); // dev-only no-op in prod
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
      lines_given,
      history_transcript,
      beat_number,
      gap_flag,
      flow_recap,
      call_memory,
      levers_used,
      sales_dna,
      confrontation: confrontation_raw,
      call_id,
    }: {
      transcript_chunk:    string;
      live_summary?:       string;
      slot?:               string;
      current_stage?:      string;
      lines_given?:        unknown;
      history_transcript?: unknown;
      beat_number?:        unknown;
      gap_flag?:           unknown;
      flow_recap?:         unknown;
      call_memory?:        unknown;
      levers_used?:        unknown;
      sales_dna?:          unknown;
      confrontation?:      unknown;
      call_id?:            string; // Flight Recorder key (dev-only); undefined = no capture
    } = body;
    capCallId = typeof call_id === "string" ? call_id : undefined;

    // Confrontationalness dial (2026-07-16): untrusted client value → the normalizer maps
    // anything unknown/missing to "direct", the default, which produces a byte-identical prompt.
    // So a bad/absent value can never change behavior — it degrades to today's card.
    const confrontation = normalizeConfrontation(
      typeof confrontation_raw === "string" ? confrontation_raw : undefined,
    );

    // Phase 1b (offer-aware): the rep's Sales DNA rides the same client rail as
    // live_summary — untrusted, so run it through the ONE shared sanitizer (same
    // caps as the save path; unknown keys dropped, per-field + total size bounded).
    // The segment builder downstream gates on completeness — a partial blob injects
    // nothing. No DB read on the press path (the client holds the profile).
    const salesDna = sanitizeSalesDna(sales_dna);

    // ── Objection-threading fields (Phase B) — untrusted client input, cap defensively ──
    // Bounds Sonnet token spend (cost boundary) regardless of what the client sends.
    const linesGiven: string[] = Array.isArray(lines_given)
      ? lines_given.filter((l): l is string => typeof l === "string").slice(-12).map((l) => l.slice(0, 400))
      : [];
    let historyTranscript = typeof history_transcript === "string" ? history_transcript.slice(0, 5_000) : "";
    const beatNumber = Number.isFinite(beat_number as number)
      ? Math.min(20, Math.max(0, Math.trunc(beat_number as number)))
      : 0;
    const gapFlag = gap_flag === true;
    // Step 2 fields — same defensive-cap treatment (untrusted client, cost boundary).
    const flowRecap = typeof flow_recap === "string" ? flow_recap.slice(0, 1_400) : "";
    const memRaw    = (call_memory ?? {}) as { recaps?: unknown; lines_given?: unknown };
    const memory: ObjectionCallMemory = {
      recaps: Array.isArray(memRaw.recaps)
        ? memRaw.recaps.filter((r): r is string => typeof r === "string" && !!r.trim()).slice(-3).map((r) => r.slice(0, 1_100))
        : [],
      linesGiven: Array.isArray(memRaw.lines_given)
        ? memRaw.lines_given.filter((l): l is string => typeof l === "string" && !!l.trim()).slice(-8).map((l) => l.slice(0, 200))
        : [],
    };
    const hasMemory = memory.recaps.length > 0 || memory.linesGiven.length > 0;
    // B4: flow-scoped plays run (untrusted → cap + drop non-taxonomy ids; unknown = no guard).
    const leversUsed: string[] = Array.isArray(levers_used)
      ? levers_used.filter((v): v is string => typeof v === "string" && v.length <= 30).slice(-12)
      : [];

    const activeSlot: Slot = VALID_SLOTS.includes(slot as Slot)
      ? (slot as Slot)
      : "objection";
    capSlot = activeSlot;

    // Cap the Belief Ladder summary defensively. The summarizer caps its OUTPUT at
    // BELIEF_LADDER_MAX_TOKENS = 1,500 tokens (~6,000 chars worst case); 8,000 chars
    // is headroom that never truncates a real summary (truncation here would silently
    // chop the tail — KEY ANCHORS/COMMITMENTS/WEAKEST LINK, exactly what the cards
    // read) but still stops an oversized/abusive payload from inflating the AI bill.
    // (Computed BEFORE the early returns below so their Flight Recorder records carry it.)
    const summary = typeof live_summary === "string"
      ? live_summary.slice(0, 8_000)
      : undefined;

    // Empty transcript — nothing to work with. For the objection slot, answer
    // with the honest static nudge (the rep pressed before anyone spoke — that
    // is not an error, so don't trigger the client's retry pill).
    if (!transcript_chunk?.trim()) {
      if (activeSlot === "objection") {
        // Flight Recorder: mirror the streaming branch's card record so the film shows
        // the static nudge that rendered. Fire-and-forget, dev-only no-op otherwise.
        if (call_id) devlog.append(call_id, "server", "card", {
          slot: "objection", beat: beatNumber,
          outcome: "nudge", line: NUDGE_LINE,
          ttftMs: null, totalMs: 0,
          transcriptChunk: transcript_chunk ?? "", summary, confrontation,
          hasThread: false, hasMemory,
        });
        return NextResponse.json({
          ok:            true,
          signal_header: "",           // empty → HUD renders the single-line headless card
          signal_text:   NUDGE_LINE,
          signal_type:   "Nudge",
        });
      }
      // Dig pressed before anyone spoke — a static nudge, NOT { ok: true } (which the client
      // would treat as a failed pull and show the retry pill on the wrong arrow). Generic
      // "get started" line — no speech yet to build a real question from.
      if (activeSlot === "dig") {
        if (call_id) devlog.append(call_id, "server", "card", {
          slot: "dig",
          outcome: "nudge", line: DIG_TOO_EARLY_LINE, belief: null,
          ttftMs: null, totalMs: 0,
          transcriptChunk: transcript_chunk ?? "", summary, confrontation,
        });
        return NextResponse.json({
          ok:            true,
          signal_header: "",           // empty → HUD renders the single-line headless card
          signal_text:   DIG_TOO_EARLY_LINE,
          signal_type:   "Nudge",
        });
      }
      // answer/close with an empty transcript — the client renders nothing for a bare
      // { ok: true }, but the press still needs an outcome in the film.
      if (call_id) devlog.append(call_id, "server", "card", {
        slot: activeSlot, outcome: "none", line: null, ttftMs: null, totalMs: 0,
      });
      return NextResponse.json({ ok: true });
    }

    // Server-side size guard — the rolling buffer is capped at ~2,400 chars
    // upstream, but guard here as well against unexpected payloads.
    if (transcript_chunk.length > 3_500) {
      console.warn("[kb-signal] transcript_chunk exceeded 3,500 chars — rejecting");
      // Flight Recorder: the film must show the press was answered by the size guard
      // (renders as a silent no-card on the client → retry pill).
      if (call_id) devlog.append(call_id, "server", "card", {
        slot: activeSlot, outcome: "rejected", reason: "transcript_too_long",
        line: null, ttftMs: null, totalMs: 0,
        transcriptChunkLength: transcript_chunk.length, summary, confrontation,
      });
      return NextResponse.json({ ok: true });
    }

    const idleGap = last === 0 ? "first" : `${Math.round((now - last) / 1000)}s`;

    // ── ↑ Objection slot → STREAMING (SSE) ──────────────────────────────────
    // NO Groq, NO KB. Sonnet reads the buffer, infers the objection, and streams the
    // ONE spoken line as it writes it. We return the Response IMMEDIATELY and run Sonnet
    // INSIDE the stream's start() — nothing is awaited before return, so Next/Railway
    // can't buffer it. The decoder yields only the inner line chars; abstain → a single
    // `nudge` event (zero deltas); error → a single `error` event (client shows retry).
    if (activeSlot === "objection") {
      // Build the thread ONLY for a genuine continuation (beat > 1 with context). Beat-1 sends
      // no thread → the user message is byte-identical to the shipped single-shot card.
      let thread: ObjectionThread | undefined;
      if (beatNumber > 1 && (historyTranscript || linesGiven.length)) {
        // D2 backstop: if the combined payload is oversized, TRIM the history (pin head + keep
        // tail) — NEVER drop linesGiven (the no-repeat guard) and never drop the thread. Client
        // already caps these; this is the defensive server-side floor.
        const combined = transcript_chunk.length + historyTranscript.length;
        if (combined > 8_000 && historyTranscript.length > 0) {
          const budget = Math.max(0, 8_000 - transcript_chunk.length);
          if (historyTranscript.length > budget) {
            const head = historyTranscript.slice(0, Math.floor(budget * 0.4));
            const tail = historyTranscript.slice(-Math.floor(budget * 0.6));
            historyTranscript = `${head}\n--- earlier exchange omitted ---\n${tail}`;
          }
        }
        thread = { linesGiven, historyTranscript, beatNumber, gapFlag, flowRecap: flowRecap || undefined, leversUsed };
      }
      console.log(
        `[kb-signal] TIMING stream branch=objection idleGap=${idleGap} ` +
        `beat=${beatNumber} hist=${historyTranscript.length} recap=${flowRecap.length} ` +
        `mem=${memory.recaps.length}r/${memory.linesGiven.length}l`,
      );

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
          // Flight Recorder capture (dev-only) — populated as events flow, logged in finally.
          const capT0 = Date.now();
          let capTtft: number | null = null;
          let capOutcome = "error";
          let capLine: string | null = null;
          let capLever: string | undefined;
          try {
            // req.signal aborts on client disconnect / dismiss / call-end → stops Sonnet (W6).
            for await (const ev of streamObjectionCard(transcript_chunk, summary, req.signal, thread, hasMemory ? memory : undefined, confrontation)) {
              let alive = true;
              if (ev.kind === "delta") {
                if (capTtft === null) capTtft = Date.now() - capT0;
                alive = send("delta", { textSoFar: ev.textSoFar });
              } else if (ev.kind === "done") {
                alive = send("done", { line: ev.line, lever: ev.lever });
                capOutcome = "done"; capLine = ev.line; capLever = ev.lever;
                sawTerminal = true;
              } else if (ev.kind === "lever-info") {
                continue; // B4 internal event — wrapper-filtered; defensive skip, never an error frame
              } else if (ev.kind === "abstain") {
                // Nothing standing — server owns the copy. Empty header → headless single-line card.
                alive = send("nudge", { header: "", text: NUDGE_LINE });
                capOutcome = "abstain";
                sawTerminal = true;
              } else {
                alive = send("error", {});
                capOutcome = "error";
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
            // Log AFTER close — fire-and-forget, gated, never throws. call_id undefined → no-op.
            // A dismiss / call-end / client-disconnect aborts req.signal → distinguish that from a
            // real model error so the dev log's error-rate + adoption signal stays clean.
            if (call_id) devlog.append(call_id, "server", "card", {
              slot: "objection", beat: beatNumber,
              outcome: capOutcome === "error" && req.signal.aborted ? "aborted" : capOutcome,
              line: capLine, lever: capLever, ttftMs: capTtft, totalMs: Date.now() - capT0,
              transcriptChunk: transcript_chunk, summary, confrontation,
              hasThread: !!thread, hasMemory,
            });
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

    // ── ↓ Dig slot → STREAMING (SSE) ─────────────────────────────────────────
    // NO Groq, NO KB. Sonnet reads the Belief Ladder + buffer, picks the weakest belief,
    // and streams the ONE discovery question. Same immediate-return + run-inside-start()
    // shape as the objection branch (nothing awaited before return → Next/Railway can't
    // buffer). Belief resolves first (→ "DIG · <belief>" tag); { line:null } → take-close.
    if (activeSlot === "dig") {
      console.log(`[kb-signal] TIMING stream branch=dig idleGap=${idleGap}`);
      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (event: string, data: unknown): boolean => {
            try {
              controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
              return true;
            } catch { return false; } // client gone — stop writing
          };
          try { controller.enqueue(encoder.encode(": ok\n\n")); } catch { return; }

          let sawTerminal = false;
          // Flight Recorder capture (dev-only) — populated as events flow, logged in finally.
          const capT0 = Date.now();
          let capTtft: number | null = null;
          let capOutcome = "error";
          let capLine: string | null = null;
          let capBelief: string | null = null;
          try {
            for await (const ev of streamDigCard(transcript_chunk, summary, req.signal, salesDna, confrontation)) {
              let alive = true;
              if (ev.kind === "belief") {
                capBelief = ev.belief ?? null;
                alive = send("belief", { belief: ev.belief ?? null });
              } else if (ev.kind === "delta") {
                if (capTtft === null) capTtft = Date.now() - capT0;
                alive = send("delta", { textSoFar: ev.textSoFar });
              } else if (ev.kind === "done") {
                alive = send("done", { line: ev.line, belief: ev.belief ?? null });
                capOutcome = "done"; capLine = ev.line; capBelief = ev.belief ?? capBelief;
                sawTerminal = true;
              } else if (ev.kind === "nudge") {
                // { line:null } → prospect is ready → take the close. #52 gate: a take-close on a
                // ladder with ZERO discovery (no summary, or every belief ⬜ open) is never real —
                // render "Start discovery." instead. isColdLadder runs the SAME pure engine the
                // → close chip runs client-side, so the two arrows can't disagree about "cold".
                const nudgeText  = isColdLadder(summary) ? DIG_START_DISCOVERY_LINE : DIG_TAKE_CLOSE_LINE;
                alive = send("nudge", { header: "", text: nudgeText });
                capOutcome = "nudge"; capLine = nudgeText; // Flight Recorder sees which line rendered
                sawTerminal = true;
              } else {
                alive = send("error", {});
                capOutcome = "error";
                sawTerminal = true;
              }
              if (!alive) break; // client disconnected — abort the generator (its finally stops Sonnet)
            }
            if (!sawTerminal) send("error", {}); // generator ended w/o terminal
          } catch (err) {
            console.error("[kb-signal] dig stream error:", err);
            send("error", {});
          } finally {
            try { controller.close(); } catch { /* already closed */ }
            // Log AFTER close — fire-and-forget, gated, never throws. call_id undefined → no-op.
            // aborted (dismiss/call-end/disconnect) is not a model error — label it distinctly.
            if (call_id) devlog.append(call_id, "server", "card", {
              slot: "dig",
              outcome: capOutcome === "error" && req.signal.aborted ? "aborted" : capOutcome,
              line: capLine, belief: capBelief,
              ttftMs: capTtft, totalMs: Date.now() - capT0,
              transcriptChunk: transcript_chunk, summary, confrontation,
            });
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type":      "text/event-stream; charset=utf-8",
          "Cache-Control":     "no-cache, no-transform",
          "Connection":        "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // ── ⚠️ DEAD CODE (as of 2026-07-22) — no client path reaches this. ──────────
    // This was the planned answer/close "raw-chunk KB path" (Phase 4b/4c). Reality
    // diverged: `main.ts` only ever sends slot "objection" | "dig" here; → close is
    // the client-side readiness chip (no fetch); ← answer is still a "coming soon"
    // pill. So searchKnowledge()→generateSignalCard() below NEVER runs live. Kept
    // only until Phase 5 dead-code removal (#37), which rips it + the KB imports out.
    // Do NOT wire ← answer to this path — answer is a direct general-LLM call (no
    // embed/KB); the embedding round-trip here would add ~0.5-1s of latency. ────────
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
      if (call_id) devlog.append(call_id, "server", "card", {
        slot: activeSlot, outcome: "error", line: null,
        ttftMs: null, totalMs: Date.now() - tPipeline,
        transcriptChunk: transcript_chunk, summary, branch,
      });
      return NextResponse.json({ ok: true });
    }

    if (call_id) devlog.append(call_id, "server", "card", {
      slot: activeSlot, outcome: "done",
      line: [card.headline, card.subtext].filter(Boolean).join(" — "),
      ttftMs: null, totalMs: Date.now() - tPipeline,
      transcriptChunk: transcript_chunk, summary, branch,
    });
    return NextResponse.json({
      ok:            true,
      signal_header: card.headline,
      signal_text:   card.subtext ?? "",
      signal_type:   "Handle",
    });

  } catch (err) {
    console.error("[kb-signal] Error:", err);
    // Flight Recorder: a mid-route throw (bad JSON body, Supabase hiccup, …) answers the
    // press with a 500 → the client shows the retry pill. Attribute it in the film when the
    // body parsed far enough to know the call. Streaming-branch errors never reach here —
    // they resolve inside their stream's finally with their own card record.
    if (capCallId) devlog.append(capCallId, "server", "card", {
      slot: capSlot ?? "unknown", outcome: "error", line: null,
      ttftMs: null, totalMs: 0,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
