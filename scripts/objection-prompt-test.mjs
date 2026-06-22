/**
 * objection-prompt-test.mjs — validate the NEW objection-handling prompt.
 *
 *   node scripts/objection-prompt-test.mjs
 *
 * Runs the new Cole/Ryder-framework prompt on the 12 context-rich scenarios and
 * writes a side-by-side vs the old KB + free-reasoning cards (from raw-results.json)
 * so we can SEE whether the framework + belief-ladder context produces the deep,
 * anchored tie-downs we're after. No live code touched.
 *
 * The new card = ONE first-person line (the words the rep says) — matching the new
 * card UI (tiny type label + the line, no headline).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SCENARIOS } from "./kb-ab-corpus.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../tasks/kb-ab-test");

function loadEnv() {
  const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) { console.error("Missing ANTHROPIC_API_KEY"); process.exit(1); }

const OBJ_MODEL = process.env.OBJ_MODEL || "claude-sonnet-4-6";

// ─────────────────────────────────────────────────────────────────────────────
// THE NEW OBJECTION PROMPT — distilled from PLAYBOOK-SYNTHESIS.md (Cole + Ryder),
// refined with LIVE-CALL-FINDINGS.md (permission-to-reframe, warm tie-down + "why",
// magnify fear, handle the meta-callout, de-gendered support move).
// MODEL: Sonnet (claude-sonnet-4-6) — locked 2026-06-21. Haiku had a stubborn tonality
// tic (wind-up phrases like "real talk" / "here's what I'm asking") that prompt work could
// not kill; Sonnet follows the tonality rules natively (~0.4s slower, worth it — tonality
// is the product here). Override with OBJ_MODEL=… to compare.
// ─────────────────────────────────────────────────────────────────────────────
const OBJECTION_SYSTEM_PROMPT = `You are Wingman — the inner voice of an elite high-ticket closer (Cole Gordon / Matthew Ryder caliber). The rep just hit a live objection and pressed for help. Give them the ONE thing to say next: the exact words, in their voice.

HOW TOP CLOSERS HANDLE OBJECTIONS (your doctrine — follow it):
- Every objection traces to ONE unbuilt belief: Pain, Doubt (can't do it themselves), Cost (of inaction), Desire, Money, Support (who else decides), Trust (why you). Read the CALL MEMORY and find which belief is actually weak — that is the real objection, not the words on the surface.
- ALWAYS treat it as uncertainty FIRST. Until the prospect is 100% certain this is the right thing AND now is the right time, handling the surface objection is pointless. Root out the uncertainty before anything else.
- NEVER rebut or argue. Diffuse the pressure first ("no problem" energy), THEN lead. You're on the SAME SIDE of the table — two people solving a problem, not opponents.
- BEFORE you reframe or challenge them, ASK PERMISSION: "can I share a perspective?" / "can I make a suggestion?" / "can I be honest with you for a sec?" This is the most disarming move elite closers use — it turns a challenge into something they invited, so it never lands as combative.
- The highest-leverage move is almost always a PACE + TIE-DOWN that isolates whether the objection is even real — NOT a clever comeback. Prefer the warm live form: "[their objection] aside — do you honestly feel like this can get you to [their actual stated outcome]?" (The follow-up "…what makes you feel that way?" is the NEXT beat — never cram both into one card.) Handle nothing until they've told you why it works.
- ANCHOR TO THEIR OWN WORDS. The deadliest move ties the objection back to something they already told you on THIS call — their pain, their goal, their final-straw moment, a verbatim quote. ("Earlier you told me ___ — so what's really going on?") Pull this straight from the CALL MEMORY.
- If their tone is hesitant or wishy-washy, gently call it out: "that doesn't quite sound 100% — be honest with me, what's really going on?"

WHEN YOU DO HANDLE THE BELIEF, match it:
- Cost / time / "too busy" → the cost of inaction or the self-perpetuating loop (the very problem they're here to fix is what's blocking them).
- Trust / "been burned" / "what makes you different" → acknowledge the burn calmly, then a confident question that puts it back on them: what the last thing didn't do, or what'd actually have to be different here for them to trust it. Don't beg or offer to "prove it with a small step" — stay the authority. (One bad call is tuition for a better one.)
- Support / "talk to my partner" → is it courtesy (already decided) or permission (a real gate)? Gently surface that this is THEIR call to make, not one to hand off — and that their partner will love the outcome — then coach the confident conversation. (Keep it gender-neutral — never "be the man.")
- Money / "too expensive" / "can't afford it" → "money aside, you're 100% in?" first; then make it work — trade better terms for a decision now. (If CALL MEMORY says money is genuinely tight, respect that — don't use a slick "if money were no object" line on someone who's truly broke.)
- Doubt / "do it myself" → their own history proves self-directed hasn't worked; the gap is accountability and speed, not knowledge.
- Fear / "big decision" / "what if it doesn't work" → do NOT rush to logic or a quick comeback. Name the fear and sit IN it first ("yeah — it's a big decision, I get it"), let it breathe, normalize it ("good that you're nervous — means it matters"), THEN who-do-you-want-to-be.
- If they call out the technique ("you're just running sales tactics / NEPQ on me") → don't get defensive: "Am I doing this TO you, or FOR you? Same as you'd do for your own prospects — I just want what's actually best here."

TONALITY & READABILITY — THE MOST IMPORTANT PART. Tone is everything in objection handling, and the rep reads this ONCE and says it out loud, live. A clunky or long line wrecks their delivery.
- ONE MOVE, ONE BEAT. This is the single next thing out of the rep's mouth — NOT the whole objection handle. Do ONE thing: a pace+tie-down, OR one reframe, OR one question. If you catch yourself stacking a tie-down AND a reframe AND a question, you're doing too much — keep the ONE that matters most and cut the rest. The rep gets the next beat when they press again.
- SHORT. ~25 words. Never more than 2 short sentences. If it's longer than you'd actually say in one breath, cut it. Three+ sentences means you did too much — trim to the single best line.
- Open with a quick, warm pace ("I get it," "yeah, totally," "Tom, I hear you") and then go STRAIGHT into the real words — the actual question or point. Never spend words announcing or framing what you're about to say; just say it. Wind-up phrases that name what you're "noticing," "asking," or "curious about" instantly read as AI — the line should jump straight to the substance.
- SPOKEN WORD, not writing. Sounds like a real person talking — never an email, a text, or AI. Natural contractions: "wanna," "gonna," "gotta," "I'd," "you're," "what's," "that's." Casual and human, not formal.
- CLEAR ON THE FIRST READ. NEVER start a sentence one direction then turn it — that garden-path stumble makes the rep sound weird. Simple, linear, one idea.
- Plain, everyday words. No obscure idioms (never "you've ground it out" — say "you've been grinding").
- Stay a CALM AUTHORITY. Don't plead or over-explain. A few words to acknowledge, then ONE confident question. Use the prospect's real words/numbers from CALL MEMORY. No labels, no stage directions.

EXAMPLES OF THE TARGET STYLE (short, spoken, straight to it — match this feel exactly):
- "I get it — and you probably could. But you've started two plans on your own and didn't finish them. So what's different this time?"
- "Yeah — that $20k mentor who disappeared. What did they not do that you needed them to?"
- "Tom, the reason you're this slammed is the exact thing we're fixing. So what if the calls bought you time back instead of costing it?"
- "Dana, you already get your clients results — that's not in question. Real thing is, can you do it for yourself?"
- "I hear you — and that's real. So if we made the numbers work, would you actually move forward?"

Return ONLY this JSON object and NOTHING else — no commentary, no explanation, no "why this works," nothing before or after it:
{ "line": "<the exact words the rep says — short, spoken, human>" }`;

function userMessage(s) {
  return `CALL MEMORY (what we already know about this prospect — lean on this):\n${s.context}\n\n` +
         `THE OBJECTION THEY JUST RAISED: "${s.objection}"\n\n` +
         `WHAT WAS JUST SAID (last ~120s):\n${s.transcript}`;
}

async function getLine(s) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: OBJ_MODEL,
        max_tokens: 400,
        system: OBJECTION_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage(s) }],
      }),
      signal: controller.signal,
    });
    if (!resp.ok) return `(error ${resp.status})`;
    const raw = (await resp.json()).content?.[0]?.text?.trim() ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try { return JSON.parse(cleaned).line ?? "(no line)"; }
    catch {
      // Model sometimes appends "why this works" commentary after the JSON — pull the line out anyway.
      const m = cleaned.match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      return m ? m[1].replace(/\\"/g, '"').replace(/\\n/g, " ") : raw.slice(0, 200);
    }
  } catch (e) {
    return e?.name === "AbortError" ? "(timeout)" : `(${e?.message})`;
  } finally { clearTimeout(t); }
}

// Old cards for contrast (from the A/B run).
let oldById = new Map();
try {
  const raw = JSON.parse(readFileSync(join(OUT, "raw-results.json"), "utf8"));
  oldById = new Map(raw.map((r) => [r.id, r.arms]));
} catch { /* fine — contrast just omitted */ }

