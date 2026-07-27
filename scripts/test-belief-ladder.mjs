/**
 * scripts/test-belief-ladder.mjs — REAL pass/fail gate for the Belief Ladder summarizer.
 *
 * Two modes:
 *   node scripts/test-belief-ladder.mjs            # GATE: run fixtures, assert, exit 0/1
 *   node scripts/test-belief-ladder.mjs --explore [file.txt] [--haiku-only] [--verbose]
 *                                                  # human read: roll a transcript, print scorecards
 *
 * WHY THE REWRITE (plan-review C4, 2026-06-28): the old harness had (a) a DUPLICATE copy
 * of the system prompt that drifted from the lib, so it tested a stale prompt, and (b) NO
 * assertions — it printed a checklist for a human to eyeball. So "re-run the harness" proved
 * nothing. Now:
 *   - The prompt + model + token cap are read from src/lib/wingman/belief-ladder.ts at runtime
 *     (single source of truth — no copy to drift).
 *   - The gate asserts the confidence-number rule: a number said ONCE (unconfirmed) must NOT
 *     appear as digits; a CONFIRMED (stated + echoed) number MUST appear. Exit 1 on any miss.
 *
 * 2026-07-11 (Phase 1b, Offer-Aware Wingman): this gate is now the SHIP GATE for the moat —
 * Sebastian's hard stop: not green → does not ship. Extended with:
 *   - The confidence-number rule landed in belief-ladder.ts (the old "RED on purpose" note
 *     is history — the gate must now be GREEN).
 *   - SALES DNA fixtures: the DNA system block is built by the SAME
 *     buildSummarizerDnaSystemBlock (sales-dna.mjs) production ships — the fabrication traps
 *     grade the exact bytes that run live.
 *   - An LLM-judge layer (Claude + gpt-4o, BOTH mandatory) auditing the two DNA failure
 *     modes: fabricated specifics (DNA facts presented as the prospect's) and belief
 *     inflation (✅/🟡 without transcript evidence). Zero tolerance on both.
 *
 * 2026-07-20 (Cole-brain redesign — plan: tasks/plan-summarizer-tuning.md): extended with
 *   - STRUCTURAL INVARIANTS on every fixture (and every tick of rolling fixtures):
 *     WEAKEST LINK present, no non-belief line starting with digit 1–7 (close-readiness
 *     parser safety), section caps (anchors ≤8, commitments ≤3), "at-risk" relabel.
 *   - New traps: polite-yes vs emotional-yes ✅ bar, regression downgrade, commitment
 *     capture + no-invention, money-as-resources, momentum default-neutral, the DNA
 *     anchor-shape trap, and the 8-tick ROLLING fixture (anchor survival across a call —
 *     the update-in-place behavior nothing previously verified).
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSummarizerDnaSystemBlock } from "../src/lib/wingman/sales-dna.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Load .env.local for API keys ────────────────────────────────────────────────
const envFile = path.join(__dirname, "../.env.local");
if (fs.existsSync(envFile)) {
  const raw = fs.readFileSync(envFile, "utf-8").replace(/^﻿/, "");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (k && !process.env[k]) process.env[k] = v;
  }
}
const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) { console.error("❌ ANTHROPIC_API_KEY not found in .env.local"); process.exit(1); }
// The GPT cross-judge is MANDATORY for the DNA fabrication gate (Sebastian, 2026-07-11:
// "use a Claude model and a GPT model so we get input from both"). No key → the gate
// cannot fully run → fail loud rather than pass on half a jury.
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// ─── SINGLE SOURCE OF TRUTH: read the prompt/model/cap from the production lib ───
// No duplicate copy. If the export shape changes, fail loud rather than test a stale string.
const libText = fs.readFileSync(path.join(__dirname, "../src/lib/wingman/belief-ladder.ts"), "utf-8");
const promptMatch = libText.match(/BELIEF_LADDER_SYSTEM_PROMPT\s*=\s*`([\s\S]*?)`;/);
const modelMatch  = libText.match(/BELIEF_LADDER_MODEL\s*=\s*"([^"]+)"/);
const maxTokMatch = libText.match(/BELIEF_LADDER_MAX_TOKENS\s*=\s*(\d+)/);
if (!promptMatch || !modelMatch || !maxTokMatch) {
  console.error("❌ Could not extract BELIEF_LADDER_{SYSTEM_PROMPT,MODEL,MAX_TOKENS} from belief-ladder.ts");
  process.exit(1);
}
const SYSTEM_PROMPT = promptMatch[1];
const PROD_MODEL    = modelMatch[1];
const MAX_TOKENS    = Number(maxTokMatch[1]);

const HAIKU = "claude-haiku-4-5-20251001";
const JUDGE_CLAUDE = "claude-sonnet-4-6";
const JUDGE_GPT    = "gpt-4o";

// ─── One summarizer call ─────────────────────────────────────────────────────────
// dnaBlock (Phase 1b): the production DNA system block. Production sends it as a second
// system text block; the eval flattens system blocks into one string — same discipline
// as the dig eval flattening user segments. null → plain pre-1b system.
async function callModel(model, currentSummary, newChunk, dnaBlock = null) {
  const userMessage =
    `CURRENT SCORECARD:\n${currentSummary || "(empty — this is the start of the call)"}\n\n` +
    `NEW TRANSCRIPT (only what was said since the last update):\n${newChunk}`;
  const system = dnaBlock ? `${SYSTEM_PROMPT}\n\n${dnaBlock}` : SYSTEM_PROMPT;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: MAX_TOKENS, system, messages: [{ role: "user", content: newChunk ? userMessage : "" }] }),
  });
  if (!resp.ok) throw new Error(`${model} API error ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  return (data.content?.[0]?.text ?? "").trim();
}

// ════════════════════════════════════════════════════════════════════════════════
// STRUCTURAL INVARIANTS (2026-07-20 Cole-brain redesign) — asserted on EVERY
// fixture output (and on EVERY tick of rolling fixtures). These are the format
// properties downstream parsers depend on; a violation is a hard gate failure.
// ════════════════════════════════════════════════════════════════════════════════
const BELIEF_ROW_RE = [null, /pain/i, /doubt|diy/i, /cost/i, /desire/i, /money/i, /support|decid/i, /trust/i];

function structuralFailures(out) {
  const fails = [];
  // WEAKEST LINK is the dig card's routing input and the original truncation victim
  // (the 600→1200 cap raise existed because it was being chopped). HARD assert.
  if (!/▸ WEAKEST LINK →\s*\S/.test(out)) {
    fails.push("WEAKEST LINK line missing or empty — truncation or format drift (the dig card's routing input)");
  }
  // close-readiness.mjs parses any line starting with digit 1–7 as a belief row.
  // An anchor/commitment line starting with a digit would be misparsed as a grade.
  for (const raw of out.split("\n")) {
    const m = /^\s*([1-7])\s+(.*)$/.exec(raw);
    if (m && !BELIEF_ROW_RE[Number(m[1])].test(m[2])) {
      fails.push(`line starts with digit ${m[1]} but is not that belief's row — close-readiness would misparse: "${raw.trim().slice(0, 70)}"`);
    }
  }
  // Per-section hard caps — the thing that keeps the scorecard fixed-size (and the
  // fleet-wide input cost bounded) as the call goes on.
  const section = (name) => out.match(new RegExp(`▸ ${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n▸ |$)`))?.[1] ?? "";
  const bullets = (text) => text.split("\n").filter((l) => /^\s*•/.test(l));
  const anchorCount = bullets(section("KEY ANCHORS")).length;
  const commitCount = bullets(section("COMMITMENTS")).length;
  if (anchorCount > 8) fails.push(`KEY ANCHORS has ${anchorCount} bullets — cap is 8 (unbounded growth)`);
  if (commitCount > 3) fails.push(`COMMITMENTS has ${commitCount} bullets — cap is 3 (unbounded growth)`);
  // The ⚠️ relabel: "at-risk" must be gone from the emitted scorecard.
  if (/at-risk/i.test(out)) fails.push('output still says "at-risk" — the ⚠️ relabel to "objected" did not take');
  // Every template section must be present — a missing header means prompt drift
  // or truncation (wingman-reviewer 2026-07-20: without this, a silently dropped
  // section is only caught when a fixture happens to exercise it).
  for (const name of ["THE GAP", "BELIEF LADDER", "KEY ANCHORS", "COMMITMENTS", "MOMENTUM", "OPEN OBJECTIONS"]) {
    if (!out.includes(`▸ ${name}`)) fails.push(`section header "▸ ${name}" missing — prompt drift or truncation`);
  }
  return fails;
}

// Pull a named section's text for targeted asserts.
function sectionText(out, name) {
  return out.match(new RegExp(`▸ ${name}[^\\n]*\\n([\\s\\S]*?)(?=\\n▸ |$)`))?.[1] ?? "";
}

// A prior-tick scorecard in the CURRENT template, for fixtures that test
// update-in-place behavior (regression/downgrade).
const PRIOR_SCORECARD_PAIN_LOCKED = `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 12m · Syntax: problems-first
▸ THE GAP
  Current "hell":   solo consultant, drowning in delivery
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "I'm drowning, it's brutal every single week"
  2 Doubt (can't DIY)    ⬜ — not discussed
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words — the ammunition a closer would replay later)
  • [Pain] "I'm drowning, it's brutal every single week"
▸ COMMITMENTS (agreements THEY made out loud)
  • none yet
▸ MOMENTUM: neutral — short answers so far
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Doubt, Cost, Desire (⬜ open)`;

// ════════════════════════════════════════════════════════════════════════════════
// GATE FIXTURES — small, purpose-built. Each asserts on the final scorecard text.
// Optional fields: `current` (prior scorecard for update-in-place tests) and
// `chunks` (array → the fixture ROLLS multiple ticks; structural invariants are
// asserted on EVERY tick, named asserts on the final scorecard).
// ════════════════════════════════════════════════════════════════════════════════
const FIXTURES = [
  {
    // SPEC REFINEMENT (2026-07-11, run past Sebastian in the 1b review): the original
    // assert banned the digits ANYWHERE in the scorecard, but "THEIR EXACT WORDS" is
    // verbatim by design — rewriting a prospect's actual words would be its own lie,
    // and a hedged quote kept intact ("maybe like 50k … I guess") is honest tie-down
    // material. The rule the product needs: an unconfirmed number must never be
    // PROMOTED TO A FACT — not $GOAL, not a belief grade, not a recorded figure.
    // Verbatim quote bullets (lines starting with •) are the one legitimate home.
    name: "Unconfirmed goal number is NOT promoted to a fact",
    transcript:
      "Rep: If we fixed this, what would good actually look like for you?\n" +
      "Prospect: I dunno, maybe like 50k a month someday would be nice I guess.\n" +
      "Rep: Got it. What's the biggest thing in the way right now?\n" +
      "Prospect: Everything runs through me — I've got no systems at all.",
    asserts: [
      {
        desc: "50k must NOT appear outside a verbatim quote bullet (no $GOAL, no belief line, no GAP fact)",
        ok: (out) =>
          !/\b50\s*k\b|\$\s*50\b|50,000/i.test(
            out.split("\n").filter((l) => !/^\s*•/.test(l)).join("\n"),
          ),
        whyRed: "a number said once, hedged ('maybe … someday … I guess'), was promoted into the scorecard as a fact — the NUMBER CONFIDENCE rule",
      },
      {
        desc: "$GOAL must stay — (unconfirmed)",
        ok: (out) => {
          const goalLine = out.split("\n").find((l) => /\$GOAL/.test(l)) ?? "";
          return !/\b50\s*k\b|\$\s*50\b|50,000/i.test(goalLine);
        },
        whyRed: "the hedged 50k landed in $GOAL — exactly the promotion the rule forbids",
      },
    ],
  },
  {
    name: "Confirmed (stated + echoed) revenue IS recorded",
    transcript:
      "Rep: Where's the business at right now, revenue-wise?\n" +
      "Prospect: We're doing about 30k a month.\n" +
      "Rep: 30k a month — got it. And how long have you been stuck there?\n" +
      "Prospect: Couple years now, honestly.",
    asserts: [
      {
        desc: "output MUST contain the confirmed figure 30k",
        ok: (out) => /\b30\s*k\b|\$\s*30\b|30,000/i.test(out),
        whyRed: "if this fails, the confidence rule is too aggressive — it's dropping CONFIRMED numbers too",
      },
    ],
  },
  {
    name: "No hallucinated figure the prospect never said",
    transcript:
      "Rep: What's pushing you to solve this now?\n" +
      "Prospect: I'm just tired of being stuck. It's wearing me down.\n" +
      "Rep: Totally hear that. What have you tried already?\n" +
      "Prospect: A few things on my own, nothing really stuck.",
    asserts: [
      {
        desc: "output must contain NO dollar/k figure (none was ever said)",
        ok: (out) => !/\$\s*\d|\b\d+\s*k\b|\d,\d{3}/i.test(out),
        whyRed: "the model invented a number from a number-free conversation",
      },
    ],
  },
  // ── 2026-07-20 Cole-brain traps ─────────────────────────────────────────────
  {
    name: "POLITE-YES TRAP: flat logical concession must not lock Pain",
    transcript:
      "Rep: Sounds like the lead flow problem is really hurting the business, yeah?\n" +
      "Prospect: I mean, yeah, I guess it's not ideal. I should probably get it sorted at some point.\n" +
      "Rep: Okay. And how long has it been like this?\n" +
      "Prospect: A while, I suppose. It is what it is.",
    asserts: [
      {
        desc: "Pain must NOT be ✅ (zero heat — 'I guess', 'at some point', 'it is what it is')",
        ok: (out) => {
          const line = out.split("\n").find((l) => /^\s*1\s+Pain/.test(l)) ?? "";
          return line !== "" && !line.includes("✅");
        },
        whyRed: "a flat logical concession got graded as emotional ownership — the ✅ bar on Pain/Cost/Desire requires conviction, not politeness",
      },
    ],
  },
  {
    name: "EMOTIONAL-YES TRAP: real heat MUST lock (over-conservatism check) + anchor captured",
    transcript:
      "Rep: What's this actually costing you?\n" +
      "Prospect: Honestly? I'm done. I missed my daughter's birthday dinner for a client emergency last month. I can't keep living like this — it's wrecking me.\n" +
      "Rep: That's heavy. So this has to change.\n" +
      "Prospect: It has to. There's no version where I keep doing this another year.",
    asserts: [
      {
        desc: "Pain or Cost must be ✅ (unmistakable emotional ownership, stated twice)",
        ok: (out) => {
          const pain = out.split("\n").find((l) => /^\s*1\s+Pain/.test(l)) ?? "";
          const cost = out.split("\n").find((l) => /^\s*3\s+Cost/.test(l)) ?? "";
          return pain.includes("✅") || cost.includes("✅");
        },
        whyRed: "the emotional bar is over-tuned — unmistakable heat with stakes must still lock, or the ladder goes numb",
      },
      {
        desc: "the daughter's-birthday line must be captured as a KEY ANCHOR (verbatim ammunition)",
        ok: (out) => /daughter/i.test(sectionText(out, "KEY ANCHORS")),
        whyRed: "the single most closable line of the call didn't make the anchors — the ammunition layer is not capturing",
      },
    ],
  },
  {
    name: "REGRESSION TRAP: a walked-back ✅ must downgrade (recent overrides stale)",
    current: PRIOR_SCORECARD_PAIN_LOCKED,
    transcript:
      "Rep: So like you said, the workload's been brutal.\n" +
      "Prospect: Honestly, this week's actually been fine. I might've overstated it before — we're managing okay, it's not like it's killing me.",
    asserts: [
      {
        desc: "Pain must NOT stay ✅ after the prospect walked it back",
        ok: (out) => {
          const line = out.split("\n").find((l) => /^\s*1\s+Pain/.test(l)) ?? "";
          return line !== "" && !line.includes("✅");
        },
        whyRed: "the scorecard kept a stale ✅ the prospect contradicted — RECENT OVERRIDES STALE applies to grades, not just numbers",
      },
    ],
  },
  {
    name: "COMMITMENT CAPTURE: a conditional yes lands in COMMITMENTS with its condition",
    transcript:
      "Rep: What's really holding you back here?\n" +
      "Prospect: Look, if I actually believed this would get me clients, the money wouldn't be the issue.\n" +
      "Rep: Fair. So if we walk through exactly how it does that, you'd move on it?\n" +
      "Prospect: Yeah — if it does what you say it does, I'm in.",
    asserts: [
      {
        desc: "COMMITMENTS must contain a bullet with the conditional yes (not 'none yet')",
        ok: (out) => {
          const c = sectionText(out, "COMMITMENTS");
          return /^\s*•/m.test(c) && !/none yet/i.test(c) && /if/i.test(c);
        },
        whyRed: "a spoken conditional close-contract ('if it does what you say, I'm in') was not filed — the commitments ledger is not capturing",
      },
      {
        desc: "the condition must be NAMED on the commitment line",
        ok: (out) => /condition/i.test(sectionText(out, "COMMITMENTS")),
        whyRed: "a conditional yes without its condition named is unusable at the close",
      },
    ],
  },
  {
    name: "COMMITMENT NO-INVENTION: a rep proposal the prospect deflected must NOT appear",
    transcript:
      "Rep: So can we agree — if I show you the case studies, you'll sign up today?\n" +
      "Prospect: Uh, I mean, let's see how the rest of this goes.\n" +
      "Rep: Sure, sure. Fair enough.\n" +
      "Prospect: What time is it? I've got another call at the top of the hour.",
    asserts: [
      {
        desc: "COMMITMENTS must not contain the rep's 'sign up today' proposal as an agreement",
        ok: (out) => !/sign up/i.test(sectionText(out, "COMMITMENTS")),
        whyRed: "the rep PROPOSING is not the prospect AGREEING — a deflection got filed as a commitment",
      },
    ],
  },
  {
    name: "MONEY = RESOURCES: stated capacity lands on belief 5, not just a price reaction",
    transcript:
      "Rep: Can I ask — if this made sense, is investing in it even on the table right now?\n" +
      "Prospect: We've got about 15k set aside. My wife and I agreed we'd use it for the right thing, so yeah — it's there if this is it.\n" +
      "Rep: Got it — 15k earmarked, and you two decide together.\n" +
      "Prospect: Exactly.",
    asserts: [
      {
        desc: "the Money row must record the capacity (15k / set aside), not stay ⬜",
        ok: (out) => {
          const line = out.split("\n").find((l) => /^\s*5\s+Money/.test(l)) ?? "";
          return /15\s*k|15,000|set aside|saved|earmark/i.test(line);
        },
        whyRed: "discovery learned real investment capacity and the Money belief didn't record it — Money is RESOURCES, not a price flinch",
      },
    ],
  },
  {
    name: "MOMENTUM DEFAULT: sparse flat transcript must read neutral, never invented leaning-in",
    transcript:
      "Rep: How's the week going?\n" +
      "Prospect: Fine. Busy.\n" +
      "Rep: Cool — well, let me share how this usually works.\n" +
      "Prospect: Sure.",
    asserts: [
      {
        desc: "MOMENTUM must not claim 'leaning in' on two one-word answers",
        ok: (out) => {
          const line = out.split("\n").find((l) => /▸ MOMENTUM/.test(l)) ?? "";
          return line !== "" && !/leaning/i.test(line);
        },
        whyRed: "enthusiasm was read into a flat transcript — a hallucinated momentum read makes every card overconfident",
      },
    ],
  },
  {
    name: "ROLLING CALL (8 ticks): early anchors survive, sharper supersedes vaguer, caps hold",
    chunks: [
      "Rep: Marcus, what made you book this call?\nProspect: I've been stuck at 40k a month for three years now.\nRep: Three years at 40k — okay.",
      "Rep: And what would it need to look like instead?\nProspect: Honestly I just want more freedom. Out of the day-to-day.",
      "Rep: What finally made you act on it?\nProspect: Last month I told my wife that if this year ends the same way, I'm shutting the whole thing down and going back to a job. And that would kill me.",
      "Rep: Can you put a number on freedom?\nProspect: I've run the numbers — it's 100k a month. That's where I can hire a GM and actually step out.\nRep: 100k a month, got it.",
      "Rep: How's your calendar looking these days?\nProspect: Packed, mostly delivery calls. Tuesdays and Thursdays are the worst.",
      "Rep: Do you use any project management tools?\nProspect: We're on Notion, some spreadsheets. It's messy but it works.",
      "Rep: And team-wise it's you plus the two contractors?\nProspect: Yeah, two contractors, part-time. One's been with me two years.",
      "Rep: Any vacations planned this year?\nProspect: We talked about Portugal in the fall. Depends how the year goes, honestly.",
    ],
    asserts: [
      {
        desc: "the final-straw anchor from tick 3 must survive to the final scorecard",
        ok: (out) => /back to a job|shutting .{0,10}down/i.test(out),
        whyRed: "the gold anchor (the wife ultimatum) got churned out by four ticks of logistics chatter — anchor retention is broken",
      },
      {
        desc: "the confirmed current-state 40k from tick 1 must survive",
        ok: (out) => /\b40\s*k\b|40,000/i.test(out),
        whyRed: "a confirmed early number was lost across ticks — update-in-place is dropping, not merging",
      },
      {
        desc: "the sharper 100k goal must have superseded the vague 'freedom' as $GOAL",
        ok: (out) => {
          const goalLine = out.split("\n").find((l) => /\$GOAL/.test(l)) ?? "";
          return /100\s*k|100,000/i.test(goalLine);
        },
        whyRed: "the confirmed, run-the-numbers goal did not land in $GOAL — sharper statements must supersede vaguer ones",
      },
    ],
  },
];

// ════════════════════════════════════════════════════════════════════════════════
// SALES DNA FIXTURES (Phase 1b) — the DNA block is built by the production builder,
// so these grade exactly what ships. Two layers of teeth per fixture:
//   1. String asserts (deterministic, cheap).
//   2. LLM judges (Claude + gpt-4o, both mandatory) auditing fabricated specifics
//      and belief inflation — the failure modes regexes can't fully see.
// ════════════════════════════════════════════════════════════════════════════════

// Complete 12-question DNA blobs (must pass the all-questions inject threshold).
const DNA_AGENCY = {
  transformation: "Agency owners go from founder-led sales to a closing team",
  root_driver: "Getting the founder OUT of the sales seat — typically at $30k/mo and up",
  emotional_root: "Getting their life back from the calendar",
  guarantee: "We don't offer a formal guarantee.",
  syntax: "goals",
  pain: "Founder is the only closer; growth is capped at their calendar — most come in around $25-35k/mo",
  desire: "'Scale to $100k months' is the common phrasing — it comes down to a team that closes without them",
  cost: "Typically $40k+ per quarter in deals they can't take",
  doubt: "Tried hiring one closer before, churned them in 60 days",
  trust: "We recruit, train, AND manage the first closer with them",
  money: "They're already spending $5-10k/mo on ads, so budget exists",
  support: "Usually a co-founder",
};
const DNA_LAND = {
  transformation: "People go from stuck at a W2 to doing land deals full-time",
  root_driver: "A monthly cash-flow number that replaces their job income — typically around $10k/mo",
  emotional_root: "Freedom — being their own boss, owning their time",
  guarantee: "Full refund if you don't close a deal in 120 days",
  syntax: "problems",
  pain: "Grinding at a job they hate, side-hustle going nowhere",
  desire: "'Quit my job', 'be free' — it all comes down to a monthly cash-flow number that replaces the paycheck",
  cost: "Another year at the W2, watching deals go to people who started later",
  doubt: "Bought courses, watched YouTube, never did a deal",
  trust: "We walk the first deal WITH them, not theory",
  money: "I ask if they have money set aside to invest in themselves",
  support: "Often a spouse — I surface it early",
};

const DNA_FIXTURES = [
  {
    name: "DNA FABRICATION TRAP: number-free call + number-heavy DNA → no imported digits",
    salesDna: DNA_AGENCY,
    transcript:
      "Rep: So what made you take the call?\n" +
      "Prospect: I'm the only one selling here. My whole week is sales calls, back to back.\n" +
      "Rep: How long has it been like that?\n" +
      "Prospect: Over a year now. I haven't touched the product side in months.",
    asserts: [
      {
        desc: "no DNA figure ($25-35k, $30k, $100k, $40k, $5-10k) may appear in the scorecard",
        ok: (out) => !/\b(25|30|35|40|100|5|10)\s*k\b|\$\s*(25|30|35|40|100)\b|(25|30|35|40|100),000/i.test(out),
        whyRed: "the summarizer imported a number from the Sales DNA and presented it as this prospect's — the exact fabrication the lens rules forbid",
      },
      {
        desc: "Desire must stay ⬜ open (the prospect never discussed a goal)",
        ok: (out) => /4 Desire[^\n]*⬜/.test(out),
        whyRed: "the summarizer marked Desire from the DNA's average-prospect goal instead of the transcript — belief inflation",
      },
    ],
  },
  {
    name: "DNA vs TRANSCRIPT CONFLICT: the prospect's confirmed number wins, the DNA's average never appears",
    salesDna: DNA_LAND,
    transcript:
      "Rep: What would the deals need to bring in monthly for you to walk away from the job?\n" +
      "Prospect: I've run my numbers — it's 25k a month. That covers everything with margin.\n" +
      "Rep: 25k a month, okay. And you're firm on that?\n" +
      "Prospect: Yeah, 25k. Below that I'm not leaving.",
    asserts: [
      {
        desc: "output MUST contain the prospect's confirmed 25k",
        ok: (out) => /\b25\s*k\b|\$\s*25\b|25,000/i.test(out),
        whyRed: "a plainly stated + reaffirmed number must be recorded — the lens must not suppress real transcript evidence",
      },
      {
        desc: "output must NOT contain the DNA's typical $10k/mo",
        ok: (out) => !/\b10\s*k\b|\$\s*10\b|10,000/i.test(out),
        whyRed: "the DNA's average-prospect figure leaked into this prospect's scorecard — transcript must win",
      },
    ],
  },
  {
    name: "DNA LENS on a normal exchange: no inflation, verbatim words kept",
    salesDna: DNA_LAND,
    transcript:
      "Rep: So if this works the way you want, what does it actually look like?\n" +
      "Prospect: Honestly? I just want to quit my job. That's the whole dream.\n" +
      "Rep: Quit the job — got it. What's driving that?\n" +
      "Prospect: I'm just done building someone else's thing.",
    asserts: [
      {
        desc: "no dollar/k figure may appear (the prospect never gave one; the DNA's $10k must not fill the blank)",
        ok: (out) => !/\$\s*\d|\b\d+\s*k\b|\d,\d{3}/i.test(out),
        whyRed: "the lens turned the DNA's typical cash-flow number into this prospect's goal",
      },
      {
        desc: "Money must stay ⬜ open (never discussed — the DNA's qualification note is not evidence)",
        ok: (out) => /5 Money[^\n]*⬜/.test(out),
        whyRed: "the summarizer graded Money from the rep's DNA notes instead of the call",
      },
    ],
  },
  {
    // 2026-07-20: the anchor-specialization block tells the summarizer what SHAPE
    // anchors take for this offer (DNA_LAND: a monthly cash-flow number). The trap:
    // a prospect who stays VAGUE must produce vague anchors — the shape hint must
    // never manufacture the offer's typical specifics.
    name: "DNA ANCHOR-SHAPE TRAP: number-shaped offer + vague prospect → anchors stay vague",
    salesDna: DNA_LAND,
    transcript:
      "Rep: What's the goal with all this?\n" +
      "Prospect: I just want something that's mine, you know? Out from under my boss.\n" +
      "Rep: And money-wise, what does that need to look like?\n" +
      "Prospect: Enough to breathe. I haven't really done the math yet.",
    asserts: [
      {
        desc: "no dollar/k figure anywhere (the prospect gave none; the DNA's typical $10k must not fill the shape)",
        ok: (out) => !/\$\s*\d|\b\d+\s*k\b|\d,\d{3}/i.test(out),
        whyRed: "the anchor-shape hint ('Desire is usually a cash-flow number') manufactured a number the prospect never said",
      },
      {
        desc: "$GOAL must stay — (they explicitly haven't done the math)",
        ok: (out) => {
          const goalLine = out.split("\n").find((l) => /\$GOAL/.test(l)) ?? "";
          return !/\d/.test(goalLine);
        },
        whyRed: "a vague 'enough to breathe' was promoted into a concrete goal — the DNA supplied the digits",
      },
    ],
  },
];

// ─── LLM judges — audit the DNA fixtures' output for the two failure modes ───────
const JUDGE_SYSTEM = `You are a strict auditor of a live sales-call belief scorecard produced by an AI summarizer. You receive: the rep's SALES DNA (offer context saved BEFORE the call — averages about the TYPICAL prospect for this offer, NOT things this prospect said), the call TRANSCRIPT, and the SCORECARD the summarizer produced.

Audit ONLY these two failure modes:
- fabricated_specifics: TRUE if the scorecard presents any number, quote, or fact as this prospect's situation/words when it does NOT appear in the transcript (especially one that appears in, or is derived from, the Sales DNA). Faithful paraphrase of transcript content is fine.
- belief_inflation: TRUE if any belief is marked ✅ locked or 🟡 partial without transcript evidence — especially where the "evidence" matches the Sales DNA's typical pain/desire rather than something this prospect actually said. ⬜/— on undiscussed beliefs is CORRECT behavior, never a failure. IMPORTANT: 🟡 partial requires ONLY that the transcript touched or implied the topic — it does NOT require emotional intensity or a full admission (that's the ✅ bar, not the 🟡 bar). Flag a 🟡 as inflation ONLY when the topic was never touched at all.

Be strict but fair: grade against the transcript as the only source of truth about this prospect.
Return ONLY this JSON object, nothing else:
{ "fabricated_specifics": true|false, "belief_inflation": true|false, "rationale": "one short sentence" }`;

function judgeUserMessage(fx, scorecard) {
  return `SALES DNA (rep's offer context — averages, NOT this prospect's words):\n${JSON.stringify(fx.salesDna, null, 2)}\n\n` +
         `TRANSCRIPT (the only truth about this prospect):\n${fx.transcript}\n\n` +
         `SCORECARD PRODUCED:\n${scorecard}`;
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* fall through */ } }
  return null;
}

