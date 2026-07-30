/**
 * Unit tests — the Coach's saved conversations.
 *
 * The thing these guard: "New chat" must never DESTROY a conversation, and a reply
 * that lands after it must still have a home. The previous one-thread-per-scope
 * model needed a generation counter to throw such a reply away; this model gives it
 * somewhere to go, and History is what makes that visible to the rep.
 */
import { describe, it, expect } from "vitest";
import {
  EMPTY_STORE,
  MAX_MESSAGES_PER_THREAD,
  MAX_THREADS,
  THREAD_TTL_MS,
  STORAGE_KEY,
  activeThread,
  startThread,
  appendMessages,
  setThreadSuggestion,
  clearActive,
  selectThread,
  historyList,
  relativeAge,
  pruneStore,
  deserialize,
  migrateLegacy,
  type ThreadStore,
  type Msg,
} from "../../src/lib/wingman/coach-threads";
import { GLOBAL_SCOPE } from "../../src/lib/wingman/coach-scope";

const CALL_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const T0 = 1_800_000_000_000;
const msg = (text: string, role: Msg["role"] = "user"): Msg => ({ role, text, timestamp: T0 });

function seeded(): ThreadStore {
  let s = startThread(EMPTY_STORE, GLOBAL_SCOPE, "t-global", T0);
  s = appendMessages(s, "t-global", [msg("where do I lose deals?")], T0);
  return s;
}

describe("startThread / activeThread", () => {
  it("makes the new thread the active one for its scope", () => {
    const s = startThread(EMPTY_STORE, GLOBAL_SCOPE, "t1", T0);
    expect(activeThread(s, GLOBAL_SCOPE)?.id).toBe("t1");
    expect(activeThread(s, CALL_A)).toBeUndefined();
  });

  it("keeps scopes independent", () => {
    let s = startThread(EMPTY_STORE, GLOBAL_SCOPE, "t1", T0);
    s = startThread(s, CALL_A, "t2", T0);
    expect(activeThread(s, GLOBAL_SCOPE)?.id).toBe("t1");
    expect(activeThread(s, CALL_A)?.id).toBe("t2");
  });
});

describe("New chat is non-destructive", () => {
  it("keeps the old conversation and starts a fresh one", () => {
    let s = seeded();
    s = clearActive(s, GLOBAL_SCOPE);
    expect(activeThread(s, GLOBAL_SCOPE)).toBeUndefined();       // fresh slate
    expect(s.threads["t-global"].messages).toHaveLength(1);      // ...but not gone
    expect(historyList(s).map((t) => t.id)).toEqual(["t-global"]);
  });

  it("still delivers a reply that was in flight when it was pressed", () => {
    // The exact case the old model had to DROP, because the reply had nowhere to go.
    let s = seeded();
    s = clearActive(s, GLOBAL_SCOPE);
    s = startThread(s, GLOBAL_SCOPE, "t-new", T0 + 1);
    s = appendMessages(s, "t-global", [msg("budget.", "assistant")], T0 + 2);
    expect(s.threads["t-global"].messages).toHaveLength(2);
    expect(activeThread(s, GLOBAL_SCOPE)?.id).toBe("t-new");     // rep is still on the new one
  });

  it("is a no-op when nothing is active", () => {
    const s = clearActive(EMPTY_STORE, GLOBAL_SCOPE);
    expect(s).toBe(EMPTY_STORE);
  });
});

describe("appendMessages", () => {
  it("caps a thread's history", () => {
    let s = startThread(EMPTY_STORE, GLOBAL_SCOPE, "t1", T0);
    for (let i = 0; i < MAX_MESSAGES_PER_THREAD + 10; i++) s = appendMessages(s, "t1", [msg(`m${i}`)], T0 + i);
    const m = s.threads["t1"].messages;
    expect(m).toHaveLength(MAX_MESSAGES_PER_THREAD);
    expect(m[m.length - 1].text).toBe(`m${MAX_MESSAGES_PER_THREAD + 9}`);   // newest kept
  });

  it("drops a reply for a thread that has been pruned away", () => {
    const s = appendMessages(EMPTY_STORE, "gone", [msg("hi")], T0);
    expect(s).toBe(EMPTY_STORE);
  });
});

