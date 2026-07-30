# TODO — Dashboard Rebuild

*Plan written 2026-07-28. Supersedes the post-call flow todo (shipped in v0.1.29; narrative in `Wingman Brain/01 - Build Log/2026-07-24.md` + `2026-07-28.md`; its one open item — live-test on a real call — is tracked in `launch-plan.md` Session 8 dogfood).*

**Scope decision:** Sebastian pulled "Dashboard full rebuild" OUT of the Parking Lot into Track 1 (2026-07-28) after I flagged the cutline. His call, reaffirmed. `tasks/launch-plan.md` updated to match.

---

## The diagnosis (measured, not vibes)

The Design Language doc (`Wingman Brain/00 - Product/Wingman Design Language.md`) defines a full token system. **Rollout step 2 — "tokens into the app" — was never done.** `src/app/globals.css` is 187 lines: one font var, scrollbar styling, keyframes. Zero tokens.

| Metric | Value |
|---|---|
| Hardcoded hex literals across dashboard | **577** |
| Unique color values in use | **41** |
| Colors the Design Language defines | ~20 |
| Shared UI primitives | 5 (+2 Aceternity imports) |
| `DashboardClient.tsx` | 1687 lines (monolith) |
| Worst file | `FlightLogTab.tsx` — 137 literals / 17 colors |

**Conclusion:** "Frankensteined" is not a taste problem — it's the absence of a token layer. Every tab invented its own palette because there was nothing to inherit from. Fix the layer and most of the complaint dissolves mechanically.

---

## Sequencing (why this order)

Sebastian's sweep and the token foundation are **independent** — the foundation needs zero opinions from him. So they run in parallel: he sweeps while I build tokens. Nobody waits.

Then screens rebuild one at a time, each its own PR, each deploying instantly via Railway. This is the design doc's own rollout order ("one language, many rebuilds — NOT one big build").

```
NOW ──┬── Sebastian: fill in tasks/dashboard-sweep.md
      └── Claude:    Session A (token foundation)
                            │
                            ▼
                  Session B → C → D → E   (screen by screen, sweep notes drive content)
```

---

## Session A — Token foundation  ⬅️ START HERE (no sweep input required)

**Goal:** one source of truth for color / type / space / motion. Zero visual redesign this session — this is plumbing.

- [x] A1. Full token set in `src/app/globals.css` — light + dark, both *designed* per §3b. Neutrals, signal accent, state, sunset/score stops, radii, elevation, motion. **Format: space-separated RGB channels** (`--ink-1: 27 26 23`) so Tailwind opacity modifiers work (`text-ink-1/70`); raw CSS uses `rgb(var(--ink-1))`.
- [x] A2. shadcn bridge in the same file — `--background`/`--card`/`--primary`/`--border`/`--ring`/`--sidebar-*`/`--radius-*` all point at Wingman tokens. Previously stock oklch AND unwired.
- [x] A3. `tailwind.config.ts` exposes tokens as utilities; dead `wm-*` iOS palette removed (verified 0 usages).
- [x] A4. Type scale (§4) as `.t-*` classes + Tailwind `text-h1`/`text-label`/etc, incl. `--font-mono` + `tabular-nums`.
- [x] A5. Primitives in `src/components/ui/wm/` — **Button** (primary/secondary/ghost/danger), **Card**, **Input**+Textarea, **Pill**. All token-only, verified 0 literals by token-lint.
- [x] A6. `scripts/token-lint.mjs` + baseline, wired into CI after unit tests.

**Deliberately deferred from A5 — Tabs, Dialog, TableRow.** Building primitives with no consumer means guessing their API. They get built in B–E against a real screen. Noting it so it isn't mistaken for an oversight.

**Key decisions made during A (each has a why):**
- **`--signal`, not `--accent`.** shadcn reserves `--accent` for its neutral hover fill. Pointing that at signal blue would turn every shadcn hover state solid blue. Spec §3c's own title is "Signal blue", so the name is faithful; only the variable differs.
- **Semantic radius/shadow names** (`rounded-card`, `rounded-control`, `rounded-pill`, `shadow-raised`, `shadow-float`, `shadow-overlay`) instead of overriding Tailwind's `sm/md/lg`. Overriding would have silently restyled every existing `rounded-lg` and `shadow-sm` across 8 unreviewed screens — while Sebastian was mid-sweep.
- **Tailwind's DEFAULT easing NOT overridden** — `ease-wm` is additive. Existing transitions keep their feel until their screen is rebuilt.
- **No `font-size`/`line-height` on `body`.** Would have resized every unsized string in the app at once. The type scale is adopted per screen.
- **Legacy `ui/Card.tsx`, `SectionLabel`, `Toggle`, `OutcomeBadge` untouched** — they're live on real screens. New system alongside old; the old ones die in Session E.