async function judgeClaude(fx, scorecard) {
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: JUDGE_CLAUDE, max_tokens: 300, system: JUDGE_SYSTEM, messages: [{ role: "user", content: judgeUserMessage(fx, scorecard) }] }),
  });
  if (!resp.ok) throw new Error(`claude judge error ${resp.status}`);
  return extractJson((await resp.json()).content?.[0]?.text ?? "");
}

async function judgeGpt(fx, scorecard) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: JUDGE_GPT, max_tokens: 300, messages: [{ role: "system", content: JUDGE_SYSTEM }, { role: "user", content: judgeUserMessage(fx, scorecard) }] }),
  });
  if (!resp.ok) throw new Error(`gpt judge error ${resp.status}`);
  return extractJson((await resp.json()).choices?.[0]?.message?.content ?? "");
}

async function runGate() {
  console.log("═".repeat(72));
  console.log("  BELIEF LADDER — GATE (prompt read live from belief-ladder.ts)");
  console.log(`  model=${PROD_MODEL} max_tokens=${MAX_TOKENS} · ${FIXTURES.length} generic + ${DNA_FIXTURES.length} Sales-DNA fixtures`);
  console.log(`  judges: ${JUDGE_CLAUDE} + ${JUDGE_GPT} (both mandatory on DNA fixtures)`);
  console.log("═".repeat(72));

  // The DNA half of the gate can't run without the GPT judge — fail loud up front,
  // never pass on half a jury.
  if (!OPENAI_KEY) {
    console.error("❌ OPENAI_API_KEY not found in .env.local — the gpt-4o cross-judge is mandatory for the Sales DNA gate.");
    process.exit(1);
  }

  let failed = 0;

  // Produce a fixture's scorecard: single-shot, or ROLL chunks (multi-tick) with
  // structural invariants asserted on EVERY intermediate tick.
  const produce = async (fx, dnaBlock = null) => {
    if (fx.chunks) {
      let summary = fx.current ?? "";
      const perTickFails = [];
      for (let i = 0; i < fx.chunks.length; i++) {
        summary = await callModel(PROD_MODEL, summary, fx.chunks[i], dnaBlock);
        for (const f of structuralFailures(summary)) perTickFails.push(`tick ${i + 1}/${fx.chunks.length}: ${f}`);
      }
      return { out: summary, perTickFails };
    }
    const out = await callModel(PROD_MODEL, fx.current ?? "", fx.transcript, dnaBlock);
    return { out, perTickFails: [] };
  };

  // One full evaluation of a fixture: produce → string asserts → structural
  // invariants → (DNA fixtures) dual judges. Returns every failure as a string.
  const evaluateOnce = async (fx, dnaBlock) => {
    const res = await produce(fx, dnaBlock);
    const failures = [];
    for (const a of fx.asserts) {
      if (!a.ok(res.out)) failures.push(`${a.desc}\n        why: ${a.whyRed}`);
    }
    for (const f of [...res.perTickFails, ...structuralFailures(res.out)]) {
      failures.push(`STRUCTURAL: ${f}`);
    }
    if (fx.salesDna) {
      // Dual LLM judges — zero tolerance on both flags, from both judges.
      for (const [judgeName, judgeFn] of [["claude", judgeClaude], ["gpt-4o", judgeGpt]]) {
        let verdict = null;
        try {
          verdict = await judgeFn(fx, res.out);
        } catch (e) {
          failures.push(`${judgeName} judge ERROR: ${e.message} (an unrunnable judge is a gate failure, not a skip)`);
          continue;
        }
        if (!verdict) {
          failures.push(`${judgeName} judge returned unparseable output`);
        } else if (verdict.fabricated_specifics || verdict.belief_inflation) {
          failures.push(`${judgeName} judge: fab=${!!verdict.fabricated_specifics} inflation=${!!verdict.belief_inflation} — ${verdict.rationale ?? ""}`);
        }
      }
    }
    return { out: res.out, failures };
  };

  // DE-FLAKE (plan hardening #9): the summarizer + judges are nondeterministic, and
  // a gate that reds on sampling noise trains people to ignore red. Majority rule:
  // clean on the first attempt → PASS (one run, the common case). Dirty → up to 2
  // retries; PASS needs 2-of-3 clean and is loudly marked FLAKY (a real prompt
  // regression fails consistently — 2/3 dirty stays a hard FAIL).
  const runFixture = async (fx, dnaBlock = null) => {
    const attempts = [];
    while (attempts.length < 3) {
      let r;
      try {
        r = await evaluateOnce(fx, dnaBlock);
      } catch (e) {
        r = { out: "", failures: [`ERROR: ${e.message}`] };
      }
      attempts.push(r);
      const clean = attempts.filter((a) => a.failures.length === 0).length;
      const dirty = attempts.length - clean;
      if (attempts.length === 1 && clean === 1) break; // clean first try — done
      if (clean >= 2 || dirty >= 2) break;             // majority reached either way
    }
    const clean = attempts.filter((a) => a.failures.length === 0).length;
    const pass = clean >= (attempts.length === 1 ? 1 : 2);
    if (pass && attempts.length === 1) {
      console.log(`\n✓ PASS  ${fx.name}  (${fx.asserts.length} asserts + structural${fx.salesDna ? " + dual judges" : ""})`);
    } else if (pass) {
      console.log(`\n✓ PASS  ${fx.name}  — ⚠️ FLAKY: ${clean}/${attempts.length} clean (passed on retry — watch this fixture)`);
      for (const [i, a] of attempts.entries()) {
        for (const f of a.failures) console.log(`        attempt ${i + 1} failure: ${f.split("\n")[0]}`);
      }
    } else {
      failed++;
      console.log(`\n✗ FAIL  ${fx.name}  — ${clean}/${attempts.length} clean (majority dirty)`);
      for (const [i, a] of attempts.entries()) {
        for (const f of a.failures) console.log(`        attempt ${i + 1}: ${f}`);
      }
      const last = attempts[attempts.length - 1];
      console.log("        ── last scorecard ──");
      console.log((last.out || "(no output)").split("\n").map((l) => "        " + l).join("\n"));
    }
  };

  // ── Part 1: generic fixtures (no DNA) — the pre-1b behavior must hold ─────────
  for (const fx of FIXTURES) {
    await runFixture(fx);
  }

  // ── Part 2: Sales DNA fixtures — production DNA block + string asserts + dual judges ──
  for (const fx of DNA_FIXTURES) {
    const dnaBlock = buildSummarizerDnaSystemBlock(fx.salesDna);
    if (!dnaBlock) {
      console.log(`\n✗ ${fx.name}\n    ERROR: fixture DNA did not pass the completeness gate — fixture bug, fix the blob`);
      failed++;
      continue;
    }
    await runFixture(fx, dnaBlock);
  }

  console.log("\n" + "═".repeat(72));
  if (failed === 0) {
    console.log("  ✅ GATE PASS — confidence-number rule + Sales DNA lens honored (0 fabrication, both judges)");
    console.log("═".repeat(72));
    process.exit(0);
  } else {
    console.log(`  ❌ GATE FAIL — ${failed} assertion(s)/verdict(s) failed`);
    console.log("  This gate is the Phase 1b ship gate — hard stop. Do NOT ship until green.");
    console.log("═".repeat(72));
    process.exit(1);
  }
}

