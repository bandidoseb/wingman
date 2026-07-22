/**
 * voice-flow-batch.mjs — the SWING grind. Where voice-batch.mjs grades MOVE 1 (the tee-up) in
 * isolation, this plays a FULL multi-turn objection flow: move 1 → simulated prospect reply →
 * move 2 → reply → … → the close. Sebastian grades the whole swing, not just the tee-up.
 *
 *   node scripts/voice-flow-batch.mjs           # generate flows → tasks/voice-flow-batch.{md,gradesheet.html}
 *   DRY=1 node scripts/voice-flow-batch.mjs     # no API calls — prove the loop + rendering
 *   BEATS=6 node scripts/voice-flow-batch.mjs   # max rep moves per flow (default 5)
 *   LIMIT=2 node scripts/voice-flow-batch.mjs   # first N scenarios only (quick smoke)
 *
 * Uses the REAL production objection builders at the `direct` level, in the SAME threaded shape
 * production sends (linesGiven + historyTranscript + beatNumber + leversUsed) — so this exercises
 * the exact back-and-forth engine, incl. the no-repeat-play guard and the beat-scaled close-lean.
 * A separate Sonnet call role-plays a realistic prospect between moves. The flow ends when the
 * model plays `direct-close` (the ask), abstains (rep waits), or hits the beat cap.
 *
 * NOTE: sim exchanges stay short, so they ride the FULL-VERBATIM history path (no flow-synth
 * recap) — the exact path a normal-length live objection uses.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildObjectionSystemPrompt, buildObjectionUserSegments } from "../src/lib/wingman/objection-prompt.mjs";
import { scanTics } from "./tic-gate.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "../tasks");

function loadEnv() {
  try {
    const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
    for (const l of text.split("\n")) {
      const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch { /* env optional in DRY */ }
}
loadEnv();

const DRY       = !!process.env.DRY;
const GEN_MODEL = process.env.GEN_MODEL || "claude-sonnet-4-6";
const MAX_BEATS = process.env.BEATS ? Math.max(2, Number(process.env.BEATS)) : 6;
// Strong-commitment phrases → the prospect said yes; stop the flow (close WON). Deliberately
// narrow: a soft "probably yeah" is NOT a commit — the swing should keep working it.
const COMMIT_RE = /\b(let'?s do it|let'?s go|i'?m in\b|sign me up|let'?s get started|let'?s get going|where do i sign|let'?s make it happen|count me in|i'?m ready to (do|start|go)|okay,? let'?s do|yeah,? let'?s do|let'?s do this)\b/i;
const LIMIT     = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const KEY       = process.env.ANTHROPIC_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lim = (arr) => (LIMIT === Infinity ? arr : arr.slice(0, LIMIT));

