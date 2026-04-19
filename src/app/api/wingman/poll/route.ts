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

function buildFlightPlanContext(snapshot: unknown): string {
  if (!snapshot || typeof snapshot !== "object") return "";
  const p = snapshot as Record<string, unknown>;
  const lines: string[] = [];

  if (p.target_market)      lines.push(`Ideal client: ${p.target_market}`);
  if (p.core_problem)       lines.push(`Core problem: ${p.core_problem}`);
  if (p.dream_outcome)      lines.push(`Dream outcome: ${p.dream_outcome}`);

  const min = typeof p.investment_min === "number" ? p.investment_min : null;
  const max = typeof p.investment_max === "number" ? p.investment_max : null;
  if (min !== null && max !== null) {
    lines.push(`Typical investment: $${min.toLocaleString()} – $${max.toLocaleString()}`);
  } else if (min !== null) {
    lines.push(`Typical investment: $${min.toLocaleString()}+`);
  } else if (max !== null) {
    lines.push(`Typical investment: up to $${max.toLocaleString()}`);
  }

  if (p.involves_partner === true) {
    lines.push("Decision usually involves a partner or spouse — establish both on the call.");
  }
  if (p.method_differentiation) lines.push(`Why this offer: ${p.method_differentiation}`);

  const checkpoints = Array.isArray(p.custom_checkpoints) ? (p.custom_checkpoints as string[]) : [];
  if (checkpoints.length > 0) {
    lines.push(`Custom checkpoints: ${checkpoints.join("; ")}`);
  }

  if (lines.length === 0) return "";
  return `REP'S FLIGHT PLAN:\n${lines.join("\n")}`;
}

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

    // Limit chunk size to prevent abuse / DB bloat.
    // With correct dedup a 30s poll chunk is ~500-1000 chars — 50K is a
    // generous ceiling that should never trigger in normal operation.
    if (transcript_chunk.length > 50_000) {
      return NextResponse.json({ error: "Transcript chunk too large" }, { status: 400 });
    }

    const service = createServiceClient();

    // ── 0. Verify call belongs to this user + load flight plan snapshot ───────
    let flightPlanSnapshot: unknown = null;
    if (call_id) {
      const { data: callCheck } = await service
        .from("calls")
        .select("id, flight_plan_snapshot")
        .eq("id", call_id)
        .eq("user_id", user.id)
        .single();
      if (!callCheck) {
        return NextResponse.json({ error: "Call not found" }, { status: 404 });
      }
      flightPlanSnapshot = callCheck.flight_plan_snapshot ?? null;
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
    let sequenceBase = Math.floor(Date.now() / 1000); // seconds — stays within INTEGER range

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

    const flightPlanStr = buildFlightPlanContext(flightPlanSnapshot);

    const userMessage = `CURRENT STAGE: ${stage}

${repProfileStr}

${signalVaultStr}

${objectionVaultStr}

${scorecardStr}
${flightPlanStr ? `\n${flightPlanStr}\n` : ""}
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
    // AbortController ensures a hung Anthropic request never freezes the poll
    // indefinitely — 10s is generous for a live-call round trip.
    const controller = new AbortController();
    const claudeTimeout = setTimeout(() => controller.abort(), 10_000);

    let claudeRes: Response;
    try {
      claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 512,
          system: [
            {
              type: "text",
              text: WINGMAN_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userMessage }],
        }),
      });
    } catch (fetchErr) {
      clearTimeout(claudeTimeout);
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        console.error("[poll] Claude API timed out after 10s");
        return NextResponse.json({ error: "AI timeout" }, { status: 504 });
      }
      throw fetchErr;
    }
    clearTimeout(claudeTimeout);

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
