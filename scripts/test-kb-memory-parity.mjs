/**
 * test-kb-memory-parity.mjs — offline parity gate for the in-memory KB search.
 *
 * Proves that searchInMemory (kb-memory-core.ts) returns the SAME results as the
 * live Supabase RPC (`search_kb_by_trigger`) on real data, so swapping the live
 * press path to memory cannot silently regress card quality. Run this BEFORE
 * merging the in-memory work, and again any time you touch the search math.
 *
 *   node scripts/test-kb-memory-parity.mjs
 *
 * DUAL USE: this script calls whatever `search_kb_by_trigger` is live. Run it
 * once against the current (008, exact) RPC to gate the in-memory merge, then
 * AGAIN after applying migration 009 — that re-run validates the new fast
 * (HNSW, approximate) FALLBACK: in-memory is the exact primary, so a couple of
 * tolerated boundary/tie diffs from the approximate RPC are expected and fine;
 * a hard FAIL (real sim gap or a non-tie set difference) means 009 needs a look.
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OPENAI_API_KEY. Read-only: it never writes to the DB.
 *
 * THE BAR (per the plan review — exact bit-identity is impossible because
 * pgvector's float path ≠ V8's, and tied ranks order differently across engines):
 *   HARD FAIL if:
 *     • the TOP-1 entry differs AND the two top scores differ by > 1e-4
 *       (a different #1 with the SAME score is an exact tie — tolerated; this KB
 *        attaches the same trigger phrase to several entries, so common
 *        objections tie exactly — see Issue #28), or
 *     • an entry present in BOTH top-5 lists has |simRPC - simMem| > 1e-4, or
 *     • an entry is in one top-5 but not the other AND it is NOT a boundary tie
 *       (its similarity is more than 1e-3 below the 5th-place similarity).
 *   Tie-order disagreement (equal scores, different label/rank) is reported but
 *   TOLERATED. This mirrors kb-memory-core.searchSnapshot — keep them in sync.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── minimal .env.local loader (no dotenv dependency required) ────────────────
function loadEnv() {
  const text = readFileSync(join(__dirname, "../.env.local"), "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY   = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !OPENAI_KEY) {
  console.error("Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY");
  process.exit(1);
}

const DIM        = 1536;
const MATCH_COUNT = 5;
const SIM_TOL    = 1e-4; // shared-entry similarity tolerance
const TIE_TOL    = 1e-3; // boundary-tie tolerance for set differences

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Probe set: raw-path phrases (threshold 0.65) + short distilled-style objection
// phrases (threshold 0.60 — the danger zone the distiller produces).
const PROBES = [
  { text: "That's way too expensive for me right now",                 threshold: 0.65 },
  { text: "I just don't think I can afford it at the moment",          threshold: 0.65 },
  { text: "I need to think about this before I make any decision",     threshold: 0.65 },
  { text: "I'm just not ready to move forward right now",              threshold: 0.65 },
  { text: "I'd need to talk to my wife about this first",              threshold: 0.65 },
  { text: "I've tried coaching programs before and they didn't work", threshold: 0.65 },
  { text: "Can you just send me some information?",                    threshold: 0.65 },
  { text: "I'm also looking at a few other options before I decide",   threshold: 0.65 },
  // distilled-style (short, objection-shaped, threshold 0.60)
  { text: "too expensive",            threshold: 0.60 },
  { text: "need to think about it",   threshold: 0.60 },
  { text: "talk to my spouse",        threshold: 0.60 },
  { text: "tried before didn't work", threshold: 0.60 },
  { text: "not the right time",       threshold: 0.60 },
  { text: "can't afford it",          threshold: 0.60 },
];

async function embed(text) {
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method:  "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!resp.ok) throw new Error(`OpenAI embed ${resp.status}: ${await resp.text()}`);
  const json = await resp.json();
  return json.data[0].embedding;
}

function normalize(vec) {
  let n = 0;
  for (let i = 0; i < DIM; i++) n += vec[i] * vec[i];
  n = Math.sqrt(n);
  if (!(n > 0)) return null;
  const out = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) out[i] = vec[i] / n;
  return out;
}

// ── Load the eligible KB into memory once (mirrors fetchAllTriggerRows) ──────
async function loadMemory() {
  const vectors = []; // Float32Array per row (normalized)
  const entryId = [];
  const triggerText = [];
  const techniqueName = [];
  let lastId = "";
  for (;;) {
    let q = supabase
      .from("kb_prospect_triggers")
      .select("id, entry_id, trigger_text, embedding, entry:kb_signal_card_entries!inner(technique_name, quality_score, trigger_speaker)")
      .eq("entry.trigger_speaker", "prospect")
      .in("entry.quality_score", ["high", "medium"])
      .not("embedding", "is", null)
      .order("id", { ascending: true })
      .limit(1000);
    if (lastId) q = q.gt("id", lastId);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const raw of data) {
      const emb = typeof raw.embedding === "string" ? JSON.parse(raw.embedding) : raw.embedding;
      if (!Array.isArray(emb) || emb.length !== DIM) continue;
      const unit = normalize(emb);
      if (!unit) continue;
      const entry = Array.isArray(raw.entry) ? raw.entry[0] : raw.entry;
      vectors.push(unit);
      entryId.push(raw.entry_id);
      triggerText.push(raw.trigger_text);
      techniqueName.push(entry?.technique_name ?? "");
    }
    lastId = data[data.length - 1].id;
    if (data.length < 1000) break;
  }
  return { vectors, entryId, triggerText, techniqueName };
}

// ranked list of ALL entries (best trigger per entry), highest sim first
function searchMemoryRanked(mem, queryEmbedding) {
  const q = normalize(queryEmbedding);
  if (!q) return [];
  const bestSim = new Map();
  const bestRow = new Map();
  for (let r = 0; r < mem.vectors.length; r++) {
    const v = mem.vectors[r];
    let dot = 0;
    for (let i = 0; i < DIM; i++) dot += v[i] * q[i];
    const eid = mem.entryId[r];
    const prev = bestSim.get(eid);
    if (prev === undefined || dot > prev) {
      bestSim.set(eid, dot);
      bestRow.set(eid, r);
    }
  }
  const ranked = [];
  for (const [eid, sim] of bestSim) {
    ranked.push({ id: eid, sim, technique_name: mem.techniqueName[bestRow.get(eid)] });
  }
  ranked.sort((a, b) => b.sim - a.sim || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return ranked;
}

async function searchRpc(queryEmbedding, threshold) {
  const { data, error } = await supabase.rpc("search_kb_by_trigger", {
    query_embedding:      queryEmbedding,
    similarity_threshold: threshold,
    match_count:          MATCH_COUNT,
  });
  if (error) throw error;
  return (data ?? []).map((m) => ({ id: m.id, sim: m.similarity, technique_name: m.technique_name }));
}

function compare(rpcTop, memRanked, threshold) {
  const memTop = memRanked.filter((r) => r.sim >= threshold).slice(0, MATCH_COUNT);
  const issues = []; // hard failures (real regressions)
  const ties   = []; // tolerated cosmetic differences (equal scores, different label)

  // TOP-1: a different label is only a FAILURE if the two top scores actually
  // differ. When they're equal (within SIM_TOL) it's an exact tie — common in
  // this KB because the same trigger phrase is attached to several entries
  // (Issue #28). Equal score = equally relevant card; order is cosmetic.
  if (rpcTop.length && memTop.length && rpcTop[0].id !== memTop[0].id) {
    const gap = Math.abs(rpcTop[0].sim - memTop[0].sim);
    if (gap > SIM_TOL) {
      issues.push(`TOP-1 differs with real sim gap ${gap.toExponential(2)}: rpc=${rpcTop[0].id.slice(0, 8)}(${rpcTop[0].sim.toFixed(5)}) mem=${memTop[0].id.slice(0, 8)}(${memTop[0].sim.toFixed(5)})`);
    } else {
      ties.push(`top-1 tie @${rpcTop[0].sim.toFixed(5)}: rpc=${rpcTop[0].id.slice(0, 8)} mem=${memTop[0].id.slice(0, 8)}`);
    }
  }

  const memSimById = new Map(memRanked.map((r) => [r.id, r.sim]));
  for (const r of rpcTop) {
    if (memSimById.has(r.id)) {
      const d = Math.abs(r.sim - memSimById.get(r.id));
      if (d > SIM_TOL) issues.push(`sim Δ ${d.toExponential(2)} on ${r.id.slice(0, 8)} (rpc=${r.sim.toFixed(5)} mem=${memSimById.get(r.id).toFixed(5)})`);
    }
  }

  const rpcIds = new Set(rpcTop.map((r) => r.id));
  const memIds = new Set(memTop.map((r) => r.id));
  const memBoundary = memTop.length ? memTop[memTop.length - 1].sim : -1;
  const rpcBoundary = rpcTop.length ? rpcTop[rpcTop.length - 1].sim : -1;

  for (const r of rpcTop) {
    if (!memIds.has(r.id)) {
      const memSim = memSimById.get(r.id);
      const isTie = memSim !== undefined && memBoundary - memSim <= TIE_TOL;
      (isTie ? ties : issues).push(`RPC-only ${r.id.slice(0, 8)} (memSim=${memSim?.toFixed(5) ?? "none"}, memBoundary=${memBoundary.toFixed(5)})`);
    }
  }
  for (const m of memTop) {
    if (!rpcIds.has(m.id)) {
      const isTie = rpcBoundary >= 0 && rpcBoundary - m.sim <= TIE_TOL;
      (isTie ? ties : issues).push(`MEM-only ${m.id.slice(0, 8)} (memSim=${m.sim.toFixed(5)}, rpcBoundary=${rpcBoundary.toFixed(5)})`);
    }
  }
  return { issues, ties };
}

async function main() {
  console.log("Loading KB into memory…");
  const mem = await loadMemory();
  console.log(`Loaded ${mem.vectors.length} trigger vectors.\n`);

  let failed = 0;
  for (const probe of PROBES) {
    const emb = await embed(probe.text);
    const [rpcTop, memRanked] = await Promise.all([
      searchRpc(emb, probe.threshold),
      Promise.resolve(searchMemoryRanked(mem, emb)),
    ]);
    const { issues, ties } = compare(rpcTop, memRanked, probe.threshold);
    const memTop = memRanked.filter((r) => r.sim >= probe.threshold).slice(0, MATCH_COUNT);
    const tag = issues.length === 0 ? "✅ PASS" : "❌ FAIL";
    if (issues.length) failed++;
    console.log(`${tag}  @${probe.threshold}  "${probe.text}"`);
    console.log(`        rpc top: ${rpcTop.map((r) => `${r.id.slice(0, 8)}:${r.sim.toFixed(3)}`).join(", ") || "(none)"}`);
    console.log(`        mem top: ${memTop.map((r) => `${r.id.slice(0, 8)}:${r.sim.toFixed(3)}`).join(", ") || "(none)"}`);
    for (const i of issues) console.log(`        ❌ ${i}`);
    for (const t of ties)   console.log(`        · tolerated tie — ${t}`);
  }

  console.log(`\n${failed === 0 ? "✅ ALL PROBES PASS" : `❌ ${failed}/${PROBES.length} PROBES FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
