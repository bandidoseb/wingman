# Phase 1 Build Plan — Offer-Aware Wingman (Sales DNA) — HARDENED (plan-reviewed 2026-07-10)

**Canonical design:** `Wingman Brain/07 - North Star/Sales DNA Capture — Design.md` (11 questions, tiering, gate, naming — LOCKED 2026-07-10).
**Status:** PLAN — awaiting Sebastian's approval. NO code until approved (Hard Rule #0). Plan-reviewer pass folded in below.

---

## Goal
Capture each user's Sales DNA → inject it so the live cards read a belief scorecard that already understands the offer (root driver, manifestations). Universal quality (Free/Core/Pro). Gate Deploy until essentials are briefed.

## Key correction from plan review (READ THIS)
The moat's real chokepoint is the **Belief-Ladder summarizer**, not the dig card. `summarize/route.ts` builds `live_summary`, and BOTH the dig card AND the objection card read it. Its `THE GAP` / `Core driver` / `WEAKEST LINK` lines are what every card digs from. Feed offer context into the summarizer and the objection card gets smarter for free + dig phrases on an offer-aware substrate. Injecting into dig ALONE = a nicer question on top of a generic belief read (cosmetic). So **1b injects into the summarizer AND dig.**

## Build order (confirmed by review): engine-first 1a → 1b → 1c → 1d. Storage = `profiles.sales_dna jsonb` (confirmed, no downside for call-start read).

---

## ⚠️ Pre-existing security bug this plan must fix (flag to Sebastian)
`src/app/api/profile/update/route.ts` has **NO field allowlist** and writes `body.updates` through the **service-role client (bypasses RLS)** straight into `profiles`. It's live (PersonalizeTab already uses it). Today any logged-in user can POST `{updates:{subscription_status:"active", subscription_plan:"pro", …}}` and **grant themselves Pro / reset call caps.** Adding an unbounded `sales_dna` blob to a no-allowlist writer also invites storage abuse. **1a introduces the allowlist — this closes a real billing-escalation hole, not just enables Sales DNA.**

---

## Phase 1a — Storage + capture + close the write hole
1. **SQL (Sebastian runs in Supabase):** `ALTER TABLE profiles ADD COLUMN sales_dna jsonb DEFAULT '{}'::jsonb;` (present exact SQL for approval).
2. `src/types/index.ts` — `sales_dna?: SalesDna | null` + `SalesDna` type + **single source of completeness**: `salesDnaComplete(profile): boolean` and `salesDnaEssentialsMissing(profile): string[]`. 1c's gate AND the dashboard import these (no drift).
3. `src/app/api/profile/update/route.ts` — **introduce an explicit column allowlist** (`Set` of writable columns; reject anything else). For `sales_dna`: assert plain object, cap serialized size (≤ ~8 KB), cap per-field length, drop unknown keys. Scoped fix, not a refactor.
4. `src/components/dashboard/PersonalizeTab.tsx` — retitle "Sales DNA"; add "Your Discovery" (Q4–Q11) + rotating ghost-text + Q1–Q3 in "Your Offer". Saves via the now-allowlisted route.
5. `src/components/dashboard/Sidebar.tsx` — nav label → "Sales DNA".
6. **Test:** fill → reload → persists; confirm the allowlist REJECTS a non-listed column (e.g. `subscription_plan`).

