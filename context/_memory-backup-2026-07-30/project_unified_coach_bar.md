---
name: project-unified-coach-bar
description: "Unified Coach bar — one bottom chat bar everywhere. Plan v3 (two review rounds), ships as 4 PRs + a PR 5 brief; PRs 1-3 done, PR 4 next"
metadata: 
  node_type: memory
  type: project
  modified: 2026-07-30T12:34:34.590Z
  originSessionId: 0ecc466e-021f-4f36-9210-3ce06bd2c68b
---

**Plan: `tasks/plan-coach-bar.md` (v3 — open it cold).** Sebastian: *"if we use Granola as a
reference, it always just has that bottom chat bar… make the entry point to talking to the
wingman chatbot the same everywhere."*

**Two plan-review rounds: 4 blockers, then 6 more issues. Every claim was independently
re-verified against the code before being accepted — and every one held.** Ships as FOUR PRs.
All local on `feat/design-tokens`, unpushed.

**The diagnosis:** FOUR chat surfaces holding THREE independent conversation states over ONE
backend. Home's Coach and Flight Log's "Mission Intel" are both `mode:"global"` with *different*
message arrays — ask Home, then ask Flight Log a follow-up, and Wingman has no memory of the
first exchange.

## Status

- **PR 1 ✅ (`bc7c53d`)** — the dive handoff. **It had never worked and burned quota per message.**
- **PR 2 ✅ (`b5802f4`)** — the quota counter (under-report, "23 of 20", overnight lockout).
- **PR 3 ✅ (`33ab2a5`)** — state lift into `CoachProvider`, zero visible change.
- **PR 4 🔴 NEXT** — the bar itself. ~400 lines out of a 1,104-line component.
- **PR 5 briefed** — chain-of-thought progress.

## Do these BEFORE writing PR 4

1. **Transcript rows → `useRef`.** They are in provider `useState`; harmless with one mounted tab,
   but the bar is an ALWAYS-MOUNTED consumer and a 2-hour transcript landing would re-render it
   mid-typing.
2. **The outcome overlay must reach EVERY call lookup**, not just the `calls` array. PR 3 shipped
   this bug once: the detail view's `calls.find(...) ?? selectedCall` fallback read a raw
   synthetic row on the HUD deep-link path, so confirming an outcome there re-rendered as if the
   click never happened.
3. `applySessionOutcomes` is **pure, not memoised** — wrap it in `useMemo` at the call site.

## Locked design

- One `<CoachBar>`, **`sticky bottom-0`** — NOT fixed. Fixed would have to duplicate the sidebar
  width constant AND its 0.28s easing, recreating the desync that broke the sidebar collapse.
- `scope = override ?? derived`. `derived` from FlightLogTab via `onOpenCallChange`, fired on
  select, back, **and an unmount cleanup**. `override` set only by a dive and **NOT cleared by a
  tab change** — a dive navigates to Flight Log, so clearing on tab change cancels the dive it
  exists for.
- Threads keyed `"global"` or call id, each `{messages, suggestion}`. Suggestion is **per-thread**
  or a stale one rides the next send and fires a spurious (billed) `DIVE_NOW`.
- In-flight requests tagged with their scope key; **one in-flight per bar** (also serialises quota).
- **The bar goes QUIET during a live call.** `electron/main.ts` registers bare arrow keys as
  GLOBAL shortcuts (`Up` for the whole call, main.ts:343). `globalShortcut` fires before the
  focused textarea, so a rep typing mid-call who presses ↑ opens the compass and the next arrow
  fires a card **onto the HUD in front of the prospect**.
- Row gone from the 20-row window → **disable send with an honest reason**, never let the route
  build an empty context and ask "which call do you mean?"

**Sebastian's calls:** whole reply at once (staggered multi-bubble DROPPED — **CLAUDE.md still
lists it as shipped, update it in PR 4**); dive **opens the call AND** scopes the chat.

## PR 5 — the constraint that decides it

`/api/ai/chat` is **not streamed**. The client has zero visibility into server phases, so a
chain-of-thought added today could only be **invented steps on setTimeout** — the fake-progress
pattern Rule #11 exists to prevent. PR 5 is really *"make the route stream its phases"*
(precedent: `kb-signal` already streams SSE; `lib/wingman/sse-parse.ts` is tested). Best real
phase: **"Retrying (2 of 3)"** — it happens today and is completely invisible, so a ~1.5s stall
just looks frozen.

## Process that worked

Every risky rule was extracted to a **pure function in `lib/` and mutation-tested** — revert the
fix, watch its own test fail. Used on: the dive suggestion lifecycle, the wire contract, the quota
clamp/date-check/render-guard, the `outcome_source` flip, and transcript "unknown vs empty".
**A test that cannot fail is worse than no test** — the plan's first draft proposed a jsdom
assertion on `getBoundingClientRect()`, which returns zeros under jsdom and would have passed
vacuously.

Related: [[project-dashboard-rebuild]] · [[feedback-plan-review-loop]] · [[feedback-dev-server-vs-build]]
