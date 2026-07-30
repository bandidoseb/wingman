# Unified Coach Bar — implementation plan (v3, FINAL)

*Sebastian: "if we use Granola as a reference, it always just has that bottom chat bar… make
the entry point to talking to the wingman chatbot the same everywhere."*

**Two plan-review rounds. Round 1 found 4 blockers, round 2 found 6 more issues. Every claim
below was independently re-verified against the code before it was accepted.**

**Ships as FOUR PRs — see §9. Do not attempt this as one diff.**

---

## PR 1 — §0. The dive handoff is broken and is costing money RIGHT NOW

Independent of this feature. Ship and verify alone.

`src/app/api/ai/chat/route.ts:145-160` selects the dive call **without `id`**; `CallRow`
(:127-136) has no `id`. So `home/Coach.tsx:200`:

```ts
if (data.diveReady?.callData?.id) {   // ← always undefined. Dead since it shipped.
```

1. **On Home, "yes, dive into that call" has never worked.** The rep gets *"Give me a moment —
   I'm reading the full transcript now"* and nothing happens. (`data` is `any` from
   `res.json()`, so TS never caught it. Flight Log's modal path works — it uses `callData` as a
   payload and never reads `.id`.)
2. **It burns money on every later message.** `setSuggestion(null)` (:203) is *inside* the dead
   branch, so `suggestion` never clears → `pendingCallId` rides every later global send (:171)
   → the model re-fires `DIVE_NOW` → `fetchCallWithRetry` re-reads the full row **plus the whole
   transcript** (3 attempts, :138-173) → another Sonnet call → another quota decrement. Per
   message, until reload.

### The fix

- **Return `callId: validPendingCallId` in `diveReady`** — already UUID-validated (:267-269),
  no type change, and it doesn't mutate `callData`, which FlightLogTab echoes back verbatim as
  `call` on every later turn (:451-455). (Adding `id` to the select also works — nothing reads
  it in `buildSingleCallContext` — but it changes a payload for zero gain.)
- **Do NOT clear `suggestion` unconditionally — that breaks retry.** Three branches
  (route.ts:389-400) deliberately say *"just say 'try again'"*, and the comment at :396 states
  the client **keeps** `pendingCallSuggestion` so the retry can work. Correct rule: server
  returns `diveFailed: true` on those branches; the client keeps the suggestion **only** when
  `diveFailed`, otherwise `setSuggestion(data.callSuggestion ?? null)`.
- The client half here is **deliberately throwaway** — PR 4 replaces `onOpenCall(id)` with a
  scope switch. Note it in the PR so `wingman-reviewer` doesn't flag duplicated logic.

---

## PR 2 — §4. Quota

### Bugs

1. **Sidebar under-reports.** `coachUsed = max(server, baseline + coachSession.sentCount)`
   (DashboardClient.tsx:108-113, `chat-quota.ts:51`). FlightLogTab never touches `sentCount`,
   so messages from the Mission Intel modal and the per-call chat increment the *server's*
   `chat_messages_today` but not the client's → surprise 429 with headroom still showing.
2. **"23 of 20".** On 429 the client sets `sentCount = CHAT_DAILY_CAP` (Coach.tsx:187); with
   `baseline = 3`, `max(server, 3 + 20)` = 23 → the sidebar renders **"23 of 20"** and
   **"-3 left"**, unclamped (Sidebar.tsx:394,397).
3. **Midnight rollover locks the rep out.** `baseline` is captured **once** in a `useRef`
   (DashboardClient.tsx:108) and never resets. After UTC midnight the server reports
   `chat_messages_today = 1` while `baseline` is yesterday's 12 → `max` keeps the stale high
   count → a rep who left the tab open overnight stays capped.

### Fix

- Route returns `messagesUsedToday` on the **success path AND the 429 branch** (:252-257
  currently returns before it). Additive, zero cost.