## Phase 1b — Offer-aware substrate + dig card + evals (the moat)
1. New `src/lib/wingman/sales-dna.ts` — `buildSalesDnaBlock(profile)`: **total (never throws)**, a **defined inject threshold** (min keys before it injects at all — a lone field skews the card → return `null`). Unit tests for empty / `{}` / partial / malformed / freeform-prose shapes.
2. **Summarizer (chokepoint):** inject the block into the **cached system block** of `belief-ladder.ts` / `summarize/route.ts` as an **interpretive lens ONLY** — explicit clause: "this is the rep's offer, use it to MAP the prospect's words to beliefs; NEVER mark a belief the prospect hasn't affirmed." Add a trap to `scripts/test-belief-ladder.mjs`. (Bonus: finally pushes the cached system block over the ~1,024-tok min it needs to cache.)
3. **Dig:** OFFER CONTEXT section in `dig-prompt.mjs` with the fence "offer facts ≠ what the prospect said — never state a saved offer number as their own." Add the Sales DNA cached segment in `buildDigUserSegments` **ordered BEFORE** the volatile live-summary segment (prefix caching — else it no-ops).
4. **Hot path:** pass a compact `sales_dna` from the client into `kb-signal/route.ts` the same way `live_summary` already flows (client holds the profile) — capped/validated server-side. **No new DB read on the press path.**
5. **Evals:** extend `dig-eval.mjs` AND `test-belief-ladder.mjs` with root-driver/chunk-down fixtures + **adversarial fabrication traps** (Sales DNA holds a number the prospect never voiced → card must never attribute it to them). Gate: offer-aware beats generic, 0 fabrication, no regression on generic fixtures, Claude + gpt-4o cross-judge.
6. `wingman-reviewer` on the diff (live pipeline + paid API + summarizer prompt change).
- **Test:** dev call, fill Sales DNA → summary GAP/root reflects the offer, ↓ aims at the root in the rep's voice; empty Sales DNA → clean generic card.

## Phase 1c — Onboarding + Deploy gate + native permissions (highest blast radius; plan-reviewer + wingman-reviewer both required)
- **Deploy gate safe point:** top of `call:start` (`electron/main.ts` ~609) **before `deployState="searching"`** (before any state is claimed → cannot desync `isRunning`/`callActive`/`deployState`, Invariants #2/#4). Return `{success:false, error:"needs_briefing"}`. **Renderer-side check is the PRIMARY gate** (the web Deploy button calls `startCall()` directly); Electron is a `zoomNameSet`-style IPC backstop (null on cold launch — document it). Uses `salesDnaComplete` from 1a.
- Onboarding step-machine (`OnboardingClient.tsx` + `OnboardingStep`): create account → "Allow Wingman to transcribe your meetings" → "Enable microphone" → "Enable system audio" → Section 1 (unskippable) → Section 2 (skippable tail + "highly recommended" nudge). Multi-page, progress dots.
- Native mic/system-audio/transcribe permissions in Electron; graceful fallback to typing if denied. Likely needs a desktop release.

## Phase 1d — Mic brain-dump (independent, last)
- 🎤 per field → record → new capped/rate-limited `src/app/api/wingman/transcribe-field/route.ts` (Whisper/Deepgram) → text → **discard audio immediately (never stored).**

## Fast-follow — Syntax auto-detect after ~5 calls
- HONEST CAVEAT (review): the `Syntax:` signal lives **embedded in the `calls.live_summary` text blob**, not a column — aggregating means regex-parsing a line out of ~5 summary blobs (brittle to template shifts). Still worth it; "only aggregation is new" was optimistic. MUST be wired — "Not sure yet" is not a dead end.

---

## Decisions that genuinely need Sebastian
1. **Fix the pre-existing mass-assignment / billing-escalation bug** in `/api/profile/update` as part of 1a — recommended (it's live).
2. **Client-pass vs server-fetch** for `sales_dna` on the dig hot path — recommend client-pass (lower latency, matches `live_summary`; untrusted-but-capped).
3. **Summarizer prompt change** gated behind `test-belief-ladder.mjs` before shipping — confirm (highest-value + highest-care change in 1b).

## Confirmed by review (held up)
- `rep-profile.ts` is only consumed by the retired `poll/route.ts` → correct that it's the wrong injection site.
- Schema drift real; manual SQL consistent with existing reality.
- jsonb blob correct; engine-first genuinely lower-risk (1c owns the #47 state machine + native permissions).
