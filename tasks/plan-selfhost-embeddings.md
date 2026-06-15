# Plan — Self-Hosted Embeddings (local model on the live path)

**Status:** HARDENED via plan-reviewer (1 priority flag + 3 blockers + 5 majors folded in). Awaiting Sebastian's sequencing decision (Phase −1) before any code.
**Goal:** Replace the OpenAI `text-embedding-3-small` call on the **live signal path** with a local model running in-process on Railway. Query embed ~200–500ms → target ~10–50ms, no network, no external dependency, $0/embed. Bonus: a 384-dim model shrinks the in-memory KB ~4x and speeds the in-memory search.

## ⚠️ Phase −1 — Sequencing decision (NO code; settle this first)
The reviewer correctly flagged: **after PR #17, embedding is no longer the dominant press-to-card cost — card *generation* (Haiku, ~1.5–2s) is.** Embedding is ~200–500ms; search is already ~10–20ms. So this heavy build attacks the ~3rd-biggest lever.
- Higher-impact, cheaper work sits ahead of it: **partial transcripts** (fixes *wrong* cards — the "this is trash" problem) and **streaming** (kills the ~2s generation feel).
- Sebastian already consciously chose self-host **over the cross-user cache** (cache needs scale he doesn't have — sound). This flag is NOT relitigating that; it's: *do the heavy self-host now, or do partials + streaming first and self-host after?*
- **Recommendation:** partials measurement next (cheap, fixes correctness), keep this plan hardened-and-ready, build it after streaming. But it's Sebastian's call — if he wants self-host now, this plan is ready.

## Scope (narrow — minimize blast radius)
- **IN:** live press path only — `kb_prospect_triggers` embeddings (6,554 rows) + the query embed in `searchKnowledge` (`knowledge-search.ts:128`).
- **OUT (stays OpenAI):** coaching KB (`kb_coaching_entries`/`searchCoachingKnowledge`/Ask Wingman) — not latency-critical; halves blast radius. `kb_signal_card_entries.prospect_embedding/technique_embedding` are vestigial (live path uses the junction table) — ignore.

## Runtime decisions (resolve to ONE each in Phase 0 — no branchy implementation)
- **Library:** `fastembed` (Node-native ONNX). Fallback `@huggingface/transformers` only if fastembed fails the Railway spike.
- **Model:** validate **bge-small-en-v1.5 (384-dim)** first, **bge-base-en-v1.5 (768-dim)** only if small fails the per-objection gate. BGE v1.5 needs **no query prefix** (removes a bug class). MIT-licensed.
- **Model artifact (BLOCKER-2):** the repo has **no Dockerfile / nixpacks.toml / Git LFS / `output:'standalone'`** — Railway deploys via Nixpacks auto-detect. So "bundle it" is NOT a checkbox. **Pick ONE mechanism and prove it on Railway in Phase 0.** Lowest-risk candidate: commit the ~130MB ONNX into the repo (NOT LFS — unconfigured) and point fastembed at the local path with network download DISABLED. Committing 130MB to git history is a permanent repo-weight decision → needs Sebastian's explicit yes.
- **Threading:** decided by the Phase 0 Railway latency measurement (MAJOR-4), NOT assumed. If Railway shared-vCPU embed is fast enough single-threaded, main thread; if it stalls the event loop, worker thread is required **in v1**, not deferred.

---

## Phases

### Phase 0 — Railway spike + offline per-objection gate (ZERO prod risk; make-or-break)
Runs on a throwaway Railway service, because laptop numbers don't transfer to Railway's shared vCPU.
**Railway spike must prove (GATE):**
1. The ONE chosen model-delivery mechanism survives build→runtime; `onnxruntime-node` linux-x64 native binary is present and loads (BLOCKER-2).
2. **p95 embed latency on Railway, under concurrent load** (fire transcript-save-sized POSTs alongside) **< warm OpenAI embed, with no measurable event-loop stall** (MAJOR-4). If Railway embed is ~150ms+ single-threaded → worker thread is v1, re-scope.
3. **RSS with the model loaded + embedding** → state the exact Railway RAM/plan setting required as a precondition (MINOR-2). "Bump if needed" is not acceptable for a non-technical founder.

**Offline quality gate (per-objection, NOT aggregate — MAJOR-2):** new `knowledge-base/eval-local-embeddings.mjs`, using the SAME shared `embedLocal()` the production path will use (MAJOR-5):
- Probe set = the parity script's raw phrases + short distilled phrases at 0.60 + any PostHog top objections.
- For **each** probe, compare OpenAI vs local **by `technique_name` top-3** (NOT entry-id — Issue #28 duplicate triggers make entry-id ties pure noise). Report the per-probe **score margin** (top match minus next non-matching).
- **Recalibrate** the live + distilled thresholds for the local model (BGE's similarity scale ≠ OpenAI's; 0.65/0.60 do NOT transfer).
- **PASS only if EVERY high-frequency objection keeps its correct technique in local's top-3 with clean threshold separation.** One high-frequency miss = abort. Aborting changes nothing in prod.
**GATE:** Sebastian sees the per-objection table + Railway latency/RAM numbers and signs off.

### Phase 1 — Schema migration (explicit YES; show SQL)
`010_kb_local_embeddings.sql`: `ADD COLUMN embedding_local vector(<DIM>)` (keep `embedding` 1536 for rollback/fallback); new RPC `search_kb_by_trigger_local` (clone of 009 against the local column — separate RPC so spaces never share); HNSW index on `embedding_local`.

### Phase 2 — Backfill (one-time, local, idempotent)
`knowledge-base/backfill-local-embeddings.mjs`: embed each `trigger_text` via the shared `embedLocal()` (confirmed: this is exactly the text OpenAI embedded — `split-triggers.js:149`), write `embedding_local`, resumable, verify count.

### Phase 3 — Server embed + COHERENT cutover (the space-mixing fixes — BLOCKER-3 + MAJOR-1)
- New `src/lib/wingman/local-embed.ts`: singleton model load at boot, `embedLocal()` + `isLocalEmbedReady()`, never throws on the request path, warmed with a dummy embed at boot. **This is the ONLY local-embed entry point** — backfill, Phase 0 eval, and runtime all import it (MAJOR-5).
- **`DIM` moves onto the snapshot (MAJOR-1):** `KbSnapshot.dim`; `normalizeVector`/`packSnapshot`/`searchSnapshot` take `dim` as a param. No module-global `DIM`. (A const can't be both "model-driven" and "instant env rollback.")
- **`searchInMemory` hard-fails on dim mismatch (BLOCKER-3):** if `query.length !== snap.dim` → return **null** (force fallback) + `console.error` once. A wrong-space query must NEVER masquerade as a valid empty "no match."
- **`EMBED_BACKEND` (`local`|`openai`, default `openai`) governs a coherent path:**
  - `local` + model ready → `embedLocal` → in-memory(local store); fallback RPC = `search_kb_by_trigger_local`.
  - `local` + model NOT ready (boot window) OR `openai` → OpenAI embed → **the 009 RPC on the 1536 column** (NOT the in-memory store, which may be the local space — BLOCKER-3). Reuses the existing breaker path. No space-mixing, ever.
- **60s query cache key gains backend + modelId (BLOCKER-3):** `fastHash(\`${backend}|${modelId}|${threshold}|${query}\`)` so a boot-window OpenAI result can't be served to a later local query.
- **Thresholds keyed on backend (MINOR-1):** both `SIMILARITY_THRESHOLD` (`knowledge-search.ts:23`) and `DISTILLED_SIMILARITY_THRESHOLD` (`kb-signal/route.ts:51`) switch together by backend. Parameterize `scripts/test-kb-memory-parity.mjs` (hardcoded DIM/0.65/0.60) so it can gate the local space too. Update `tests/wingman/kb-memory.test.ts` for per-snapshot dim + add a wrong-dim-query→null test.

### Phase 4 — Ingestion writes BOTH columns (MAJOR-3 — the rollback fix)
`ingest.js` + `split-triggers.js` import the shared embed module and write **both** `embedding` (OpenAI 1536) AND `embedding_local` until Phase 6. Otherwise a post-cutover ingest leaves `embedding` NULL → an `openai` rollback silently drops every new entry (filtered by `embedding IS NOT NULL`). Extra cost: ~$0.001/run. Coaching ingestion stays OpenAI-only.

### Phase 5 — Cutover + live + rollback proof
Deploy on `openai` (no change) → flip `local` → live role-play → confirm `path=mem`, embed latency, cards correct. **Rollback acceptance test:** ingest a new entry on `local`, flip to `openai`, confirm it's STILL retrievable (proves Phase 4). Rollback = env flip, no code redeploy.

### Phase 6 — Cleanup (later, separate PR, after prod-stable)
Drop the 1536 column + OpenAI live-path code + the ingestion dual-write.

---

## Acceptance criteria
- [ ] Phase −1 sequencing decided by Sebastian.
- [ ] Railway spike: artifact survives build→runtime, p95 embed < warm OpenAI under load with no event-loop stall, RAM precondition stated.
- [ ] Per-objection gate: every high-frequency objection keeps its technique in local top-3; thresholds recalibrated; Sebastian signs off.
- [ ] Backfill: every eligible trigger has `embedding_local`; count verified.
- [ ] Cache key includes backend+model; `searchInMemory` returns null+logs on dim mismatch; boot-window fallback uses the RPC not the in-memory store (unit-tested).
- [ ] Ingestion writes both columns; rollback acceptance test passes.
- [ ] tsc + vitest green; no hardcoded 0.65/0.60/1536 left on the local path; coaching/Ask Wingman unchanged.

## Open decisions for Sebastian
1. **Phase −1 sequencing:** self-host now, or partials + streaming first?
2. **Schema:** `010` column + RPC + index — explicit yes.
3. **Repo weight:** committing ~130MB ONNX into git history (if that's the chosen delivery) — permanent decision.
4. **Railway RAM:** exact instance setting, confirmed in Phase 0.
