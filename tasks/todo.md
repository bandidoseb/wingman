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

## Phase 1b — Offer-aware substrate + dig card + evals (the moat) — ✅ BUILT 2026-07-11, awaiting Sebastian's review/PR
**Gates at build time: test-belief-ladder GREEN (Claude + gpt-4o judges, 0 fabrication) · dig-eval PASS with CROSS=1 (14 fixtures, 0 fabrication, tonality 4.83, 100% right-belief) · 164 unit tests · web+electron tsc clean · wingman-reviewer APPROVE (its 🟡 warm-up spend cap fixed: 60s per-user debounce in session route).**
**Spec refinement to flag in review: belief-ladder fixture 1 now asserts an unconfirmed number is never PROMOTED TO A FACT ($GOAL/beliefs/GAP) — verbatim quote bullets keep the prospect's exact words (hedge intact), which is honest tie-down material, not promotion.**
**Decisions LOCKED by Sebastian 2026-07-11:** (1) ship gate = `test-belief-ladder.mjs` GREEN, hard stop, no exceptions — the eval may be extended/readjusted to test what we're actually building, but the gate stays hard; (2) client-pass on the press path + **prompt caching** + **warm-at-deploy cache priming** (Sebastian's call: Sales DNA never changes mid-call → cache it once, don't re-pay per card); (3) 1b = engine working via dashboard-filled DNA; onboarding + Deploy gate = 1c, separate session. **Framing locked:** Sales DNA = *averages about the typical prospect for this offer* — context, never gospel, never what THIS prospect said. **Zero fabrication is the bar.** Dual-judge (Claude + GPT) confirmed.

**Plan-reviewer pass 2 (2026-07-11) folded in below — 7 real gaps fixed. Verified: dig AND summarizer both run `claude-sonnet-4-6` (1,024-tok cache min ✅). Prime cost bounded (<$0.005/call) and session POST only fires AFTER recording confirms — empty Deploys pay nothing.**