describe("selectThread", () => {
  it("resumes a saved conversation for its own scope", () => {
    let s = seeded();
    s = clearActive(s, GLOBAL_SCOPE);
    s = selectThread(s, "t-global");
    expect(activeThread(s, GLOBAL_SCOPE)?.id).toBe("t-global");
  });

  it("ignores an unknown id and returns the SAME object when already active", () => {
    const s = seeded();
    expect(selectThread(s, "nope")).toBe(s);
    expect(selectThread(s, "t-global")).toBe(s);
  });
});

describe("historyList", () => {
  it("hides empty threads and sorts newest first", () => {
    let s = seeded();
    s = startThread(s, CALL_A, "t-call", T0 + 100);
    s = appendMessages(s, "t-call", [msg("what did I miss?")], T0 + 100);
    s = startThread(s, "other-call", "t-empty", T0 + 200);     // never used
    expect(historyList(s).map((t) => t.id)).toEqual(["t-call", "t-global"]);
  });
});

describe("pruneStore", () => {
  it("drops threads past the TTL", () => {
    const s = pruneStore(seeded(), T0 + THREAD_TTL_MS + 1);
    // "t-global" is still ACTIVE, so it survives — the rep may be mid-sentence in it.
    expect(s.threads["t-global"]).toBeDefined();

    let s2 = seeded();
    s2 = clearActive(s2, GLOBAL_SCOPE);                        // no longer active
    expect(pruneStore(s2, T0 + THREAD_TTL_MS + 1).threads["t-global"]).toBeUndefined();
  });

  it("keeps the newest MAX_THREADS and forgets pointers to the rest", () => {
    // All in ONE scope, so only the last is active and the cap has something to bite.
    let s = EMPTY_STORE;
    for (let i = 0; i < MAX_THREADS + 5; i++) {
      s = startThread(s, "global", `t${i}`, T0 + i);
      s = appendMessages(s, `t${i}`, [msg("hi")], T0 + i);
    }
    const pruned = pruneStore(s, T0 + 1000);
    expect(Object.keys(pruned.threads)).toHaveLength(MAX_THREADS);
    expect(pruned.threads["t0"]).toBeUndefined();              // oldest gone
    // Every surviving pointer resolves — a dangling one would render a blank thread.
    for (const id of Object.values(pruned.activeByScope)) expect(pruned.threads[id]).toBeDefined();
  });

  it("never evicts an ACTIVE thread at the cap, however old it is", () => {
    /*
      The data-loss case. Resuming an old conversation from History makes it active
      WITHOUT bumping `updatedAt` (ordering means "last message", not "last opened"),
      so it is still the oldest thread in the store. Exempting active threads from
      the TTL but not the cap would delete the chat the rep is reading the moment
      they start one more conversation somewhere else.
    */
    let s = startThread(EMPTY_STORE, "old-call", "t-ancient", T0);
    s = appendMessages(s, "t-ancient", [msg("what did I miss?")], T0);
    for (let i = 0; i < MAX_THREADS + 5; i++) {
      s = startThread(s, "global", `t${i}`, T0 + 1000 + i);     // all far newer
      s = appendMessages(s, `t${i}`, [msg("hi")], T0 + 1000 + i);
    }
    const pruned = pruneStore(s, T0 + 5000);
    expect(pruned.threads["t-ancient"]).toBeDefined();
    expect(pruned.activeByScope["old-call"]).toBe("t-ancient");
    // ...and the cap still holds overall.
    expect(Object.keys(pruned.threads).length).toBeLessThanOrEqual(MAX_THREADS);
  });

  it("returns the SAME object when nothing is dropped, so React bails out", () => {
    const s = seeded();
    expect(pruneStore(s, T0 + 1000)).toBe(s);
  });
});

describe("deserialize", () => {
  it("round-trips", () => {
    const s = seeded();
    const back = deserialize(JSON.stringify(s));
    expect(back).toEqual(s);
  });

  it("returns null on ANY malformation rather than a partial store", () => {
    // Half a conversation reads as a real one, and the coach would answer against a
    // history the rep never had.
    expect(deserialize(null)).toBeNull();
    expect(deserialize("not json")).toBeNull();
    expect(deserialize(JSON.stringify({ threads: "nope" }))).toBeNull();
    expect(deserialize(JSON.stringify({ threads: { a: { scope: "global", messages: [{ role: "user" }], updatedAt: 1 } } }))).toBeNull();
    expect(deserialize(JSON.stringify({ threads: { a: { scope: 1, messages: [], updatedAt: 1 } } }))).toBeNull();
  });

  it("drops an active pointer whose thread is missing", () => {
    const raw = JSON.stringify({ threads: {}, activeByScope: { global: "ghost" } });
    expect(deserialize(raw)).toEqual({ threads: {}, activeByScope: {} });
  });

  it("uses a stable storage key", () => {
    expect(STORAGE_KEY).toBe("wingman_coach_threads");
  });
});

