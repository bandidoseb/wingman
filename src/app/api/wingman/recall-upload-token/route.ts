import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Purpose: stop a leaked/replayed Supabase access token from minting UNLIMITED
// Recall AI upload tokens (abuse guard — Recall bills per recorded minute). It is
// NOT a product limit on normal use.
//
// Rolling-window burst limiter, per Supabase user id: up to RATE_MAX_STARTS starts
// per RATE_WINDOW_MS. Generous on purpose — a dropped call that the rep redeploys
// immediately must NOT get blocked. The old "1 per 30s" broke exactly that case.
// Per-user, so different users on different machines never affect each other.
// NOTE: in-process Map — fine for single-instance beta. Swap for Redis if Railway
// ever runs multiple instances (each would otherwise keep its own window).
const tokenStarts    = new Map<string, number[]>(); // userId → recent start timestamps (ms)
const RATE_WINDOW_MS = 60 * 1000; // rolling 60-second window
const RATE_MAX_STARTS = 6;        // up to 6 call-starts per user per rolling minute

/**
 * POST /api/wingman/recall-upload-token
 *
 * Called by the Electron main process the moment the user starts a call.
 * Authenticates the request via Bearer token, then calls Recall AI to create
 * a Desktop SDK Upload and returns the short-lived upload token.
 *
 * Security model:
 * - RECALL_AI_API_KEY lives only on Railway (server env). It is never in the
 *   desktop app binary.
 * - The caller must supply a valid Supabase access token. We verify it with
 *   supabase.auth.getUser() before touching Recall AI.
 * - The returned upload_token is short-lived and scoped to one recording.
 */
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authenticate via Bearer token ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.slice(7);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Rate limit: burst of RATE_MAX_STARTS per user per rolling minute ──
    const now    = Date.now();
    const recent = (tokenStarts.get(user.id) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX_STARTS) {
      console.warn(`[recall-upload-token] Rate limit hit for user ${user.id} (${recent.length} starts in ${RATE_WINDOW_MS / 1000}s)`);
      return NextResponse.json(
        { error: "Too many requests — please wait a moment before starting a new call" },
        { status: 429 }
      );
    }
    recent.push(now);
    tokenStarts.set(user.id, recent);

    // ── 4. Verify server has the Recall AI key configured ────────────────────
    const recallApiKey = process.env.RECALL_AI_API_KEY;
    if (!recallApiKey) {
      console.error("[recall-upload-token] RECALL_AI_API_KEY is not set in environment");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // ── 5. Request an upload token from Recall AI ─────────────────────────────
    // Creates a Desktop SDK Upload with live transcript streaming via Deepgram.
    const recallRes = await fetch("https://us-west-2.recall.ai/api/v1/sdk_upload/", {
      method: "POST",
      headers: {
        "accept":        "application/json",
        "content-type":  "application/json",
        "Authorization": `Token ${recallApiKey}`,
      },
      body: JSON.stringify({
        recording_config: {
          transcript: {
            // interim_results: Deepgram only EMITS partial (unfinalized)
            // transcripts when this is on — subscribing to the
            // transcript.partial_data event alone yields zero events (#41,
            // verified on the 2026-07-03 measurement call). Billing is per
            // audio minute, so interims add no cost. Finals are unaffected.
            provider: {
              deepgram_streaming: { model: "nova-2-general", interim_results: true },
            },
          },
          realtime_endpoints: [
            {
              type:   "desktop_sdk_callback",
              // partial_data: low-latency unfinalized transcripts (#41) —
              // consumed by electron/recall.ts for measurement; the live card
              // pipeline still reads finals (transcript.data) only.
              events: ["transcript.data", "transcript.partial_data"],
            },
          ],
        },
      }),
    });

    if (!recallRes.ok) {
      const body = await recallRes.text();
      console.error("[recall-upload-token] Recall AI returned error:", recallRes.status, body);
      return NextResponse.json({ error: "Failed to create recording session" }, { status: 502 });
    }

    const recallData = await recallRes.json() as { upload_token?: string };

    if (!recallData.upload_token) {
      console.error("[recall-upload-token] Recall AI response missing upload_token:", recallData);
      return NextResponse.json({ error: "No upload token returned" }, { status: 502 });
    }

    // ── 6. Return the token to Electron ───────────────────────────────────────
    return NextResponse.json({ upload_token: recallData.upload_token });

  } catch (err) {
    console.error("[recall-upload-token] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
