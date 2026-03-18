import { NextRequest, NextResponse } from "next/server";

// Strip HTML tags and collapse whitespace to get readable page text
function extractText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000); // cap at ~2k tokens worth of text
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Fetch the page
    let html: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Wingman/1.0)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown fetch error";
      return NextResponse.json({ error: `Could not fetch page: ${msg}` }, { status: 422 });
    }

    const pageText = extractText(html);

    // Ask Claude Haiku to extract the key selling intel
    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `You are extracting sales intelligence from an offer page. Read the page text below and extract the following fields. Return ONLY a valid JSON object — no markdown, no explanation.

Fields to extract:
- ideal_client: Who is this offer for? (1-2 sentences describing the target person — their situation, struggle, or identity)
- unique_differentiator: What makes this offer different or better? (1 sentence — their mechanism, edge, or unique promise)
- guarantee: What guarantee or risk-reversal do they offer? (1 sentence, or null if none found)
- offer_name: The name of the main product/program/service
- offer_price: The price if visible (e.g. "$5,000" or "$997/month"), or null if not found

Page text:
${pageText}

Return only JSON like:
{"ideal_client":"...","unique_differentiator":"...","guarantee":"...","offer_name":"...","offer_price":"..."}`,
          },
        ],
      }),
    });

    const aiJson = await aiRes.json();
    const raw: string = aiJson.content?.[0]?.text?.trim() ?? "";

    // Parse JSON safely
    let extracted: Record<string, string | null> = {};
    try {
      extracted = JSON.parse(raw);
    } catch {
      // Try to find JSON in the response if Claude added extra text
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) extracted = JSON.parse(match[0]);
      else return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    return NextResponse.json({
      ideal_client: extracted.ideal_client ?? null,
      unique_differentiator: extracted.unique_differentiator ?? null,
      guarantee: extracted.guarantee ?? null,
      offer_name: extracted.offer_name ?? null,
      offer_price: extracted.offer_price ?? null,
    });
  } catch (err: unknown) {
    console.error("[crawl-offer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
