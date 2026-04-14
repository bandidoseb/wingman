/**
 * knowledge-signal.ts — Signal card compression via Claude Haiku
 *
 * generateSignalCard(knowledgeResults, transcriptChunk, scorecardSnapshot, currentStage):
 *   Takes the best-matching KB technique and compresses it into a two-tier signal
 *   card: ≤5-word actionable headline + optional support sentence.
 *   Returns structured JSON { headline, subtext, source }.
 *
 * Model: Claude Haiku (claude-haiku-4-5-20251001)
 * Target: under 500ms
 * Token budget: ~300 (KB techniques) + ~150 (trigger chunk) + ~300 (system prompt) + ~100 (scorecard snapshot) = ~850 tokens in
 *               ~150 tokens out = well under 1,300 total ✓
 */

// Stage descriptions and format rules — keyed to the exact CallStageLabel values used in code
// ("Rapport" | "Discovery" | "Press" | "Confirm" | "Pitch" | "Close")
const STAGE_DESCRIPTIONS: Record<string, string> = {
  "Rapport":    "Building connection and trust. Establish peer frame, not salesperson frame. Almost no signals fire here.",
  "Discovery":  "Excavating pain. Dig into the real problem, implications, and emotional cost. Go deep — don't rush to pitch.",
  "Press":      "Making the cost of inaction feel real. Most skipped stage. Help the rep quantify the gap between where they are and where they want to be.",
  "Confirm":    "Verifying all key topics before pitching. Gate before the pitch — don't proceed without confirmation.",
  "Pitch":      "Presenting the solution tied directly to their stated pain. Keep it short and specific.",
  "Close":      "Price reveal, close attempt, and objection handling. Go assumptive or direct. Objections = reopen pain.",
};

// ── Signal card system prompt ──────────────────────────────────────────────
const SIGNAL_CARD_SYSTEM_PROMPT = `You are Wingman — a real-time AI sales coach for high-ticket phone closers.
Your job is to surface the single most important thing the rep should do RIGHT NOW.
You speak to the rep, not the prospect. The rep sees your card on screen.

Rules:
- One clear directive. Not a suggestion — an instruction.
- HEADLINE: 5 words maximum. Must be fully actionable on its own. The rep reads this in a single glance while the prospect is talking — it must work alone.
- SUBTEXT: One sentence only. An example question or framing the rep can use. Write this for when the rep has a natural pause before responding.
- Use the prospect's exact words when referencing their pain or hesitation.
- Do NOT tell the rep to "consider" anything. Tell them what to do.
- Do NOT sound like a training manual. Sound like their inner voice.
- When a SCRIPT is provided in the knowledge base technique, base your headline directly on that script — compress it to ≤5 words that capture its core directive. Do NOT invent an alternative approach if a script is provided.
- The "Why it works" field gives you the psychological principle — use it to write a more precise subtext, not to replace the script.

Card format rules by stage:
- Rapport / Confirm / Pitch: headline only (≤4 words). Pure directional nudge. Set subtext to empty string "".
- Discovery / Press / Close: headline (≤5 words, actionable alone) + subtext (one example sentence the rep can say).

Return JSON only — no markdown, no explanation, no preamble:
{
  "headline": "≤5 words. Actionable alone. The thing to do right now.",
  "subtext": "One sentence. Example question or framing. Empty string for Rapport / Confirm / Pitch stages.",
  "source": "The KB technique or principle this is based on."
}`;

// ─────────────────────────────────────────────────────────────────────────────

export interface SignalCardResult {
  headline: string;
  subtext:  string;
  source:   string;
}

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
  scorecardSnapshot?: ScorecardSnapshot,
  currentStage?:     string,
): Promise<SignalCardResult | null> {
  if (!knowledgeResults) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateSignalCard] ANTHROPIC_API_KEY not set");
    return null;
  }

  const t0 = Date.now();

  // Stage context injected into user message so Haiku applies the right card format
  const stageLabel = currentStage ?? "Unknown";
  const stageDesc  = STAGE_DESCRIPTIONS[stageLabel] ?? "Active call stage.";

  // Build a compact call-context block from the scorecard snapshot (~100 tokens max).
  // Only include fields that have actual values — empty fields add noise, not signal.
  const contextLines: string[] = [];
  contextLines.push(`Call stage: ${stageLabel} — ${stageDesc}`);
  if (scorecardSnapshot?.pain_detail)              contextLines.push(`Prospect pain: ${scorecardSnapshot.pain_detail}`);
  if (scorecardSnapshot?.gold_moment)              contextLines.push(`Key moment so far: ${scorecardSnapshot.gold_moment}`);
  if (scorecardSnapshot?.predicted_next_objection) contextLines.push(`Expected objection: ${scorecardSnapshot.predicted_next_objection}`);
  if (scorecardSnapshot?.objection_risk)           contextLines.push(`Objection risk: ${scorecardSnapshot.objection_risk}`);
  if (scorecardSnapshot?.prospect_anchors)         contextLines.push(`What this prospect has revealed:\n${scorecardSnapshot.prospect_anchors}`);

  const callContextBlock = `\nLIVE CALL CONTEXT:\n${contextLines.join("\n")}`;

  // Use the best-matching technique only (first entry) + last ~500 chars of the chunk
  // This keeps total input well under the 1,300 token budget
  const userMessage =
    `KNOWLEDGE BASE TECHNIQUE:\n${knowledgeResults}\n\n` +
    `WHAT THE PROSPECT JUST SAID:\n${transcriptChunk.slice(-500)}` +
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
        max_tokens: 150,
        system:     SIGNAL_CARD_SYSTEM_PROMPT,
        messages:   [{ role: "user", content: userMessage }],
      }),
    });

    if (!resp.ok) {
      console.error("[generateSignalCard] Haiku error:", await resp.text());
      return null;
    }

    const data = await resp.json() as { content: [{ text: string }] };
    const raw  = data.content?.[0]?.text?.trim() ?? "";

    if (!raw) return null;

    // Strip markdown code fences if Haiku wraps the response (e.g. ```json ... ```)
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    // Parse JSON response — Haiku is instructed to return JSON only
    let parsed: SignalCardResult;
    try {
      parsed = JSON.parse(cleaned) as SignalCardResult;
    } catch {
      console.error("[generateSignalCard] Failed to parse JSON response:", raw);
      return null;
    }

    if (!parsed.headline) {
      console.error("[generateSignalCard] Missing headline in response:", raw);
      return null;
    }

    const ms = Date.now() - t0;
    if (ms > 500) {
      console.warn(`[generateSignalCard] ⚠️  ${ms}ms — exceeds 500ms target`);
    } else {
      console.log(`[generateSignalCard] ${ms}ms ✓`);
    }

    return {
      headline: parsed.headline,
      subtext:  parsed.subtext  ?? "",
      source:   parsed.source   ?? "",
    };
  } catch (err) {
    console.error("[generateSignalCard] Error:", err);
    return null;
  }
}
