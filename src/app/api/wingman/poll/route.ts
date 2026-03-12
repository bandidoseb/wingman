import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { WINGMAN_SYSTEM_PROMPT } from "@/lib/wingman/system-prompt";
import {
  buildRepProfile,
  buildSignalVaultSummary,
  buildObjectionVaultSummary,
} from "@/lib/wingman/rep-profile";
import type { LiveScorecard, WingmanPollResponse } from "@/types";

const MODEL_MAP: Record<string, string> = {
  smart: "claude-sonnet-4-6",
  fast:  "claude-haiku-4-5-20251001",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      call_id,
      stage,
      transcript_chunk, // new text since last poll
      scorecard,         // current LiveScorecard
    }: {
      call_id: string;
      stage: string;
      transcript_chunk: string;
      scorecard: LiveScorecard;
    } = body;

    if (!transcript_chunk?.trim()) {
      return NextResponse.json({ error: "Empty transcript chunk" }, { status: 400 });
    }

    // Limit chunk size to prevent abuse / DB bloat
    if (transcript_chunk.length > 10_000) {
      return NextResponse.json({ error: "Transcript chunk too large" }, { status: 400 });
    }

    const service = createServiceClient();

    // ── 0. Verify call belongs to this user ──────────────────────────────────
    if (call_id) {
      const { data: callCheck } = await service
        .from("calls")
        .select("id")
        .eq("id", call_id)
        .eq("user_id", user.id)
        .single();
      if (!callCheck) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
    }

    // ── 1. Load all context in parallel ──────────────────────────────────────
    const [profileRes, offerRes, callsRes, signalsRes, objectionsRes] =
      await Promise.all([
        service.from("profiles").select("*").eq("id", user.id).single(),
        service
          .from("offers")
          .select("name, price")
          .eq("user_id", user.id)
          .eq("is_main", true)
          .single(),
        service
          .from("calls")
          .select("outcome, call_stages(*)")
          .eq("user_id", user.id)
          .order("call_date", { ascending: false })
          .limit(30),
        service
          .from("vault_signals")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_enabled", true),
        service
          .from("vault_objections")
          .select("*")
          .eq("user_id", user.id)
          .order("frequency", { ascending: false }),
      ]);

    const profile = profileRes.data;
    const offer = offerRes.data;
    const recentCalls = callsRes.data ?? [];
    const signals = signalsRes.data ?? [];
    const objections = objectionsRes.data ?? [];

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Allow active subscribers and free-tier users; only block explicitly canceled/past_due.
    // null status = new user who hasn't subscribed yet → allow through.
    const status = profile.subscription_status ?? "trialing";
    if (status === "canceled" || status === "past_due") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }

    // ── 2. Save transcript chunk to DB ─────────────────────────────────────
    const lines = transcript_chunk.split("\n").filter((l) => l.trim());
    let sequenceBase = Date.now(); // use timestamp as sequence seed

    const transcriptRows = lines
      .map((line, idx) => {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) return null;
        const speaker = line.slice(0, colonIdx).trim();
        const text = line.slice(colonIdx + 1).trim();
        if (!text) return null;
        return {
          call_id,
          speaker,
          text,
          sequence_order: sequenceBase + idx,
        };
      })
      .filter(Boolean);

    if (transcriptRows.length > 0) {
      await service.from("call_transcript").insert(transcriptRows);
    }

    // ── 3. Build flat payload ─────────────────────────────────────────────
    const repProfileStr = buildRepProfile({
      profile,
      offerName: offer?.name ?? null,
      offerPrice: offer?.price ?? null,
      recentCalls,
      objections,
      signals,
    });

    const signalVaultStr = buildSignalVaultSummary(signals);
    const objectionVaultStr = buildObjectionVaultSummary(objections);

    const scorecardStr = `LIVE SCORECARD:\n${JSON.stringify(scorecard, null, 2)}`;

    const userMessage = `CURRENT STAGE: ${stage}

${repProfileStr}

${signalVaultStr}

${objectionVaultStr}

${scorecardStr}

NEW TRANSCRIPT CHUNK (since last poll):
${transcript_chunk}

Based on the new chunk and scorecard above, return your JSON response now.`;

    // ── 4. Select model ───────────────────────────────────────────────────
    const modelPref = profile.ai_model_preference ?? "smart";
    const model = MODEL_MAP[modelPref] ?? MODEL_MAP.smart;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI not configured" }, { status: 503 });
    }

    // ── 5. Call Claude ────────────────────────────────────────────────────
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        system: WINGMAN_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", errText);
      return NextResponse.json({ error: "Claude API error" }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const rawText: string = claudeData.content?.[0]?.text ?? "{}";

    // ── 6. Parse response ─────────────────────────────────────────────────
    let parsed: WingmanPollResponse;
    try {
      // Strip any markdown code fences if Claude wraps the JSON
      const cleaned = rawText.replace(/^```json?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("JSON parse error. Raw:", rawText);
      return NextResponse.json({ error: "Invalid AI response" }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("Poll route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
