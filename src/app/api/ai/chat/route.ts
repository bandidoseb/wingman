import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchCoachingKnowledge } from "@/lib/wingman/knowledge-search";

const DAILY_CAP  = 20;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Context builders ───────────────────────────────────────────────────────────

/**
 * Builds a concise multi-call summary for the global "Mission Intel" chat.
 * Each call line is ~15 tokens — 20 calls = ~300 tokens, well within budget.
 */
function buildGlobalContext(
  callSummaries: Array<{
    id: string;
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
    const parts = [`[${c.id}] ${date} — ${c.prospect_name ?? "Unknown"} — ${c.outcome ?? "no outcome"}`];
    if (c.summary)               parts.push(c.summary.slice(0, 150));
    if (c.missed_topics?.length) parts.push(`Missed: ${c.missed_topics.join(", ")}`);
    return parts.join(" | ");
  });

  return `${statsLine}\n\nRECENT CALLS:\n${callLines.join("\n")}`;
}

/**
 * Builds full context for a single-call coaching session.
 * No word cap — Wingman's 2-hour hard stop is the natural ceiling.
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
    const transcript = [...call.call_transcript]
      .sort((a, b) => a.sequence_order - b.sequence_order)
      .map((l) => `${l.speaker}: ${l.text}`)
      .join("\n");
    lines.push(`\nTRANSCRIPT:\n${transcript}`);
  }

  return lines.join("\n");
}

// ── Transcript fetcher with auto-retry ────────────────────────────────────────
// Retries up to maxRetries times with 500ms delay between attempts.
// CRITICAL: always includes .eq("user_id", userId) — users can only fetch their own calls.

type CallRow = {
  prospect_name: string | null;
  outcome: string | null;
  call_date: string;
  duration: string | null;
  summary: string | null;
  missed_topics: string[];
  call_stages: Array<{ name: string; status: string; note: string | null; display_order: number }>;
  call_transcript: Array<{ speaker: string; text: string; sequence_order: number }>;
};

async function fetchCallWithRetry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callId: string,
  userId: string,
  maxRetries = 2
): Promise<CallRow | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const { data, error } = await supabase
        .from("calls")
        .select(`
          prospect_name,
          outcome,
          call_date,
          duration,
          summary,
          missed_topics,
          call_stages ( name, status, note, display_order ),
          call_transcript ( speaker, text, sequence_order )
        `)
        .eq("id", callId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      if (data) return data as CallRow;
    } catch (err) {
      if (attempt === maxRetries) {
        console.error(`[ai/chat] fetchCallWithRetry failed after ${maxRetries + 1} attempts:`, err);
        return null;
      }
    }
  }
  return null;
}

// ── Core system prompt (static — same for every user, every call) ─────────────
const CORE_PROMPT = [
  `You are Wingman — an elite sales coach who has seen thousands of real calls. You don't sugarcoat, and you don't flatter.`,
  ``,
  `Tone:`,
  `- Text like a sharp human, not a polished assistant. Lowercase is fine. Sentences don't need to end in periods. Don't be sloppy — just be real.`,
  `- Never use em dashes. Never. Not once.`,
  `- Never use profanity, vulgar language, slang, or expletives. Not once, not even for emphasis. This is a hard rule.`,
  `- Confident and direct. When you have an opinion, share it.`,
  `- Not a yes-man. If their thinking or performance is off, name it briefly — then move on. Don't be harsh, but don't sugarcoat.`,
  `- No filler openers. Never start with "Great question", "Absolutely", "Of course", or "I".`,
  `- Praise when it's earned. Pushback when it's earned. Neither is given freely.`,
  ``,
  `Format:`,
  `- Keep it short. When you have 2-3 distinct thoughts, separate each with a blank line — like sending separate texts.`,
  `- No bullet points, no lists, no headers. Just talk.`,
  `- Match the weight of the question. A casual check gets a casual one-liner. Save the analysis for when they actually ask for it.`,
  ``,
  `Substance:`,
  `- Always anchor to their real data — specific outcomes, specific patterns, specific call moments. Generic advice is lazy advice.`,
  `- If you don't have enough to be specific, ask ONE short question instead of guessing.`,
  `- Never mention other coaches, frameworks, or external tools. All insights come from you.`,
  `- Never say "the knowledge base" or reference any system. You're their coach, period.`,
].join("\n");

const CALL_TRIAGE_INSTRUCTIONS = `\n---\nCALL TRIAGE — follow these steps exactly, in order:

STEP 1 — User asks about a specific call: Identify the best match from the call list above. Ask for confirmation only — e.g. "Are you talking about the call with [Name] on [Date]?" Do NOT include CALL_MATCH. Do NOT offer to dive deeper yet.

STEP 2 — User confirms the call (says yes, "that's the one", etc.): Offer the deep dive clearly. Say something like: "If you want to do a deep dive into your call with [Name], just say the word — I'll read the full transcript and we can get into every detail." Then end your response with this marker on its own line:
CALL_MATCH:{"call_id":"[exact ID from the list]","name":"[prospect name]","date":"[e.g. Apr 12]"}

STEP 3 — User accepts the deep dive (says "yes", "let's do it", "yeah go ahead", etc.): Say something like "Give me a moment — I'm reading the full transcript now." Then end your response with this exact marker on its own line:
DIVE_NOW

Rules:
- CALL_MATCH only appears in a STEP 2 response — never in Step 1 or Step 3
- DIVE_NOW only appears in a STEP 3 response — never in Step 1 or Step 2
- Copy the call_id exactly as it appears in the list — do not alter it
- Never include CALL_MATCH or DIVE_NOW for general pattern or trend questions
- If the user denies the call in Step 1, try to identify another match or ask for more detail`;

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
    const { mode, messages, callSummaries, call, pendingCallId } = await req.json();

    if (!mode || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "mode and messages required" }, { status: 400 });
    }

    // ── Validate pendingCallId (UUID v4 only — prevents injection) ─────────────
    const validPendingCallId = (
      typeof pendingCallId === "string" && UUID_REGEX.test(pendingCallId)
    ) ? pendingCallId : null;

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
        kbContext = await searchCoachingKnowledge(lastUserMsg);
      } catch {
        // silent — KB failure doesn't block the response
      }
    }

    // ── Assemble system prompt ─────────────────────────────────────────────────
    // In single_call mode: use array format with cache_control on the context block.
    // This caches the full transcript for ~5 min, saving ~90% cost on follow-up turns.
    // In global mode: use string format (context changes every message — not worth caching).

    const usePromptCaching = mode === "single_call" && contextStr.length > 0;

    type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
    let systemField: string | SystemBlock[];

    if (usePromptCaching) {
      const blocks: SystemBlock[] = [
        { type: "text", text: CORE_PROMPT },
        { type: "text", text: `\n---\n${contextStr}`, cache_control: { type: "ephemeral" } },
      ];
      if (kbContext) {
        blocks.push({
          type: "text",
          text: `\n---\nCOACHING INSIGHTS (weave these naturally into your response — never quote or attribute them):\n${kbContext}`,
        });
      }
      systemField = blocks;
    } else {
      // String system prompt (global mode)
      const parts = [CORE_PROMPT];
      if (contextStr)                parts.push(`\n---\n${contextStr}`);
      if (mode === "global")         parts.push(CALL_TRIAGE_INSTRUCTIONS);
      if (kbContext)                 parts.push(`\n---\nCOACHING INSIGHTS (weave these naturally into your response — never quote or attribute them):\n${kbContext}`);
      systemField = parts.join("\n");
    }

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
        ...(usePromptCaching ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {}),
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-6",
        max_tokens: 400,
        system:     systemField,
        messages:   cappedMessages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai/chat] Anthropic API error:", errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const aiData = await response.json();
    let   reply  = aiData.content?.[0]?.text ?? "";

    // ── Extract CALL_MATCH marker (global mode, Step 2) ────────────────────────
    let callSuggestion: { call_id: string; name: string; date: string } | null = null;
    if (mode === "global") {
      const markerIdx = reply.lastIndexOf("\nCALL_MATCH:");
      if (markerIdx !== -1) {
        const jsonStr = reply.slice(markerIdx + "\nCALL_MATCH:".length).trim();
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.call_id && parsed.name && parsed.date) {
            callSuggestion = parsed;
            reply = reply.slice(0, markerIdx).trim();
          }
        } catch { /* malformed marker — keep full reply, no suggestion */ }
      }
    }

    // ── Detect DIVE_NOW marker (global mode, Step 3) ──────────────────────────
    // Claude appends DIVE_NOW after the user accepts the deep dive.
    // We strip it, fetch the full transcript, and return diveReady to the client.
    let diveReady: { openerReply: string; callData: CallRow } | null = null;

    if (mode === "global" && /\n?DIVE_NOW[.!]?\s*$/i.test(reply)) {
      // Strip the marker from the visible reply
      reply = reply.replace(/\n?DIVE_NOW[.!]?\s*$/i, "").trim();

      if (!validPendingCallId) {
        // Claude said DIVE_NOW but client didn't send a valid pendingCallId
        console.warn("[ai/chat] DIVE_NOW fired but no valid pendingCallId — soft error");
        reply = "Having trouble loading that call right now — just say 'try again' and we'll get it.";
      } else {
        const callData = await fetchCallWithRetry(supabase, validPendingCallId, user.id);

        if (!callData) {
          // All retries failed — tell user to retry; client keeps pendingCallSuggestion
          reply = "Having trouble loading that transcript right now — just say 'try again' and I'll give it another shot.";
        } else if (!callData.call_transcript?.length) {
          reply = "That call doesn't have a transcript available yet.";
        } else {
          const date = new Date(callData.call_date).toLocaleDateString("en-US", {
            month: "short", day: "numeric",
          });
          const openerReply = `Read it. Your call with ${callData.prospect_name ?? "that prospect"} on ${date} — ${callData.duration ?? "unknown duration"}, ${callData.outcome ?? "no outcome logged"}. What do you want to look at?`;
          diveReady = { openerReply, callData };
        }
      }
    }

    // ── Increment daily counter ────────────────────────────────────────────────
    await supabase
      .from("profiles")
      .update({ chat_messages_today: usedToday + 1, chat_reset_date: today })
      .eq("id", user.id);

    return NextResponse.json({
      reply,
      ...(callSuggestion ? { callSuggestion } : {}),
      ...(diveReady      ? { diveReady }      : {}),
    });

  } catch (err) {
    console.error("[ai/chat] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
