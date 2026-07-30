import type { CallSuggestion } from "@/lib/wingman/dive-suggestion";
// Relative, not `@/…`: this is a RUNTIME import, and vitest.config.ts registers no
// path alias on purpose (the other libs' `@/` imports are all type-only and erased).
import { GLOBAL_SCOPE } from "./coach-scope";

/**
 * The Coach's saved conversations.
 *
 * Sebastian, 2026-07-30, pointing at Granola's chat list: *"does it make sense to
 * have it all in one thread? I think it makes more sense to have individual chats."*
 *
 * THE MODEL: a thread is a first-class record with its own id and a `scope` (either
 * `"global"` or a call id). A scope can own MANY threads over time; `activeByScope`
 * only says which one new messages go into right now. That is what makes "New chat"
 * non-destructive — it clears the active pointer, so the next send starts a fresh
 * thread and the old one is still in History instead of being overwritten.
 *
 * It also removes a whole class of bug. The previous one-thread-per-scope model
 * needed a generation counter to DROP a reply that landed after the rep hit "New
 * chat", because there was nowhere for it to go. Here the reply simply lands in the
 * thread that asked for it, which is still on the list.
 *
 * Pure and dependency-free so it can be unit-tested — the component is not reachable
 * from the test runner (vitest runs in `node`, no jsdom).
 */

export type Msg = { role: "user" | "assistant"; text: string; timestamp?: number };

export type Thread = {
  id: string;
  /** `"global"` or a call id — see coach-scope. */
  scope: string;
  messages: Msg[];
  /** Pending dive suggestion. PER-THREAD: shared, it rides the next send as
   *  `pendingCallId` and re-fires DIVE_NOW, paying for a transcript re-read and a
   *  Sonnet call on every message. */
  suggestion: CallSuggestion | null;
  /** Last activity, for History ordering and the TTL sweep. */
  updatedAt: number;
};

export type ThreadStore = {
  threads: Record<string, Thread>;
  /** scope → the thread new messages currently go into. Absent = start a fresh one. */
  activeByScope: Record<string, string>;
};

export const EMPTY_STORE: ThreadStore = { threads: {}, activeByScope: {} };

/** Per-thread history cap. The wire caps independently at 10 turns. */
export const MAX_MESSAGES_PER_THREAD = 40;
/** Total saved conversations. Oldest are dropped first. */
export const MAX_THREADS = 30;
/**
 * How long a saved conversation survives.
 *
 * The single global thread this replaces used 24h. That was right for "restore what
 * I was in the middle of" and far too short for a history LIST — a rep looking back
 * at last week's call would find nothing. Seven days, with the thread cap as the
 * real bound on storage.
 */
export const THREAD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function activeThread(store: ThreadStore, scope: string): Thread | undefined {
  const id = store.activeByScope[scope];
  return id ? store.threads[id] : undefined;
}

/** Begin a conversation. The caller owns id generation (crypto.randomUUID in the app). */
export function startThread(store: ThreadStore, scope: string, id: string, now: number): ThreadStore {
  return {
    threads: { ...store.threads, [id]: { id, scope, messages: [], suggestion: null, updatedAt: now } },
    activeByScope: { ...store.activeByScope, [scope]: id },
  };
}

export function appendMessages(store: ThreadStore, threadId: string, msgs: Msg[], now: number): ThreadStore {
  const t = store.threads[threadId];
  if (!t) {
    // A reply for a thread that has been pruned away. Dropping it is correct — there
    // is no conversation left to attach it to — but it must not be SILENT: the rep
    // would see the dots clear with no answer and no error. Unreachable today (prune
    // never runs while a request is in flight); this is here so that if a third
    // `pruneStore` caller ever appears, the symptom diagnoses itself.
    console.warn(`[coach-threads] dropped ${msgs.length} message(s) for missing thread ${threadId}`);
    return store;
  }
  const merged = [...t.messages, ...msgs];
  const messages = merged.length > MAX_MESSAGES_PER_THREAD ? merged.slice(-MAX_MESSAGES_PER_THREAD) : merged;
  return { ...store, threads: { ...store.threads, [threadId]: { ...t, messages, updatedAt: now } } };
}

export function setThreadSuggestion(store: ThreadStore, threadId: string, suggestion: CallSuggestion | null): ThreadStore {
  const t = store.threads[threadId];
  if (!t || t.suggestion === suggestion) return store;
  return { ...store, threads: { ...store.threads, [threadId]: { ...t, suggestion } } };
}

/**
 * "New chat" — forget which thread is active for this scope, keep the thread itself.
 *
 * Deliberately NOT a delete. The rep asked to start something new, not to destroy
 * what they had; the old conversation stays in History. An in-flight reply for it
 * also still has somewhere to land.
 */
export function clearActive(store: ThreadStore, scope: string): ThreadStore {
  if (!(scope in store.activeByScope)) return store;
  const activeByScope = { ...store.activeByScope };
  delete activeByScope[scope];
  return { ...store, activeByScope };
}

/** Resume a saved conversation: make it active for its own scope. */
export function selectThread(store: ThreadStore, threadId: string): ThreadStore {
  const t = store.threads[threadId];
  if (!t || store.activeByScope[t.scope] === threadId) return store;
  return { ...store, activeByScope: { ...store.activeByScope, [t.scope]: threadId } };
}

