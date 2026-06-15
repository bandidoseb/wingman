/**
 * kb-memory.ts — in-process copy of the signal-card KB for fast vector search.
 *
 * This is the I/O + lifecycle SHELL. The pure math (parse/normalize/pack/search)
 * lives in kb-memory-core.ts so it is unit-testable without Supabase/Next.
 *
 * WHY THIS EXISTS
 * ---------------
 * The live press-to-card path used to embed the prospect's objection and then
 * ask Supabase to vector-search it via the `search_kb_by_trigger` RPC. Measured
 * live (2026-06-12): that RPC took ~2.3s per press. Root cause (confirmed by
 * EXPLAIN ANALYZE = 2,091ms): the RPC's `DISTINCT ON (e.id) ... ORDER BY e.id,
 * distance` shape cannot use a vector index, so every press sequential-scans and
 * de-TOASTs all ~6,554 × 1536-dim vectors (~40MB) on a small shared instance.
 *
 * THE FIX
 * -------
 * Load the whole eligible KB into this Node server's memory ONCE (at boot), keep
 * it as one packed Float32Array, and brute-force the dot product in-process. At
 * 6,554 trigger rows that is ~10M multiply-adds ≈ 5–15ms — ~200x faster, exact
 * (checks every row; no approximate-index recall loss), and immune to the
 * Supabase instance tier. Supabase stays the system of record; this is a cache.
 *
 * RELATIONSHIP TO knowledge-search.ts
 * -----------------------------------
 * `searchKnowledge()` still owns the OpenAI embedding step + 60s query cache +
 * result formatting. After embedding, it calls `searchInMemory()`. If memory is
 * `ready`, that serves the result (~10ms). If not (fresh boot / load failure),
 * it falls back to the existing RPC — slow-but-correct, and bounded by a circuit
 * breaker so a fleet-wide memory-load failure can't stampede Supabase.
 *
 * SCALE / GRADUATION (honest ceilings — see tasks/todo.md)
 * --------------------------------------------------------
 * Each KB *entry* has ~30 trigger phrases (one embedding each). Today: 215
 * entries → 6,554 triggers → ~40MB RAM, ~125MB boot transfer (text JSON).
 *   • Boot transfer is the FIRST wall: ~19KB/row as JSON → ~200MB near ~10k
 *     triggers. Past there, re-downloading every row as text each boot gets slow
 *     and JSON.parse gets memory-spiky. Graduation: precompute a compact binary
 *     snapshot in Supabase Storage and load THAT at boot.
 *   • Event-loop is the SECOND wall: brute-force on the main thread starts to
 *     jank concurrent transcript/summarize POSTs near ~100k triggers (~3k
 *     entries). Graduation: move the search kernel to an in-process ANN lib
 *     (usearch/hnswlib) in a worker thread — interface here stays identical.
 * `WARN_TRIGGER_COUNT` below fires a loud one-time alarm well before either wall
 * so we can never silently outgrow the simple loader.
 *
 * GUARANTEES
 * ----------
 * - Load is non-blocking and never throws on the request path (errors set state
 *   = "error" and schedule a backoff retry; readers just fall back to the RPC).
 * - Reloads (staleness) build a NEW snapshot off to the side and swap the
 *   reference atomically — in-flight searches keep using the old snapshot to
 *   completion. No locks, no torn reads (JS reference assignment is atomic).
 * - Singleton on globalThis so Next.js dev HMR doesn't reload 40MB per edit.
 *
 * HOSTING NOTE: relies on a persistent Node server (Railway). On serverless
 * (Vercel) module memory does not persist between invocations — this would
 * degrade to "always RPC". Revisit if hosting moves.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  DIM,
  packSnapshot,
  parseEmbedding,
  searchSnapshot,
  type InMemoryMatch,
  type KbSnapshot,
  type RawTriggerRow,
} from "./kb-memory-core";

export type { InMemoryMatch } from "./kb-memory-core";

const PAGE_SIZE          = 1_000;        // keyset pagination page size
const STALE_CHECK_MS     = 5 * 60_000;   // re-check KB size/recency every 5 min
const RETRY_BASE_MS      = 1_000;        // backoff: 1s, 2s, 4s, … capped
const RETRY_MAX_MS       = 30_000;
const WARN_TRIGGER_COUNT = 25_000;       // ~800 entries — alarm to plan the snapshot loader

export type KbMemoryState = "empty" | "loading" | "ready" | "error";

interface KbMemoryStore {
  state:              KbMemoryState;
  snapshot:           KbSnapshot | null;
  loadedCount:        number;
  loadedMaxCreatedAt: string | null;
  retryCount:         number;
  retryTimer:         ReturnType<typeof setTimeout> | null;
  staleTimer:         ReturnType<typeof setInterval> | null;
  warned:             boolean;
}

// ── Singleton on globalThis (survives Next.js dev HMR) ───────────────────────
const GLOBAL_KEY = "__wingmanKbMemory" as const;

function getStore(): KbMemoryStore {
  const g = globalThis as unknown as { [GLOBAL_KEY]?: KbMemoryStore };
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = {
      state:              "empty",
      snapshot:           null,
      loadedCount:        0,
      loadedMaxCreatedAt: null,
      retryCount:         0,
      retryTimer:         null,
      staleTimer:         null,
      warned:             false,
    };
  }
  return g[GLOBAL_KEY]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function getKbMemoryState(): KbMemoryState {
  return getStore().state;
}

/**
 * Search the in-memory KB. Returns null ONLY when there is genuinely nothing to
 * serve (cold boot before the first successful load, or a permanent error with
 * no prior snapshot) — the caller then falls back to the RPC. An array (possibly
 * empty) means memory served it; empty = "no match cleared the threshold", a
 * valid answer, NOT a fallback signal.
 *
 * Crucially we serve whenever a snapshot EXISTS, even mid-reload (state =
 * "loading") or post-error. A staleness rebuild or a retry keeps the previous
 * snapshot valid in store.snapshot; gating on `state === "ready"` would force
 * every press during every re-ingestion onto the slow RPC for no reason. The
 * reload swaps the reference atomically, so a reader that captured the old
 * snapshot finishes against it cleanly.
 */
