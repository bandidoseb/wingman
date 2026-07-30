---
name: project-dashboard-rebuild
description: "The dashboard rebuild — token foundation, Tailwind v4, Home + Coach, dark-mode elevation FIXED, Flight Plan + Signal Vault deleted, Settings + theme toggle shipped"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0d201796-b1f0-4545-b083-4bb928ff209a
  modified: 2026-07-29T17:54:00.033Z
---

**Branch `feat/design-tokens` — 9 commits, NOT pushed (as of 2026-07-29).** Session log:
`Wingman Brain/01 - Build Log/2026-07-29.md`. Plan + session result: `tasks/todo.md`.

**Why it was un-parked:** the cause of "Frankensteined" is **measurable, not aesthetic** — Design Language
Rollout step 2 ("tokens into the app") had never been done, so `globals.css` had zero tokens and the
dashboard carried **590 hardcoded colour literals across 41 unique values** (spec defines ~20). Every tab
invented its own palette because there was nothing to inherit from.

**Landed:** token set + shadcn bridge + `ui/wm/*` primitives · `scripts/token-lint.mjs` **ratchet**
(baselines debt, fails on increase, in CI — a hard gate would have been red day one and disabled in a week)
· **Tailwind v3.4.19 → v4.3.3** · Home rebuilt · Wingman Coach chat · dark mode · one filled `OutcomePill`
· **dark elevation fixed** · **Flight Plan + Signal Vault deleted** · **Settings + the Appearance
(System/Light/Dark) control**. **Debt 590 → 111.**

**✅ DARK MODE ELEVATION — FIXED 2026-07-29.** Rules now written up as **Design Language §3f** (read it
before touching any dark value). The rule that was backwards: in dark mode elevation is expressed as
LIGHTNESS and **you cannot go DOWN** — `--paper` is already near the floor, so a "recessed" surface must go
**UP**. `--surface-sunken` `#100F0D` → **`#2C2B25`**; ladder is now `#171613` page → `#201F1B` card →
`#2C2B25` field, step 1.162:1 vs light's 1.158:1. Also `--ink-3` → `#8A867C` (2.79 → 3.91:1) and a new
**`--knob`** token (switch thumbs stay near-white in both themes — same "must not flip" class as `--scrim`,
which is always black).

**⭐ The bug the written brief did NOT contain, and Sebastian caught by eye:** `src/components/ui/Card.tsx`
hardcoded its dark background to an **iOS system gray** measuring **R−B = −2 (cool/bluish)** against
`--surface` at **R−B = +5 (warm/brownish)** — his *"it's like a bluish gray, and then on the homepage it's
like a brownish gray"* is literally measurable. **Seven tabs imported that card; one line fixed all of
them.** Lesson: when Sebastian describes a colour difference in plain words, **measure the hue channels** —
he is describing something real. Same file family: `SectionLabel`'s dark gray measured **2.37:1**, invisible.

**⚠️ FLAGGED, needs its own session:** deleting the Flight Plan *page* did **not** remove its *plumbing*.
`api/wingman/session` still snapshots the `flight_plans` table into every call, and that snapshot still
feeds **the live card prompt** (`poll` → `buildFlightPlanContext`) and **post-call framework grading**
(`post-call` → `formatFlightPlanForEval`). That data is now **frozen** with no UI to edit it.
`api/flight-plan/route.ts` deliberately left in place as the only remaining write path.
Repoint-at-Sales-DNA or retire = live-call code → plan-reviewer + `wingman-reviewer` required.

**Key decisions:**
- `--signal`, NOT `--accent` — shadcn reserves `--accent` for its neutral hover fill.
- `@theme inline` is load-bearing; plain `@theme` freezes dark mode unless `.dark` sits on `<html>`.
- Semantic radius/shadow names (`rounded-card`, `shadow-raised`) instead of overriding Tailwind's
  `sm/md/lg`, which would silently restyle unreviewed screens.
- Colour migration is **mechanical**: these screens are inline-styled, so `"#8e8e93"` →
  `"rgb(var(--ink-2))"` works without restructuring. `scripts/migrate-colors.mjs`, then hand-fix where
  nearest-colour ≠ correct semantics (dividers want `--line` not a surface; input borders want
  `--line-strong`; **a border must never equal the fill it sits on**).
- **`token-lint` scans COMMENTS too** — quoting an old hex in a "was #xxx" comment keeps the debt counter
  high and blinds the ratchet on that file. Describe the old value, don't quote it.
- Six of eight screens use ZERO Tailwind classes — that's *why* they hold the literals, and why the v4
  upgrade's blast radius was far smaller than estimated.

**⭐ The inline ✓/✗ on Home is not cosmetic:** AI outcome auto-detect shipped in v0.1.29, auto outcomes are
EXCLUDED from close-rate until a human confirms, and the only confirm path was the Flight Log picker — so
nobody did. **Sebastian's 11% close rate is understated.**

**🔴 NEXT:** Sebastian sweeps every screen in dark mode and reports what's still wrong. Then **IntelTab
(53)** — largest remaining, definitely staying. Then ObjectionVaultTab (34), PaywallModal (15),
OnboardingClient (8). **Objection Vault is KEPT** — only Flight Plan + Signal Vault were deleted.

**Process:** deleting a component while the dev server runs **poisons HMR** — it keeps serving stale code
and the console replays module-not-found errors long after the source is clean. Restart + `rm -rf .next`
after any file deletion. And the browser pane returns **stale composited frames** after DOM/scroll/theme
changes — measure computed styles, that is the authority ([[feedback-dev-server-vs-build]]).

Related: [[project-launch-cutline]] · [[feedback-dev-server-vs-build]] · [[feedback-status-lives-in-git]]
