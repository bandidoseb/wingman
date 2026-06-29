# TODO — Objection Card Production Build (status 2026-06-28)

Canonical plan: `tasks/plan-objection-build.md`. Eval: `scripts/objection-eval.mjs`.

## ✅ Phase 0 — DONE (de-risk)
- Merged prompt (v1 tonality + accuracy/no-social-proof/when-to-anchor fence): holds tonality, **0 fabrications across 6+ runs**.
- Anchors: clean once the "no invented social proof" rule was added (was 1 fab/3 runs → 0/3 after). Aggregate lift is within noise; the win is per-scenario "kill-shot detail" cards. → anchors viable, prompt-only, NO validator needed.
- Belief-ladder harness rebuilt into a REAL gate (`scripts/test-belief-ladder.mjs`) — reads the live prompt from belief-ladder.ts, asserts confidence-number rule, exits 0/1. Correctly RED now (current summarizer records a once-said $GOAL) → goes green after Phase 2.

## ✅ Phase 1 — CODE-COMPLETE + reviewer-APPROVED (pending live gate)
Wired the validated Sonnet objection prompt; cut KB from the objection slot (Coach untouched).
- NEW `src/lib/wingman/objection-signal.ts` — `generateObjectionCard` (Sonnet, merged prompt, tolerant parse, 10s timeout).
- `kb-signal/route.ts` — distiller = nudge gate only; `generateObjectionCard`; headless response `{signal_type:"Objection", signal_text:<line>, signal_header:""}`; removed dead threshold const.
- `DashboardClient.tsx` — delivery gate now keys on card CONTENT (`signal_text || signal_header`), not the (now-empty) header.
- `electron/hud/index.html` — `TYPE_MAP['Objection']` + `.signal-card.headless` conversational text style + toggle. Staged into `electron-dist/`.
- `src/types/index.ts` — `SignalType` += `"Objection"`.
- Verified: web tsc 0, electron tsc 0, vitest 59/59, `wingman-reviewer` APPROVE (no correctness/security/cost bugs; prompt byte-for-byte = eval-validated).
- **GATE LEFT:** live role-play call (Sebastian). NOT pushed.

## ⏳ Phase 2 — NEXT: confidence-aware summarizer
Edit `belief-ladder.ts` confidence rule (keep confirmed numbers, drop unconfirmed digits) → the `test-belief-ladder.mjs` gate must go GREEN → live gate. No schema change.

## ⏳ Phase 3 — Anchors (de-risked, deferred)
Growing confidence-flagged anchor library fed to the card. Needs `calls.anchors` schema (Sebastian's YES), summarizer emit, client threading. No validator (prompt rules suffice). Own plan + review.

## Out of scope (named)
Streaming card reveal (separate gated PR); answer/dig/close headless + own generators (Phase 4); Deepgram word-confidence capture (hardening).
