---
name: project-confrontationalness-dial
description: "Confrontationalness dial — BUILT + gated, PINNED behind the core-voice rework"
metadata: 
  node_type: memory
  type: project
  originSessionId: b44b0cee-02cf-4f83-b2e8-b0db45ab866e
---

**Confrontationalness dial — BUILT + fully gated 2026-07-16, then PINNED (voice comes first).**
Rep-level named dial that adjusts how HARD live objection + dig cards press, WITHOUT changing what
they diagnose or whether they fire. Levels: `consultative < balanced < direct(DEFAULT) < challenger`.

**Key design:** `direct` returns the base prompt BYTE-IDENTICAL; any missing/unknown value → `direct`.
So the dial is **INERT until a level is set** — zero regression, safe to leave dormant. Non-default
levels append a "DELIVERY INTENSITY" block to the (uncached) system string; user-content cache prefix
untouched. Modifiers change delivery ONLY — never diagnosis, fire/abstain, length, or no-fabrication.

**State:** committed LOCAL on branch `feat/confrontation-dial` (`cf468da`), **NOT pushed**. Migration
`010_card_style.sql` (`profiles.card_style` jsonb + `set_card_style_key` SECURITY DEFINER RPC) **NOT
run in Supabase yet**. Files: `objection-prompt.mjs`, `dig-prompt.mjs` (`CONFRONTATION_MODIFIERS` +
`build*SystemPrompt`), `objection-signal.ts`, `dig-signal.ts`, `kb-signal/route.ts` (thread
`confrontation`), `types/index.ts` (`ConfrontationLevel`+`CardStyle`), `scripts/confrontation-eval.mjs`.

**Eval:** `node scripts/confrontation-eval.mjs` → ALL HARD GATES PASS across ~350 dual-judged cards
(byte-identity, judge-validation-first, fire/silence, ordering [per-fixture non-inversion + corpus
≥75% strong separation], no-fabrication, length, tonality-mean, challenger-not-too-far). Dial is
EMPHATIC on objection cards, SUBTLE on dig (correct — money/support asked gently). wingman-reviewer
APPROVE; plan-reviewer hardened the plan.

**PINNED behind [[project-card-voice-rework]]** — the dial multiplies the base voice, and the base
voice has AI tics. When we RESUME: (1) re-tune the modifiers on the NEW voice (their examples use the
old "come on" tic — fix them), (2) re-run the eval (byte-identity auto-adapts to the new base),
(3) run migration 010 in Supabase, (4) build Phase 1b (dashboard control + `/api/profile/card-style`
save route) then Phase 2 (mid-call Live Hub cog toggle that persists as new default, with an obvious
"saved for every call" confirmation). Full plan + resume context: `tasks/todo.md`.
