# Roadmap — phase numbering reconciled

> **Moved out of `Current Sprint.md` on 2026-07-30.** This is reference material, not sprint
> status: it is the ONLY place where the two colliding phase-numbering systems are reconciled.
> Without it, every build log before July becomes misreadable — a session reads
> *"2026-06-29: Phase 1 shipped"* and concludes the wrong phase is done.

---

## 🗺️ MASTER ROADMAP — One Unified Plan (added 2026-06-29)

**Why this exists:** two phase-numbering systems were running in parallel and colliding. The "big" **Hotkey Signal-Card Model** (Phases 0–5) and a "small" **objection-card refinement track** (its own Phase 1/2/3, from the 2026-06-21 → 06-29 sessions). They are now merged into ONE list. The small track was always a *deepening of the ↑ objection arrow inside big-model Phase 3* — it's renumbered **Phase 3.6** below. There is now one plan; nothing lives in a second numbering system.

**The arc:** autonomous pop-up cards → rep presses a hotkey → 4-arrow compass (↑ objection · ← answer · ↓ dig · → close) → Wingman generates that one card.

| Phase            | What                                                                                                          | Status                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 0                | Decouple transcript saving                                                                                    | ✅ PR #4                                                                                                                 |
| 1                | Retire live Sonnet poll, stages → post-call                                                                   | ✅ PR #5                                                                                                                 |
| 2                | Belief Ladder live-call memory                                                                                | ✅ PR #8                                                                                                                 |
| 3                | Hotkey + 4-arrow compass + **↑ objection slot**                                                               | ✅ PR #10                                                                                                                |
| 3.5              | Groq query distillation + latency fixes                                                                       | ✅ PR #15                                                                                                                |
| **3.6**          | **↑ Objection slot deepening** *(was the "small" Phase 1/2/3)*                                                | ◐ in progress                                                                                                           |
| &nbsp;&nbsp;3.6a | Sonnet prompt, KB cut, headless top-center card *(was small "Phase 1")*                                       | ✅ shipped 06-29, PR #20                                                                                                 |
| &nbsp;&nbsp;3.6b | Confidence-aware summarizer — `belief-ladder.ts`; `test-belief-ladder.mjs` gate GREEN *(was small "Phase 2")* | ✅ shipped 2026-07-11 in PR #45 (NUMBER CONFIDENCE rule pulled forward with the moat; gate green, Claude+GPT dual-judge) |
| &nbsp;&nbsp;3.6c | Anchor library — needs `calls.anchors` schema *(was small "Phase 3")*                                         | 🔲 DEFERRED (eval showed no aggregate lift)                                                                             |
| **4**            | The other 3 arrows: ← answer · ↓ dig deeper · → close readiness                                               | 🔲 not started                                                                                                          |
| **5**            | Dead-code removal (#37) + reconcile stale CLAUDE.md rules (#34)                                               | 🔲 not started                                                                                                          |

**Cross-cutting work** (not tied to one arrow — slot in between phases):
- ✅ **Auto-updater FIXED + verified live (#45) — 2026-07-01.** Was release-blocking; now working end-to-end (0.1.25→0.1.26 auto-installed; 0.1.27→0.1.28 smooth self-relaunch). Root cause: private code repo → `releases.atom` 404. Fix: publish signed/notarized installers to the **public `bandidoseb/wingman-releases` repo** (source stays private) + `releaseType: release` + `zip` target + `notarize: true` + arm64-only + `isQuitting=true` before `quitAndInstall`. Auth = PAT `WINGMAN_RELEASES_TOKEN`. **Latest release = v0.1.28** (ships streaming card + everything to the packaged app). Beta download = https://github.com/bandidoseb/wingman-releases/releases/latest (install once → auto-updates). At-scale upgrade = Option 3 self-hosted feed (`_Inbox/` note). Full narrative: `2026-07-01.md`.
- 🎬 **Streaming card reveal — ✅ SHIPPED. [PR #24](https://github.com/bandidoseb/wingman/pull/24) merged 2026-07-01 → Railway backend has SSE streaming + Groq removal live.** (PR #23 was folded into #24.) Server SSE (envelope opened as it streams; `no-transform` defeats Next gzip) → `hud:signal-delta` IPC → renderer SSE reader (`sse-parse.ts`) + `json-line-stream.ts` decoder; seq guard, idempotent release, TTFB/idle guards, dismiss/call-end abort. 91 tests. Sebastian live-confirmed (~1.7–2.7s warm). Also shipped: cold-start-abort fix, `Controller is already closed` crash fix, rapid-press throttle + 429 quiet-resolve, "SUGGEST" tag removed, **Sonnet warm-up** (cold first press ~6s→~2s). **Reaches the packaged Mac app only on the next desktop release** (bundle into #45). Narrative: `2026-06-30.md` Session 3.
- 🛡️ **Model-resilience (#44)** — one `models.ts` source of truth + a daily deprecation canary. Own session.
- 🩹 **Partials (#41)** — stale-objection correctness bug; really an ↑ objection-slot fix (transcript finalization lag).
- 🎛️ **Card Placement Studio + Notch Mode** (NEW 2026-06-30, POST-STREAMING) — let the rep choose notch vs floating window + customize size/width/drop/text color/text size, via a drag-to-place mock-Zoom customizer in the dashboard, saved as a per-user preset. Inspired by Moody; we take its look/placement, NOT the teleprompter scrolling. Notch only on some Macs → graceful fallback to top-center. Spec: `_Inbox/2026-06-30 Card Placement Studio + Notch Mode.md`.
- ⭐ **Offer-Aware Wingman — THE MOAT** (NEW 2026-07-07, Sebastian's core conviction) — capture the rep's offer + discovery process in **onboarding** (questionnaire first; AI voice-call later) → inject into the Belief Ladder summarizer so ALL live cards are offer-specific/verbatim/tailored, not generic. **Tier split:** Core = generic Dig-only supplement · Pro = offer-aware (leads early discovery). Generic cards kill trust → churn; tailored = the retention moat no competitor is building. Deferred pending the 4a.1 live test but worth building regardless. **Canonical spec: `07 - North Star/Offer-Aware Wingman — The Moat.md`.**

**Collision killed:** when an older build log says "Phase 1 shipped" (06-29), it meant **3.6a**, NOT big-model Phase 1. All future logs use the unified numbers above.

---

