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

Card format — ALWAYS two-tier (the rep summoned this card on purpose and needs the line):
- HEADLINE: ≤5 words, fully actionable on its own.
- SUBTEXT: one sentence the rep can say out loud. Never leave it empty.

Return JSON only — no markdown, no explanation, no preamble:
{
  "headline": "≤5 words. Actionable alone. The thing to do right now.",
  "subtext": "One sentence the rep can say out loud. Always provide it.",
  "source": "The KB technique or principle this is based on."
}`;

// ─────────────────────────────────────────────────────────────────────────────

export interface SignalCardResult {
  headline: string;
  subtext:  string;
  source:   string;
}

// ── Slot directive text — tells Haiku what the rep is asking for ──────────────
// Used by both generateSignalCard (with KB context) and generateFallbackCard (without).
const SLOT_DIRECTIVES: Record<string, string> = {
  objection: "The rep needs to handle an objection or resistance. Surface a NEPQ reframe that reopens the pain — not a rebuttal.",
  answer:    "The rep needs to answer the prospect's direct question. Give a clear, confident framework using their stated context.",
  dig:       "The rep needs to dig deeper into pain or situation. Give a discovery question that uncovers more.",
  close:     "The rep is ready to move toward the close. Give an assumptive close or a next-step question in the prospect's own words.",
};

export async function generateSignalCard(
  knowledgeResults:  string,
  transcriptChunk:   string,
  liveSummary?:      string,   // Full Belief Ladder text from Phase 2 — replaces the 5-field snapshot
  currentStage?:     string,
): Promise<SignalCardResult | null> {
  if (!knowledgeResults) return null;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateSignalCard] ANTHROPIC_API_KEY not set");
    return null;
  }

  const t0 = Date.now();

  // Stage context — OPTIONAL. Post-Phase-1 there is no live stage tracker, so the
  // Belief Ladder (liveSummary) is the source of truth for where the call is. Only
  // print a stage line if a REAL stage was passed — never feed Haiku a stale label.
  const stageLine = currentStage ? `Call stage: ${currentStage}\n` : "";
  const stageDesc = currentStage ? (STAGE_DESCRIPTIONS[currentStage] ?? "") : "";

  // Prefer the full Belief Ladder (rich — Weakest Link, verbatim quotes, all 7 beliefs).
  // Fall back to a light line when Phase 2 hasn't produced a summary yet (first ~2 min).
  const callContextBlock = liveSummary
    ? `\n${stageLine}\nLIVE CALL CONTEXT (Belief Ladder — Weakest Link, verbatim quotes, 7 beliefs):\n${liveSummary}`
    : `\n${stageLine}${stageDesc ? stageDesc + "\n" : ""}Active sales call.`;

  // Full 120 s transcript — no slicing. The rolling buffer is already capped at
  // ~2,400 chars upstream. See Wingman Brain/Beta Tuning Parameters.md.
  const userMessage =
    `KNOWLEDGE BASE TECHNIQUE:\n${knowledgeResults}\n\n` +
    `WHAT THE PROSPECT JUST SAID (last ~120 s):\n${transcriptChunk}` +
    callContextBlock;

  // 10 s timeout — if Haiku stalls, isGeneratingRef must not be stuck true
  // for the rest of the call leaving the rep with a dead compass.
  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

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
      signal: controller.signal,
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
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[generateSignalCard] Timed out after 10s");
    } else {
      console.error("[generateSignalCard] Error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * generateFallbackCard — fires when KB search returns no match (similarity < threshold).
 *
 * The rep pressed a hotkey — they always get a card back.
 * Uses the same Haiku model + system prompt as generateSignalCard, but without
 * KB techniques. Instead, the slot directive + Belief Ladder guide the output.
 *
 * Latency target: same <1 s (same model, same token budget).
 */
export async function generateFallbackCard(
  slot:           string,
  transcriptChunk: string,
  liveSummary?:   string,
  currentStage?:  string,
): Promise<SignalCardResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("[generateFallbackCard] ANTHROPIC_API_KEY not set");
    return null;
  }

  const t0 = Date.now();

  const slotDirective = SLOT_DIRECTIVES[slot] ?? SLOT_DIRECTIVES["objection"];
  // Stage is OPTIONAL — never feed Haiku a stale label (see generateSignalCard).
  const stageLine = currentStage ? `Call stage: ${currentStage}\n` : "";
  const stageDesc = currentStage ? (STAGE_DESCRIPTIONS[currentStage] ?? "") : "";

  const callContextBlock = liveSummary
    ? `\n${stageLine}\nLIVE CALL CONTEXT (Belief Ladder — Weakest Link, verbatim quotes, 7 beliefs):\n${liveSummary}`
    : `\n${stageLine}${stageDesc ? stageDesc + "\n" : ""}Active sales call.`;

  // No KB technique — use the slot directive as the framing instead
  const userMessage =
    `SITUATION:\n${slotDirective}\n\n` +
    `WHAT THE PROSPECT JUST SAID (last ~120 s):\n${transcriptChunk}` +
    callContextBlock;

  const controller = new AbortController();
  const timeoutId  = setTimeout(() => controller.abort(), 10_000);

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
      signal: controller.signal,
    });

    if (!resp.ok) {
      console.error("[generateFallbackCard] Haiku error:", await resp.text());
      return null;
    }

    const data    = await resp.json() as { content: [{ text: string }] };
    const raw     = data.content?.[0]?.text?.trim() ?? "";
    if (!raw) return null;

    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();

    let parsed: SignalCardResult;
    try {
      parsed = JSON.parse(cleaned) as SignalCardResult;
    } catch {
      console.error("[generateFallbackCard] Failed to parse JSON:", raw);
      return null;
    }

    if (!parsed.headline) return null;

    const ms = Date.now() - t0;
    console.log(`[generateFallbackCard] ${ms}ms ✓ (no KB match — fallback)`);

    return {
      headline: parsed.headline,
      subtext:  parsed.subtext ?? "",
      source:   "fallback",
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[generateFallbackCard] Timed out after 10s");
    } else {
      console.error("[generateFallbackCard] Error:", err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
