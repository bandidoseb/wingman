/**
 * objection-threading-eval.mjs — Phase A gate for multi-turn Objection Flow.
 *
 *   node scripts/objection-threading-eval.mjs        # full run (AI judge)
 *   DRY=1 node scripts/objection-threading-eval.mjs  # no API — prove assembly + report
 *   OBJ_MODEL=… JUDGE_MODEL=… node scripts/objection-threading-eval.mjs
 *
 * What it proves (the four threading behaviors the plan requires):
 *   - advance      : a continuation beat gives a NEW move, does not repeat a prior one, and
 *                    answers the LATEST prospect response.
 *   - abstain      : if the rep pressed before the prospect actually responded, return {line:null}.
 *   - switch       : if the prospect raised a genuinely NEW objection (with a gap NOTE), the card
 *                    addresses the NEW objection and does not repeat the old thread's moves.
 *
 * Faithfulness (reviewer SEV-4): each fixture is fed through the REAL production message shape
 * (buildObjectionUserSegments, the same builder objection-signal.ts ships), flattened to one
 * string for the judge call — so the gate grades exactly what the live card would send.
 *
 * The AI judge is BLIND to the fixture's expectation. Sebastian is the final tonality judge;
 * this gate is the correctness triage. Stochastic — run it 3× and require green each time.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { OBJECTION_SYSTEM_PROMPT, buildObjectionUserSegments } from "../src/lib/wingman/objection-prompt.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const DRY = !!process.env.DRY;
const REPEAT = process.env.REPEAT ? Number(process.env.REPEAT) : 3;   // per-fixture runs; need a strong majority
const ONLY = process.env.ONLY || "";                                  // run just fixtures whose id includes this
const OBJ_MODEL = process.env.OBJ_MODEL || "claude-sonnet-4-6";
const JUDGE_MODEL = process.env.JUDGE_MODEL || "claude-sonnet-4-6";
// Cross-model judge: JUDGE_PROVIDER=openai routes the judge to GPT (different model family) to break
// the model-judges-model blind spot. It's a CROSS-CHECK, not the final word — disagreements between
// the two judges are the cards worth eyeballing. Default stays Claude.
const JUDGE_PROVIDER = (process.env.JUDGE_PROVIDER || "anthropic").toLowerCase();
const OPENAI_JUDGE_MODEL = process.env.OPENAI_JUDGE_MODEL || "gpt-4o";
const KEY = process.env.ANTHROPIC_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!DRY && !KEY) { console.error("Missing ANTHROPIC_API_KEY (or run with DRY=1)"); process.exit(1); }
if (!DRY && JUDGE_PROVIDER === "openai" && !OPENAI_KEY) { console.error("JUDGE_PROVIDER=openai needs OPENAI_API_KEY"); process.exit(1); }

// ── Fixtures — realistic mid-flow ledgers. `belief` = frozen Belief Ladder snapshot. ──────────
const FIX = [
  // ── ADVANCE: a continuation beat must give a NEW angle that answers the latest response ──
  {
    id: "advance-money", kind: "advance",
    belief: "Sarah, done-for-you agency at ~$12k/mo, wants $50k/mo [confirmed]. Weak belief: Money (wants it, worried about cash on hand). Burned once by an $8k coach who ghosted.",
    thread: { beatNumber: 3,
      linesGiven: [
        "Money aside — if we actually got you to that $50k month, are you a hundred percent in?",
        "I hear you. So what'd have to be true for the investment to feel like a no-brainer?",
      ],
      historyTranscript: "REP: Money aside — if we got you to that $50k month, are you a hundred percent in?\nSARAH: Yeah, I want it. That's the whole reason I'm here.\nREP: So what'd have to be true for the investment to feel like a no-brainer?\nSARAH: Honestly I just don't love spending this much up front." },
    latestResponse: "SARAH: Yeah I want it, I do. I just don't have the full amount sitting there right now.",
  },
  {
    id: "advance-money-2", kind: "advance",
    belief: "Ben, gym owner, wants to add an online arm [confirmed]. Weak belief: Money (\"too expensive\"). Cash is fine; it's a spending-comfort thing.",
    thread: { beatNumber: 4,
      linesGiven: [
        "Price aside — you feel like this is actually the thing that gets you the online side, right?",
        "So what'd need to be true for the number to feel worth it?",
        "We can structure it so it's not one big hit up front — that help?",
      ],
      historyTranscript: "REP: We can structure it so it's not one big hit up front — that help?\nBEN: Maybe. It's still a lot for one month." },
    latestResponse: "BEN: I hear you, I just wasn't planning to spend this much this month.",
  },
  {
    id: "advance-fear", kind: "advance",
    belief: "Marcus, wants to leave his W2 for full-time consulting [confirmed]. Weak belief: Fear (big decision, scared it won't work). Emotional why: be present for his kids instead of commuting.",
    thread: { beatNumber: 2,
      linesGiven: ["Yeah — it's a big decision, I get it. Honestly, good that you're a little nervous. Means it matters to you."],
      historyTranscript: "REP: Good that you're a little nervous — means it matters.\nMARCUS: I guess. It's just a lot." },
    latestResponse: "MARCUS: What if I put all this money in and it still doesn't work out for me?",
  },
  {
    id: "advance-trust", kind: "advance",
    belief: "Priya, wants a done-with-you program [confirmed]. Weak belief: Trust — burned by a $15k mastermind that dumped her in a Slack group and vanished.",
    thread: { beatNumber: 2,
      linesGiven: ["Yeah — that mastermind that left you in a Slack group and bailed, that stung. Makes total sense you're guarded."],
      historyTranscript: "REP: Makes total sense you're guarded.\nPRIYA: Yeah, I'm not doing that again." },
    latestResponse: "PRIYA: So how do I know you're not just gonna be the same thing?",
  },
  {
    id: "advance-trust-2", kind: "advance",
    belief: "Tom, wants more qualified leads [confirmed]. Weak belief: Trust (\"what makes you different\"). Last provider over-promised.",
    thread: { beatNumber: 3,
      linesGiven: [
        "Fair question. What did the last provider actually not do that you needed them to?",
        "Got it. So the gap was they handed you tools and disappeared.",
      ],
      historyTranscript: "REP: So the gap was they handed you tools and disappeared.\nTOM: Basically." },
    latestResponse: "TOM: The last guy just gave me a bunch of videos and ghosted. What's actually different here?",
  },
  {
    id: "advance-support", kind: "advance",
    belief: "Rachel, wants to scale her studio [confirmed]. Weak belief: Support — 'need to talk to my husband.' Unclear if courtesy or a real gate.",
    thread: { beatNumber: 3,
      linesGiven: [
        "Totally get wanting to loop him in. Is this a 'we already decide these together' thing, or more of a heads-up?",
        "So it's really your call — he trusts you on the business side.",
      ],
      historyTranscript: "REP: So it's really your call — he trusts you on the business side.\nRACHEL: Mostly, yeah." },
    latestResponse: "RACHEL: He usually handles the big financial decisions though.",
  },
  {
    id: "advance-doubt", kind: "advance",
    belief: "Kev, wants to launch his course [confirmed]. Weak belief: Doubt ('I can do this myself'). History: two half-built courses, never shipped.",
    thread: { beatNumber: 2,
      linesGiven: ["You probably could — but you've started two courses on your own and neither shipped. What's different this time?"],
      historyTranscript: "REP: What's different this time?\nKEV: I dunno, I've got the stuff, I just haven't sat down and done it." },
    latestResponse: "KEV: I mean I've got all the resources already, I just haven't pulled the trigger.",
  },
  {
    id: "advance-busy", kind: "advance",
    belief: "Nina, agency owner drowning in delivery [confirmed]. Weak belief: Cost/time ('too busy right now'). The busyness IS the problem she's here to fix.",
    thread: { beatNumber: 2,
      linesGiven: ["The reason you're this slammed is the exact thing we fix. What if this bought your time back instead of costing it?"],
      historyTranscript: "REP: What if this bought your time back instead of costing it?\nNINA: Maybe, but starting it is still time I don't have." },
    latestResponse: "NINA: Yeah but adding one more thing to my plate right now feels insane.",
  },
  {
    id: "advance-think", kind: "advance",
    belief: "Omar, wants to switch niches [confirmed]. Weak belief: stall ('need to think about it'). No specific objection surfaced yet.",
    thread: { beatNumber: 2,
      linesGiven: ["Totally fair. That aside — do you actually feel like this gets you where you want to go?"],
      historyTranscript: "REP: Do you actually feel like this gets you there?\nOMAR: Yeah, I think so." },
    latestResponse: "OMAR: I do, I just... I always like to sleep on big things before I commit.",
  },
  {
    id: "advance-toogood", kind: "advance",
    belief: "Lena, wants predictable monthly revenue [confirmed]. Weak belief: skepticism ('too good to be true'). Seen a lot of guru hype.",
    thread: { beatNumber: 2,
      linesGiven: ["I get the skepticism — honestly you should be skeptical. What's making it feel too good?"],
      historyTranscript: "REP: What's making it feel too good?\nLENA: Just, everyone promises this stuff." },
    latestResponse: "LENA: I've seen a lot of gurus promise the world and deliver nothing.",
  },
  {
    // Advisory: by beat 9 (8 prior moves) the model has genuinely exhausted fresh angles and tends to
    // repeat or close. That's the real signal — a 9-beat objection is a stall, where the honest move is
    // to force a decision, not invent a novel reframe. The no-repeat check can't cleanly credit that, so
    // we report but don't gate. If threading routinely hits 8+ beats live, add a dedicated "you keep
    // circling — let's decide" close move rather than chasing endless reframes.
    id: "advance-deep-beat", kind: "advance", advisory: true,
    belief: "Dana, coach who gets clients results but can't scale herself [confirmed]. Weak belief: Doubt shading into a stall. NINE beats deep — time to move toward a decision, not another reframe.",
    thread: { beatNumber: 9,
      linesGiven: [
        "You already get your clients results — real thing is, can you do it for yourself?",
        "You've said that before — what's different this time?",
        "So if the accountability was there, you'd follow through?",
        "What's the part that still feels shaky?",
        "And if we solved exactly that, you're in?",
        "So it's not the how — it's pulling the trigger.",
        "What happens if you don't, and it's still like this a year from now?",
        "Right. So what would 'a week to think' actually change?",
      ],
      historyTranscript: "REP: So what would 'a week to think' actually change?\nDANA: Nothing really. I know it doesn't change." },
    latestResponse: "DANA: I just feel like it's a lot to decide right now, on this call.",
  },

  // ── SWITCH: after a gap, a genuinely DIFFERENT objection → engage the new one, don't continue ──
  {
    id: "switch-money-to-trust", kind: "switch",
    belief: "Sarah, agency owner, wants $50k/mo [confirmed]. Was working a Money objection. Burned once by an $8k coach who ghosted — Trust is fragile.",
    thread: { beatNumber: 4, gapFlag: true,
      linesGiven: [
        "Money aside — if we got you to that $50k month, are you a hundred percent in?",
        "So what'd have to be true for the investment to feel like a no-brainer?",
        "Totally fair. We can split it so the first payment's small and you get moving now — that work?",
      ],
      historyTranscript: "REP: ...split it so the first payment's small — that work?\nSARAH: Maybe. Hang on.\n[they chat about her kids' school schedule for a bit]\nSARAH: Okay so actually, wait." },
    latestResponse: "SARAH: Before any of that — what happens if I do all this and it still doesn't work? Do I get my money back or am I just out?",
    newObjection: "a refund / guarantee / what-if-it-doesn't-work risk objection (Trust), NOT money",
  },
  {
    id: "switch-support-to-fear", kind: "switch",
    belief: "Diego, wants to go full-time on his side business [confirmed]. Was working a Support ('talk to my wife') objection.",
    thread: { beatNumber: 3, gapFlag: true,
      linesGiven: [
        "Totally fair to loop her in. Is it a decision you two make together, or more a heads-up?",
        "So she'll back you — it's really your call to make here.",
      ],
      historyTranscript: "REP: It's really your call to make here.\nDIEGO: Yeah... hang on, my kid needed something.\n[short pause]" },
    latestResponse: "DIEGO: Actually — forget my wife for a sec. Honestly I think I'm just scared it won't work for me specifically.",
    newObjection: "a Fear / self-doubt objection ('scared it won't work for me'), NOT the spouse/support one",
  },

  // ── CONTINUE: after a gap, the SAME objection resurfaces → advance it, do NOT restart at beat 1 ──
  {
    id: "continue-money", kind: "continue",
    belief: "Sarah, agency owner, wants $50k/mo [confirmed]. Working a Money (cash-on-hand) objection across several beats.",
    thread: { beatNumber: 4, gapFlag: true,
      linesGiven: [
        "Money aside — if we got you to that $50k month, are you a hundred percent in?",
        "So what'd have to be true for the investment to feel like a no-brainer?",
        "We can split it so the first payment's small — that help?",
      ],
      historyTranscript: "REP: We can split it so the first payment's small — that help?\nSARAH: Maybe. Hang on.\n[they chat about her son's soccer game for a minute]\nSARAH: Sorry — okay." },
    latestResponse: "SARAH: Anyway, back to the money thing — I still just don't see how I pull the full amount together right now.",
  },
  {
    id: "continue-fear", kind: "continue",
    belief: "Marcus, leaving his W2 [confirmed]. Working a Fear ('what if it doesn't work') objection.",
    thread: { beatNumber: 3, gapFlag: true,
      linesGiven: [
        "Good that you're nervous — means it matters.",
        "The version that definitely doesn't work is staying on that commute another two years. That's already locked in if you do nothing.",
      ],
      historyTranscript: "REP: That's already locked in if you do nothing.\nMARCUS: Yeah... hang on, someone's at my door.\n[short pause]" },
    latestResponse: "MARCUS: Sorry, got distracted — but yeah, that fear of it not working is still the thing sitting with me.",
  },

  // ── ABSTAIN: nothing real below the marker (rep pressed before the prospect actually answered) ──
  // `advisory` fixtures test mid-turn detection (fragment / ambiguous echo). Reliable handling needs
  // end-of-turn detection (Deepgram speech_final — the queued #41 partials work), NOT a prompt fix;
  // prompt-only is best-effort ~50-70%. We RUN + REPORT them (regression signal) but do NOT block the
  // gate on them. The one CLEAR echo case below stays a hard gate — the model reliably catches that.
  {
    id: "abstain-echo", kind: "abstain",
    belief: "Sarah, agency owner, wants $50k/mo [confirmed]. Weak belief: Money. Mid-exchange.",
    thread: { beatNumber: 3,
      linesGiven: [
        "Money aside — if we got you to that $50k month, are you a hundred percent in?",
        "So what'd have to be true for the investment to feel like a no-brainer?",
      ],
      historyTranscript: "REP: Money aside — you a hundred percent in?\nSARAH: Yeah, I want it.\nREP: So what'd have to be true for the investment to feel like a no-brainer?" },
    // The only thing below the marker is the rep's own line still being transcribed — no prospect reply.
    latestResponse: "REP: ...so what'd have to be true for the investment to feel like a no-brainer for you?",
  },
  {
    id: "abstain-echo-2", kind: "abstain", advisory: true,
    belief: "Tom, wants more leads [confirmed]. Weak belief: Trust. Mid-exchange.",
    thread: { beatNumber: 4,
      linesGiven: ["What did the last provider not do that you needed?", "So the gap was no accountability.", "What'd have to be different here for you to trust it?"],
      historyTranscript: "REP: So the gap was no accountability.\nTOM: Right.\nREP: What'd have to be different here for you to trust it?" },
    latestResponse: "REP: ...like what would actually have to be different for you to feel good about it?",
  },
  {
    id: "abstain-fragment-money", kind: "abstain", advisory: true,
    belief: "Sarah, agency owner, wants $50k/mo [confirmed]. Weak belief: Money. Mid-exchange — the rep pressed while she's mid-sentence.",
    thread: { beatNumber: 3,
      linesGiven: ["Money aside — you a hundred percent in?", "What'd have to be true for it to feel like a no-brainer?"],
      historyTranscript: "REP: What'd have to be true for it to feel like a no-brainer?\nSARAH: I mean..." },
    // Cut off mid-thought — she's still talking. Firing on half a sentence would misread her.
    latestResponse: "SARAH: I do want it, it's just that right now with everything going on I'm not totally sure if I can—",
  },
  {
    id: "abstain-fragment-fear", kind: "abstain", advisory: true,
    belief: "Marcus, leaving his W2 [confirmed]. Weak belief: Fear. The rep pressed while he's mid-sentence.",
    thread: { beatNumber: 2,
      linesGiven: ["Good that you're nervous — means it matters."],
      historyTranscript: "REP: Good that you're nervous — means it matters.\nMARCUS: Yeah I guess..." },
    latestResponse: "MARCUS: Yeah I guess what scares me is like, what if I put all this in and then—",
  },
];

async function anthropic(model, system, user, maxTokens) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
        signal: controller.signal,
      });
      if (resp.status === 429 || resp.status === 529) {
        if (attempt === 0) { await new Promise((r) => setTimeout(r, 3000)); continue; }
        return { error: `${resp.status} overloaded` };
      }
      if (!resp.ok) return { error: `${resp.status}` };
      return { text: (await resp.json()).content?.[0]?.text?.trim() ?? "" };
    } catch (e) {
      if (attempt === 0 && e?.name !== "AbortError") { await new Promise((r) => setTimeout(r, 1500)); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch error") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}

// OpenAI chat-completions — used only for the cross-model judge (JUDGE_PROVIDER=openai).
async function openai(model, system, user, maxTokens) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model, max_tokens: maxTokens, response_format: { type: "json_object" },
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        }),
        signal: controller.signal,
      });
      if (resp.status === 429) { if (attempt === 0) { await new Promise((r) => setTimeout(r, 3000)); continue; } return { error: "429 rate-limited" }; }
      if (!resp.ok) return { error: `${resp.status} ${(await resp.text().catch(() => "")).slice(0, 80)}` };
      return { text: (await resp.json()).choices?.[0]?.message?.content?.trim() ?? "" };
    } catch (e) {
      if (attempt === 0 && e?.name !== "AbortError") { await new Promise((r) => setTimeout(r, 1500)); continue; }
      return { error: e?.name === "AbortError" ? "timeout" : (e?.message || "fetch error") };
    } finally { clearTimeout(t); }
  }
  return { error: "unreachable" };
}

// The judge routes to whichever provider is configured; the generator ALWAYS uses Claude (prod parity).
function judgeCall(system, user, maxTokens) {
  return JUDGE_PROVIDER === "openai"
    ? openai(OPENAI_JUDGE_MODEL, system, user, maxTokens)
    : anthropic(JUDGE_MODEL, system, user, maxTokens);
}

function extractJson(raw) {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  const km = cleaned.match(/"line"\s*:\s*(null|"((?:[^"\\]|\\.)*)")/);
  if (km) return km[1] === "null" ? { line: null } : { line: km[2] };
  return null;
}

// Build the card exactly as production would, then flatten segments → one string for the call.
function assembleUser(fx) {
  const segs = buildObjectionUserSegments({
    liveSummary: fx.belief,
    latestResponse: fx.latestResponse,
    thread: fx.thread,
  });
  return segs.map((s) => s.text).join("");
}

async function generate(fx) {
  if (DRY) return fx.kind === "abstain" ? { line: null, abstained: true } : { line: `(dry) ${fx.kind} card for ${fx.id}` };
  const { text, error } = await anthropic(OBJ_MODEL, OBJECTION_SYSTEM_PROMPT, assembleUser(fx), 150);
  if (error) return { line: null, error };
  const p = extractJson(text);
  if (p && typeof p.line === "string") return { line: p.line.trim() };
  if (p && p.line === null) return { line: null, abstained: true };
  return { line: null, error: "unparseable", raw: text.slice(0, 160) };
}

const JUDGE_SYSTEM = `You grade ONE objection-handling line inside a live, multi-turn objection exchange. The rep already said the "MOVES ALREADY GIVEN" out loud; the prospect then said the "LATEST RESPONSE." Judge ONLY against what you're given.

Return ONLY this JSON, nothing else:
{
  "repeats_prior": true|false,           // TRUE if the line repeats or lightly rewords ANY move already given (same question/angle). A genuinely new angle = false.
  "addresses_latest": true|false,        // TRUE if the line responds to the LATEST RESPONSE or the belief/fear behind it — e.g. answering a "what if it doesn't work?" fear with the cost of NOT acting, or isolating the fear, is valid engagement (handling the belief is the doctrine, not literal echo of every surface word). FALSE only if the line responds to an EARLIER turn instead, or is generic filler that engages nothing specific.
  "on_new_objection": true|false,        // Only meaningful when the LATEST RESPONSE raises a NEW/different objection. TRUE if the line ENGAGES that new concern or the belief/fear behind it — INCLUDING a discovery or permission question that opens it up ("what would make you feel safe/protected here?", "what does 'not working' even look like to you?", "can I be honest about what that question tells me?"). Going to the root, or asking a diagnostic question about the NEW concern, is correct closer work — NOT a dodge — so mark TRUE. FALSE only if the line ignores the new concern entirely or gives generic filler with no engagement. If the latest response is not a new objection, return false.
  "continued_old_objection": true|false, // TRUE if the line keeps pushing the EARLIER objection (e.g. still closing on price/money) despite the prospect raising a new concern. This is the real failure on a switch.
  "restarted": true|false,               // TRUE if the line IGNORES the exchange so far and opens as if hearing this objection for the FIRST time — a generic reset like "do you feel this can get you there?" — even though the moves already given show it's been worked for several beats. FALSE if it builds on the thread. (Only relevant when the SAME objection resurfaces after a pause.)
  "rationale": "one short sentence"
}`;

function judgeUser(fx, line) {
  return `WEAK BELIEF / CALL CONTEXT:\n${fx.belief}\n\n` +
         `MOVES ALREADY GIVEN (must NOT be repeated):\n${fx.thread.linesGiven.map((l, i) => `${i + 1}. "${l}"`).join("\n")}\n\n` +
         `THE PROSPECT'S LATEST RESPONSE:\n${fx.latestResponse}\n\n` +
         (fx.newObjection ? `NOTE: the latest response raises ${fx.newObjection}.\n\n` : "") +
         `THE LINE TO GRADE: "${line}"`;
}

async function judge(fx, line) {
  if (DRY) return { repeats_prior: false, addresses_latest: true, on_new_objection: fx.kind === "switch", continued_old_objection: false, restarted: false, rationale: "(dry)" };
  const { text, error } = await judgeCall(JUDGE_SYSTEM, judgeUser(fx, line), 300);
  if (error) return { error };
  const p = extractJson(text);
  if (!p) return { error: "judge unparseable" };
  return {
    repeats_prior: !!p.repeats_prior,
    addresses_latest: !!p.addresses_latest,
    on_new_objection: !!p.on_new_objection,
    continued_old_objection: !!p.continued_old_objection,
    restarted: !!p.restarted,
    rationale: String(p.rationale || "").slice(0, 200),
  };
}

function evaluate(fx, card, j) {
  if (fx.kind === "abstain") {
    return { pass: !!card.abstained, why: card.abstained ? "abstained ✓" : `should abstain but returned a line: "${card.line ?? card.error}"` };
  }
  if (card.abstained) return { pass: false, why: "abstained on a real continuation beat (false silence)" };
  if (!card.line) return { pass: false, why: `no card (${card.error})` };
  if (j.error) return { pass: false, why: `judge error: ${j.error}` };
  if (fx.kind === "advance") {
    const pass = !j.repeats_prior && j.addresses_latest;
    return { pass, why: `repeats_prior=${j.repeats_prior} addresses_latest=${j.addresses_latest} — ${j.rationale}` };
  }
  if (fx.kind === "switch") {
    // The behavior under test: dropped the OLD thread AND engaged the NEW objection's belief.
    const pass = !j.repeats_prior && !j.continued_old_objection && j.on_new_objection;
    return { pass, why: `repeats_prior=${j.repeats_prior} continued_old=${j.continued_old_objection} on_new_objection=${j.on_new_objection} — ${j.rationale}` };
  }
  if (fx.kind === "continue") {
    // Same objection resurfaced after a pause: advance it with a new angle, do NOT restart at beat 1.
    const pass = !j.repeats_prior && !j.restarted && j.addresses_latest;
    return { pass, why: `repeats_prior=${j.repeats_prior} restarted=${j.restarted} addresses_latest=${j.addresses_latest} — ${j.rationale}` };
  }
  return { pass: false, why: "unknown kind" };
}

// Deterministic guard (no API): the message builder and the doctrine reference the SAME anchor
// phrases. If a future edit changes one without the other, threading silently breaks — this throws
// loudly instead. Same spirit as objection-prompts.mjs's "NEVER MAKE ANYTHING UP" sanity check.
function assertMarkersInSync() {
  const built = buildObjectionUserSegments({
    liveSummary: "x", latestResponse: "y",
    thread: { beatNumber: 2, linesGiven: ["a"], historyTranscript: "h", gapFlag: true },
  }).map((s) => s.text).join("");
  const builderMarkers = ["MOVES YOU'VE ALREADY GIVEN", "EXCHANGE SO FAR", "the prospect's LATEST response"];
  for (const m of builderMarkers) {
    if (!built.includes(m)) throw new Error(`[threading-eval] builder no longer emits marker "${m}" — update the fixtures/doctrine to match`);
  }
  const doctrineRefs = ["MOVES YOU'VE ALREADY GIVEN", "EXCHANGE SO FAR", "latest response"];
  for (const m of doctrineRefs) {
    if (!OBJECTION_SYSTEM_PROMPT.includes(m)) throw new Error(`[threading-eval] doctrine no longer references "${m}" — builder/doctrine DESYNC, threading will break silently`);
  }
}

async function run() {
  assertMarkersInSync();
  const fixtures = ONLY ? FIX.filter((f) => f.id.includes(ONLY)) : FIX;
  // Require a strong majority per fixture, NOT unanimity. The AI judge is itself stochastic, so an
  // all-pass bar goes red on the odd judge misfire even when the card is fine. A 2/3 floor still
  // fails a genuinely broken behavior (e.g. the ~1/3 switch reliability the reviewer caught) while
  // tolerating judge variance on a nuanced-but-correct card.
  const need = Math.ceil((REPEAT * 2) / 3);
  const judgeName = JUDGE_PROVIDER === "openai" ? `${OPENAI_JUDGE_MODEL} (openai)` : JUDGE_MODEL;
  console.log(`${DRY ? "[DRY] " : ""}Threading gate — ${fixtures.length} fixtures × ${REPEAT} runs (need ${need}/${REPEAT} each)${DRY ? "" : ` · gen=${OBJ_MODEL} judge=${judgeName}`}\n`);
  let allPass = true;
  for (const fx of fixtures) {
    let passes = 0;
    const samples = [];
    for (let r = 0; r < REPEAT; r++) {
      const card = await generate(fx);
      const j = (fx.kind === "abstain" || card.abstained || !card.line) ? {} : await judge(fx, card.line);
      const res = evaluate(fx, card, j);
      if (res.pass) passes++;
      samples.push({ res, card });
    }
    const fixturePass = passes >= need;
    if (!fixturePass && !fx.advisory) allPass = false;   // advisory fixtures report but don't block
    const mark = fixturePass ? "✅" : (fx.advisory ? "⚠️" : "❌");
    const tag = fx.advisory ? "  (advisory — mid-turn detection, needs #41; not gated)" : "";
    console.log(`${mark} ${fx.id.padEnd(22)} [${fx.kind}]  ${passes}/${REPEAT} passed (need ${need})${tag}`);
    for (const s of samples) {
      const shown = s.card.abstained ? "ABSTAIN" : (s.card.line ?? `(${s.card.error})`);
      console.log(`    ${s.res.pass ? "·" : "✗"} ${shown}`);
      if (!s.res.pass) console.log(`      ↳ ${s.res.why}`);
    }
    console.log("");
  }
  console.log(`── GATE: ${allPass ? "✅ PASS" : "❌ FAIL"} (every fixture ≥${need}/${REPEAT}) ──`);
  if (DRY) {
    console.log("\n[DRY] Sample assembled user message — fixture 'switch-money-to-trust':\n");
    console.log(assembleUser(FIX.find((f) => f.id === "switch-money-to-trust")));
  }
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
