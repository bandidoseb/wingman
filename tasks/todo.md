# Press-to-Card Latency Build — In-Memory KB Search + Streaming Reveal

**Date:** 2026-06-12 · **Status:** ✅ PR 1 MERGED (#17) → Railway deploying. `009` SQL run in Supabase ✅. Live-tested: `path=mem`, search 2.8s → ~20ms. PR 2 (streaming) still gated on the spike.
*(Replaces the Phase 3.5 plan — shipped in PR #15.)*

## Remaining latency roadmap (agreed order of impact)
1. **Partial transcripts** — biggest objection-freshness win. Subscribe to Recall `transcript.partial_data` (interim words, ~hundreds of ms) + `prioritize_low_latency`. Cuts the 1–3s Recall finalization lag → ~0.3s. DESIGN: finals stay the authoritative buffer; partials are a provisional live tail, reconciled when the final lands. The Groq distiller already normalizes messy partials before embedding (error-correction layer), so gist/objection detection is robust to the unstable last 1–2 words. Optional: one-line prompt note that the tail is provisional.
2. **Streaming card reveal** (PR 2) — gated on the 1h Railway SSE-buffering spike. First words ~0.5–0.8s.
3. **Embedding latency** — app-wide SHARED cache (Sebastian's idea, 2026-06-12): cache distilled-objection→embedding (and →KB result, KB is global) in Redis across ALL users; first rep fleet-wide pays ~200ms, everyone after = 0ms. PostHog measures real top-~100 objections → keep permanently warm. Cache the GENERIC phrase only (not PII). Also: `encoding_format:"base64"` + warm pooled OpenAI connection. Self-hosted/local embedding model (bge-small on Railway, ~10–50ms) = bigger lever, needs full KB re-embed — likely UNNECESSARY given the shared cache's hit rate. REJECTED: armed/speculative objection listener (re-opens Phase 1 autonomous-firing pivot, high cost, wrong-card risk).

## Build log (PR 1 — branch `feat/in-memory-kb-search`)
- ✅ `kb-memory-core.ts` (pure math) + `kb-memory.ts` (I/O/lifecycle) + `instrumentation.ts` (boot load) + `knowledge-search.ts` (mem-first, breaker-guarded RPC fallback) + `pipeline-warmup.ts` (kick load).
- ✅ 20 vitest unit tests (59 total pass). Web + electron tsc clean.
- ✅ **Parity gate: 14/14 probes pass** vs the live 008 RPC — every shared similarity within 1e-4, identical sets; the only diffs are exact-tie top-1 reorderings (KB Issue #28 duplicate triggers), correctly tolerated.
- ✅ `009_kb_trigger_hnsw.sql` — HNSW index + filter-then-rank rewrite (fast fallback). Needs Sebastian to paste in Supabase.
- ✅ wingman-reviewer: APPROVE WITH FIXES → both folded in: (1) serve the stale snapshot during a reload/retry instead of dropping to RPC; (2) 009 Stage-1 eligibility filter so future rep/low rows can't starve results. Optional null-count guard also added.

## Why

Live gate test (2026-06-12, real Zoom call) measured press-to-card at 1.9–4.9s. Root causes, confirmed:

1. **Search (2.8s):** the `search_kb_by_trigger` RPC's query shape (`DISTINCT ON ... ORDER BY e.id, distance` — migration 008) cannot use a vector index, so every press seq-scans + de-TOASTs all 6,554 × 1536-dim vectors (~40MB) on a small shared Supabase instance. EXPLAIN ANALYZE: 2,091ms inside the DB.
2. **Generation (1.4–1.9s):** Haiku non-streaming for ~100–150 tokens. The ~430-token system prompt is below Haiku 4.5's 4,096-token prompt-cache minimum — caching cannot engage.
3. Warm-up at call start is moot by first press (~2.5 min later, connections cooled).

Target: ≤1.5s press to first visible words, without degrading card quality (Haiku locked via 5-trap test; 0.60 threshold chosen because 0.65 guillotined real matches).

## Scale honesty (corrected)

Each KB **entry** has ~30 trigger phrases, each with its own embedding (215 entries → 6,554 triggers). At Sebastian's stated horizon:

| Entries | Triggers | RAM (float32) | Brute-force JS search |
|---|---|---|---|
| 215 (today) | 6.5k | 40MB | ~5–15ms ✅ |
| ~3,000 | ~100k | ~600MB | ~50–100ms ⚠️ ceiling |
| 10,000 | ~300k | ~1.8GB | ~150ms+ event-loop block ❌ |
| 50,000 | ~1.5M | ~9.2GB | ❌ needs ANN + quantization |

**The architecture (in-memory on the Railway server) holds at all these scales. The simple brute-force engine inside it is safe to ~3k entries (~100k triggers).** Past that: swap the search kernel to an in-process ANN library (usearch/hnswlib) in a worker thread — a contained change inside one module, interface unchanged — plus int8 quantization / Matryoshka dims at the top end, and snapshot-file boot loading when boot transfer exceeds ~200MB. A **load-time alarm** (PR 1, item 1) makes silently crossing the ceiling impossible. Thousands of users = non-issue at any tier (read-only replicas; presses are rare; ~10ms CPU each).

---

## PR 1 — In-memory KB search (backend only, no schema change, no UI change)

Files: NEW `src/lib/wingman/kb-memory.ts`, NEW `scripts/test-kb-memory-parity.mjs`, MODIFY `src/lib/wingman/knowledge-search.ts`, MODIFY `src/lib/wingman/pipeline-warmup.ts` (+ vitest unit tests).

1. **`kb-memory.ts`** — module owning the in-memory copy:
   - Boot load from Supabase via PostgREST, paginated **by `id` alone** (UUID PK — stable, immune to `created_at` ties; reviewer MAJOR-2). Filters identical to the RPC: `quality_score IN (high, medium)`, `trigger_speaker = 'prospect'`, `embedding IS NOT NULL`.
   - One contiguous `Float32Array` (n × 1536) + parallel metadata arrays. Normalize vectors at load (cosine = dot).
   - `searchInMemory(queryEmbedding, threshold, matchCount)`: exact brute-force dot product; best-trigger-per-entry dedupe mirroring DISTINCT ON; **deterministic tiebreak — on equal similarity, lower entry UUID wins** (reviewer BLOCKER-1); top-5 by similarity.
   - State machine `empty → loading → ready | error` (retry w/ backoff). `globalThis.__wingmanKbMemory` singleton (Next.js dev HMR).
   - Searches capture the array reference once at function entry; reloads build aside + atomic reference swap (reviewer MINOR-2).
   - Staleness: poll `count(*) + max(created_at)` every 5 min; rebuild + swap on change.
   - **Load-time alarm:** `console.error` if trigger count > 100k (event-loop ceiling) — ties to the graduation plan (reviewer MAJOR-4).
   - Boot log line: row count, bytes, load ms. **Load failure is loud:** single aggregated error, not per-request spam (reviewer MAJOR-1).
2. **`knowledge-search.ts`** — `searchKnowledge` keeps exact signature, embed step, 60s query cache (layering unchanged — `skipCache` still governs only the query cache; reviewer MINOR-4), and result formatting. After embed: memory `ready` → `searchInMemory`; else → existing RPC fallback. Timing log gains `path=mem|rpc`.
3. **Circuit breaker on the RPC fallback** (reviewer MAJOR-1): if recent RPC calls are slow/failing (e.g., >4s), shed load — return "" (route already degrades to grounded fallback card / nudge) instead of piling 2.3s seq-scans onto Supabase during a fleet-wide memory-load failure.
4. **`pipeline-warmup.ts`**: RPC ping → kb-memory readiness check/kick; OpenAI/Anthropic/Groq pings unchanged.
5. **CUT from PR 1** (reviewer MAJOR-3): transcript-route keep-warm pings — marginal value vs. moving-part risk; revisit with PR 1's live numbers. Also CUT: precomputed canonical-objection embeddings (same reason).
6. **Parity gate** (`test-kb-memory-parity.mjs`, run before merge — reviewer BLOCKER-1): probe set = calibrate.js probes **plus short distilled-style objection phrases at threshold 0.60** (the danger zone). Asserts: identical top-5 entry-ID **set**, identical **top-1** entry, shared similarities within 1e-4. Documented tolerance rationale in the script.
7. Vitest: dedupe/tiebreak, threshold edges, empty KB, atomic swap, alarm trigger.

**Expected:** search 2.8s → ~10ms; full card ~1.9–2.4s (generation now dominates). Worst case (memory not ready) = today's behavior, bounded by the breaker.

## Migration (recommended, needs Sebastian's explicit YES — schema change)

Fix the fallback so it's fast too: new two-stage RPC (`ORDER BY embedding <=> query LIMIT ~100` — index-compatible — then dedupe/rank in an outer query) + create the HNSW index on `kb_prospect_triggers.embedding`. Turns a memory-load failure from "outage-grade 2.3s herd" into "~100–300ms slowdown." Small SQL file, run in Supabase SQL Editor. (Reviewer: "the single highest-leverage deferred item.")

## PR 2 — Streaming card reveal (GATED — do not build until the spike passes)

**Gate (reviewer MAJOR-5):** 1-hour spike — throwaway streaming route deployed on Railway, consumed by the real Electron renderer, timestamp-per-chunk logged. If Railway's proxy buffers the stream, PR 2 dies cheaply and we attack generation latency another way (fewer output tokens / faster provider behind the 5-trap quality harness).

If the spike passes, build with these reviewer-mandated fixes:
1. **Keep all three generators on the JSON contract** (BLOCKER-3). Stream raw tokens for progressive display, but parse JSON at `done` for structured fields. Explicit per-branch framing for all 5 route branches (kb / fallback-grounded / nudge / raw-fallback / none). Fence guard: drop a leading ``` line.
2. **Timeout architecture** (BLOCKER-2): per-chunk idle timeout (~5s) AND a hard overall ceiling (15s) — either fires → abort reader, release `isGeneratingRef`, error pill if nothing rendered. **HUD-side watchdog** after first delta: "no delta and no done in Ns" → finalize gracefully. Single state machine in the HUD. Rule: headline rendered + stream dies = keep card; nothing rendered = error pill.
3. New IPC delta channel wired across preload + main + HUD **in the same commit, both sides** (#39 lesson), verified in HUD DevTools.
4. Constant-rate reveal in HUD (Decisions Log 2026-06-11). Card persisted exactly once at `done`. Stream aborted on call end.

**Expected combined:** first words ~0.8–1.5s; full card ~2–2.5s with the rep already reading.

## Sequencing

1. Sebastian approves plan (+ yes/no on the migration).
2. PR 1 → parity gate → wingman-reviewer → merge → **live role-play gate** (also the deferred Phase 3.5 gate).
3. Railway streaming spike (1h) → go/no-go on PR 2.
4. PR 2 (if go) → live gate.
5. Follow-ups (named, scheduled by KB growth): ANN worker-thread kernel at >100k triggers; kb_meta version row; snapshot boot loading; keep-warm + canonical embeddings if live numbers justify.

## Acceptance criteria

- [x] Parity gate passes (top-1 + top-5 set + 1e-4 on shared sims) on raw AND distilled probes — 14/14
- [x] tsc (web + electron) + vitest (59) green; wingman-reviewer approves diff
- [x] Boot log shows count/bytes/ms; one-time alarm wired at >25k triggers (~800 entries)
- [ ] **Live call (Sebastian):** `path=mem` in the `[searchKnowledge]` log, search ≤50ms in the `[kb-signal] TIMING` line
- [ ] **Live call:** full card noticeably faster than the 1.9–4.9s baseline (search no longer the bottleneck — generation now dominates; streaming = PR 2)
- [ ] **After `009` SQL:** re-run parity script (validates the fast fallback) + EXPLAIN ANALYZE drops from ~2,000ms to a few hundred