// ─── Explore mode: roll a transcript and print scorecards for a human read ───────
const MOCK_TRANSCRIPT = `Rep: Marcus, appreciate you hopping on. What made you book this call?
Prospect: I've run my Shopify store three years and hit a ceiling — can't break past 40k a month.
Rep: What's that costing you right now?
Prospect: I'm working 70 hour weeks, barely see my kids. My wife's been on me about it.
Rep: If we fixed one thing, what would worth-it look like?
Prospect: 100k a month consistently. That's where I could hire a team and step back.
Rep: What have you tried?
Prospect: Courses, a freelancer for ads that burned me — dropped 8k, got nothing. I know what to do, I just can't execute alone.
Rep: Is scaling to 100k a this-year commitment or a someday thing?
Prospect: This year. I told my wife if it's not different by year-end I'd go back to a job. That'd kill me.`;

function chunk(text, n = 6) {
  const lines = text.split("\n").filter((l) => l.trim());
  const out = [];
  for (let i = 0; i < lines.length; i += n) out.push(lines.slice(i, i + n).join("\n"));
  return out;
}

async function runExplore(args) {
  const haikuOnly = args.includes("--haiku-only");
  const verbose   = args.includes("--verbose");
  const file      = args.find((a) => !a.startsWith("--") && a !== "--explore");
  const transcript = file ? fs.readFileSync(path.resolve(file), "utf-8") : MOCK_TRANSCRIPT;
  const chunks = chunk(transcript);

  const roll = async (model) => {
    let summary = "";
    for (let i = 0; i < chunks.length; i++) {
      summary = await callModel(model, summary, chunks[i]);
      if (verbose) console.log(`\n── ${model} after chunk ${i + 1}/${chunks.length} ──\n${summary}`);
    }
    return summary;
  };

  console.log(`Exploring ${file ? path.resolve(file) : "(mock)"} — ${chunks.length} ticks · prompt from belief-ladder.ts`);
  const jobs = [roll(PROD_MODEL)];
  if (!haikuOnly) jobs.unshift(roll(HAIKU));
  const results = await Promise.all(jobs);
  if (!haikuOnly) { console.log("\n===== HAIKU =====\n" + results[0]); console.log("\n===== SONNET (prod model) =====\n" + results[1]); }
  else            { console.log("\n===== " + PROD_MODEL + " =====\n" + results[0]); }
  console.log("\n(Explore mode is for human reading — run with no args for the pass/fail GATE.)");
}

const args = process.argv.slice(2);
const run = args.includes("--explore") ? runExplore(args) : runGate();
run.catch((err) => { console.error("\n❌ Harness error:", err.message); process.exit(1); });