export function searchInMemory(
  queryEmbedding: number[],
  threshold: number,
  matchCount: number,
): InMemoryMatch[] | null {
  // capture the reference once so an atomic swap mid-search can't tear the read
  const snap = getStore().snapshot;
  if (!snap) return null;
  return searchSnapshot(snap, queryEmbedding, threshold, matchCount);
}

/**
 * Kick a load if one isn't already in progress or done. Idempotent and
 * non-blocking — safe to call from boot, call-start warm-up, and every search.
 */
export function ensureKbMemoryLoaded(): void {
  const store = getStore();
  if (store.state === "loading" || store.state === "ready") return;
  void load(store);
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading + lifecycle (internal)
// ─────────────────────────────────────────────────────────────────────────────

async function load(store: KbMemoryStore): Promise<void> {
  store.state = "loading";
  const t0 = Date.now();

  try {
    const { rows, maxCreatedAt } = await fetchAllTriggerRows();
    const snapshot = packSnapshot(rows);

    // Atomic swap: assign the new snapshot; in-flight searches hold the old one.
    store.snapshot           = snapshot;
    store.loadedCount        = snapshot.count;
    store.loadedMaxCreatedAt = maxCreatedAt;
    store.state              = "ready";
    store.retryCount         = 0;

    const bytes = snapshot.vectors.byteLength;
    console.log(
      `[kb-memory] ✅ ready — ${snapshot.count} triggers (${rows.length} fetched), ` +
      `${(bytes / 1_048_576).toFixed(1)}MB vectors, ${Date.now() - t0}ms`,
    );

    if (snapshot.count > WARN_TRIGGER_COUNT && !store.warned) {
      store.warned = true;
      console.error(
        `[kb-memory] ⚠️  ALARM: ${snapshot.count} triggers exceeds ${WARN_TRIGGER_COUNT}. ` +
        `The simple in-memory loader is approaching its boot-transfer ceiling — ` +
        `plan the binary-snapshot loader / worker-thread ANN (see tasks/todo.md & module header).`,
      );
    }

    scheduleStaleCheck(store);
  } catch (err) {
    store.state = "error";
    // ONE loud aggregated error — not per-request spam. "Memory never loaded,
    // everyone's on the slow RPC path" must never be invisible.
    console.error(
      `[kb-memory] ❌ load failed (attempt ${store.retryCount + 1}) after ${Date.now() - t0}ms — ` +
      `serving via RPC fallback until a retry succeeds:`, err,
    );
    scheduleRetry(store);
  }
}

/** Keyset-paginated fetch of every eligible trigger row + its entry metadata. */
async function fetchAllTriggerRows(): Promise<{ rows: RawTriggerRow[]; maxCreatedAt: string | null }> {
  const supabase = createServiceClient();
  const rows: RawTriggerRow[] = [];
  let maxCreatedAt: string | null = null;
  let lastId = ""; // UUIDs sort after '' — keyset cursor

  // Keyset pagination by PK (id) is stable under concurrent inserts/deletes —
  // unlike OFFSET, pages can't shift or skip. created_at is read only to seed
  // the staleness baseline; it is NOT used for ordering (immune to clock ties).
  for (;;) {
    let query = supabase
      .from("kb_prospect_triggers")
      .select(
        "id, entry_id, trigger_text, embedding, created_at, " +
        "entry:kb_signal_card_entries!inner(technique_name, situation, exact_script, why_it_works, call_stage, quality_score, trigger_speaker)",
      )
      .eq("entry.trigger_speaker", "prospect")
      .in("entry.quality_score", ["high", "medium"])
      .not("embedding", "is", null)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const raw of data as unknown as RawDbRow[]) {
      const embedding = parseEmbedding(raw.embedding);
      if (!embedding) continue;
      const entry = Array.isArray(raw.entry) ? raw.entry[0] : raw.entry;
      if (!entry) continue;

      rows.push({
        entry_id:       raw.entry_id,
        trigger_text:   raw.trigger_text,
        embedding,
        technique_name: entry.technique_name ?? "",
        situation:      entry.situation      ?? "",
        exact_script:   entry.exact_script   ?? "",
        why_it_works:   entry.why_it_works   ?? "",
        call_stage:     entry.call_stage     ?? "",
        quality_score:  entry.quality_score  ?? "",
      });

      if (raw.created_at && (maxCreatedAt === null || raw.created_at > maxCreatedAt)) {
        maxCreatedAt = raw.created_at;
      }
    }

    lastId = (data[data.length - 1] as unknown as RawDbRow).id;
    if (data.length < PAGE_SIZE) break;
  }

  return { rows, maxCreatedAt };
}