- Client keeps the server's **absolute** in its own state: `used = max(serverReported,
  baseline + sent)`. **When `serverReported` comes back LOWER than the current display, reset
  `baseline` and `sent`** — that decrease is the only rollover signal the client ever gets.
- Increment on **every** 200 path including dive (Coach.tsx:199-207 returns before
  `setSentCount` at :212). Invariant: increment on 200, then reconcile with `max` — never both
  additive.
- Clamp the display to `CHAT_DAILY_CAP`. With the 429 now returning a real number this is
  belt-and-braces rather than the fix.
- Caveat, stated not papered over: the server increment is a read-modify-write
  (route.ts:412-415), not atomic. Two tabs racing lose a count.

**Must land before PR 4** — after the merge you can't tell a quota bug from a scope bug.

---

## PR 3 — State lift, zero visible change

### Why the bar can't work without it

- **No transcript.** The dashboard query deliberately drops transcripts (`page.tsx:30-35`).
  The only source is FlightLogTab-local `transcriptCache` (:269) / `noDebriefIds` (:273),
  destroyed on unmount. And `/api/calls/[id]?include=transcript` does **not** return
  `call_stages` (`api/calls/[id]/route.ts:34`) — a bar that fetches for itself silently drops
  the STAGES block, changes the cached prefix, and answers *worse* than today.
- **Outcome overrides aren't where v1 assumed.** ✓/✗ writes to HomeTab-local `confirmed`
  (:73); FlightLogTab has a separate `localOutcomes` (:198). Without lifting, the bar re-ships
  the bug HomeTab.tsx:98-101 documents as fixed — close-rate answers ignoring a ✓ from seconds
  ago.

### Placement: `<CoachProvider>`, NOT DashboardClient's body

```
<CoachProvider>{tabs}<CoachBar/></CoachProvider>
```

Putting a 1,400-row transcript into `DashboardClient` state would drag it into the render path
of the component that owns `handleMenuPick`, `handleDigPick`, the objection ledger and the pill
machinery — and every chat message re-renders that tree. It also **retains** for the session
what today dies on tab unmount. The provider keeps DashboardClient's diff at ~4 lines, which is
what makes "no changes to polling or the pill state machine" actually verifiable.

**Transcript rows live in a `useRef(Map)` inside the provider**; only the small per-call
`{status}` goes in state, so rows never trigger a render.

### The two overlays have different shapes — merge carefully

HomeTab's sets `outcome_source: "manual"` (:106) so `confirmedOutcome()` counts it.
FlightLog's `localOutcomes` is a bare string, read by `effectiveOutcome` (:208) and
`listOutcome` (:873) — and `listOutcome` feeds `wins`/`qualifying`, i.e. the **"N/M closed"
header** (:874-875, :931). Merge to `{ outcome, source: "manual" }` and migrate **both**
consumers, or that count changes silently.

**Manual pass for this PR specifically:** Flight Log's "N/M closed" header, and the "nothing
was captured for this call" answer on a no-transcript call (FlightLogTab.tsx:594-597) — the two
things this lift can quietly break.

---

## PR 4 — The bar

### Target

One `<CoachBar>`, `sticky bottom-0`, on every tab. Scope drives placeholder, chips and which
thread is visible. Sending expands the existing Granola-style takeover. **Deleted:** the
Mission Intel card + modal, and the per-call "Ask Wingman" card.

### Layout: `sticky bottom-0`, NOT `position: fixed`

The content column is offset by `marginLeft: sidebarWidth` with a
`0.28s cubic-bezier(0.22,1,0.36,1)` transition (DashboardClient.tsx:1642-1647). A fixed bar
would have to duplicate **both the width constant and the easing** — recreating the exact
desync that broke the sidebar collapse earlier today. Sticky needs neither, and no
bottom-padding constant.

The takeover keeps a **definite** height (`h-[calc(100vh-96px)]`, HomeTab.tsx:129-140), not
`min-h-` — that distinction is what fixed the earlier BLOCK where the composer walked to
y=2022 in a 794px viewport at 40 messages. It renders as a fixed overlay with its own definite
height; it must not inherit the page column's `minHeight:"100vh"` + 48px padding, which is that
failure case exactly.

### Scope state machine

```
scope = override ?? derived

