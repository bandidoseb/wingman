/**
 * flight-recorder-core.mjs — Flight Recorder merge + analysis CORE (pure).
 *
 * ONE implementation shared by the CLI (scripts/flight-recorder.mjs) and the
 * owner dashboard's Flight Recorder tab (via /api/wingman/devlog/report), so the
 * two can never disagree. Reads the raw dev-logs/*.jsonl; derives the call film,
 * card adoption, hallucination-watch, belief trajectory, and cost. No side effects
 * beyond reading files — never touches the live pipeline.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

// Approximate Sonnet 4.x rates ($/M tokens) — a dev cost gauge, not billing truth.
const RATE = { input: 3.0, cacheWrite: 3.75, cacheRead: 0.30, output: 15.0 };
const BELIEFS = ["Pain", "Doubt", "Cost", "Desire", "Money", "Support", "Trust"];
const PRIO = { main: 0, server: 1, renderer: 2 };
const STOP = new Set("the a an is it to of in on and or but so you your i we they that this what for be do how are was with about like just yeah okay right at as".split(" "));

const clock = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
const words = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

function readJsonl(path) {
  const out = [];
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip a partial last line */ }
  }
  return out;
}

/** List captured callIds (those with a .server.jsonl), newest first. */
export function listCalls(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".server.jsonl"))
    .map((f) => {
      let mtime = 0;
      try { mtime = statSync(join(dir, f)).mtimeMs; } catch { /* racing delete */ }
      return { callId: f.replace(/^call-|\.server\.jsonl$/g, ""), mtime };
    })
    .filter((c) => c.callId)
    .sort((a, b) => b.mtime - a.mtime)
    .map((c) => c.callId);
}

function findMainFor(dir, callId) {
  if (!existsSync(dir)) return null;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".main.jsonl"))) {
    const rows = readJsonl(join(dir, f));
    if (rows.some((r) => r.kind === "recorder-link" && r.callId === callId)) return join(dir, f);
  }
  return null;
}

/**
 * Build the full report for one call. Returns structured data (for the page to
 * render) plus a `markdown` string (for the Copy button + the CLI's .report.md).
 * Returns null if the call has no server log.
 */
