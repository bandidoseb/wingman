/**
 * query-distill.ts — Phase 3.5 query distillation for the ↑ objection slot.
 *
 * Before searching the KB, a small fast Groq model reads the last ~120s of
 * transcript and extracts ONE short, plainly-stated objection phrase. That
 * phrase — not the raw buffer — is embedded and searched against the short
 * first-person triggers in kb_prospect_triggers (query↔KB shape symmetry).
 *
 * It doubles as a quality gate: {found:false} means "no real objection in the
 * window" → the route shows an honest nudge instead of guessing.
 *
 * The distilled phrase is a SEARCH QUERY only. The card itself is still
 * written from the full 120s buffer + Belief Ladder summary, so the
 * prospect's exact words are never lost.
 *
 * Model: Groq llama-3.1-8b-instant (locked 2026-06-07; ~250–550ms measured).
 * Prompt: locked 2026-06-11 via scripts/test-distill.mjs — 5/5 extraction gate
 * incl. the no-objection reverse trap and the hidden-objection judgment test.
 * Tuning dials (window, model, timeout): Wingman Brain/Beta Tuning Parameters.md.
 * ONE SOURCE OF TRUTH: keep DISTILL_SYSTEM_PROMPT identical to the harness.
 */

const DISTILL_TIMEOUT_MS = 1_500; // hard cap — on timeout the route degrades to the raw path

export const DISTILL_SYSTEM_PROMPT = `You extract the prospect's CURRENT objection from the last ~2 minutes of a live sales call.

An objection is ANY pushback, hesitation, concern, doubt, stall, or deflection from the PROSPECT — about price, value, timing, trust, a partner/spouse who must approve, fear of failing, "send me info," "let me think about it," "let me check with X," etc. Err toward extraction: a soft stall counts.

Rules:
- Output the objection still STANDING at the end of the window. A concern the prospect already moved past (accepted the reframe, agreed, resolved it themselves) is DEAD — never extract it.
- If several concerns are still standing, pick the DEEPEST one (fear/self-doubt, approval, money, trust) — but a request for materials, case studies, logistics or scheduling is NEVER the objection when a real concern is standing.
- If the prospect hides behind surface questions (logistics, refund policy) but then voices the real concern underneath, extract the REAL concern — not the surface question.
- Write it in FIRST PERSON, stated PLAINLY — the way a prospect would say it head-on (like: "I need to talk to my husband first" / "this is too expensive" / "I'm not ready to commit"). Keep the prospect's own distinctive words only when the emotion itself is the objection (scared, burned, overwhelmed). HARD LIMIT: 15 words.
- If the concern is a spouse/partner/boss who must approve, ALWAYS phrase it exactly as: "I need to talk to my <person> first" — drop everything else.
- Only use what was ACTUALLY SAID. Never invent or embellish.
- The REP raising a topic is not an objection. Only the prospect's own resistance counts.
- If the prospect shows genuine commitment with no live hesitation (clear yes, money ready, no stall), there is NO objection.

Examples:
Prospect said: "Honestly the price scared me at first, but the ROI makes sense now. Could you email me the syllabus? I'd also need to run it by my wife — we handle money together."
→ {"objection": "I need to run it by my wife before deciding"}   (price concern was resolved; syllabus is materials; the wife gate is what's standing)
Prospect said: "What stack do you use? Is support included? ...Truthfully I got burned by an agency last year, so I'm cautious about trusting another one."
→ {"objection": "I got burned before and I'm scared to trust another agency"}   (the logistics questions were cover; the trust fear is the real concern)

Respond with JSON only, no other text:
{"objection": "<the phrase, max 15 words>"}  or  {"objection": null}`;

export type DistillResult =
  | { found: true; phrase: string }   // a real objection is standing — search the KB with it
  | { found: false }                  // quality gate: no objection in the window → nudge
  | null;                             // Groq error/timeout → route degrades to the raw path

/**
 * Parse the raw Groq completion text into a DistillResult.
 * Exported separately so unit tests cover it without network.
 * Returns null on anything malformed — the route treats null as "degrade to raw".
 */
export function parseDistillResponse(raw: string): DistillResult {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || !("objection" in parsed)) {
    return null;
  }

  const objection = (parsed as { objection: unknown }).objection;

  if (objection === null) return { found: false };

  if (typeof objection === "string" && objection.trim().length > 0) {
    // Defensive cap — the prompt says 15 words, but never trust a model with
    // the embedding budget. 160 chars ≈ a 25–30 word ceiling.
    return { found: true, phrase: objection.trim().slice(0, 160) };
  }

  return null;
}

export async function distillObjection(transcriptChunk: string): Promise<DistillResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Not configured — behave exactly like a Groq outage: degrade to raw path.
    console.error("[distillObjection] GROQ_API_KEY not set — degrading to raw search");
    return null;
  }

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), DISTILL_TIMEOUT_MS);

  try {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:  "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        model:           "llama-3.1-8b-instant",
        temperature:     0,
        max_tokens:      100,                          // headroom — truncated JSON = parse failure
        response_format: { type: "json_object" },      // Groq guaranteed-JSON mode
        messages: [
          { role: "system", content: DISTILL_SYSTEM_PROMPT },
          { role: "user",   content: `LAST ~2 MINUTES OF THE CALL:\n${transcriptChunk}` },
        ],
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      console.error("[distillObjection] Groq error:", resp.status, await resp.text());
      return null;
    }

    const data = await resp.json() as { choices?: [{ message?: { content?: string } }] };
    const raw  = data.choices?.[0]?.message?.content ?? "";
    const result = parseDistillResponse(raw);
    if (result === null) {
      console.error("[distillObjection] Unparseable response:", raw.slice(0, 200));
    }
    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn(`[distillObjection] Timed out after ${DISTILL_TIMEOUT_MS}ms — degrading to raw search`);
    } else {
      console.error("[distillObjection] Error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