**Files touched:** `src/app/globals.css` · `tailwind.config.ts` · `src/components/ui/wm/{Button,Card,Input,Pill}.tsx` (new) · `scripts/token-lint.mjs` + baseline (new) · `.github/workflows/ci.yml` · `package.json` (added `token-lint`, `typecheck`, `typecheck:electron` — CLAUDE.md referenced `npm run typecheck` but it didn't exist)

**NOT touched:** any dashboard tab, `DashboardClient.tsx`, the HUD, anything in `electron/`.

**Verified:** web + electron typecheck clean · 194/194 tests pass · `next build` succeeds, all routes compile · Tailwind CLI generates all 17 probed utilities and they resolve to `rgb(var(--token) / alpha)` · live in-browser check confirms tokens + shadcn bridge resolve and `/login` renders · token-lint exit codes proven 1/0/1 for regression / clean / stale-baseline.

**⚑ Open decision for Sebastian — the typeface.** App ships **Geist** (`src/app/layout.tsx` assigns it to `--font-sans`, shadowing the token). Spec §4 says system sans / SF Pro. Left as-is; it's a design call that restyles every screen. In the sweep file.

**Visual deltas — the honest list.** "Plumbing only" was *nearly* true, not exactly true. `wingman-reviewer` machine-diffed the emitted CSS from `origin/main` vs this branch: **0 selectors removed, 88 added, 13 existing rules changed.** Of those 13, only two are actually reachable on a real screen:
1. **`input::placeholder` darkens** — `#aeaeb2` → `#8B877E` (`--ink-3`). Hits login, signup, reset-password, and every dashboard input; only onboarding overrides it. Contrast improves, but it IS a change.
2. **`/owner` now renders correctly** — `OwnerDashboard.tsx` uses `bg-background`/`bg-card`/`border-border`/`bg-primary`, which previously resolved to nothing because the shadcn vars were never wired into Tailwind. It was rendering unstyled. Fixed as a side effect.

Everything else is inert and was verified as such, not assumed: `body { background }` is overridden inline on every route (`DashboardClient.tsx:1566`, both auth pages, onboarding, privacy, terms); the `* { border-color }` shift (#E4E4E4 → #E6E2D9) is unreachable because all 10 bare `border` utilities in the app already pair an explicit color; the removed `.dark` scrollbar override was a no-op (nothing in `src/` ever adds the `dark` class); reduced-motion breaks nothing (0 `animationend`/`transitionend` listeners in `src/` or `electron/`).

**Reviewer verdict: APPROVE WITH FIXES.** Both applied — token-lint now explains the issue-ref/URL-fragment false positive and how to skip it, and the `:focus-visible` comment no longer overclaims (it does not reach raw inputs; `input:focus{outline:none}` outranks it by specificity).

**⚠️ Load-bearing, do not "clean up":** the `:root, .dark` selector list on the shadcn bridge block. The bridge must re-declare `--background: var(--paper)` **on the `.dark` element itself** for it to resolve to the dark value. Refactoring it to `:root`-only silently breaks dark mode.

---

## Session B — HOME ✅ BUILT (reordered ahead of Flight Log 2026-07-28)

Sebastian swept Home first and gave complete feedback, so it leads. North star: Granola-clean — "clean, informative." Decision trail in `tasks/dashboard-sweep.md`.

**Layout, top → bottom:**
- [x] B1. **Header** — greeting left, **Deploy Wingman moved to top-right** (was center) with the ⌃⇧W hint.
- [x] B2. **Sales DNA banner** — Wispr-Flow-style pinned card: headline + subtext + CTA + dismissible ✕. Permanently gone once Sales DNA is complete; ✕ hides it meanwhile.
- [x] B3. **Calendar strip — "coming soon" skeleton.** Schematic grey rows, NOT fake meeting names behind a blur (reads as a bug or a bait-and-switch). Copy: *"Calendar sync — coming soon. Wingman will show your day and remind you before each call."* The ONLY coming-soon surface on Home (Sebastian, 2026-07-28).
- [x] B4. **Today's calls + inline ✓/✗ outcome confirm.** ⭐ Highest-value item. AI outcome auto-detect ALREADY SHIPPED (`post-call/route.ts:412` writes `outcome_source:'auto'`); this adds the one-click affordance. ✓ → confirm (writes `manual` via `/api/wingman/outcome`, unlocking it into close-rate math). ✗ → open the picker to correct.
- [x] B5. **Wingman Coach chat bar, pinned bottom.** Wired to the EXISTING `/api/ai/chat` with `mode: "global"` — the same payload Mission Intel already sends. No new AI, no new prompt, no new cost. Shows "N of 20 messages" (`DAILY_CAP = 20`, already enforced server-side). A `CALL_MATCH` answer deep-links into Flight Log.
- [x] B6. Migrate Home's 51 color literals → tokens; then `npm run token-lint -- --update`.

**Chart hero: CUT (Sebastian, 2026-07-28).** He doesn't yet know which metric matters and wants Test Pilot feedback first. Correct call — it would have been tuned against 2 data points. The 3 stat cards (Total Closes / Close Rate / Calls This Week) go with it.

⚠️ **The Coach bar lives inside `HomeTab`, NOT `DashboardClient`** — that file holds the post-call polling behind PR #54's ~2000× cost regression. Do not touch it.

**Files actually touched:** `HomeTab.tsx` (rewrite) · NEW `home/OutcomeConfirm.tsx`, `home/CoachBar.tsx` · NEW `lib/wingman/sales-dna-status.ts`, `lib/wingman/chat-quota.ts` (+ tests for both) · `DashboardClient.tsx` (ONE line — the sidebar's chat counter, see below; polling/pill machinery untouched, verified by diff)

**Verified:** web + electron typecheck clean · 206/206 tests (12 new) · `next build` all routes · token-lint clean, HomeTab **72 → 0** literals (total debt 662 → 590) · rendered and interacted with in-browser via a throwaway probe route (since deleted).

### `wingman-reviewer` round — 6 real bugs caught and fixed
1. **Stale `calls` leak.** Confirmations were applied only to today's rows, so the Coach's `callSummaries` and the Flight Log hand-off still saw `outcome_source:'auto'` for a call just confirmed — ask "what's my close rate" and get an answer ignoring the click made two seconds earlier. Now one `useMemo` feeds every consumer.
2. **#47 solidity regression.** The `⌃⇧W` hint exists only in the idle state, so the header collapsed ~24px the instant Deploy was pressed. Fixed height on the column; **measured 64px in both states**.
3. **No request timeouts.** A hung fetch left `inFlight`/`saving` true forever — dead send button, permanently disabled ✓/✗, reload the only recovery. `AbortSignal.timeout` on both.
4. **`limitReached` didn't lock the client** — reachable normally (use Mission Intel first, then Home; `profile` is a page-load snapshot), and the rep could keep pressing send collecting identical "limit reached" bubbles.
5. **Silent picker failure.** A failed PATCH from the picker showed nothing at all and logged nothing.
6. **Sticky bar had no stacking context** — the DNA banner's z-indexed children painted over the input and could steal clicks.

Also extracted `chat-quota.ts` so the reset-date logic exists **once**: the sidebar was reading `chat_messages_today` raw and would have contradicted the Coach bar on a returning user's first visit of a new day.

**Deliberately NOT taken:** the reviewer's banner-flash fix (gating on a `hydrated` flag moves the flash from the minority who dismissed to the majority who didn't — strictly worse), and widening the `Outcome` union (real debt, but it reaches beyond Home; do it when `Outcome` is next touched).

### 🔴 OPEN — must verify before the Coach bar ships
`profiles.chat_reset_date` exists in **no migration** (added by hand in the SQL editor). If its column type is `timestamptz` rather than `date`, Supabase returns a full timestamp, the `===` compare **in the route itself** never matches, and the 20/day cap has never fired for anyone — unlimited Sonnet 4.6 per user. This is pre-existing, not introduced here, but Home makes the Coach far more prominent.

Check without SQL: send 3 Coach messages, reload, read the sidebar counter. **"1 of 20" = broken. "3 of 20" = fine.** Or in Supabase:
```sql
select data_type from information_schema.columns
where table_name = 'profiles' and column_name = 'chat_reset_date';
```
Must return `date`. If not: `ALTER TABLE profiles ALTER COLUMN chat_reset_date TYPE date USING chat_reset_date::date;` — schema change, needs Sebastian's approval (rule #2).

---

## Session C — Intel → "Analytics", Coming Soon blur

Sebastian's call 2026-07-28, made with the tradeoff stated: this **removes working functionality** (Overall Score, Total DQs, Stage Performance Heatmap all render fine today).

- [ ] C1. Rename the tab **Intel → Analytics** (user-facing label only).
- [ ] C2. Granola-pattern gate: existing content blurred, centered card on top. **Keep the existing render code intact behind the gate — do NOT delete it.** Restoring must stay a one-line change.
- [ ] C3. **Honest copy, not a paywall mimic.** Granola blurs a feature that EXISTS and is plan-gated ("upgrade to unlock"); ours doesn't exist yet. Say *"Analytics — coming soon"* + what it will do. Never imply payment unlocks it.

**Prerequisite already handled:** any future analytics sits on outcome data, which is unreliable today — close rate excludes every unconfirmed auto outcome (why Home reads 11%). B4's ✓/✗ makes those numbers true first.

**Files:** `src/components/dashboard/IntelTab.tsx` · `src/components/dashboard/Sidebar.tsx`

---

## Sessions D–F — Remaining screens, one per PR

- [ ] **D** — Flight Log (was Session B): apply sweep verdicts — likely delete "Topics Missed Before Pitch" (a third rendering of Stage Breakdown + Framework Coverage); fix raw key leakage (`cant_diy`/`investment_readiness`/`why_you` appear in BOTH the debrief prose and the chips — prompt rule in `post-call/route.ts` ~lines 31–92 where pillars are defined to the model in snake_case, plus a display-side key→label mapper as backstop; `PILLARS` in `FlightLogTab.tsx` already holds the human labels); migrate 137 literals; Granola pass. **Structure before paint.**
- [ ] **E** — Flight Plan + Sales DNA — **structural merge decision first** (they collect overlapping information), then rebuild whatever survives
- [ ] **F** — Objection Vault · Settings · Sidebar/shell · **kill Signal Vault** (listed as retired in `CLAUDE.md`, still live in the sidebar and rendered by `DashboardClient`) · collapse `ui/wm/` up into `ui/` and delete the legacy primitives

---

## Parked from this track (Sebastian, 2026-07-28)

- **Google Calendar connect + pre-call notifications** — gets its OWN planned session. Real feature: OAuth, refresh-token storage, sync loop, notification scheduler. Also the fix for Recall's Space-swipe limit ([[project-calendar-detection]]). Home reserves the visual slot for it now.
- **Chat history list in the left nav** (Granola-style) — needs a new Supabase table; chat is not persisted today (`chat_messages_today` is only a counter). Schema change = separate approval per CLAUDE.md rule #2.
- **Recipes / slash-commands** — post-launch. Natural first one is a pre-call cheat sheet, which is the queued Call Continuity + Prospect Memory project.

---

## Risks — read before writing code

1. **🚨 `DashboardClient.tsx` is load-bearing and expensive.** It holds post-call polling + the Live Hub pill morph. PR #54 shipped a cost regression in exactly this file (post-call polling re-ran the full dashboard load — 20 calls × transcripts, ~180MB per call ended, ~2000× more than needed), and the fix for *that* self-inflicted a second bug by starving "Ask Wingman" of transcript context. **Rule for this rebuild: presentational changes only in that file. Do not touch data fetching, polling intervals, or the pill state machine.** If restructuring becomes necessary, it's a separate PR with `wingman-reviewer` on it.
2. **Big diffs hide bugs.** Hence one screen per PR. Never batch two screens.
3. **Do NOT re-skin the HUD to the dashboard's light style.** §2 — the HUD dark spec is research-backed and load-bearing. HUD reconciliation is rollout step 4, a separate track needing a desktop release.
4. **Scope creep is the real enemy here.** The cutline exists because this exact category of work expands. Every session ships or it doesn't count.

---

## Standing rules for this track

- `wingman-reviewer` on every diff before it's called done
- Typecheck gate stays green
- No push without explicit approval
- Plain English in every rep-facing string (§6) — no `cant_diy`, no NEPQ jargon

---
---

# SESSION 2026-07-29 (cont.) — DARK MODE: research → fix

*Research done first, per `tasks/plan-dark-mode.md` §4. Every number below is measured, not guessed
(`node` contrast math on the real token values — WCAG 2.1 relative luminance).*

## The research answers (→ become Design Language §3f)

1. **Elevation direction.** Confirmed: in dark themes, **lighter = higher**, always. Material 3 expresses
   elevation as *tonal* lightness ("always a lighter surface on top of a darker surface"), not just shadow.
   Apple HIG says the same — base colors are darker so background interfaces recede; **elevated colors are
   lighter** so foreground interfaces advance. A working dark theme needs **4 levels**: page ground → card →
   sub-surface (fields, tracks, chips, hover) → overlay.
2. **Why not pure black.** #000 with light text is sustained maximum contrast — eye strain, plus halation on
   OLED, plus it removes all headroom to go *darker* for recesses. Recommended near-black band is
   **#0A0A0A–#161616**. Ours is `--paper` **#171613 — validated, no change.**
3. **Fields.** A dark-mode field is **lighter than the surface it sits on**, not darker. This is the direct
   answer to Sebastian's question, and it's the whole bug.
4. **Contrast (measured on our real tokens).** `--ink-1` 14.5–16.8:1 ✅ · `--ink-2` 6.0–8.2:1 ✅ ·
   **`--ink-3` 2.8–3.6:1 ❌** — fails AA-large on the new lightest surface. Muted greys collapsing in dark is
   the classic failure and we have it.
5. **Desaturation.** Dark `--signal` #7E9BFF measures 6.3–7.3:1 on all dark surfaces ✅, and the state colors
   (positive/warning/critical) all clear 5.6:1 ✅. **Already correct — no change.**

## What the research found that the brief did NOT know

**`src/components/ui/Card.tsx` is hardcoded `dark:bg-[#1c1c1e]`** — an iOS system gray. Measured hue:

| | hex | R−B | reads as |
|---|---|---|---|
| legacy `Card` in dark | `#1C1C1E` | **−2** | **COOL / bluish** |
| `--surface` (Home, Coach) | `#201F1B` | **+5** | **WARM / brownish** |

That is Sebastian's *"it's like a bluish gray, and then on the homepage it's like a brownish gray"* —
**literally measurable, and he spotted it with his eyes.** Seven tabs import this Card (Flight Log, Sales DNA,
Intel, Settings, Flight Plan, Objection Vault, Signal Vault). It is a second, independent cause of the
complaint and the single highest-leverage line in the codebase right now.

Same file family: `SectionLabel` is hardcoded `dark:text-[#636366]` → **2.37–2.75:1 = illegible** in dark.

## The fix — 3 files, all token-level

| # | File | Change | Why |
|---|---|---|---|
| 1 | `src/app/globals.css` | dark `--surface-sunken` `#100F0D` → **`#2C2B25`** (moves from *below* `--paper` to *above* `--surface`) | The one token. Separation vs `--surface` becomes **1.162:1** — matching light mode's 1.158:1 exactly, so both themes feel identical. Fixes every field, tab track, hover fill, keycap and progress track at once. |
| 2 | `src/app/globals.css` | dark `--ink-3` `#726E64` → **`#8A867C`** | Research Q4. Lifts min contrast 2.79 → **3.91:1**, still a clear step below `--ink-2` (1.55:1 apart) so hierarchy survives. |
| 3 | `src/components/ui/Card.tsx` | `bg-white dark:bg-[#1c1c1e] border-black/6 dark:border-white/8` → `bg-surface border-line` | Kills the cool-gray card on 7 tabs. |
| 4 | `src/components/ui/SectionLabel.tsx` | `text-[#aeaeb2] dark:text-[#636366]` → `text-ink-3` | Illegible label → legible, and drops 2 literals. |

**Deliberately NOT doing:**
- **No 4th "overlay" token.** Grep found zero popover consumers; the one modal (Flight Log) already separates
  via `--scrim` + `--e-lg` + border. Add the token when a real overlay-over-card exists, not before.
- **Not touching `Sidebar.tsx`.** Its `--surface-sunken` elements sit on `--paper`; after fix #1 they go from
  a 1.058:1 step (invisible) to 1.275:1 (a clearly readable raised pill) — an improvement, and light mode is
  untouched. Bigger deltas are *correct* at low luminance, not a bug.
- **Not touching light mode at all.** Home is the reference; if the fix changes Home, the fix is wrong.

## Verification (not screenshots-only — the brief warns they go stale)

- Read **computed styles** in the browser for the Sales DNA input vs the Home Coach composer and prove they
  now sit at the same step above their own parent.
- Home light + Home dark eyeballed against the reference.
- `npx tsc` (web + electron) · `npx vitest run` (218) · `node scripts/token-lint.mjs` (baseline must go **down**).
- ⚠️ Dev server must be STOPPED before any `npm run build`.

## Then, if approved

**SettingsTab (75 literals — biggest remaining) + the light/dark toggle UI**, so Sebastian stops editing
`localStorage` by hand.

⚠️ **OPEN QUESTION FOR SEBASTIAN — blocks 125 literals of work:** Flight Plan / Objection Vault / Signal Vault.
He said 2026-07-29 he's probably killing them. Migrating a page that's about to be deleted is pure waste.

---

## ✅ SESSION RESULT (2026-07-29 cont.)

**Colour debt 286 → 111.** Zero literals now in: Card, SectionLabel, Toggle, **SettingsTab**.
Remaining 111: IntelTab 53 · ObjectionVaultTab 34 · PaywallModal 15 · OnboardingClient 8 · WIcon 1.

**Shipped**
1. **Dark elevation fixed at the token.** `--surface-sunken` #100F0D → **#2C2B25** (below `--paper` → above
   `--surface`). Ladder is now monotonic: page #171613 → card #201F1B → field #2C2B25. Measured step vs
   `--surface` = **1.162:1**, matching light's 1.158:1.
2. **The finding the brief didn't have:** `ui/Card.tsx` was hardcoded to an iOS gray measuring **R−B = −2
   (cool)** against `--surface` at **R−B = +5 (warm)** — Sebastian's *"bluish gray vs brownish gray"*, on
   **7 tabs at once**. Now tokens.
3. `--ink-3` #726E64 → **#8A867C** (min contrast 2.79 → 3.91:1). `SectionLabel`'s dark gray measured
   **2.37:1** — invisible — now `--ink-3`.
4. **New `--knob` token** for switch thumbs (near-white in both themes, same "must not flip" class as
   `--scrim`). Toggle rebuilt as a real `<button role="switch">` with an accessible label.
5. **Flight Plan + Signal Vault deleted** (Sebastian: Sales DNA supersedes Flight Plan). Removed components,
   sidebar entries, orphaned hover animations, tab-union members, badge wiring, and the now-dead
   `vault_signals` query in `page.tsx` (one less Supabase round-trip per dashboard load). **Objection Vault
   kept.**
6. **SettingsTab on tokens + the Appearance control** (System / Light / Dark) — Sebastian no longer edits
   `localStorage` by hand.

**Verified by measurement, not screenshots** (browser pane returned stale frames again — cost two false
alarms; DOM measurement is the authority): Home Coach composer unchanged at #201F1B on #171613 (1.097) ·
Sales DNA input now #2C2B25 on a #201F1B card, monotonic ladder true · every light token byte-identical to
before · theme switch flips class + `color-scheme` + tokens + storage + pressed state.

**Gates:** typecheck (web + electron) · **218/218 vitest** · production build · token-lint 286→111 · dev
server compiles clean.

### ⚠️ FLAGGED — needs its own session, do NOT bolt onto a UI change
Deleting the Flight Plan **page** did not remove the Flight Plan **plumbing**. `api/wingman/session`
still reads the `flight_plans` table at every call start and snapshots it into `calls.flight_plan_snapshot`,
which still feeds **the live card prompt** (`poll/route.ts` → `buildFlightPlanContext`) and **post-call
framework grading** (`post-call/route.ts` → `formatFlightPlanForEval`). So that data is now **frozen** —
live cards keep reading whatever is in the table, with no UI to change it. `api/flight-plan/route.ts` was
left in place on purpose (it is the only remaining write path). **Decide separately:** point that plumbing
at Sales DNA, or retire it. It is live-call code → plan-reviewer + `wingman-reviewer` required.
