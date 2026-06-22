/**
 * kb-ab-build-grader.mjs — generates a self-contained blind grading page.
 *
 *   node scripts/kb-ab-build-grader.mjs
 *
 * Reads tasks/kb-ab-test/raw-results.json and emits tasks/kb-ab-test/grader.html
 * with ONLY the blind fields inlined (id, objection, transcript, and the 4 cards
 * in their already-randomized order — headline + subtext only). The card→arm
 * mapping and all KB info stay OUT of the HTML, so the page can't leak which card
 * is the KB one even if you view source.
 *
 * Open grader.html in a browser, click the card you prefer per objection, jot
 * optional thoughts, then "Copy results" and paste the JSON back to Claude.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "../tasks/kb-ab-test");

const raw = JSON.parse(readFileSync(join(DIR, "raw-results.json"), "utf8"));

// Strip to blind fields ONLY. Cards stay in r.order (same order the answer key
// records), so the position the user clicks maps back to an arm in the scorer.
const blind = raw.map((r) => ({
  id: r.id,
  objection: r.objection,
  context: r.context,
  transcript: r.transcript,
  cards: r.order.map((armKey) => {
    const c = r.arms[armKey];
    return c.error
      ? { headline: "(generation failed)", subtext: "" }
      : { headline: c.headline, subtext: c.subtext };
  }),
}));

const BUILD_ID = String(Date.now());
const DATA_JSON = JSON.stringify(blind).replace(/</g, "\\u003c");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Wingman — KB A/B Blind Grader</title>
<style>
  :root {
    --bg: #0a0c11; --panel: #12151d; --panel2: #161a24; --line: #232838;
    --text: #e8ebf2; --muted: #8a93a6; --muted2: #5f6678;
    --accent: #7c5cff; --accent-soft: rgba(124,92,255,.14); --accent-line: rgba(124,92,255,.55);
    --good: #34d399; --warn: #f5a524;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif; }
  .wrap { max-width: 740px; margin: 0 auto; padding: 28px 20px 80px; }
  .top { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 6px; }
  .brand { font-weight: 700; letter-spacing: .2px; }
  .brand span { color: var(--accent); }
  .count { color: var(--muted); font-variant-numeric: tabular-nums; font-size: 13px; }
  .bar { height: 6px; background: var(--panel2); border-radius: 99px; overflow: hidden; margin: 10px 0 22px; }
  .bar > i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, var(--accent), #a98bff);
    border-radius: 99px; transition: width .25s ease; }
  .obj-label { color: var(--muted); font-size: 12.5px; text-transform: uppercase; letter-spacing: .12em; }
  .obj { font-size: 22px; font-weight: 700; margin: 4px 0 16px; }
  .setup { background: var(--panel); border: 1px solid var(--line); border-radius: 12px;
    padding: 14px 16px; margin-bottom: 22px; }
  .setup .ln { display: flex; gap: 10px; padding: 3px 0; color: var(--text); }
  .setup .who { color: var(--muted2); min-width: 64px; font-weight: 600; font-size: 13px; padding-top: 1px; }
  .hint { color: var(--muted); font-size: 13px; margin: 0 0 12px; }
  .lbl { color: var(--muted2); font-size: 11.5px; text-transform: uppercase; letter-spacing: .12em; margin: 0 0 7px; }
  .disco { background: var(--panel2); border: 1px solid var(--line); border-left: 3px solid var(--accent-line);
    border-radius: 10px; padding: 12px 14px; margin-bottom: 18px; font-size: 13.5px; color: var(--muted); }
  .disco .ln { padding: 2px 0; }
  .cards { display: grid; gap: 12px; }
  .card { position: relative; text-align: left; width: 100%; cursor: pointer;
    background: var(--panel); border: 1.5px solid var(--line); border-radius: 14px;
    padding: 16px 16px 16px 48px; color: var(--text); transition: border-color .12s, background .12s, transform .06s; }
  .card:hover { border-color: #36405a; background: var(--panel2); }
  .card:active { transform: translateY(1px); }
  .card .num { position: absolute; left: 14px; top: 15px; width: 22px; height: 22px; border-radius: 7px;
    background: var(--panel2); border: 1px solid var(--line); color: var(--muted);
    font-size: 12px; font-weight: 700; display: grid; place-items: center; }
  .card .hl { font-size: 16.5px; font-weight: 700; margin-bottom: 5px; }
  .card .sub { color: var(--muted); font-size: 14px; }
  .card.sel { border-color: var(--accent-line); background: var(--accent-soft); }
  .card.sel .num { background: var(--accent); border-color: var(--accent); color: #fff; }
  .card.sel::after { content: "✓ preferred"; position: absolute; right: 14px; top: 14px;
    color: var(--accent); font-size: 12px; font-weight: 700; }
  .weak { margin-top: 12px; }
  .weak button { background: none; border: 1px dashed var(--line); color: var(--muted);
    border-radius: 10px; padding: 9px 12px; cursor: pointer; font-size: 13px; width: 100%; }
  .weak button:hover { border-color: var(--warn); color: var(--warn); }
  .weak button.sel { border-style: solid; border-color: var(--warn); color: var(--warn); background: rgba(245,165,36,.08); }
  .notes { margin-top: 18px; }
  .notes label { display: block; color: var(--muted); font-size: 13px; margin-bottom: 6px; }
  textarea { width: 100%; min-height: 60px; resize: vertical; background: var(--panel);
    border: 1px solid var(--line); border-radius: 10px; color: var(--text); padding: 10px 12px;
    font: inherit; font-size: 14px; }
  textarea:focus { outline: none; border-color: var(--accent-line); }
  .nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 26px; }
  .btn { border: 1px solid var(--line); background: var(--panel2); color: var(--text);
    border-radius: 11px; padding: 11px 20px; font-size: 14.5px; font-weight: 600; cursor: pointer; }
  .btn:hover { border-color: #36405a; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .btn.primary:hover { filter: brightness(1.07); }
  .btn:disabled { opacity: .4; cursor: not-allowed; }
  .kbd { color: var(--muted2); font-size: 12px; text-align: center; margin-top: 14px; }
  .kbd b { color: var(--muted); background: var(--panel2); border: 1px solid var(--line);
    border-radius: 5px; padding: 1px 6px; font-weight: 600; }
  /* summary */
  .sum h2 { font-size: 22px; margin: 0 0 6px; }
  .sum p { color: var(--muted); margin: 0 0 18px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 0 0 18px; }
  .row { display: flex; justify-content: space-between; gap: 10px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; cursor: pointer; }
  .row:hover { color: #fff; }
  .row .pk { color: var(--accent); font-weight: 700; }
  .row .pk.none { color: var(--warn); }
  .out { width: 100%; min-height: 120px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .miss { color: var(--warn); font-size: 13px; margin: -6px 0 16px; }
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
const DATA = ${DATA_JSON};
const BUILD_ID = "${BUILD_ID}";
const LS = "kb-ab-grades-" + BUILD_ID;

let st = { idx: 0, picks: {}, notes: {} };
try { const s = JSON.parse(localStorage.getItem(LS) || "null"); if (s) st = s; } catch {}
const save = () => { try { localStorage.setItem(LS, JSON.stringify(st)); } catch {} };

const app = document.getElementById("app");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function setPick(id, val) { st.picks[id] = val; save(); render(); }

function renderObjection() {
  const o = DATA[st.idx];
  const pick = st.picks[o.id];
  const done = Object.keys(st.picks).length;
  const setupLines = o.transcript.split("\\n").map((ln) => {
    const m = ln.match(/^(\\w+):\\s*(.*)$/);
    return m ? '<div class="ln"><span class="who">' + esc(m[1]) + '</span><span>' + esc(m[2]) + "</span></div>"
             : '<div class="ln"><span></span><span>' + esc(ln) + "</span></div>";
  }).join("");
  const discoLines = (o.context || "").split("\\n").map((ln) => '<div class="ln">' + esc(ln) + "</div>").join("");

  const cards = o.cards.map((c, i) => {
    const n = i + 1;
    const sel = pick === n ? " sel" : "";
    return '<button class="card' + sel + '" data-pick="' + n + '">' +
      '<span class="num">' + n + "</span>" +
      '<div class="hl">' + esc(c.headline) + "</div>" +
      '<div class="sub">' + esc(c.subtext || "") + "</div></button>";
  }).join("");

  app.innerHTML =
    '<div class="top"><div class="brand">Wing<span>man</span> · KB A/B</div>' +
    '<div class="count">' + done + " of " + DATA.length + " graded</div></div>" +
    '<div class="bar"><i style="width:' + (done / DATA.length * 100) + '%"></i></div>' +
    '<div class="obj-label">Objection ' + o.id + " of " + DATA.length + "</div>" +
    '<div class="obj">“' + esc(o.objection) + '”</div>' +
    (o.context ? '<div class="lbl">Discovery so far</div><div class="disco">' + discoLines + "</div>" : "") +
    '<div class="lbl">Right now</div><div class="setup">' + setupLines + "</div>" +
    '<p class="hint">Which card would you most want on screen at that moment? Click to pick.</p>' +
    '<div class="cards">' + cards + "</div>" +
    '<div class="weak"><button data-pick="x" class="' + (pick === "x" ? "sel" : "") + '">None of these — all 4 are weak</button></div>' +
    '<div class="notes"><label>Any thoughts? (optional)</label>' +
    '<textarea id="note" placeholder="Why this one? What was off about the others?">' + esc(st.notes[o.id] || "") + "</textarea></div>" +
    '<div class="nav"><button class="btn" id="prev"' + (st.idx === 0 ? " disabled" : "") + ">← Back</button>" +
    '<button class="btn primary" id="next">' + (st.idx === DATA.length - 1 ? "Review & finish →" : "Next →") + "</button></div>" +
    '<div class="kbd">Keys: <b>1</b>–<b>4</b> pick · <b>0</b> all-weak · <b>←</b> <b>→</b> move</div>';

  app.querySelectorAll(".card, .weak button").forEach((el) => {
    el.onclick = () => { const v = el.dataset.pick; setPick(o.id, v === "x" ? "x" : Number(v)); };
  });
  const note = document.getElementById("note");
  note.oninput = () => { st.notes[o.id] = note.value; save(); };
  document.getElementById("prev").onclick = () => { if (st.idx > 0) { st.idx--; save(); render(); } };
  document.getElementById("next").onclick = () => { if (st.idx < DATA.length - 1) { st.idx++; save(); render(); } else { st.idx = DATA.length; save(); render(); } };
}

function renderSummary() {
  const missing = DATA.filter((o) => !(o.id in st.picks));
  const rows = DATA.map((o) => {
    const p = st.picks[o.id];
    const label = p === "x" ? "all weak" : p ? "Card " + p : "—";
    return '<div class="row" data-go="' + o.id + '"><span>#' + o.id + " " + esc(o.objection) + '</span>' +
      '<span class="pk' + (p ? "" : " none") + '">' + label + "</span></div>";
  }).join("");

  const output = JSON.stringify({
    build: BUILD_ID,
    picks: st.picks,
    notes: Object.fromEntries(Object.entries(st.notes).filter(([, v]) => v && v.trim())),
  });

  app.innerHTML =
    '<div class="sum"><h2>Done — ' + Object.keys(st.picks).length + " of " + DATA.length + " graded</h2>" +
    "<p>Click any row to revisit it. When you're happy, copy the results and paste them back to Claude.</p>" +
    (missing.length ? '<div class="miss">Still blank: ' + missing.map((m) => "#" + m.id).join(", ") + "</div>" : "") +
    '<div class="grid2">' + rows + "</div>" +
    '<button class="btn primary" id="copy" style="width:100%;margin-bottom:12px">📋 Copy results</button>' +
    '<textarea class="out" id="out" readonly>' + esc(output) + "</textarea>" +
    '<div class="nav"><button class="btn" id="back">← Back to grading</button></div></div>';

  app.querySelectorAll(".row").forEach((el) => {
    el.onclick = () => { st.idx = DATA.findIndex((o) => o.id === Number(el.dataset.go)); save(); render(); };
  });
  document.getElementById("back").onclick = () => { st.idx = DATA.length - 1; save(); render(); };
  document.getElementById("copy").onclick = () => {
    const out = document.getElementById("out");
    out.select();
    const ok = () => { const b = document.getElementById("copy"); b.textContent = "✓ Copied — paste it to Claude"; setTimeout(() => (b.textContent = "📋 Copy results"), 2200); };
    if (navigator.clipboard) navigator.clipboard.writeText(out.value).then(ok).catch(() => { document.execCommand("copy"); ok(); });
    else { document.execCommand("copy"); ok(); }
  };
}

function render() { if (st.idx >= DATA.length) renderSummary(); else renderObjection(); window.scrollTo(0, 0); }

document.addEventListener("keydown", (e) => {
  if (st.idx >= DATA.length) return;
  if (e.target.tagName === "TEXTAREA") return;
  const o = DATA[st.idx];
  if (["1", "2", "3", "4"].includes(e.key)) { const n = Number(e.key); if (n <= o.cards.length) setPick(o.id, n); }
  else if (e.key === "0" || e.key.toLowerCase() === "x") setPick(o.id, "x");
  else if (e.key === "ArrowRight") { st.idx++; save(); render(); }
  else if (e.key === "ArrowLeft" && st.idx > 0) { st.idx--; save(); render(); }
});

render();
</script>
</body>
</html>
`;

writeFileSync(join(DIR, "grader.html"), html);
console.log(`Wrote tasks/kb-ab-test/grader.html (${blind.length} objections, build ${BUILD_ID})`);