describe("migrateLegacy", () => {
  it("carries the old single global thread across the upgrade", () => {
    const raw = JSON.stringify({ messages: [msg("hi"), msg("hey", "assistant")], savedAt: T0 });
    const s = migrateLegacy(raw, "t-migrated", T0 + 1000)!;
    expect(activeThread(s, GLOBAL_SCOPE)?.messages).toHaveLength(2);
    expect(s.threads["t-migrated"].scope).toBe(GLOBAL_SCOPE);
  });

  it("honours the old key's 24h expiry", () => {
    const raw = JSON.stringify({ messages: [msg("hi")], savedAt: T0 });
    expect(migrateLegacy(raw, "t", T0 + 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("ignores absent, empty or malformed legacy data", () => {
    expect(migrateLegacy(null, "t", T0)).toBeNull();
    expect(migrateLegacy(JSON.stringify({ messages: [], savedAt: T0 }), "t", T0)).toBeNull();
    expect(migrateLegacy("{{", "t", T0)).toBeNull();
    expect(migrateLegacy(JSON.stringify({ messages: [{ role: "bogus", text: "x" }], savedAt: T0 }), "t", T0)).toBeNull();
  });
});

describe("setThreadSuggestion", () => {
  it("is per-thread, so a stale one can't ride another conversation's send", () => {
    let s = seeded();
    s = startThread(s, CALL_A, "t-call", T0);
    s = setThreadSuggestion(s, "t-global", { call_id: CALL_A, name: "kathryn" });
    expect(s.threads["t-global"].suggestion?.call_id).toBe(CALL_A);
    expect(s.threads["t-call"].suggestion).toBeNull();
  });

  it("returns the SAME object when unchanged", () => {
    const s = seeded();
    expect(setThreadSuggestion(s, "t-global", null)).toBe(s);
    expect(setThreadSuggestion(s, "missing", null)).toBe(s);
  });
});

describe("relativeAge", () => {
  it("never renders a confusing 0m", () => {
    // A chat sent five seconds ago labelled "0m" reads as a bug.
    expect(relativeAge(T0, T0)).toBe("now");
    expect(relativeAge(T0, T0 + 59_000)).toBe("now");
  });

  it("matches the shape Granola uses", () => {
    expect(relativeAge(T0, T0 + 60_000)).toBe("1m");
    expect(relativeAge(T0, T0 + 34 * 60_000)).toBe("34m");
    expect(relativeAge(T0, T0 + 15 * 3_600_000)).toBe("15h");
    expect(relativeAge(T0, T0 + 25 * 3_600_000)).toBe("1d");
    expect(relativeAge(T0, T0 + 6 * 86_400_000)).toBe("6d");
  });

  it("clamps a future timestamp instead of printing a negative age", () => {
    // Clock skew between a persisted `updatedAt` and this render.
    expect(relativeAge(T0 + 10_000, T0)).toBe("now");
  });
});

describe("deserialize — suggestion validation", () => {
  const withSuggestion = (suggestion: unknown) =>
    JSON.stringify({
      threads: { a: { scope: "global", messages: [{ role: "user", text: "hi" }], suggestion, updatedAt: T0 } },
      activeByScope: { global: "a" },
    });

  it("keeps a well-formed suggestion", () => {
    const s = deserialize(withSuggestion({ call_id: CALL_A, name: "kathryn" }))!;
    expect(s.threads["a"].suggestion).toEqual({ call_id: CALL_A, name: "kathryn" });
  });

  it("drops a malformed one instead of casting it through", () => {
    /*
      It now survives a reload and feeds `pendingCallId` on the wire. A corrupted `{}`
      is TRUTHY, so it would be sent as `pendingCallId: undefined`, JSON.stringify
      would drop the key, and the route would fall to its "lost track of which call"
      branch — one wasted Sonnet call and quota decrement to get to an honest error.
    */
    for (const bad of [{}, { call_id: 123, name: "x" }, { call_id: "" }, "nope", 7]) {
      expect(deserialize(withSuggestion(bad))!.threads["a"].suggestion).toBeNull();
    }
  });
});
