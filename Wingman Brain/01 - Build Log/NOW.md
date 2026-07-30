# NOW

Last updated: 2026-07-30

> **This file answers one question: what is true right now?** It is rewritten each session by
> `/wrap` — never appended to. Finished work moves down to [[Sprint Archive]]; the full story of
> a session lives in its dated log. **Five headings only** (a hook blocks a sixth), and the file
> is size-capped, so it can never grow into another 755-line scroll.
>
> **Do not hand-type status here** — no "not pushed", "not merged", "nothing deployed". Those
> rot within a day. Branch, PR, and release status is injected live by the SessionStart hook and
> generated into `context/STATE.md`. That rule exists because on 2026-07-30 both this file's
> predecessor and MEMORY.md insisted `feat/design-tokens` was "17 commits UNPUSHED" while it had
> already merged as PR #58 and shipped.

---

## Next action

**PR 4 of `tasks/plan-coach-bar.md` — the unified Coach bar.** Plan is at v3 (two review rounds;
4 blockers + 6 issues found and folded).

**Two carry-forwards land first — see below.**

⚠️ PR 4 rewrites `FlightLogTab.tsx` and `HomeTab.tsx`, the same files the dark-mode sweep just
touched. **Don't let it sit unmerged** — PR #53's squash-merge cost a 15-file conflict, and that
lesson has now been paid for twice.

Decisions already closed, don't reopen: the Coach replies as **one message** (staggered bubbles
dropped); "dive into that call" opens the call **and** scopes the chat.

**PR 5 is briefed but blocked on a rewrite:** chain-of-thought progress. `/api/ai/chat` is not
streamed, so a progress display added today could only be **invented steps on timers** — that is
Product Rule #11. PR 5 is really "make the route stream its phases." The one real phase that
happens today and is invisible: **"Retrying (2 of 3)"**.

---

## Blocked on Sebastian

- **Typeface call.** The app ships **Geist** (`src/app/layout.tsx` assigns it to `--font-sans`,
  shadowing the token) but Design Language §4 says system sans / SF Pro. Left unchanged because
  it restyles every screen. Pick one.
- **Dark-mode sweep of every screen** — the instrument is `tasks/dashboard-sweep.md` and it is
  still **completely empty**. Nothing downstream of it can start.
- **`.claude/settings.local.json` sets `"defaultMode": "bypassPermissions"`** and that file is
  git-tracked, not ignored. Permission prompts are off and the setting is committed. Deliberate?
  If yes, leave it. If not, it should move to a gitignored file.
- **Objection Vault redesign** — rank by DAMAGE not frequency; buckets → instances; kill the red
  NEW badges (red means *lost*, never decoration — Design Language §3d).

---

## In flight

Nothing mid-code. `main` is clean at the context-system cleanup.

**Live now** (verify with the SessionStart hook, never from this line): `main` carries PR #58
(dashboard rebuild + dark mode + 3 Coach bug fixes, merged 2026-07-30). Latest desktop release
**v0.1.29**, published live to `bandidoseb/wingman-releases`, auto-update confirmed working.

---

## Carry-forwards

These are the "do this before the next thing" notes. They exist in exactly one place — here.

1. **Transcript rows → `useRef`** before an always-mounted consumer exists. PR 4 creates that
   consumer, so this has to land first.
2. **Any new call-by-id lookup needs the outcome overlay.** PR 3 shipped that exact bug once
   already — a call fetched by id rendered without its confirmed outcome.
3. **`#52`'s cold-ladder dig gate still needs one live verification on a real *talking* call.**
   The smoke test had no finalized speech, so the gate has never actually been exercised.
4. **`#57`'s sidebar traffic-light clearance was verified by arithmetic only** — the browser has
   no traffic lights. Needs one Electron eyeball.

---

## Backlog

**Everything below is behind the cutline.** `tasks/launch-plan.md` is law: *does this block a
Test Pilot from using the 4 arrows?* If no → it stays here, however good it is.

**Pre-beta, required**
- **Exhaustion detection** on ↓ — reps will mash it; no sense of exhaustion within a belief reads
  as interrogation, which is Rule #11 breaking in front of the first ten users.
- **← Answer card** — the one empty compass slot. A direct general-LLM call, *not* the dead KB path.
- **↓ rename to "Discover"** — user-facing labels only. Never rename `dig-prompt.mjs`,
  `DIG_SYSTEM_PROMPT`, the `"dig"` id, or any eval id.
- **`/terms` and `/privacy` on meetwingman.ai** — the signup ToS line already links to `/terms`
  and that URL must resolve before a single beta user signs up.
- **Beta onboarding email** — download link is the public `wingman-releases` page. **No quarantine
  command** (notarized since 2026-07-01). Mention it auto-updates after first install.

**Queued projects** (each its own fresh session — do not batch)
- Core card **voice** rework → then un-pin the confrontation dial (built, gated, inert)
- Replay harness (blocked on Land Geek transcripts — keep them local + git-ignored)
- In-call prospect anchor capture · dig-card threading + non-sequitur fix
- Summarizer (Belief Ladder) tuning — brief is session-ready at `tasks/plan-summarizer-tuning.md`
- Close-readiness follow-ups · shared readiness engine so every card agrees
- Sales DNA Phase 1d — wire raw DNA into the **objection** card + the payment-terms configurator

**Post-launch**
- **Replace Recall with our own capture, in shadow mode** — decided. $1.25/hr → $0.15–0.30/hr,
  a 55–75% cut. Runs alongside Recall, compare ~20 real calls, flip only at proven parity.
- **A/V recording (Wingman as notetaker)** — ⚠️ this **reverses Architectural Invariant #6** and
  needs Sebastian's explicit call plus a privacy lawyer before any storage code exists.
- Stripe billing end-to-end · PostHog analytics · full undetectability buildout
  (`app.dock.hide()`, CMD+Tab removal, Settings toggle)
- Calendar detection · voice-AI onboarding · owner cockpit · positioning demo · iMessage funnel
- Pinecone migration (blocked: Sebastian creates the account + `wingman-kb` index)
- Vercel migration · Wingman Intelligence graph visualizer · transcript tester tool
- Signal-card simulation testing · Ask Wingman automated test suite
- KB re-ingestion (#28 `trigger_type` classification + #29 Pass-2 trigger diversity)
- **Recall.ai Launch plan** — before signing, ask: (1) overage rate above 6,000 h, (2) the
  3,000 h starter option. Then update the rate in `margin-calculator.html`.

**Dead — do not resurrect**
- Pusher push migration (superseded by the hotkey pivot; Phase 5 rips out the leftover path)
- "Offer Brain" → "Sales DNA" rename sweep — **phantom task.** The term never existed in app
  code or the schema. Verified: `grep -rn "offer_brain\|offerBrain" src electron supabase` is empty.
