/**
 * voice-batch.mjs — the Phase 1 VOICE-GRIND tool. Generates DIRECT-ONLY (base voice) cards
 * for Sebastian to tear apart. No dial levels, no LLM judges — Sebastian IS the judge.
 *
 *   node scripts/voice-batch.mjs            # generate the batch → tasks/voice-batch.md
 *   DRY=1 node scripts/voice-batch.mjs      # no API calls — prove wiring
 *   GEN_MODEL=claude-sonnet-4-6 …           # override the generator model
 *   LIMIT=4 node scripts/voice-batch.mjs    # first N fixtures per family (quick smoke)
 *
 * Uses the REAL production builders (objection-prompt.mjs / dig-prompt.mjs) at the `direct`
 * level, so the batch is exactly the shipped base voice. Runs the deterministic tic gate
 * (tic-gate.mjs) so any mechanical tic is flagged before Sebastian reads it.
 *
 * OUTPUT: tasks/voice-batch.md — one card per fixture with a ✓ / ✗ / rewrite slot. Sebastian
 * fills the Verdict + Rewrite inline; next session Claude ingests the rewrites into the base
 * prompt few-shot anchors + the tic-gate ban-list. This is the human-in-the-loop reward signal.
 *
 * FIXTURES live in THIS file on purpose — the grind adds/edits situations constantly; keeping
 * them here (not shared with the dial eval) means editing the batch never risks the dial gate.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildObjectionSystemPrompt, buildObjectionUserSegments } from "../src/lib/wingman/objection-prompt.mjs";
import { buildDigSystemPrompt, buildDigUserSegments } from "../src/lib/wingman/dig-prompt.mjs";
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
const LIMIT     = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const POOL      = process.env.POOL ? Number(process.env.POOL) : 4;
const KEY       = process.env.ANTHROPIC_API_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const lim = (arr) => (LIMIT === Infinity ? arr : arr.slice(0, LIMIT));

async function mapPool(items, fn, pool = POOL) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(pool, items.length)) }, worker));
  return out;
}

async function anthropic(system, user, maxTokens = 150) {
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
function parseLine(text) {
  const cleaned = String(text).replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let p = null;
  try { p = JSON.parse(cleaned); } catch { const m = cleaned.match(/\{[\s\S]*\}/); if (m) { try { p = JSON.parse(m[0]); } catch { /* */ } } }
  if (p && typeof p.line === "string" && p.line.trim()) return p.line.trim();
  if (p && p.line === null) return null;
  const m = String(text).match(/"line"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (m && m[1].trim()) return m[1].replace(/\\"/g, '"').replace(/\\n/g, " ").trim();
  if (/"line"\s*:\s*null/.test(String(text))) return null;
  return "(unparseable)";
}

// ── FIXTURES (direct/base voice grind — edit freely; these ARE the coverage set) ──
const OBJ = [
  { id: "money-tight", belief: "1 Pain ✅ — hates the grind\n4 Desire ✅ — wants $30k months\n5 Money ⚠️ — flinched at price", latest: "Honestly that's a lot of money right now. I don't know." },
  { id: "money-anchor", belief: "1 Pain ✅\n4 Desire ✅\n5 Money ⚠️ — sticker shock", latest: "I mean… that's a lot more than I was expecting to spend on this." },
  { id: "think", belief: "1 Pain 🟡 — busy, overwhelmed\n7 Trust ⬜", latest: "Yeah this sounds good, let me think about it and get back to you." },
  { id: "trust-burned", belief: "7 Trust ⚠️ — burned by a past coach\n1 Pain ✅ — stuck at $10k", latest: "I've done a coaching thing before and it was a waste. How's this any different?" },
  { id: "fear", belief: "1 Pain ✅ — miserable in job\n4 Desire ✅ — wants to go full-time\n5 Money 🟡", latest: "I mean… this is a big decision. What if it doesn't work out for me?" },
  { id: "partner", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⚠️ — spouse not on call", latest: "I'd need to talk to my wife before I make a decision like this." },
  { id: "timing", belief: "1 Pain ✅\n3 Cost ⬜\n4 Desire ✅", latest: "Now's just not a great time for me. Maybe next quarter would be better." },
  { id: "send-info", belief: "1 Pain 🟡\n7 Trust ⬜", latest: "Can you just send me some information and I'll look it over on my own time?" },
  { id: "diy", belief: "1 Pain ✅ — stalled 18 months\n2 Doubt ⚠️ — thinks he can DIY", latest: "Honestly I feel like I could probably just figure this out on my own." },
  { id: "competitor", belief: "1 Pain ✅\n7 Trust 🟡 — comparison shopping", latest: "I'm actually looking at a couple other options too, so I'm not sure yet." },
  { id: "skeptic", belief: "1 Pain ✅\n2 Doubt ⚠️ — doubts it'll work for HIM", latest: "How do I actually know this'll work for someone like me?" },
  { id: "wishy-washy", belief: "1 Pain 🟡\n4 Desire 🟡 — lukewarm all call", latest: "Yeah… maybe. I don't know, I'm not really sure about it." },
  { id: "too-busy", belief: "1 Pain ✅ — overwhelmed IS the problem\n3 Cost ⬜", latest: "I'm slammed right now, I really don't have time to take on something new." },
  { id: "results-doubt", belief: "1 Pain ✅\n2 Doubt ⚠️\n7 Trust 🟡", latest: "I've seen a lot of people not really get results from stuff like this, you know?" },
];
const DIG = [
  { id: "open-pain", belief: "1 Pain ⬜\n4 Desire ⬜", latest: "Things are just kind of stuck right now, you know?" },
  { id: "deepen-desire", belief: "1 Pain ✅\n4 Desire 🟡 — 'more money', no number", latest: "I just want to be making more money, more consistently." },
  { id: "cost", belief: "1 Pain ✅ — stuck 2 years\n3 Cost ⬜", latest: "Yeah it's been about two years at this same spot honestly." },
  { id: "doubt-diy", belief: "1 Pain ✅\n2 Doubt 🟡 — tried on own", latest: "I've bought a few courses and tried to do it myself but it just hasn't clicked." },
  { id: "trust-why", belief: "1 Pain ✅\n7 Trust ⬜", latest: "I've tried programs before that overpromised, so I'm a little cautious." },
  { id: "support", belief: "1 Pain ✅\n4 Desire ✅\n6 Support ⬜", latest: "Yeah this is the kind of thing I'd want to get right." },
  { id: "money-qualifier", belief: "1 Pain ✅\n2 Doubt ✅\n4 Desire ✅\n5 Money ⬜ — other beliefs built", latest: "Yeah honestly everything you're saying makes a lot of sense to me." },
  { id: "vague", belief: "1 Pain 🟡 — vague\n4 Desire ⬜", latest: "I don't know, I just want things to be better than they are now." },
];

async function genObj(fx) {
  if (DRY) return `(dry) ${fx.latest.slice(0, 40)}`;
  const system = buildObjectionSystemPrompt("direct");
  const user = flatten(buildObjectionUserSegments({ liveSummary: fx.belief, latestResponse: fx.latest }));
  const { text, error } = await anthropic(system, user);
  return error ? `(error ${error})` : parseLine(text);
}
async function genDig(fx) {
  if (DRY) return `(dry) ${fx.latest.slice(0, 40)}`;
  const system = buildDigSystemPrompt("direct");
  const user = flatten(buildDigUserSegments({ liveSummary: fx.belief, latestResponse: fx.latest }));
  const { text, error } = await anthropic(system, user);
  return error ? `(error ${error})` : parseLine(text);
}

/**
 * renderGradesheet — body-only HTML (no <html>/<head>/<body>) for a clickable "fill out a test"
 * grading sheet. Publishable directly as a Claude Artifact AND openable locally in a browser.
 * All card data is embedded (self-contained; the Artifact CSP blocks any external fetch). Marks
 * persist to localStorage; "Copy results" assembles the exact voice-batch.md format to paste back.
 */
function renderGradesheet(records, meta) {
  const dataJson = JSON.stringify(records).replace(/</g, "\\u003c");
  const keyStr = `wingman-voicebatch-${meta.generated}`.replace(/[^a-z0-9-]/gi, "-");
  return `<title>Wingman Voice Batch — Grade Sheet</title>
<style>
:root{
  --bg:#f5f6f9; --surface:#ffffff; --surface2:#fbfcfe; --ink:#161a21; --muted:#5b6472;
  --line:#e3e7ee; --accent:#2f6bff; --accent-soft:#eaf0ff;
  --keep:#15873f; --keep-bg:#e9f6ee; --rewrite:#b5730a; --rewrite-bg:#fbf1df; --kill:#d21b4b; --kill-bg:#fdebf0;
  --radius:12px; --shadow:0 1px 2px rgba(20,26,33,.06),0 4px 16px rgba(20,26,33,.05);
}
@media (prefers-color-scheme:dark){:root{
  --bg:#0d1016; --surface:#161b23; --surface2:#1b212b; --ink:#e8ebf1; --muted:#96a1b2;
  --line:#262d39; --accent:#6a97ff; --accent-soft:#1a2438;
  --keep:#4fce7f; --keep-bg:#132a1d; --rewrite:#e5a83c; --rewrite-bg:#2c2413; --kill:#ff6b93; --kill-bg:#2e1620;
  --shadow:0 1px 2px rgba(0,0,0,.35),0 6px 20px rgba(0,0,0,.3);
}}
:root[data-theme="light"]{
  --bg:#f5f6f9; --surface:#ffffff; --surface2:#fbfcfe; --ink:#161a21; --muted:#5b6472;
  --line:#e3e7ee; --accent:#2f6bff; --accent-soft:#eaf0ff;
  --keep:#15873f; --keep-bg:#e9f6ee; --rewrite:#b5730a; --rewrite-bg:#fbf1df; --kill:#d21b4b; --kill-bg:#fdebf0;
}
:root[data-theme="dark"]{
  --bg:#0d1016; --surface:#161b23; --surface2:#1b212b; --ink:#e8ebf1; --muted:#96a1b2;
  --line:#262d39; --accent:#6a97ff; --accent-soft:#1a2438;
  --keep:#4fce7f; --keep-bg:#132a1d; --rewrite:#e5a83c; --rewrite-bg:#2c2413; --kill:#ff6b93; --kill-bg:#2e1620;
}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;line-height:1.5;margin:0;-webkit-font-smoothing:antialiased}
.wrap{max-width:760px;margin:0 auto;padding:0 20px 140px}
.topbar{position:sticky;top:0;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);margin:0 -20px;padding:14px 20px}
.topbar-inner{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:16px}
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
.sec{margin-top:26px}
.sec > h2{font-size:12px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:0 2px 12px;display:flex;align-items:center;gap:9px}
.sec > h2::after{content:"";flex:1;height:1px;background:var(--line)}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px 16px 14px;margin-bottom:14px;transition:border-color .15s}
.card[data-v="keep"]{border-color:color-mix(in srgb,var(--keep) 55%,var(--line))}
.card[data-v="rewrite"]{border-color:color-mix(in srgb,var(--rewrite) 55%,var(--line))}
.card[data-v="kill"]{border-color:color-mix(in srgb,var(--kill) 55%,var(--line))}
.chead{display:flex;align-items:center;gap:8px;margin-bottom:11px}
.cid{font-size:12px;font-weight:600;letter-spacing:.04em;color:var(--muted);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.badge{font-size:10.5px;font-weight:600;letter-spacing:.03em;padding:2px 7px;border-radius:20px;border:1px solid}
.badge.hard{color:var(--kill);border-color:var(--kill);background:var(--kill-bg)}
.badge.soft{color:var(--rewrite);border-color:var(--rewrite);background:var(--rewrite-bg)}
.lbl{font-size:10px;font-weight:650;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
.prospect{font-style:italic;color:var(--muted);font-size:14px;margin-bottom:12px;padding-left:11px;border-left:2px solid var(--line)}
.line{font-size:16.5px;font-weight:500;line-height:1.42;color:var(--ink);margin-bottom:14px;letter-spacing:-.005em}
.line.abstain{font-weight:400;font-style:italic;color:var(--muted)}
.controls{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.vbtn{appearance:none;font:inherit;font-size:13px;font-weight:600;padding:9px 6px;border-radius:9px;border:1px solid var(--line);background:var(--surface2);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .12s}
.vbtn:hover{border-color:var(--muted)}
.vbtn .ic{font-size:14px;line-height:1}
.vbtn[aria-pressed="true"][data-v="keep"]{background:var(--keep-bg);border-color:var(--keep);color:var(--keep)}
.vbtn[aria-pressed="true"][data-v="rewrite"]{background:var(--rewrite-bg);border-color:var(--rewrite);color:var(--rewrite)}
.vbtn[aria-pressed="true"][data-v="kill"]{background:var(--kill-bg);border-color:var(--kill);color:var(--kill)}
.extra{margin-top:11px;display:none}
.extra.show{display:block}
.extra textarea{width:100%;font:inherit;font-size:14px;color:var(--ink);background:var(--surface2);border:1px solid var(--line);border-radius:9px;padding:9px 11px;resize:vertical;min-height:44px;margin-top:8px}
.extra textarea:focus{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.extra .tl{font-size:10px;font-weight:650;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.footer{position:fixed;left:0;right:0;bottom:0;z-index:20;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(10px);border-top:1px solid var(--line);padding:12px 20px}
.footer-inner{max-width:760px;margin:0 auto;display:flex;align-items:center;gap:12px}
.footer .note{font-size:12.5px;color:var(--muted);flex:1}
.footer .btn{padding:10px 18px;font-size:14px}
#output{display:none;width:100%;max-width:760px;margin:16px auto 0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;color:var(--ink);background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:12px;min-height:180px}
.toast{position:fixed;left:50%;bottom:74px;transform:translateX(-50%) translateY(8px);background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;padding:9px 16px;border-radius:9px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;z-index:40}
.toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.vbtn:focus-visible,.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:520px){.brand .sub{display:none}.footer .note{display:none}}
</style>
<div class="topbar"><div class="topbar-inner">
  <div class="brand"><h1>Wingman Voice Batch</h1><div class="sub" id="subline"></div></div>
  <div class="count" id="count">0 / 0</div>
  <button class="btn ghost" id="copyTop">Copy results</button>
</div><div class="progress"><i id="bar"></i></div></div>
<div class="wrap">
  <p class="intro">Read each card as the closer and mark it — <b>Keep</b> if you'd say it, <b>Rewrite</b> to give me the better line, <b>Kill</b> if it's the wrong move. Add a one-line <b>why</b> on the reds. Your marks save automatically. When you're done, hit <b>Copy results</b> and paste the block back to me.</p>
  <div id="list"></div>
</div>
<div class="footer"><div class="footer-inner">
  <div class="note" id="fnote">0 of 0 marked</div>
  <button class="btn" id="copyBtn">Copy results to paste back</button>
</div><textarea id="output" readonly></textarea></div>
<div class="toast" id="toast">Copied — paste it back to me</div>
<script>
var CARDS = ${dataJson};
var KEY = "${keyStr}";
var GEN = "${meta.generated}", MODEL = "${meta.model}";
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
document.getElementById("subline").textContent = "Generated " + GEN + " · " + MODEL + " · direct base voice";
var VERBS = [["keep","✓","Keep"],["rewrite","✎","Rewrite"],["kill","✗","Kill"]];
var list = document.getElementById("list");
var lastFam = null;
CARDS.forEach(function(c){
  if(c.fam !== lastFam){
    lastFam = c.fam;
    list.appendChild(el("div",{class:"sec"},[ el("h2",{text:c.fam + " — direct"}) ]));
  }
  var sec = list.lastChild;
  var st = state[c.id] || (state[c.id] = { verdict:null, rewrite:"", why:"" });
  var badges = [];
  if(c.hard && c.hard.length) badges.push(el("span",{class:"badge hard",text:"TIC: " + c.hard.join(", ")}));
  if(c.soft && c.soft.length) badges.push(el("span",{class:"badge soft",text:"tic? " + c.soft.join(", ")}));
  var rewriteWrap = el("div",{class:"extra"},[
    el("div",{class:"tl",text:"Your rewrite"}),
    el("textarea",{placeholder:"How you'd actually say it…", oninput:function(e){ st.rewrite = e.target.value; save(); }})
  ]);
  rewriteWrap.querySelector("textarea").value = st.rewrite || "";
  var whyWrap = el("div",{class:"extra"},[
    el("div",{class:"tl",text:"Why (one line)"}),
    el("textarea",{placeholder:"What's wrong / what it should do…", oninput:function(e){ st.why = e.target.value; save(); }})
  ]);
  whyWrap.querySelector("textarea").value = st.why || "";
  var btns = VERBS.map(function(v){
    return el("button",{class:"vbtn","data-v":v[0],type:"button","aria-pressed":"false", onclick:function(){ setVerdict(c.id, v[0]); }},[
      el("span",{class:"ic",text:v[1]}), v[2]
    ]);
  });
  var card = el("div",{class:"card","data-id":c.id},[
    el("div",{class:"chead"},[ el("span",{class:"cid",text:c.id}) ].concat(badges)),
    el("div",{class:"lbl",text:"Prospect"}),
    el("div",{class:"prospect",text:c.prospect}),
    el("div",{class:"lbl",text:"Wingman says"}),
    el("div",{class: c.line === null ? "line abstain" : "line", text: c.line === null ? "(abstain — take the close)" : c.line}),
    el("div",{class:"controls"}, btns),
    rewriteWrap, whyWrap
  ]);
  card._btns = btns; card._rw = rewriteWrap; card._wy = whyWrap;
  sec.appendChild(card);
  paint(c.id);
});
function cardEl(id){ return list.querySelector('.card[data-id="' + id + '"]'); }
function paint(id){
  var st = state[id] || {}; var card = cardEl(id); if(!card) return;
  card.setAttribute("data-v", st.verdict || "");
  card._btns.forEach(function(b){ b.setAttribute("aria-pressed", b.getAttribute("data-v") === st.verdict ? "true" : "false"); });
  card._rw.className = "extra" + (st.verdict === "rewrite" ? " show" : "");
  card._wy.className = "extra" + (st.verdict === "rewrite" || st.verdict === "kill" ? " show" : "");
}
function setVerdict(id, v){
  var st = state[id] || (state[id] = { verdict:null, rewrite:"", why:"" });
  st.verdict = (st.verdict === v ? null : v);
  save(); paint(id); updateProgress();
  if(st.verdict === "rewrite"){ var t = cardEl(id)._rw.querySelector("textarea"); if(t) t.focus(); }
}
function marked(){ return CARDS.filter(function(c){ return state[c.id] && state[c.id].verdict; }).length; }
function updateProgress(){
  var m = marked(), total = CARDS.length;
  document.getElementById("count").innerHTML = "<b>" + m + "</b> / " + total;
  document.getElementById("fnote").textContent = m + " of " + total + " marked" + (m === total ? " — all done ✓" : "");
  document.getElementById("bar").style.width = (total ? (m/total*100) : 0) + "%";
}
function assemble(){
  var out = ["# Wingman Voice Batch — MARKED", "", "Generated " + GEN + " · gen=" + MODEL + " · marked in grade sheet", ""];
  var fam = null;
  CARDS.forEach(function(c){
    if(c.fam !== fam){ fam = c.fam; out.push("## " + c.fam + " — direct", ""); }
    var st = state[c.id] || {};
    var v = st.verdict === "keep" ? "✓" : st.verdict === "kill" ? "✗" : st.verdict === "rewrite" ? "✎ (rewrite)" : "";
    out.push("### " + c.id);
    out.push('Prospect: "' + c.prospect + '"');
    out.push("Card: **" + (c.line === null ? "(abstain — take the close)" : c.line) + "**");
    out.push("Verdict: " + v);
    out.push("Rewrite: " + (st.rewrite || "").trim());
    out.push("Why: " + (st.why || "").trim());
    out.push("");
  });
  return out.join("\\n");
}
function copyResults(){
  var text = assemble();
  var ta = document.getElementById("output");
  ta.value = text; ta.style.display = "block";
  ta.focus(); ta.select();
  var done = function(){ var t = document.getElementById("toast"); t.classList.add("show"); setTimeout(function(){ t.classList.remove("show"); }, 2200); };
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(done, done); }
  else { try { document.execCommand("copy"); } catch(e){} done(); }
}
document.getElementById("copyBtn").addEventListener("click", copyResults);
document.getElementById("copyTop").addEventListener("click", copyResults);
updateProgress();
</script>`;
}

async function run() {
  if (!DRY && !KEY) { console.error("Missing ANTHROPIC_API_KEY (or DRY=1)"); process.exit(1); }
  const obj = lim(OBJ), dig = lim(DIG);
  console.log(`Generating ${obj.length} objection + ${dig.length} dig DIRECT cards · gen=${GEN_MODEL}${DRY ? " · DRY" : ""}…`);
  const objLines = await mapPool(obj, genObj);
  const digLines = await mapPool(dig, genDig);

  const md = [
    "# Wingman Voice Batch — DIRECT (base voice) · read as the closer",
    "",
    `Generated ${new Date().toISOString().slice(0, 16).replace("T", " ")} · gen=${GEN_MODEL}. Base/default voice only — no dial levels.`,
    "",
    "**How to mark each card:** set `Verdict:` to `✓` (I'd say it), `✗` (wrong move — kill it), or write your",
    "rewrite after `Rewrite:`. Add one line of `Why:` when you red-light or rewrite. 🚩TIC = the gate caught a",
    "mechanical tic (should be none on a clean base); ⚠️tic? = an advisory (e.g. dig's personal pre-frame).",
    "",
  ];
  const section = (title, fam, fixtures, lines) => {
    md.push(`## ${title}`, "");
    fixtures.forEach((fx, i) => {
      const line = lines[i];
      const t = typeof line === "string" ? scanTics(line, fam === "obj" ? "objection" : "dig") : { hard: [], soft: [] };
      const flags = [t.hard.length ? `🚩TIC(${t.hard.join(",")})` : "", t.soft.length ? `⚠️tic?(${t.soft.join(",")})` : ""].filter(Boolean).join(" ");
      md.push(`### ${fx.id}${flags ? "  " + flags : ""}`);
      md.push(`Prospect: _"${fx.latest}"_`);
      md.push(`Card: **${line === null ? "(abstain / take the close)" : line}**`);
      md.push(`Verdict: `);
      md.push(`Rewrite: `);
      md.push(`Why: `);
      md.push("");
    });
  };
  section("Objection — direct", "obj", obj, objLines);
  section("Dig — direct", "dig", dig, digLines);

  // Structured records for the clickable grade sheet (same data as the .md).
  const rec = (fam, fixtures, lines) => fixtures.map((fx, i) => {
    const line = lines[i];
    const t = typeof line === "string" ? scanTics(line, fam === "obj" ? "objection" : "dig") : { hard: [], soft: [] };
    return { fam: fam === "obj" ? "Objection" : "Dig", id: fx.id, prospect: fx.latest, line: line === null ? null : line, hard: t.hard, soft: t.soft };
  });
  const records = [...rec("obj", obj, objLines), ...rec("dig", dig, digLines)];
  const generated = new Date().toISOString().slice(0, 16).replace("T", " ");

  try { mkdirSync(OUT_DIR, { recursive: true }); } catch { /* */ }
  writeFileSync(join(OUT_DIR, "voice-batch.md"), md.join("\n"));
  writeFileSync(join(OUT_DIR, "voice-batch.gradesheet.html"), renderGradesheet(records, { generated, model: GEN_MODEL }));
  console.log(`Wrote tasks/voice-batch.md + voice-batch.gradesheet.html (${records.length} cards).`);
}
run().catch((e) => { console.error(e); process.exit(1); });