/** Everything worth showing in History: has messages, newest first. */
export function historyList(store: ThreadStore): Thread[] {
  return Object.values(store.threads)
    .filter((t) => t.messages.length > 0)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Drop expired and surplus threads.
 *
 * ACTIVE THREADS ARE EXEMPT FROM BOTH RULES — the TTL and the cap. Exempting them
 * from the TTL alone is not enough, and the difference is a real data loss: resuming
 * an old conversation out of History makes it active WITHOUT touching `updatedAt`
 * (deliberately — ordering means "last message", not "last opened"), so it is still
 * the oldest thread in the store. At the cap, the very next new conversation would
 * sort it off the end and delete the chat the rep is reading, from state, from
 * History and from storage on the next save.
 *
 * Everything else is ranked newest-first and fills the remaining slots. Empty
 * non-active threads are dropped outright: they are what a "New chat" the rep never
 * used leaves behind.
 */
export function pruneStore(store: ThreadStore, now: number): ThreadStore {
  const activeIds = new Set(Object.values(store.activeByScope));
  const all = Object.values(store.threads);
  const active = all.filter((t) => activeIds.has(t.id));
  const rest = all
    .filter((t) => !activeIds.has(t.id) && t.messages.length > 0 && now - t.updatedAt < THREAD_TTL_MS)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, Math.max(0, MAX_THREADS - active.length));
  const kept = [...active, ...rest];

  const keptIds = new Set(kept.map((t) => t.id));
  if (keptIds.size === Object.keys(store.threads).length) return store;

  const threads: Record<string, Thread> = {};
  for (const t of kept) threads[t.id] = t;
  const activeByScope: Record<string, string> = {};
  for (const [scope, id] of Object.entries(store.activeByScope)) {
    if (keptIds.has(id)) activeByScope[scope] = id;
  }
  return { threads, activeByScope };
}

/**
 * Compact age for the History list — `34m`, `15h`, `1d`, matching the shape
 * Sebastian pointed at in Granola. Never renders "0m": under a minute reads "now",
 * because a chat you sent five seconds ago labelled "0m" looks like a bug.
 */
export function relativeAge(ts: number, now: number): string {
  const seconds = Math.max(0, now - ts) / 1000;
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export const STORAGE_KEY = "wingman_coach_threads";
/** The single-global-thread key this replaces. Read once, for migration, then dropped. */
export const LEGACY_STORAGE_KEY = "wingman_global_chat";

function isSuggestion(s: unknown): s is CallSuggestion {
  if (!s || typeof s !== "object") return false;
  const { call_id, name } = s as Record<string, unknown>;
  return typeof call_id === "string" && call_id.length > 0 && typeof name === "string";
}

function isMsg(m: unknown): m is Msg {
  if (!m || typeof m !== "object") return false;
  const { role, text } = m as Record<string, unknown>;
  return (role === "user" || role === "assistant") && typeof text === "string";
}

/**
 * Parse a persisted store. Returns null on ANY malformation rather than a partial
 * store — half a conversation reads as a real one, and the coach would answer
 * against a history the rep never had.
 */
export function deserialize(raw: string | null): ThreadStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const { threads, activeByScope } = parsed as Record<string, unknown>;
    if (!threads || typeof threads !== "object") return null;

    const out: Record<string, Thread> = {};
    for (const [id, t] of Object.entries(threads as Record<string, unknown>)) {
      if (!t || typeof t !== "object") return null;
      const { scope, messages, suggestion, updatedAt } = t as Record<string, unknown>;
      if (typeof scope !== "string" || !Array.isArray(messages) || typeof updatedAt !== "number") return null;
      if (!messages.every(isMsg)) return null;
      out[id] = {
        id,
        scope,
        messages: messages as Msg[],
        // Validated like everything else, not cast through. This one now survives a
        // reload and feeds `pendingCallId` on the wire: a corrupted `{}` is truthy,
        // so it would go out as `pendingCallId: undefined`, JSON.stringify would drop
        // the key, and the route would land on its "lost track of which call" branch
        // — honest, but a wasted Sonnet call and quota decrement to get there.
        suggestion: isSuggestion(suggestion) ? suggestion : null,
        updatedAt,
      };
    }

    const active: Record<string, string> = {};
    for (const [scope, id] of Object.entries((activeByScope ?? {}) as Record<string, unknown>)) {
      if (typeof id === "string" && out[id]) active[scope] = id;
    }
    return { threads: out, activeByScope: active };
  } catch {
    return null;
  }
}

/**
 * Migrate the old single global thread so an upgrading rep doesn't lose the
 * conversation they had open. Same 24h expiry the old key enforced.
 */
export function migrateLegacy(raw: string | null, id: string, now: number): ThreadStore | null {
  if (!raw) return null;
  try {
    const { messages, savedAt } = JSON.parse(raw) as { messages?: unknown; savedAt?: unknown };
    if (typeof savedAt !== "number" || now - savedAt >= 24 * 60 * 60 * 1000) return null;
    if (!Array.isArray(messages) || messages.length === 0 || !messages.every(isMsg)) return null;
    return {
      threads: { [id]: { id, scope: GLOBAL_SCOPE, messages: messages as Msg[], suggestion: null, updatedAt: savedAt } },
      activeByScope: { [GLOBAL_SCOPE]: id },
    };
  } catch {
    return null;
  }
}
