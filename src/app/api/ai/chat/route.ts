import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Enforce active subscription before calling Claude
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    // Allow active subscribers and free-tier users; only block explicitly canceled/past_due.
    // null status = new user who hasn't subscribed yet → allow through.
    const status = profile?.subscription_status ?? "trialing";
    if (status === "canceled" || status === "past_due") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }

    const { messages, context } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    // Cap messages to prevent oversized payloads
    if (messages.length > 50) {
      return NextResponse.json({ error: "Too many messages" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured" }, { status: 503 });
    }

    // Build system prompt
    const systemPrompt = context
      ? `You are Wingman, an elite sales coaching AI for high-ticket closers and setters. You are analyzing call data and providing actionable coaching feedback. Be direct, specific, and tactical. Reference actual call details when possible. Keep responses concise — 2-4 sentences unless a detailed breakdown is requested.

Context about this rep and their calls:
${context}`
      : `You are Wingman, an elite sales coaching AI for high-ticket closers and setters. Give direct, tactical coaching advice. Be specific, not generic. Keep responses to 2-4 sentences unless a detailed breakdown is requested.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 500,
        system: systemPrompt,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", errText);
      return NextResponse.json({ error: "AI service error" }, { status: 502 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("AI chat error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