1. New `src/lib/wingman/sales-dna.mjs` — **`.mjs`, NOT `.ts`** (reviewer gap #3: the `.mjs` eval harnesses can't import `.ts`; same anti-drift discipline as `dig-prompt.mjs` — ONE builder imported by dig-signal.ts, the summarize route, session/warmup, AND both eval gates; thin `.ts` type re-export if needed). `buildSalesDnaBlock(dna)`: **total (never throws)**; **inject threshold = ALL questions answered (Sebastian LOCKED 2026-07-11 — overrides the earlier 4-essentials idea)** — below it return `null`. Redefine `salesDnaComplete` in `types/index.ts` to mean all-questions-answered (single source; the 1c Deploy gate uses the SAME helper — zero drift). Two "answered ≠ has one" nuances: `guarantee` gets an explicit "we don't offer one" answer option, and `syntax: "unsure"` counts as answered — so "complete" means every question ADDRESSED, not every field non-empty. (`SALES_DNA_ESSENTIALS` and the PersonalizeTab UI updated to match — small 1a follow-up, same PR.) "AVERAGES, NOT GOSPEL" framing baked into the block text itself (header: "This describes the rep's offer and the AVERAGE prospect for it. The person on THIS call has said none of this unless the transcript shows it."). **Byte-stable output** (fixed field order, identical caps) — the prompt cache keys on exact bytes. Unit tests for empty / `{}` / partial / malformed / freeform-prose / oversized shapes.
2. **Canonical data path (reviewer gap #7):** client sends the **raw `sales_dna` object** on ALL three rails (press path, summarize body, session-create); the **server** builds the block via the one `buildSalesDnaBlock` with identical caps everywhere. Never a pre-built string on one path and a rebuild on another — divergent bytes = wasted cache.
3. **Fix the stale-copy silent no-op (reviewer gap #1 — the worst one):** the dashboard `profile` prop is a snapshot from page mount; PersonalizeTab saves DNA without refreshing it, so fill-then-Deploy in the same session would send EMPTY DNA → generic cards, silently. Fix: PersonalizeTab save success → `router.refresh()` (or lifted state) so the live path sees fresh DNA. Add a test. Mid-call edits intentionally do NOT take effect until the next call (client copy is per-call snapshot — document in-code as intentional; consistent with "averages, never per-prospect").
4. **Thread it into the hook (reviewer gap #2):** `useWingmanPoller` options gain `salesDna` (it currently has no profile access — `{callId, stage, isActive, objections, repName}` only); include it (capped) in the summarize body at `executeSummarize` and in the press payload.
5. **Summarizer (chokepoint):** inject the block into the cached system block of `belief-ladder.ts` / `summarize/route.ts` as an **interpretive lens ONLY** — "use it to MAP the prospect's words to beliefs; NEVER mark a belief the prospect hasn't affirmed." Caching bonus: the ~2-min tick re-hits the same prefix → summarizer cache stays warm all call (5-min TTL refreshes on every hit). **⚠️ Pre-existing RED (reviewer gap #4):** `test-belief-ladder.mjs` is red TODAY on purpose — it demands a confidence-number rule that `BELIEF_LADDER_SYSTEM_PROMPT` never got (queued 3.6b work). The "gate must be GREEN" promise is impossible without it → **1b adds the confidence-number rule to the summarizer prompt in the same step** (it's the same prompt being edited anyway; effectively pulls the core of 3.6b forward).
6. **Dig:** OFFER CONTEXT via a new Sales DNA segment in `buildDigUserSegments`, ordered BEFORE the live-summary segment, `cache: true` (machinery exists — dig-signal.ts maps `cache:true` → `cache_control: ephemeral`). **Flip the live-summary segment to `cache: false`** (reviewer gap #8: it changes every ~2 min, so its breakpoint pays 1.25x write per press for ~0 hits). Fence: "offer facts ≠ what the prospect said — never state a saved offer number as their own."
7. **Warm-at-deploy (Sebastian's idea, 2026-07-11):** session-create body gains `sales_dna`; `pipeline-warmup.ts` gets a cache-priming ping — the real dig prefix (system + DNA block) with `cache_control`, `max_tokens: 1` — **replacing the existing generic Sonnet ping** (don't warm Sonnet twice). Byte-identical via the same builder. Honest caveat in-code: 5-min TTL — a first press >5 min after deploy misses anyway; prime costs <$0.005 so still worth it, TLS/pool warm rides along. Keep all existing warmup guarantees (never throws, never awaited, bounded cost).
8. **Prove caching engages (not assume):** log `cache_creation_input_tokens` / `cache_read_input_tokens` into the TIMING line; verify each prefix clears Sonnet's 1,024-tok minimum (breakpoint caches the full prefix incl. system prompt). If a prefix is under the minimum, skip the breakpoint and say so — never ship a silent no-op.
9. **Evals (scoped honestly — reviewer gap #5):** `dig-eval.mjs` gains root-driver/chunk-down fixtures + adversarial fabrication traps (its Claude+GPT `CROSS=1` judge already exists). `test-belief-ladder.mjs` is string-assertion-only today — **this step builds it an LLM-judge layer** (port the `dig-eval.mjs:50-89` scaffolding) + DNA injection + fabrication fixtures (summary must never mark a belief off DNA alone). Gate: offer-aware beats generic, **0 fabrication**, no regression on generic fixtures, **Claude + GPT cross-judge both pass**. Not "just add fixtures" — it's a real harness extension; budgeted as such.
10. `wingman-reviewer` on the diff (live pipeline + paid API + summarizer prompt change).
- **Test:** dev call, fill Sales DNA → Deploy in the SAME session → summary GAP/root reflects the offer, ↓ aims at the root in the rep's voice; empty Sales DNA → clean generic card, zero injected text; TIMING line shows `cache_read > 0` on the second press.

## Phase 1c — Onboarding + Deploy gate + native permissions (highest blast radius; plan-reviewer + wingman-reviewer both required)

**Sebastian's 1c direction (captured verbatim-in-spirit, 2026-07-11 — do not lose):**
- **Gate Deploy until EVERY Sales DNA question is answered** (core + discovery — all of it, not just essentials). Decision made knowing there may be some onboarding drop-off — product quality during the free trial wins. Uses the same all-questions `salesDnaComplete` helper as 1b's inject threshold (one definition of "briefed" everywhere).
- **The gate needs an honest, respectful explanation, not a naked wall:** "For Wingman to actually do a good job, it needs context on what you're selling, who you're selling to, and how you run your sales calls. Otherwise it can't do a good job." Frame it as briefing your copilot, acknowledging the time it takes — never corporate-speak, never guilt.
- **Incentive idea (considered, gate chosen instead — keep on file):** "+5 free-trial calls if you complete your Sales DNA." Could layer ON TOP of the gate later (e.g. reward completing optional depth), don't discard.
- **ACTIVATION IS THE PRIORITY (Granola-inspired):** Granola's main page has "Get started" demo video + a **"Try a demo meeting"** button — Sebastian wants Wingman's version of this. Ideas locked for exploration: (1) short onboarding/explanation video, (2) demo video, (3) a **test activation / fake sales call** — Wingman running purely on computer audio so a new user can deploy it, trigger cards, and learn the hotkeys risk-free before a real call. "If you can't teach people to use your software correctly, they won't use it and they'll churn." Free trial must SHOW OFF Wingman — activation drives conversion.
- Onboarding flow = very handheld; activation = very straightforward.

**Existing 1c technical plan (unchanged):**
- **Deploy gate safe point:** top of `call:start` (`electron/main.ts` ~609) **before `deployState="searching"`** (before any state is claimed → cannot desync `isRunning`/`callActive`/`deployState`, Invariants #2/#4). Return `{success:false, error:"needs_briefing"}`. **Renderer-side check is the PRIMARY gate** (the web Deploy button calls `startCall()` directly); Electron is a `zoomNameSet`-style IPC backstop (null on cold launch — document it). Uses the all-questions `salesDnaComplete` from 1b.
- Onboarding step-machine (`OnboardingClient.tsx` + `OnboardingStep`): create account → "Allow Wingman to transcribe your meetings" → "Enable microphone" → "Enable system audio" → Sales DNA (all questions, gated) — sequencing of videos/demo-call TBD in the 1c planning session. Multi-page, progress dots.
- Native mic/system-audio/transcribe permissions in Electron; graceful fallback to typing if denied. Likely needs a desktop release.

## Phase 1d — Mic brain-dump (independent, last)
- 🎤 per field → record → new capped/rate-limited `src/app/api/wingman/transcribe-field/route.ts` (Whisper/Deepgram) → text → **discard audio immediately (never stored).**

## Fast-follow — Syntax auto-detect after ~5 calls
- HONEST CAVEAT (review): the `Syntax:` signal lives **embedded in the `calls.live_summary` text blob**, not a column — aggregating means regex-parsing a line out of ~5 summary blobs (brittle to template shifts). Still worth it; "only aggregation is new" was optimistic. MUST be wired — "Not sure yet" is not a dead end.

---

## Decisions that genuinely need Sebastian
1. **Fix the pre-existing mass-assignment / billing-escalation bug** in `/api/profile/update` as part of 1a — ✅ DONE (shipped in 1a, PR #41).
2. **Client-pass vs server-fetch** for `sales_dna` on the dig hot path — ✅ LOCKED 2026-07-11: client-pass + prompt caching + warm-at-deploy priming.
3. **Summarizer prompt change** gated behind `test-belief-ladder.mjs` before shipping — ✅ LOCKED 2026-07-11: hard stop, no exceptions; eval may be readjusted to test the real behavior; Claude + GPT dual-judge.

## Confirmed by review (held up)
- `rep-profile.ts` is only consumed by the retired `poll/route.ts` → correct that it's the wrong injection site.
- Schema drift real; manual SQL consistent with existing reality.
- jsonb blob correct; engine-first genuinely lower-risk (1c owns the #47 state machine + native permissions).
