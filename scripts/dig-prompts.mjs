/**
 * dig-prompts.mjs — the dig prompt under test + the user-message builder for the eval.
 *
 * Imports the PRODUCTION prompt from the single source of truth so the gate grades EXACTLY
 * what ships. No live code imports this file — it's an offline test artifact.
 */

import { DIG_SYSTEM_PROMPT, buildDigUserSegments } from "../src/lib/wingman/dig-prompt.mjs";

export const PROD_DIG_PROMPT = DIG_SYSTEM_PROMPT;

// Sanity: the production prompt must carry the no-fabrication fence + the take-the-close gate.
if (!PROD_DIG_PROMPT.includes("NEVER MAKE ANYTHING UP")) {
  throw new Error("[dig-prompts] production prompt is missing the no-fabrication fence");
}
if (!PROD_DIG_PROMPT.includes("take the close")) {
  throw new Error("[dig-prompts] production prompt is missing the take-the-close gate");
}

// Flatten the shared segments into the single user string the eval sends (production maps the
// same segments → content blocks). liveSummary = the fixture's belief ladder (null for early call).
// salesDna (Phase 1b) = the fixture's rep Sales DNA blob (undefined → generic, byte-identical
// to pre-1b — the generic fixtures are the no-regression guard).
export function buildDigUserMessage(scenario) {
  return buildDigUserSegments({
    salesDna: scenario.salesDna ?? undefined,
    liveSummary: scenario.context ?? undefined,
    latestResponse: scenario.transcript,
  })
    .map((s) => s.text)
    .join("");
}