async function anthropic(system, user, maxTokens = 200) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: GEN_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: c.signal,
      });
      if (resp.status === 429 || resp.status === 529) { if (attempt < 2) { await sleep(2500 * (attempt + 1)); continue; } return { error: `${resp.status}` }; }
      if (!resp.ok) return { error: `${resp.status}` };
      return { text: (await resp.json()).content?.[0]?.text?.trim() ?? "" };
    } catch (e) {
      if (attempt < 2 && e?.name !== "AbortError") { await sleep(1500); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}

const flatten = (segs) => segs.map((s) => s.text).join("");

// Parse the card JSON — handles both single-shot {line} and threaded {lever,line}.
function parseCard(text) {
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let p = null;
  try { p = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { /* */ } } }
  if (p && typeof p === "object") {
    const line = typeof p.line === "string" && p.line.trim() ? p.line.trim() : (p.line === null ? null : undefined);
    const lever = typeof p.lever === "string" && p.lever.trim() ? p.lever.trim() : null;
    if (line !== undefined) return { lever, line };
  }
  const lm = String(text).match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const vm = String(text).match(/"lever"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (lm && lm[1].trim()) return { lever: vm ? vm[1].trim() : null, line: lm[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim() };
  if (/"line"\s*:\s*null/.test(String(text))) return { lever: null, line: null };
  return { lever: null, line: "(unparseable)" };
}

// ── SCENARIOS — full-flow objection situations. `belief` now carries the FULL context the card
// sees in a real call: the OFFER (incl. whether it has coaching/support/guarantee/terms — so the
// card can't fabricate features), the DISCOVERY anchors (what the prospect actually told the rep),
// and the belief ladder. This mirrors what the offer-aware summarizer + anchor capture inject. ──
const FLOWS = [
  {
    id: "money-tight",
    belief:
      `OFFER (rep's Sales DNA) — "Scale to $30k" business coaching · $8,000. Weekly live group coaching, 1-on-1 onboarding, private community, done-with-you script buildout. Guarantee: 14-day money-back. Payment plans: PIF, 2-pay, 3-pay.\n\n` +
      `LIVE CALL MEMORY\n` +
      `Stage: Close · Elapsed: 41m · Syntax: problems-first\n` +
      `▸ THE GAP\n` +
      `  Current "hell":   ~$6k/mo at a 9-5 he hates, feels stuck\n` +
      `  Desired "heaven": $30k/mo running his own thing · $GOAL 30000 · why that #: replace the job + freedom\n` +
      `  Final straw / emotional why: "tired of where I'm at"\n` +
      `  Core driver: Freedom\n` +
      `▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)\n` +
      `  1 Pain                 ✅ — hates the grind, "tired of where I'm at"\n` +
      `  2 Doubt (can't DIY)    🟡 — tried on his own ~18 months, hasn't cracked it\n` +
      `  3 Cost (of inaction)   🟡 — 18 months lost, still stuck\n` +
      `  4 Desire               ✅ — wants $30k/mo, said it twice\n` +
      `  5 Money                ⚠️ — has some savings, said $8k is "a stretch but doable"; then flinched at the price, "a lot of money right now"\n` +
      `  6 Support (who decides) ⬜ — not discussed\n` +
      `  7 Trust (why you)      🟡 — engaged, no strong objection\n` +
      `▸ KEY ANCHORS (their exact words)\n  • "that's a lot of money right now"\n  • "tired of where I'm at"\n  • "it'd be a stretch but doable"\n` +
      `▸ OPEN OBJECTIONS: price / affordability (open)\n` +
      `▸ WEAKEST LINK → 5 Money (⚠️, live objection), then 6 Support (⬜, untouched), then 2 Doubt (🟡)`,
    persona: "A 34-year-old stuck at a 9-5 making ~$6k/mo, wants to build a business to $30k/mo. The price is a real stretch but not impossible — he has some savings. He's interested but scared of the money.",
    objection: "Honestly that's a lot of money right now. I don't know.",
  },
  {
    id: "timing",
    belief:
      `OFFER (rep's Sales DNA) — "Freedom Accelerator" · $6,000. Weekly coaching, accountability check-ins, 90-day roadmap, community. Guarantee: 30-day money-back. Payment plans: 3-pay.\n\n` +
      `LIVE CALL MEMORY\n` +
      `Stage: Close · Elapsed: 38m · Syntax: goals-first\n` +
      `▸ THE GAP\n` +
      `  Current "hell":   runs a service biz ~10 yrs, "constantly busy," overwhelmed\n` +
      `  Desired "heaven": out into her own thing full-time within a year · $GOAL — · why that #: —\n` +
      `  Final straw / emotional why: —\n` +
      `  Core driver: Freedom\n` +
      `▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)\n` +
      `  1 Pain                 ✅ — overwhelmed, wants out\n` +
      `  2 Doubt (can't DIY)    ⬜ — not discussed\n` +
      `  3 Cost (of inaction)   🟡 — 10 yrs busy, it never settles\n` +
      `  4 Desire               ✅ — full-time in a year\n` +
      `  5 Money                ⬜ — not discussed\n` +
      `  6 Support (who decides) ⬜ — not discussed\n` +
      `  7 Trust (why you)      🟡 — engaged\n` +
      `▸ KEY ANCHORS (their exact words)\n  • "now's just not a great time"\n  • "constantly busy"\n` +
      `▸ OPEN OBJECTIONS: timing / "next quarter" (open)\n` +
      `▸ WEAKEST LINK → break the timing stall via 3 Cost (of inaction); beliefs still open: 2 Doubt, 5 Money, 6 Support (⬜)`,
    persona: "Runs a service business she's had ~10 years — it has NEVER settled down. Genuinely interested but reflexively delays; 'next quarter' is a stall. Underneath is a fear it won't work. Warms up when the rep exposes that nothing actually changes next quarter.",
    objection: "Now's just not a great time for me. Maybe next quarter would be better.",
  },
  {
    id: "partner",
    belief:
      `OFFER (rep's Sales DNA) — high-ticket coaching · $9,000. 1-on-1 coaching, weekly calls, community. Guarantee: results-based extension (no cash refund). Payment plans: 2-pay, 3-pay.\n\n` +
      `LIVE CALL MEMORY\n` +
      `Stage: Close · Elapsed: 44m · Syntax: problems-first\n` +
      `▸ THE GAP\n` +
      `  Current "hell":   wants more but stuck; ready for change\n` +
      `  Desired "heaven": wants the outcome the program delivers · $GOAL — · why that #: —\n` +
      `  Final straw / emotional why: —\n` +
      `  Core driver: Significance\n` +
      `▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)\n` +
      `  1 Pain                 ✅ — owns the problem\n` +
      `  2 Doubt (can't DIY)    🟡\n` +
      `  3 Cost (of inaction)   🟡\n` +
      `  4 Desire               ✅ — wants it, basically decided\n` +
      `  5 Money                🟡 — "decent chunk of money," surfaces late\n` +
      `  6 Support (who decides) ⚠️ — "need to talk to my wife"; she usually trusts his call\n` +
      `  7 Trust (why you)      ✅ — sold on the rep/offer\n` +
      `▸ KEY ANCHORS (their exact words)\n  • "I'd need to talk to my wife"\n  • "she usually trusts my judgment"\n` +
      `▸ OPEN OBJECTIONS: spouse / "talk to my wife" (open — likely courtesy, money underneath)\n` +
      `▸ WEAKEST LINK → 6 Support (⚠️, isolate courtesy vs real gate), then 5 Money`,
    persona: "Genuinely wants to move forward and has basically decided; loops in his wife out of respect — mostly courtesy, not a hard gate. Admits she'd trust his call. The real hesitation underneath is money (stretching thin), which surfaces once the wife excuse is dissolved.",
    objection: "I'd need to talk to my wife before I make a decision like this.",
  },
  {
    id: "results-doubt",
    belief:
      `OFFER (rep's Sales DNA) — "Land Flip Accelerator" · $7,000. 1-on-1 coaching, WEEKLY accountability calls, deal-review support, community. Guarantee: make your money back in 12 mo or keep working free. Payment plans: 2-pay, 3-pay. (Heavy coaching + accountability — NOT a sit-there course.)\n\n` +
      `LIVE CALL MEMORY\n` +
      `Stage: Press · Elapsed: 33m · Syntax: problems-first\n` +
      `▸ THE GAP\n` +
      `  Current "hell":   wants out, tried courses that "sat there," no follow-through\n` +
      `  Desired "heaven": build a land-flipping business that actually works · $GOAL — · why that #: —\n` +
      `  Final straw / emotional why: —\n` +
      `  Core driver: Certainty\n` +
      `▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)\n` +
      `  1 Pain                 ✅\n` +
      `  2 Doubt (can't DIY)    ⚠️ — doubts programs work; really doubts HIS own follow-through\n` +
      `  3 Cost (of inaction)   🟡\n` +
      `  4 Desire               🟡 — wants it, guarded\n` +
      `  5 Money                ⬜ — not yet discussed (surfaces later)\n` +
      `  6 Support (who decides) ⬜\n` +
      `  7 Trust (why you)      🟡 — a little guarded, "seen people not get results"\n` +
      `▸ KEY ANCHORS (their exact words)\n  • "seen a lot of people not really get results"\n  • courses "just sat there"\n` +
      `▸ OPEN OBJECTIONS: results skepticism (open)\n` +
      `▸ WEAKEST LINK → 2 Doubt (⚠️, live objection — mirror: the variable is the person), then 5 Money & 6 Support (⬜, untouched), then 7 Trust (🟡)`,
    persona: "Skeptical because he's seen people not get results. The real issue is he's afraid HE won't follow through, projected onto 'these programs.' Has bought sit-there courses before. Concedes when the rep mirrors that the variable is the person, not the program.",
    objection: "I've seen a lot of people not really get results from stuff like this, you know?",
  },
];

const PROSPECT_SYSTEM =
  `You are role-playing a realistic high-ticket sales PROSPECT on a live call. Stay fully in character as the person described. ` +
  `You have real hesitations but you're a normal human: you concede a little when the rep makes a genuinely good point, you get more honest as they earn it, ` +
  `and you surface your real concern when pushed well — but you do NOT cave instantly and you do NOT stonewall forever. ` +
  `If the rep asks you to make the decision and they've genuinely handled your concern, it's okay to say yes (or a real, specific final hesitation). ` +
  `Reply in 1–2 short SPOKEN sentences, casual and natural — never a monologue, never robotic, never mention you're an AI or that this is a role-play. Output ONLY the words you say, no quotes, no labels.`;

async function genMove(fx, { latest, thread }) {
  if (DRY) return { lever: thread ? "why-probe" : null, line: `(dry move b${thread ? thread.beatNumber : 1}) re: ${latest.slice(0, 30)}` };
  const system = buildObjectionSystemPrompt("direct");
  const user = flatten(buildObjectionUserSegments({ liveSummary: fx.belief, latestResponse: latest, thread }));
  const { text, error } = await anthropic(system, user, 220);
  if (error) return { lever: null, line: `(error ${error})`, error: true };
  return parseCard(text);
}

async function genProspect(fx, historyText, repLine) {
  if (DRY) return `(dry prospect reply to: ${repLine.slice(0, 30)})`;
  const user =
    `WHO YOU ARE: ${fx.persona}\n\nWhat's on the table: a high-ticket coaching/program offer you're on a sales call about.\n\n` +
    `THE CONVERSATION SO FAR:\n${historyText}\n\nThe rep just said to you: "${repLine}"\n\nRespond as the prospect (1–2 short spoken sentences):`;
  const { text, error } = await anthropic(PROSPECT_SYSTEM, user, 90);
  return error ? `(prospect error ${error})` : text.replace(/^["']|["']$/g, "").trim();
}

async function runFlow(fx) {
  const turns = [{ who: "prospect", text: fx.objection }];
  let history = `Prospect: ${fx.objection}`;
  let latest = fx.objection;
  const linesGiven = [];
  const leversUsed = [];
  let endReason = "maxbeats";

  for (let beat = 1; beat <= MAX_BEATS; beat++) {
    const thread = beat > 1
      ? { beatNumber: beat, linesGiven: [...linesGiven], historyTranscript: history, gapFlag: false, leversUsed: [...leversUsed] }
      : null;
    const move = await genMove(fx, { latest, thread });

    if (move.error) { turns.push({ who: "rep", beat, lever: move.lever, line: move.line, tics: { hard: [], soft: [] }, note: "generation error" }); endReason = "error"; break; }
    if (move.line === null) { turns.push({ who: "rep", beat, lever: null, line: null, tics: { hard: [], soft: [] } }); endReason = "abstain"; break; }

    const tics = scanTics(move.line, "objection");
    turns.push({ who: "rep", beat, lever: move.lever, line: move.line, tics });
    linesGiven.push(move.line);
    if (move.lever) leversUsed.push(move.lever);
    history += `\nRep: ${move.line}`;

    // Prospect responds to this move. We do NOT stop at the first direct-close — if a new
    // objection surfaces after the ask, the flow should keep working it (that's the real swing).
    const resp = await genProspect(fx, history, move.line);
    const won = COMMIT_RE.test(resp);
    turns.push({ who: "prospect", text: resp, afterClose: move.lever === "direct-close" });
    history += `\nProspect: ${resp}`;
    latest = resp;

    if (won) { endReason = "won"; break; }
  }

  return { id: fx.id, belief: fx.belief, turns, endReason };
}

// ── RENDER: readable markdown ──
function renderMd(flows, meta) {
  const md = [
    "# Wingman Voice FLOW Batch — the SWING (full multi-turn objection flows)",
    "",
    `Generated ${meta.generated} · gen=${meta.model}. Each flow plays move 1 → prospect reply → move 2 → … → close.`,
    "Prospect replies are simulated (Sonnet role-play). Grade the WINGMAN moves + whether the swing lands.",
    "",
  ];
  const endLabel = { won: "✅ prospect committed", abstain: "⏸️ Wingman abstained (rep waits)", maxbeats: `⚠️ still working it at the ${MAX_BEATS}-beat cap`, error: "❌ generation error" };
  for (const f of flows) {
    md.push(`## ${f.id}`, "", "**Context (what the card sees — offer + discovery + belief ladder):**", "", "```", f.belief, "```", "");
    for (const t of f.turns) {
      if (t.who === "prospect") md.push(`**Prospect:** _${t.text}_`, "");
      else if (t.line === null) md.push(`**Wingman (beat ${t.beat}):** — (abstain — take the close / wait)`, "");
      else {
        const flags = [t.tics.hard.length ? `🚩TIC(${t.tics.hard.join(",")})` : "", t.tics.soft.length ? `⚠️(${t.tics.soft.join(",")})` : ""].filter(Boolean).join(" ");
        md.push(`**Wingman — MOVE ${t.beat}** ${t.lever ? `[${t.lever}]` : ""} ${flags}`, `> ${t.line}`, "Verdict:  · Why: ", "");
      }
    }
    md.push(`_End: ${endLabel[f.endReason] || f.endReason}_`, "", "**Whole-swing verdict:**  · **Notes:** ", "", "---", "");
  }
  return md.join("\n");
}

// ── RENDER: clickable flow grade sheet (body-only HTML — Artifact-ready + opens locally) ──
function renderGradesheet(flows, meta) {
  const dataJson = JSON.stringify(flows).replace(/</g, "\\u003c");
  const keyStr = `wingman-flowbatch-${meta.generated}`.replace(/[^a-z0-9-]/gi, "-");
  return `<title>Wingman Flow Batch — Grade the Swing</title>
<style>
:root{
  --bg:#f5f6f9; --surface:#ffffff; --surface2:#fbfcfe; --ink:#161a21; --muted:#5b6472;
  --line:#e3e7ee; --accent:#2f6bff; --accent-soft:#eaf0ff; --prospect:#6b5bd2; --prospect-bg:#efecfb;
  --keep:#15873f; --keep-bg:#e9f6ee; --rewrite:#b5730a; --rewrite-bg:#fbf1df; --kill:#d21b4b; --kill-bg:#fdebf0;
  --radius:12px; --shadow:0 1px 2px rgba(20,26,33,.06),0 4px 16px rgba(20,26,33,.05);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0d1016; --surface:#161b23; --surface2:#1b212b; --ink:#e8ebf1; --muted:#96a1b2;
  --line:#262d39; --accent:#6a97ff; --accent-soft:#1a2438; --prospect:#a99cf0; --prospect-bg:#211d33;
  --keep:#4fce7f; --keep-bg:#132a1d; --rewrite:#e5a83c; --rewrite-bg:#2c2413; --kill:#ff6b93; --kill-bg:#2e1620;
  --shadow:0 1px 2px rgba(0,0,0,.35),0 6px 20px rgba(0,0,0,.3);
}}
:root[data-theme="light"]{ --bg:#f5f6f9; --surface:#ffffff; --surface2:#fbfcfe; --ink:#161a21; --muted:#5b6472; --line:#e3e7ee; --accent:#2f6bff; --accent-soft:#eaf0ff; --prospect:#6b5bd2; --prospect-bg:#efecfb; --keep:#15873f; --keep-bg:#e9f6ee; --rewrite:#b5730a; --rewrite-bg:#fbf1df; --kill:#d21b4b; --kill-bg:#fdebf0; }
:root[data-theme="dark"]{ --bg:#0d1016; --surface:#161b23; --surface2:#1b212b; --ink:#e8ebf1; --muted:#96a1b2; --line:#262d39; --accent:#6a97ff; --accent-soft:#1a2438; --prospect:#a99cf0; --prospect-bg:#211d33; --keep:#4fce7f; --keep-bg:#132a1d; --rewrite:#e5a83c; --rewrite-bg:#2c2413; --kill:#ff6b93; --kill-bg:#2e1620; }
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;margin:0;-webkit-font-smoothing:antialiased}
.wrap{max-width:800px;margin:0 auto;padding:0 20px 150px}
.topbar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin:0 -20px;padding:14px 20px}
.topbar-inner{max-width:800px;margin:0 auto;display:flex;align-items:center;gap:16px}
.brand{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.brand h1{font-size:15px;font-weight:650;margin:0;letter-spacing:-.01em}
.brand .sub{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.count{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
.count b{color:var(--ink)}
.btn{appearance:none;border:1px solid var(--accent);background:var(--accent);color:#fff;font:inherit;font-weight:600;font-size:13px;padding:8px 14px;border-radius:9px;cursor:pointer;white-space:nowrap;transition:filter .12s,transform .06s}
.btn:hover{filter:brightness(1.06)}.btn:active{transform:translateY(1px)}
.btn.ghost{background:transparent;color:var(--accent)}
.progress{height:3px;background:var(--line);border-radius:2px;margin-top:12px;overflow:hidden}
.progress > i{display:block;height:100%;width:0;background:var(--accent);border-radius:2px;transition:width .25s ease}
.intro{color:var(--muted);font-size:13.5px;margin:22px 2px 6px}
.intro b{color:var(--ink);font-weight:600}
.flow{margin-top:26px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:var(--shadow);overflow:hidden}
.flow-head{padding:14px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.flow-head h2{font-size:15px;font-weight:650;margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.02em}
.flow-end{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:20px;border:1px solid var(--line);color:var(--muted)}
.flow-end.closed,.flow-end.won{color:var(--keep);border-color:var(--keep);background:var(--keep-bg)}
.flow-end.maxbeats{color:var(--rewrite);border-color:var(--rewrite);background:var(--rewrite-bg)}
.flow-end.abstain{color:var(--muted)}
.flow-end.error{color:var(--kill);border-color:var(--kill);background:var(--kill-bg)}
.belief{padding:11px 16px;background:var(--surface2);border-bottom:1px solid var(--line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;color:var(--muted);white-space:pre-wrap}
.turns{padding:14px 16px;display:flex;flex-direction:column;gap:13px}
.pros{align-self:flex-start;max-width:82%;background:var(--prospect-bg);color:var(--ink);border:1px solid color-mix(in srgb,var(--prospect) 30%,var(--line));border-radius:14px 14px 14px 4px;padding:9px 13px;font-size:14px}
.pros .who{font-size:9.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--prospect);margin-bottom:2px}
.pros.after-close{border-style:dashed}
.move{align-self:stretch;background:var(--surface2);border:1px solid var(--line);border-radius:12px;padding:11px 13px}
.move-head{display:flex;align-items:center;gap:8px;margin-bottom:7px;flex-wrap:wrap}
.move-n{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.lever{font-size:10px;font-weight:600;color:var(--muted);border:1px solid var(--line);border-radius:20px;padding:1px 8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.lever.close{color:var(--keep);border-color:var(--keep);background:var(--keep-bg)}
.badge{font-size:10px;font-weight:600;padding:2px 7px;border-radius:20px;border:1px solid}
.badge.hard{color:var(--kill);border-color:var(--kill);background:var(--kill-bg)}
.badge.soft{color:var(--rewrite);border-color:var(--rewrite);background:var(--rewrite-bg)}
.move-line{font-size:15.5px;font-weight:500;line-height:1.4;color:var(--ink);margin-bottom:11px}
.move-line.abstain{font-weight:400;font-style:italic;color:var(--muted)}
.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}
.vbtn{appearance:none;font:inherit;font-size:12.5px;font-weight:600;padding:8px 6px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .12s}
.vbtn:hover{border-color:var(--muted)}
.vbtn[aria-pressed="true"][data-v="keep"]{background:var(--keep-bg);border-color:var(--keep);color:var(--keep)}
.vbtn[aria-pressed="true"][data-v="rewrite"]{background:var(--rewrite-bg);border-color:var(--rewrite);color:var(--rewrite)}
.vbtn[aria-pressed="true"][data-v="kill"]{background:var(--kill-bg);border-color:var(--kill);color:var(--kill)}
.extra{margin-top:9px;display:none}
.extra.show{display:block}
.extra textarea{width:100%;font:inherit;font-size:13.5px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 10px;resize:vertical;min-height:40px;margin-top:6px}
.extra textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.extra .tl{font-size:9.5px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.swing{padding:13px 16px;border-top:1px solid var(--line);background:var(--surface2)}
.swing .q{font-size:13px;font-weight:600;color:var(--ink);margin-bottom:9px}
.swing .sw-controls{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px}
.swbtn{appearance:none;font:inherit;font-size:12.5px;font-weight:600;padding:7px 13px;border-radius:8px;border:1px solid var(--line);background:var(--surface);color:var(--muted);cursor:pointer;transition:all .12s}
.swbtn[aria-pressed="true"][data-s="nailed"]{background:var(--keep-bg);border-color:var(--keep);color:var(--keep)}
.swbtn[aria-pressed="true"][data-s="ok"]{background:var(--rewrite-bg);border-color:var(--rewrite);color:var(--rewrite)}
.swbtn[aria-pressed="true"][data-s="off"]{background:var(--kill-bg);border-color:var(--kill);color:var(--kill)}
.swing textarea{width:100%;font:inherit;font-size:13.5px;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:8px;padding:8px 10px;resize:vertical;min-height:40px}
.swing textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.footer{position:fixed;left:0;right:0;bottom:0;z-index:20;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:12px 20px}
.footer-inner{max-width:800px;margin:0 auto;display:flex;align-items:center;gap:12px}
.footer .note{font-size:12.5px;color:var(--muted);flex:1}
.footer .btn{padding:10px 18px;font-size:14px}
#output{display:none;width:100%;max-width:800px;margin:16px auto 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;min-height:200px}
.toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%) translateY(8px);background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;padding:9px 16px;border-radius:9px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:40}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.vbtn:focus-visible,.btn:focus-visible,.swbtn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:520px){.brand .sub{display:none}.footer .note{display:none}.pros{max-width:100%}}
</style>
<div class="topbar"><div class="topbar-inner">
  <div class="brand"><h1>Wingman Flow Batch — the Swing</h1><div class="sub" id="subline"></div></div>
  <div class="count" id="count">0 / 0</div>
  <button class="btn ghost" id="copyTop">Copy results</button>
</div><div class="progress"><i id="bar"></i></div></div>
<div class="wrap">
  <p class="intro">Each block opens with the <b>CONTEXT the card sees</b> — the offer (incl. whether it has coaching / a guarantee / payment plans, so it can't fabricate) + what the prospect told you in discovery + the belief ladder — then the full flow: move 1 → prospect reply → … → commit. Grade each <b>Wingman move</b> (Keep / Rewrite / Kill), then the <b>whole-swing verdict</b>: did it carry the rep to the close at the right time? Auto-saves; hit <b>Copy results</b> and paste back.</p>
  <div id="list"></div>
</div>
<div class="footer"><div class="footer-inner">
  <div class="note" id="fnote">0 of 0 moves marked</div>
  <button class="btn" id="copyBtn">Copy results to paste back</button>
</div><textarea id="output" readonly></textarea></div>
<div class="toast" id="toast">Copied — paste it back to me</div>
<script>
var FLOWS = ${dataJson};
var KEY = "${keyStr}";
var GEN = "${meta.generated}", MODEL = "${meta.model}";
var END = { won:"prospect committed", closed:"reached the close", abstain:"Wingman abstained", maxbeats:"still working at beat cap", error:"generation error" };
var state = {};
try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch(e) { state = {}; }
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch(e){} }
function el(tag, attrs, kids){
  var n = document.createElement(tag);
  if(attrs) for(var k in attrs){
    if(k === "class") n.className = attrs[k];
    else if(k === "text") n.textContent = attrs[k];
    else if(k.indexOf("on") === 0) n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
    else n.setAttribute(k, attrs[k]);
  }
  if(kids) kids.forEach(function(c){ if(c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
  return n;
}
document.getElementById("subline").textContent = "Generated " + GEN + " · " + MODEL + " · full objection flows";
var VERBS = [["keep","✓","Keep"],["rewrite","✎","Rewrite"],["kill","✗","Kill"]];
var moveKeys = [];
var list = document.getElementById("list");
FLOWS.forEach(function(f){
  var flow = el("div",{class:"flow"});
  var endCls = "flow-end " + f.endReason;
  flow.appendChild(el("div",{class:"flow-head"},[ el("h2",{text:f.id}), el("span",{class:endCls,text:END[f.endReason]||f.endReason}) ]));
  flow.appendChild(el("div",{class:"belief",text:f.belief}));
  var turnsWrap = el("div",{class:"turns"});
  f.turns.forEach(function(t){
    if(t.who === "prospect"){
      turnsWrap.appendChild(el("div",{class:"pros" + (t.afterClose ? " after-close" : "")},[
        el("div",{class:"who",text: t.afterClose ? "Prospect (after the ask)" : "Prospect"}),
        document.createTextNode(t.text)
      ]));
      return;
    }
    // rep move
    var mkey = f.id + "::" + t.beat;
    moveKeys.push(mkey);
    var st = state[mkey] || (state[mkey] = { verdict:null, rewrite:"", why:"" });
    if(t.line === null){
      turnsWrap.appendChild(el("div",{class:"move"},[
        el("div",{class:"move-head"},[ el("span",{class:"move-n",text:"MOVE " + t.beat}) ]),
        el("div",{class:"move-line abstain",text:"(abstain — Wingman tells the rep to wait / take the close)"})
      ]));
      return;
    }
    var badges = [];
    if(t.tics && t.tics.hard && t.tics.hard.length) badges.push(el("span",{class:"badge hard",text:"TIC: " + t.tics.hard.join(", ")}));
    if(t.tics && t.tics.soft && t.tics.soft.length) badges.push(el("span",{class:"badge soft",text:"tic? " + t.tics.soft.join(", ")}));
    var rw = el("div",{class:"extra"},[ el("div",{class:"tl",text:"Your rewrite"}), el("textarea",{placeholder:"How you'd actually say this move…", oninput:function(e){ st.rewrite=e.target.value; save(); }}) ]);
    rw.querySelector("textarea").value = st.rewrite || "";
    var wy = el("div",{class:"extra"},[ el("div",{class:"tl",text:"Why"}), el("textarea",{placeholder:"What's wrong / what it should do…", oninput:function(e){ st.why=e.target.value; save(); }}) ]);
    wy.querySelector("textarea").value = st.why || "";
    var btns = VERBS.map(function(v){ return el("button",{class:"vbtn","data-v":v[0],type:"button","aria-pressed":"false", onclick:function(){ setV(mkey, v[0]); }},[ el("span",{text:v[1]}), v[2] ]); });
    var leverEl = t.lever ? el("span",{class:"lever" + (t.lever==="direct-close"?" close":""),text:t.lever}) : null;
    var move = el("div",{class:"move","data-mk":mkey},[
      el("div",{class:"move-head"}, [ el("span",{class:"move-n",text:"MOVE " + t.beat}), leverEl ].concat(badges).filter(Boolean)),
      el("div",{class:"move-line",text:t.line}),
      el("div",{class:"controls"}, btns),
      rw, wy
    ]);
    move._btns = btns; move._rw = rw; move._wy = wy;
    turnsWrap.appendChild(move);
    paint(mkey);
  });
  flow.appendChild(turnsWrap);
  // whole-swing verdict
  var skey = f.id + "::swing";
  var sst = state[skey] || (state[skey] = { grade:null, notes:"" });
  var SW = [["nailed","Nailed the swing"],["ok","Okay / mixed"],["off","Off — didn't carry"]];
  var swBtns = SW.map(function(s){ return el("button",{class:"swbtn","data-s":s[0],type:"button","aria-pressed": sst.grade===s[0] ? "true":"false", onclick:function(){ setSwing(skey, s[0]); }},[s[1]]); });
  var swNotes = el("textarea",{placeholder:"Did it carry the rep to the close at the right time? Too early / too late / never? Notes…", oninput:function(e){ sst.notes=e.target.value; save(); }});
  swNotes.value = sst.notes || "";
  var swing = el("div",{class:"swing"},[
    el("div",{class:"q",text:"Whole-swing verdict — did Wingman carry the rep to the close?"}),
    el("div",{class:"sw-controls"}, swBtns),
    swNotes
  ]);
  swing._btns = swBtns;
  flow._swing = swing;
  flow.appendChild(swing);
  list.appendChild(flow);
});
function moveEl(mk){ return list.querySelector('.move[data-mk="' + (window.CSS && CSS.escape ? CSS.escape(mk) : mk) + '"]'); }
function paint(mk){
  var st = state[mk] || {}; var m = moveEl(mk); if(!m || !m._btns) return;
  m._btns.forEach(function(b){ b.setAttribute("aria-pressed", b.getAttribute("data-v") === st.verdict ? "true":"false"); });
  m._rw.className = "extra" + (st.verdict === "rewrite" ? " show" : "");
  m._wy.className = "extra" + (st.verdict === "rewrite" || st.verdict === "kill" ? " show" : "");
}
function setV(mk, v){
  var st = state[mk] || (state[mk] = { verdict:null, rewrite:"", why:"" });
  st.verdict = (st.verdict === v ? null : v);
  save(); paint(mk); updateProgress();
}
function setSwing(sk, g){
  var st = state[sk] || (state[sk] = { grade:null, notes:"" });
  st.grade = (st.grade === g ? null : g);
  save(); repaintSwings();
}
function repaintSwings(){
  var i = 0;
  list.querySelectorAll(".flow").forEach(function(fl){
    var f = FLOWS[i++]; if(!f || !fl._swing) return;
    var st = state[f.id + "::swing"] || {};
    fl._swing._btns.forEach(function(b){ b.setAttribute("aria-pressed", b.getAttribute("data-s") === st.grade ? "true":"false"); });
  });
}
function marked(){ return moveKeys.filter(function(k){ return state[k] && state[k].verdict; }).length; }
function updateProgress(){
  var m = marked(), total = moveKeys.length;
  document.getElementById("count").innerHTML = "<b>" + m + "</b> / " + total + " moves";
  document.getElementById("fnote").textContent = m + " of " + total + " moves marked";
  document.getElementById("bar").style.width = (total ? (m/total*100) : 0) + "%";
}
function assemble(){
  var out = ["# Wingman Flow Batch — MARKED (the swing)", "", "Generated " + GEN + " · gen=" + MODEL, ""];
  FLOWS.forEach(function(f){
    out.push("## " + f.id + "  [end: " + (END[f.endReason]||f.endReason) + "]", "");
    f.turns.forEach(function(t){
      if(t.who === "prospect"){ out.push("Prospect: " + t.text); return; }
      if(t.line === null){ out.push("Wingman MOVE " + t.beat + ": (abstain)"); return; }
      var st = state[f.id + "::" + t.beat] || {};
      var v = st.verdict === "keep" ? "✓" : st.verdict === "kill" ? "✗" : st.verdict === "rewrite" ? "✎ (rewrite)" : "(unmarked)";
      out.push("Wingman MOVE " + t.beat + (t.lever ? " ["+t.lever+"]" : "") + ": " + t.line);
      out.push("  Verdict: " + v + (st.rewrite ? " | Rewrite: " + st.rewrite.trim() : "") + (st.why ? " | Why: " + st.why.trim() : ""));
    });
    var sw = state[f.id + "::swing"] || {};
    out.push("", "SWING VERDICT: " + (sw.grade || "(unmarked)") + (sw.notes ? " — " + sw.notes.trim() : ""), "", "---", "");
  });
  return out.join("\\n");
}
function copyResults(){
  var text = assemble();
  var ta = document.getElementById("output");
  ta.value = text; ta.style.display = "block"; ta.focus(); ta.select();
  var done = function(){ var t = document.getElementById("toast"); t.classList.add("show"); setTimeout(function(){ t.classList.remove("show"); }, 2200); };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, done); }
  else { try { document.execCommand("copy"); } catch(e){} done(); }
}
document.getElementById("copyBtn").addEventListener("click", copyResults);
document.getElementById("copyTop").addEventListener("click", copyResults);
repaintSwings();
updateProgress();
</script>`;
}

async function run() {
  if (!DRY && !KEY) { console.error("Missing ANTHROPIC_API_KEY (or DRY=1)"); process.exit(1); }
  const flows = lim(FLOWS);
  console.log(`Playing ${flows.length} objection flows (≤${MAX_BEATS} beats each) · gen=${GEN_MODEL}${DRY ? " · DRY" : ""}…`);
  const results = [];
  for (const fx of flows) {
    process.stdout.write(`  · ${fx.id} …`);
    const r = await runFlow(fx);
    const moves = r.turns.filter((t) => t.who === "rep").length;
    console.log(` ${moves} moves → ${r.endReason}`);
    results.push(r);
  }
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");
  const meta = { generated, model: GEN_MODEL };
  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* */ }
  writeFileSync(join(OUT_DIR, "voice-flow-batch.md"), renderMd(results, meta));
  writeFileSync(join(OUT_DIR, "voice-flow-batch.gradesheet.html"), renderGradesheet(results, meta));
  console.log(`Wrote tasks/voice-flow-batch.md + voice-flow-batch.gradesheet.html (${results.length} flows).`);
}
run().catch((e) => { console.error(e); process.exit(1); });