derived  = callId from FlightLogTab via onOpenCallChange(callId | null)
           fired on select, on back, AND in an unmount cleanup
           (FlightLogTab unmounts on every tab switch — DashboardClient.tsx:1668 —
            so without the cleanup the bar keeps a scope for a call that's gone)

override = set ONLY by a dive.
           Cleared by: `derived` becoming a DIFFERENT non-null call · the chip's ✕ · New chat.
           NOT cleared by a tab change — a dive navigates to Flight Log, so clearing on tab
           change would cancel the dive it exists to serve.
```

- **Threads:** `Record<string, { messages: Msg[]; suggestion: Suggestion | null }>`, keyed
  `"global"` or a call id. `suggestion` is **per-thread** — shared, a suggestion from an
  abandoned conversation rides the next global send → spurious `DIVE_NOW` → wasted Sonnet call.
- **In-flight requests are tagged with their scope key.** On resolve, write into **that
  thread's** history and render only if it is still the visible scope. Typing dots render in
  the *owning* thread, not the visible one. **One in-flight per bar** — a scope switch does not
  unlock the composer; that also serializes quota.
- **No LRU.** 20 calls × 20 messages ≈ 200 KB against an already-MB payload; it bought nothing
  and created an undefined case (a response landing in an evicted thread). Cap **messages per
  thread** — the wire already caps at 10 turns (Coach.tsx:158, route.ts:329-331).
- **New chat** clears that thread's messages + suggestion + input, and drops the override.
- **Reopening a call resumes its thread** (today all four paths reset `chatMessages` —
  FlightLogTab.tsx:236, :253, :652, :972). Deliberate change; per-thread "New chat" stays.
- **Re-derive the call by id on every send**, never from the snapshot taken when scope was set:
  the deep-link path opens a *synthetic* Call (`prospect_name: null, summary: null`, :248-252).
- **If the row is gone** — deleted, or fallen out of the 20-row window (`page.tsx:35`) —
  `calls.find()` returns undefined, the route's `mode==="single_call" && call` guard
  (route.ts:275) leaves `contextStr` empty, and the model gets CORE_PROMPT only and asks "which
  call do you mean?" — the exact failure the `unknown` branch exists to prevent. **Disable send
  in that scope with an honest reason.**

### Live call — the bar goes QUIET

`electron/main.ts` registers **bare arrow keys as global shortcuts**: `Up` for the whole call
(:343), `Left/Down/Right` while the compass is open (:206), as direct picks for 2 min of flow
mode (:244), `Down` after a close chip (:318). `globalShortcut` fires **before** the focused
textarea. A rep typing mid-call who presses ↑ opens the compass; the next arrow fires a slot →
a billed Sonnet stream → **a card on the HUD in front of the prospect.**

**Input + chips disabled whenever `isActive || deployPhase !== "idle" || isPendingOutcome`**,
with a visible reason — the same gate that protects the End Call button. This also resolves the
Live Hub pill collision (pill defaults to `bottom:80px; left:32px`, `electron/hud/index.html:357-360`,
draggable and position-persisted, in an always-on-top `screen-saver`-level window that wins
every z-fight).

⚠️ The composer now has **two** disable reasons — daily cap and live call. Distinct copy, or a
rep mid-call reads "Daily limit reached."

### Deletes

Both chat UIs, plus the leftovers: `chatEndRef`/`globalEndRef`/`modalEndRef`/`modalInputRef`/
`callInputRef` (:217-221), `globalInFlightRef`/`callInFlightRef` (:222-223), `userIsTyping`/
`userTypingTimerRef` (:224-225) + cleanup effect (:395-397), `modalOpen` (:226),
`pendingCallSuggestion`/`activeSingleCall`/`singleCallHistoryRef` (:229-231), four scroll/focus
effects (:362-378), modal ESC handler (:381-392), `formatTimestamp` (:157-163), `GlobalMessage`
(:209), both `/api/ai/chat` fetches.

**Port, don't delete:** `wingman_global_chat` localStorage, 24h TTL (:399-424). The Coach thread
is in-memory only (Coach.tsx:36-39), so a naive merge regresses a shipped behaviour and orphans
the key.

**Escape has two owners on Flight Log:** Coach binds window-level Escape while open
(Coach.tsx:133-138); OutcomePicker's "Other" input uses Escape to cancel (:127). Bind on the
panel, or skip when `e.target` is an input.

---

## Decisions — CLOSED (Sebastian, 2026-07-29)

1. **Whole reply at once.** The staggered multi-bubble path (:487, :513-517, :534-542 — 2s
   "reading" pause, then 3s between chunks) is DROPPED. It cost ~9s before the answer was
   readable. **`CLAUDE.md` must be updated** — it lists staggered multi-bubble as shipped.
   Bonus: the scope-change drop rule is now a single resolve, not N deferred writes over 9s.
2. **Dive opens the call AND scopes the chat to it.** Sets `override` to that call id and routes
   to Flight Log with it open. If `onOpenCall` returns false (not in the loaded list), fall back
   to scope-only and **say so in the reply** — never silently do nothing.

**Decided without asking:** bar disabled during a live call (safety); localStorage persistence
ported; reopening a call resumes its thread.

---

## §9. Phasing — four PRs, in this order

| PR | Scope | Why separate |
|---|---|---|
| **1** | Dive fix (`callId`, `diveFailed`, suggestion lifecycle) | 3 hunks. Live, costing money now. |
| **2** | Quota (route returns `messagesUsedToday` on 200 **and** 429; reconcile + rollover reset + clamp) | Independently testable, zero UI risk. **After the merge you can't tell a quota bug from a scope bug.** |
| **3** | State lift only, zero visible change (`CoachProvider`, `sessionOutcomes`, transcript store) | This is the diff that can silently break Flight Log's close count and the `transcriptStatus` contract. Own review, own manual pass. |
| **4** | CoachBar, scope machine, deletes, `CLAUDE.md` | ~400 lines out of a 1,104-line component. |

⚠️ **Merge-order warning:** PR 4 rewrites `FlightLogTab.tsx` and `HomeTab.tsx` — the same files
being swept for dark mode on the unmerged `feat/design-tokens`. Land 1-3 first and **don't let
PR 4 sit**; PR #53's squash-merge already cost a 15-file conflict.

---

## §10. Gates

- `npm run typecheck` + `typecheck:electron`
- `npx vitest run` — **verify the count, don't assert 218**
- `npm run build:verify` (**never** `npm run build` — it kills a running dev server)
- `node scripts/token-lint.mjs` — must not increase
- `wingman-reviewer` on every PR before it is called done

**The composer-position check is a MANUAL browser measurement, not a unit test.**
`vitest.config.ts` is `environment:"node"` with no jsdom, no testing-library, no Playwright
(verified: 0 matches in package.json), and under jsdom `getBoundingClientRect()` returns zeros
so the assertion would pass vacuously — **a test that can never fail is worse than none.**
Seed 40 messages in the browser and measure the composer's `bottom` against `innerHeight` (the
method that produced the original 2022px/794px numbers).

**Manual pass:** send in global scope → open a call → send in call scope → back → reopen (thread
intact) → sidebar counter matches messages actually sent → start a call, confirm the bar is
disabled → Flight Log "N/M closed" header unchanged → no-transcript call still answers honestly.
