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
            content: `You are Wingman helping a sales rep set up. They pasted their own offer page. Read it and write a SHORT overview of the key info you can find — a memory-jogger the rep will glance at while describing their offer in their own words. This is reference only; it is NOT the source of truth.

Cover, in a few tight bullet points, only what's actually on the page:
- What they sell + who it's for
- The core promise / transformation
- Price, if shown
- Any guarantee or notable claim

Rules: Only include what's genuinely on the page — NEVER invent or infer. If the page is thin on real info, say so plainly. Keep it under ~120 words. Plain text bullets, no headers, no preamble.

Page text:
${pageText}`,
          },
        ],
      }),
    });

    const aiJson = await aiRes.json();
    const overview: string = aiJson.content?.[0]?.text?.trim() ?? "";

    if (!overview) {
      return NextResponse.json({ error: "Couldn't read anything useful on that page" }, { status: 502 });
    }

    // Reference-only summary for the rep to react to — NEVER used as live-card
    // context (that stays 100% the rep's own words). Not persisted server-side.
    return NextResponse.json({ overview });
  } catch (err: unknown) {
    console.error("[crawl-offer]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