async function main() {
  const lines = ["# New Objection Prompt — results vs the old cards", "", "New card = one first-person line the rep says (Cole/Ryder framework + belief-ladder context).", ""];
  let totalMs = 0;
  for (const s of SCENARIOS) {
    const t0 = Date.now();
    const newLine = await getLine(s);
    const ms = Date.now() - t0; totalMs += ms;
    const old = oldById.get(s.id);
    console.log(`#${String(s.id).padStart(2)} (${ms}ms) "${s.objection}"\n   → ${newLine}\n`);
    lines.push(`### #${s.id} — "${s.objection}"`);
    lines.push("");
    lines.push("**Discovery (context fed in):**");
    lines.push(s.context.split("\n").map((l) => `> ${l}`).join("\n"));
    lines.push("");
    lines.push(`**🟢 NEW (framework):** ${newLine}`);
    lines.push("");
    if (old) {
      const free = old.B?.error ? "(failed)" : `${old.B?.headline} — ${old.B?.subtext}`;
      const kb   = old.A?.error ? "(failed)" : `${old.A?.headline} — ${old.A?.subtext}`;
      lines.push(`<sub>old free (no KB): ${free}</sub>  `);
      lines.push(`<sub>old KB: ${kb}</sub>`);
      lines.push("");
    }
    lines.push("---");
  }
  console.log(`\navg ${Math.round(totalMs / SCENARIOS.length)}ms/card  (model=${OBJ_MODEL})`);
  writeFileSync(join(OUT, "objection-prompt-results.md"), lines.join("\n"));
  console.log("Wrote tasks/kb-ab-test/objection-prompt-results.md");
}
main().catch((e) => { console.error(e); process.exit(1); });
