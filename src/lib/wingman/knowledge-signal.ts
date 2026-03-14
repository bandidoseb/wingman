/**
 * knowledge-signal.ts — Signal card compression via Claude Haiku
 *
 * generateSignalCard(knowledgeResults, transcriptChunk):
 *   Takes the best-matching KB technique and compresses it into a
 *   first-person, 12-word-max signal card the rep can read in under 2 seconds.
 *
 * Model: Claude Haiku (claude-haiku-4-5-20251001)
 * Target: under 500ms
 * Token budget: ~300 (KB techniques) + ~150 (trigger chunk) + ~300 (system prompt) + ~100 (scorecard snapshot) = ~850 tokens in
 *               ~80 tokens out = well under 1,300 total ✓
 */

// ── Signal card system prompt (exact — do not modify) ──────────────────────
const SIGNAL_CARD_SYSTEM_PROMPT = `You are a real-time sales coach. A rep is on a live call right now and needs instant guidance. You have been given a detailed sales technique from a knowledge base.

Convert it into a signal card using this exact format: [MOMENT TYPE in caps] — "[what the rep says, written in first person, natural spoken language, max 12 words]"

Rules:
* Write it as words coming out of the rep's mouth, not instructions about what to say
* First person only — 'I totally get that' not 'acknowledge their concern'
* Maximum 12 words in the script line
* No jargon, no sales terminology, no explanations
* Natural spoken language only — how a confident closer actually talks
* If a silent pause or micro-action helps, add it in brackets after — max 5 words. Example: [then go silent]
* The rep must be able to read this entire card in under 2 seconds and know exactly what to do
* Output the signal card only — no explanation, no preamble`;

// ─────────────────────────────────────────────────────────────────────────────

interface ScorecardSnapshot {
  pain_detail?:               string;
  gold_moment?:               string;
  predicted_next_objection?:  string;
  objection_risk?:            string;
  prospect_anchors?:          string;
}

export async function generateSignalCard(
  knowledgeResults:  string,
  transcriptChunk:   string,
  scorecardSnapshot?: ScorecardSnapshot
): Promise<string | null> {
  if (!knowledgeResults) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateSignalCard] ANTHROPIC_API_KEY not set");
    return null;
  }

  const t0 = Date.now();

  // Build a compact call-context block from the scorecard snapshot (~100 tokens max).
  // Only include fields that have actual values — empty fields add noise, not signal.
  const contextLines: string[] = [];
  if (scorecardSnapshot?.pain_detail)              contextLines.push(`Prospect pain: ${scorecardSnapshot.pain_detail}`);
  if (scorecardSnapshot?.gold_moment)              contextLines.push(`Key moment so far: ${scorecardSnapshot.gold_moment}`);
  if (scorecardSnapshot?.predicted_next_objection) contextLines.push(`Expected objection: ${scorecardSnapshot.predicted_next_objection}`);
  if (scorecardSnapshot?.objection_risk)           contextLines.push(`Objection risk: ${scorecardSnapshot.objection_risk}`);
  if (scorecardSnapshot?.prospect_anchors)         contextLines.push(`What this prospect has revealed:\n${scorecardSnapshot.prospect_anchors}`);

  const callContextBlock = contextLines.length > 0
    ? `\nLIVE CALL CONTEXT (use this to make the card specific to this prospect):\n${contextLines.join("\n")}`
    : "";

  // Use the best-matching technique only (first entry) + last ~500 chars of the chunk
  // This keeps total input well under the 1,300 token budget
  const userMessage =
    `KNOWLEDGE BASE TECHNIQUE:\n${knowledgeResults}\n\n` +
    `CALL CONTEXT (what just happened):\n${transcriptChunk.slice(-500)}` +
    callContextBlock;

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:  "POST",
      headers: {
        "x-api-key":         apiKey,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 80,
        system:     SIGNAL_CARD_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      console.error("[generateSignalCard] Haiku error:", await resp.text());
      return null;
    }

    const data = await resp.json() as { content: [{ text: string }] };
    const card = data.content?.[0]?.text?.trim() ?? null;

    const ms = Date.now() - t0;
    if (ms > 500) {
      console.warn(`[generateSignalCard] ⚠️  ${ms}ms — exceeds 500ms target`);
    } else {
      console.log(`[generateSignalCard] ${ms}ms ✓`);
    }

    return card;
  } catch (err) {
    console.error("[generateSignalCard] Error:", err);
    return null;
  }
}