interface RawDbEntry {
  technique_name:  string | null;
  situation:       string | null;
  exact_script:    string | null;
  why_it_works:    string | null;
  call_stage:      string | null;
  quality_score:   string | null;
  trigger_speaker: string | null;
}
interface RawDbRow {
  id:           string;
  entry_id:     string;
  trigger_text: string;
  embedding:    unknown;
  created_at:   string | null;
  entry:        RawDbEntry | RawDbEntry[] | null;
}

function scheduleRetry(store: KbMemoryStore): void {
  if (store.retryTimer) clearTimeout(store.retryTimer);
  const delay = Math.min(RETRY_BASE_MS * 2 ** store.retryCount, RETRY_MAX_MS);
  store.retryCount++;
  store.retryTimer = setTimeout(() => {
    store.retryTimer = null;
    void load(store);
  }, delay);
  store.retryTimer.unref?.(); // never keep the process alive just for a retry
}

function scheduleStaleCheck(store: KbMemoryStore): void {
  if (store.staleTimer) return; // one interval for the life of the process
  store.staleTimer = setInterval(() => { void checkStale(store); }, STALE_CHECK_MS);
  store.staleTimer.unref?.();
}

/**
 * Cheap staleness probe: compare row count + newest created_at against what's
 * loaded. Re-ingestion does per-source delete+insert, so both move when the KB
 * changes. On change, rebuild off to the side (load() swaps atomically).
 *
 * count(*) is a seq-scan on Postgres — fine at today's scale; when the table is
 * large enough that it bites, swap to a kb_meta version row (see tasks/todo.md).
 */
async function checkStale(store: KbMemoryStore): Promise<void> {
  if (store.state === "loading") return;
  try {
    const supabase = createServiceClient();

    const { count, error: countErr } = await supabase
      .from("kb_prospect_triggers")
      .select("*", { count: "exact", head: true });
    if (countErr) throw countErr;

    const { data: newest, error: maxErr } = await supabase
      .from("kb_prospect_triggers")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1);
    if (maxErr) throw maxErr;

    // An indeterminate count (null on a non-error response) must NOT be read as
    // "changed" — that would fire a full ~125MB reload every 5 min forever.
    if (count === null) return;

    const maxCreatedAt = newest?.[0]?.created_at ?? null;
    const changed =
      count !== store.loadedCount || maxCreatedAt !== store.loadedMaxCreatedAt;

    if (changed) {
      console.log(
        `[kb-memory] KB changed (count ${store.loadedCount}→${count}) — rebuilding`,
      );
      await load(store);
    }
  } catch (err) {
    // Non-fatal: keep serving the current snapshot; try again next interval.
    console.warn("[kb-memory] staleness check failed (keeping current snapshot):", err);
  }
}

// Re-exported for callers that want the DIM constant alongside the API.
export { DIM };
