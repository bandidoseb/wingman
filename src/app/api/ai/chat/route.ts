import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchKnowledge } from "@/lib/wingman/knowledge-search";

const DAILY_CAP = 20;

// ── Context builders ───────────────────────────────────────────────────────────

/**
 * Caps a transcript to ~2,000 words so it stays within the token budget.
 * Server-side cap — client sends the full transcript.
 */
function capTranscript(
  lines: Array<{ speaker: string; text: string; sequence_order: number }>,
  maxWords = 2000
): string {
  const sorted = [...lines].sort((a, b) => a.sequence_order - b.sequence_order);
  const out: string[] = [];
  let wordCount = 0;

  for (const line of sorted) {
    const words = line.text.split(/\s+/).length;
    if (wordCount + words > maxWords) {
      out.push("[transcript truncated for length]");
      break;
    }
    out.push(`${line.speaker}: ${line.text}`);
    wordCount += words;
  }
  return out.join("\n");
}

/**
 * Builds a concise multi-call summary for the global "Mission Intel" chat.
 * Each call line is ~15 tokens — 20 calls = ~300 tokens, well within budget.
 */
function buildGlobalContext(
  callSummaries: Array<{
    prospect_name: string | null;
    outcome: string | null;
    call_date: string;
    duration: string | null;
    summary: string | null;
    missed_topics: string[];
  }>
): string {
  const total     = callSummaries.length;
  const closed    = callSummaries.filter((c) => c.outcome === "Closed").length;
  const lost      = callSummaries.filter((c) => c.outcome === "Lost").length;
  const dq        = callSummaries.filter((c) => c.outcome === "DQ").length;
  const followUp  = callSummaries.filter((c) => c.outcome === "Follow Up").length;
  const closeRate = total > 0 ? Math.round((closed / Math.max(total - dq, 1)) * 100) : 0;

  const statsLine = `CALL STATS (last ${total} calls): ${closed} closed / ${lost} lost / ${dq} DQ / ${followUp} follow-up | Close rate: ${closeRate}%`;

  const callLines = callSummaries.slice(0, 20).map((c) => {
    const date  = new Date(c.call_date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const parts = [`${date} — ${c.prospect_name ?? "Unknown"} — ${c.outcome ?? "no outcome"}`];
    if (c.summary)               parts.push(c.summary.slice(0, 150));
    if (c.missed_topics?.length) parts.push(`Missed: ${c.missed_topics.join(", ")}`);
    return parts.join(" | ");
  });

  return `${statsLine}\n\nRECENT CALLS:\n${callLines.join("\n")}`;
}

/**
 * Builds full context for a single-call coaching session.
 * Transcript is capped to 2,000 words server-side.
 */
function buildSingleCallContext(call: {
  prospect_name: string | null;
  outcome: string | null;
  call_date: string;
  duration: string | null;
  summary: string | null;
  missed_topics: string[];
  call_stages?:     Array<{ name: string; status: string; note: string | null; display_order: number }>;
  call_transcript?: Array<{ speaker: string; text: string; sequence_order: number }>;
}): string {
  const date  = new Date(call.call_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const lines: string[] = [
    `CALL: ${call.prospect_name ?? "Unknown Prospect"} — ${date} — ${call.duration ?? "unknown duration"} — Outcome: ${call.outcome ?? "not set"}`,
  ];

  if (call.summary) {
    lines.push(`\nAI DEBRIEF:\n${call.summary}`);
  }

  if (call.missed_topics?.length) {
    lines.push(`\nMISSED TOPICS: ${call.missed_topics.join(", ")}`);
  }

  if (call.call_stages?.length) {
    const stagesStr = [...call.call_stages]
      .sort((a, b) => a.display_order - b.display_order)
      .map((s) => `${s.name}: ${s.status}${s.note ? ` (${s.note})` : ""}`)
      .join(" → ");
    lines.push(`\nSTAGES: ${stagesStr}`);
  }

  if (call.call_transcript?.length) {
    lines.push(`\nTRANSCRIPT:\n${capTranscript(call.call_transcript)}`);
  }

  return lines.join("\n");
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Subscription check ─────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status, chat_messages_today, chat_reset_date")
      .eq("id", user.id)
      .single();

    const status = profile?.subscription_status ?? "trialing";
    if (status === "canceled" || status === "past_due") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }

    // ── Daily message cap ──────────────────────────────────────────────────────
    const today     = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    const lastReset = profile?.chat_reset_date ?? today;
    const usedToday = lastReset === today ? (profile?.chat_messages_today ?? 0) : 0;

    if (usedToday >= DAILY_CAP) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_CAP} messages/day). Resets at midnight.`, limitReached: true },
        { status: 429 }
      );
    }

    // ── Parse body ─────────────────────────────────────────────────────────────
    const { mode, messages, callSummaries, call } = await req.json();

    if (!mode || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "mode and messages required" }, { status: 400 });
    }

    // ── Build call context ─────────────────────────────────────────────────────
    let contextStr = "";
    if (mode === "global" && Array.isArray(callSummaries)) {
      contextStr = buildGlobalContext(callSummaries);
    } else if (mode === "single_call" && call) {
      contextStr = buildSingleCallContext(call);
    }

    // ── KB search (non-fatal — coaching works without it) ─────────────────────
    const lastUserMsg = [...messages].reverse().find((m: { role: string }) => m.role === "user")?.content ?? "";
    let kbContext = "";
    if (lastUserMsg) {
      try {
        kbContext = await searchKnowledge(lastUserMsg);
      } catch {
        // silent — KB failure doesn't block the response
      }
    }

    // ── Build system prompt ────────────────────────────────────────────────────
    const systemParts: string[] = [
      `You are Wingman — an elite sales coach who has seen thousands of real calls. You don't sugarcoat, and you don't flatter.`,
      ``,
      `Tone:`,
      `- Proper grammar and punctuation. You're a professional.`,
      `- Confident and direct. When you have an opinion, share it.`,
      `- Not a yes-man. If their thinking or performance is off, name it briefly — then move on. Don't be harsh, but don't sugarcoat.`,
      `- No filler openers. Never start with "Great question", "Absolutely", "Of course", or "I".`,
      `- Praise when it's earned. Pushback when it's earned. Neither is given freely.`,
      ``,
      `Format:`,
      `- Keep it short. When you have 2-3 distinct thoughts, separate each with a blank line — like sending separate texts.`,
      `- No bullet points, no lists, no headers. Just talk.`,
      ``,
      `Substance:`,
      `- Always anchor to their real data — specific outcomes, specific patterns, specific call moments. Generic advice is lazy advice.`,
      `- If you don't have enough to be specific, ask ONE short question instead of guessing.`,
      `- Never mention other coaches, frameworks, or external tools. All insights come from you.`,
      `- Never say "the knowledge base" or reference any system. You're their coach, period.`,
    ];

    if (contextStr) {
      systemParts.push(`\n---\n${contextStr}`);
    }

    if (kbContext) {
      // Strip any stray coach name lines before injecting
      const cleanKb = kbContext.replace(/^coach_name:.*$/gmi, "").trim();
      systemParts.push(
        `\n---\nCOACHING INSIGHTS (weave these naturally into your response — never quote or attribute them):\n${cleanKb}`
      );
    }

    const systemPrompt = systemParts.join("\n");

    // ── Cap history to last 10 turns ───────────────────────────────────────────
    const cappedMessages = messages
      .slice(-10)
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));

    // ── Call Claude Sonnet ─────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key":          apiKey,
        "anthropic-version":  "2023-06-01",
        "content-type":       "application/json",
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 400,
        system:     systemPrompt,
        messages:   cappedMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai/chat] Anthropic API error:", errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const aiData = await response.json();
    const reply  = aiData.content?.[0]?.text ?? "";

    // ── Increment daily counter ────────────────────────────────────────────────
    await supabase
      .from("profiles")
      .update({ chat_messages_today: usedToday + 1, chat_reset_date: today })
      .eq("id", user.id);

    return NextResponse.json({ reply });

  } catch (err) {
    console.error("[ai/chat] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