export function buildReport(dir, callId) {
  const serverPath = join(dir, `call-${callId}.server.jsonl`);
  if (!existsSync(serverPath)) return null;
  const server = readJsonl(serverPath);
  const mainPath = findMainFor(dir, callId);
  const main = mainPath ? readJsonl(mainPath) : [];

  const all = [...server, ...main].filter((e) => e.tMs);
  if (!all.length) return null;
  const t0 = Math.min(...all.map((e) => e.tMs));
  all.forEach((e) => (e.elapsed = e.tMs - t0));
  all.sort((a, b) => a.tMs - b.tMs || (PRIO[a.source] ?? 9) - (PRIO[b.source] ?? 9));

  const film = [];
  const cards = [];
  const summTicks = [];
  const finals = [];
  let presses = 0, drops = 0, readinessReads = 0;
  const header = all.find((e) => e.kind === "header");

  for (const e of all) {
    const ts = clock(e.elapsed);
    switch (e.kind) {
      case "header":
        film.push(`[${ts}] ▶️  CALL START — prospect="${e.prospectName}" · DNA ${Object.keys(e.salesDna || {}).length ? "present" : "empty"}`);
        break;
      case "final":
        if (e.text) { film.push(`[${ts}] 🎙️  ${e.speaker}: ${e.text}`); finals.push(e); }
        break;
      case "press":
        if (e.source === "renderer") { presses++; film.push(`[${ts}] ⌨️  PRESS ${e.slot}`); }
        break;
      case "press-dropped":
        drops++; film.push(`[${ts}] 🚫 DROP ${e.slot} (${e.reason})`);
        break;
      case "card": {
        const idx = cards.length;
        cards.push({ ts, slot: e.slot, outcome: e.outcome, line: e.line ?? null, belief: e.belief ?? null, lever: e.lever ?? null, tMs: e.tMs, totalMs: e.totalMs ?? null });
        const detail = e.slot === "dig" ? `belief=${e.belief}` : e.lever ? `lever=${e.lever}` : "";
        const line = e.line ? `"${e.line}"` : `(${e.outcome})`;
        film.push(`[${ts}] 💬 CARD#${idx} ${e.slot} → ${line}  [${e.outcome}${e.totalMs ? ` ${e.totalMs}ms` : ""}${detail ? " " + detail : ""}]`);
        break;
      }
      case "readiness":
        readinessReads++; film.push(`[${ts}] 📊 READINESS ${e.state}${e.gap && e.gap.length ? ` — missing: ${e.gap.join(", ")}` : ""}`);
        break;
      case "summarizer-tick":
        summTicks.push(e); film.push(`[${ts}] 🧠 SUMMARY updated`);
        break;
    }
  }

  // card adoption (heuristic + verifiable)
  const adoption = [];
  for (const c of cards.filter((x) => x.line && x.outcome === "done")) {
    const after = finals.filter((f) => f.tMs > c.tMs && f.tMs <= c.tMs + 30000);
    const spoken = words(after.map((f) => f.text).join(" "));
    const cw = words(c.line);
    const hit = cw.length ? cw.filter((w) => spoken.includes(w)).length / cw.length : 0;
    adoption.push({
      slot: c.slot, ts: c.ts, line: c.line,
      label: hit >= 0.5 ? "LIKELY USED" : hit >= 0.2 ? "MAYBE PARAPHRASED" : "NOT OBVIOUSLY USED",
      hit: Math.round(hit * 100),
      reply: after.map((f) => f.text).join(" ").slice(0, 160) || "(no speech captured after)",
    });
  }

  // hallucination watch
  const transcriptTo = (tMs) => finals.filter((f) => f.tMs <= tMs).map((f) => f.text).join(" ");
  const hallucinations = [];
  for (const t of summTicks) {
    const outNums = [...new Set((t.output || "").match(/\b\d[\d,]{1,}\b/g) || [])].map((n) => n.replace(/,/g, ""));
    const src = (transcriptTo(t.tMs) + " " + (t.window || "")).replace(/,/g, "");
    const missing = outNums.filter((n) => n.length >= 2 && !src.includes(n));
    if (missing.length) hallucinations.push({ ts: clock(t.tMs - t0), numbers: missing });
  }

  // belief-ladder trajectory
  const trajectory = {};
  for (const b of BELIEFS) {
    const arr = [];
    for (const t of summTicks) {
      const m = new RegExp(`\\d\\s+${b}[^\\n]*?([✅🟡⬜⚠️])`).exec(t.output || "");
      if (m) { const prev = arr[arr.length - 1]; if (!prev || prev.g !== m[1]) arr.push({ g: m[1], at: clock(t.tMs - t0) }); }
    }
    if (arr.length) trajectory[b] = arr;
  }

  // cost (summarizer exact; cards estimated)
  let sumCost = 0, sumIn = 0, sumOut = 0;
  for (const t of summTicks) {
    const u = t.usage || {};
    sumIn += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    sumOut += u.output_tokens || 0;
    sumCost += ((u.input_tokens || 0) * RATE.input + (u.cache_creation_input_tokens || 0) * RATE.cacheWrite +
      (u.cache_read_input_tokens || 0) * RATE.cacheRead + (u.output_tokens || 0) * RATE.output) / 1e6;
  }
  let cardEstTok = 0;
  for (const c of all.filter((e) => e.kind === "card")) cardEstTok += Math.ceil(((c.transcriptChunk || "").length + (c.summary || "").length + (c.line || "").length) / 4);
  const cardEstCost = (cardEstTok * RATE.input + cardEstTok * 0.15 * RATE.output) / 1e6;

  const durMs = Math.max(...all.map((e) => e.elapsed));
  const bySlot = {};
  for (const c of cards) bySlot[`${c.slot}:${c.outcome}`] = (bySlot[`${c.slot}:${c.outcome}`] || 0) + 1;

  const stats = {
    duration: clock(durMs), cards: cards.length, presses, drops, readiness: readinessReads,
    summaries: summTicks.length, paired: !!mainPath,
    cost: { summarizer: +sumCost.toFixed(4), sumIn, sumOut, cardsEst: +cardEstCost.toFixed(4), cardEstTok, total: +(sumCost + cardEstCost).toFixed(4) },
    bySlot,
  };

  const markdown = toMarkdown({ callId, stats, film, adoption, hallucinations, trajectory, paired: !!mainPath });
  return { callId, stats, header, film, cards, adoption, hallucinations, trajectory, markdown };
}

export function toMarkdown({ callId, stats, film, adoption, hallucinations, trajectory }) {
  const R = [];
  R.push(`# Flight Recorder — call ${callId}`);
  R.push("");
  R.push(`Duration **${stats.duration}** · Cards **${stats.cards}** · Presses **${stats.presses}** · Drops **${stats.drops}** · Readiness **${stats.readiness}** · Summaries **${stats.summaries}**`);
  R.push(`Cost (approx): summarizer **$${stats.cost.summarizer}** exact (${stats.cost.sumIn} in / ${stats.cost.sumOut} out) + cards **$${stats.cost.cardsEst}** est (~${stats.cost.cardEstTok} tok) = **~$${stats.cost.total}**`);
  R.push(`Cards by outcome: ${Object.entries(stats.bySlot).map(([k, v]) => `${k}×${v}`).join(" · ") || "none"}`);
  R.push("");
  R.push("## 🎬 Call film");
  R.push("```");
  R.push(...film);
  R.push("```");
  R.push("");
  R.push("## 🎯 Card adoption (heuristic — verify against the reply)");
  if (!adoption.length) R.push("_No fired cards with a line._");
  for (const a of adoption) { R.push(`- **${a.slot}** @${a.ts} → ${a.label} (${a.hit}%)`); R.push(`  - card: "${a.line}"`); R.push(`  - rep next ~30s: ${a.reply}`); }
  R.push("");
  R.push("## 🔍 Hallucination watch");
  if (!hallucinations.length) R.push("_Clean — no invented numbers._");
  for (const h of hallucinations) R.push(`- ⚠️ @${h.ts}: ${h.numbers.join(", ")} — not in transcript`);
  R.push("");
  R.push("## 📈 Belief-ladder trajectory");
  const keys = Object.keys(trajectory);
  if (!keys.length) R.push("_No belief data captured._");
  for (const b of keys) R.push(`- **${b}**: ${trajectory[b].map((s) => `${s.g}@${s.at}`).join(" → ")}`);
  R.push("");
  return R.join("\n");
}
