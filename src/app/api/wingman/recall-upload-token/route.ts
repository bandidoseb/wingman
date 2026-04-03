import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Prevents a leaked or replayed Supabase access token from minting unlimited
// Recall AI upload tokens (Recall AI charges per recording minute).
// One token per user per 30 seconds is far more than any legitimate use case needs.
// NOTE: This map lives in-process. On a single Railway server this is sufficient
// for beta. For multi-instance deployments, swap for a Redis-backed rate limiter.
const tokenRateLimit = new Map<string, number>();
const RATE_LIMIT_MS  = 30 * 1000; // 30 seconds between tokens per user

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

    // ── 2. Rate limit: one upload token per user per 30 seconds ──────────────
    const now       = Date.now();
    const lastMint  = tokenRateLimit.get(user.id) ?? 0;
    if (now - lastMint < RATE_LIMIT_MS) {
      console.warn(`[recall-upload-token] Rate limit hit for user ${user.id}`);
      return NextResponse.json(
        { error: "Too many requests — please wait a moment before starting a new call" },
        { status: 429 }
      );
    }
    tokenRateLimit.set(user.id, now);

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
            provider: { deepgram_streaming: { model: "nova-2-general" } },
          },
          realtime_endpoints: [
            {
              type:   "desktop_sdk_callback",
              events: ["transcript.data"],
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
