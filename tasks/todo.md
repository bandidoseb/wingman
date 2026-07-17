# Confrontationalness Dial — Implementation Plan

**Feature:** A rep-level, named-level setting that adjusts how HARD Wingman's live signal cards
press — WITHOUT changing what they diagnose or ask. "Same meaning, same ask, softer or harder."

Plan hardened via `plan-reviewer` (2026-07-16). Confrontationalness dial ONLY this session;
formality dial + card-color toggle are follow-ons on the same rails.

## 🚩 STATUS (2026-07-16) — DIAL PINNED · CORE VOICE REWORK IS NOW THE PRIORITY

**Decision (Sebastian, 2026-07-16):** the confrontationalness dial multiplies the base voice — and the
base card voice has AI tics (see below). So we PIN the dial and fix the CORE VOICE first. The dial
(and later a formality dial) sits on top of a nailed voice, not before it.

### ✅ Dial work DONE this session (PINNED — inert, nothing lost)
- **Phase 1a engine + eval GREEN.** `node scripts/confrontation-eval.mjs` → ALL HARD GATES PASS across
  ~350 dual-judged cards (byte-identity, judge-validation, fire/silence, ordering, no-fabrication,
  length, tonality-mean, challenger-not-too-far). wingman-reviewer APPROVE. 187 unit tests + typecheck green.
- **Phase 0 migration WRITTEN** (`010_card_style.sql`) — NOT run in Supabase yet.
- **The dial is INERT by default:** `direct` = untouched base, all missing/unknown values → `direct`.
  So the modifiers change nothing until a level is set. Safe to leave dormant. No rip-out needed.

### 📌 PIN — resume context for when we return to the dial (AFTER the voice is fixed)
- Levels: `consultative < balanced < direct(default) < challenger`. Modifiers live in
  `objection-prompt.mjs` (`OBJECTION_CONFRONTATION_MODIFIERS` + `buildObjectionSystemPrompt`) and
  `dig-prompt.mjs` (same). Threaded through objection-signal.ts / dig-signal.ts / kb-signal route;
  `card_style` type + column + `set_card_style_key` RPC ready.
- **When we resume:** (1) RE-TUNE the modifiers on the NEW base voice (they were written against the
  old base; the append-structure still works, examples inside them use the old "come on" tic — fix
  those). (2) Re-run `confrontation-eval.mjs` (byte-identity auto-adapts to the new base). (3) THEN
  build UI: Phase 1b dashboard control + Phase 2 mid-call Live Hub toggle (persists as new default,
  obvious "saved for every call"). Migration must be run in Supabase before 1b.
- Findings that survive: eval gate design is solid & reusable; the dial is EMPHATIC on objection cards,
  SUBTLE on dig (correct — money/support asked gently). Full plan + reviewer notes above/below.

---

# ⭐ ACTIVE PRIORITY — CORE CARD VOICE REWORK (make cards sound genuinely human)

**Why:** signal-card quality is the whole product. Sebastian (final tonality judge) tore apart the
batch — the cards have AI tics the AI judge scored 4.8/5 and could not feel. Bar = "Cole Gordon reads
a card and thinks *this is legit*." Voice spec (his verbatim feedback + gold rewrites): `tasks/card-voice-spec.md`.

**The 3-part solution (agreed):**
1. **Encode Sebastian's rewrites as the few-shot examples** in the base OBJECTION + DIG prompts (the
   model imitates examples > rules). Rip the permission-asky examples; drop in his flowy human lines.
2. **Deterministic tic-detector HARD gate** in the eval — regex ban-list ("can I ask", "come on",
   "getting burned is real", "that feeling makes total sense", …) → auto-fail, no AI judgment. This is
   how the tics can NEVER ship again (the AI judge can't feel them).
3. **Human-in-the-loop tuning loop** — generate batch → Sebastian reacts → encode → regenerate. Several
   tight cycles (multi-session craft). This CHANGES the shipped default prompt (deliberately, better);
   snapshot `tasks/prompt-snapshot-2026-07-16/` preserves the old version.

**Banned tics / target voice / gold rewrites:** all in `tasks/card-voice-spec.md`.
**Next step:** collect any more of Sebastian's do/don't phrases → pass 1 (encode + tic gate + regenerate).

---

## Locked decisions
- Dial changes DELIVERY intensity only — never the diagnosis, never whether it fires. It must never
  make Wingman go silent, go blind to an objection, or press a different belief.
- 4 named levels: `consultative` (~3) · `balanced` (~5) · `direct` (~8, **DEFAULT**) · `challenger` (~9.5).
- Missing/null/invalid → resolves to `direct` → **byte-identical** prompt to what ships today.
- Set in dashboard Settings **AND** toggleable mid-call from the Live Hub cog. A mid-call change
  **persists as the new permanent default** for all future calls, made **obvious** to the rep.
- Only affects the generative arrows in play: ↑ objection + ↓ dig. (← answer is unwired today;
  → close is deterministic — but a close that routes to dig inherits the dial via the dig path.)

---

## Phase 0 — Schema  ⚠️ NEEDS SEBASTIAN'S EXPLICIT YES (real migration, not hand-applied)
- [ ] `supabase/migrations/NNN_card_style.sql`:
  - `ALTER TABLE profiles ADD COLUMN card_style jsonb NOT NULL DEFAULT '{}'::jsonb;`
    (separate from `sales_dna` — delivery preference ≠ offer content; keeps the "briefed" gate clean)
  - `set_card_style_key(p_user_id uuid, p_key text, p_value text)` — **SECURITY DEFINER**, atomic
    single-key `jsonb_set`, whitelists `p_key ∈ (confrontation, formality)` and
    `p_value ∈ (consultative, balanced, direct, challenger)`, rejects anything else.
  - Atomic per-KEY so a future formality write and a confrontation write can't clobber each other,
    and a mid-call toggle can't race a dashboard save. (This is the lesson of the syntax RPC.)

## Phase 1a — Engine + eval (NO UI; must go green before 1b)
- [ ] `objection-prompt.mjs`: `CONFRONTATION_MODIFIERS` map + `buildObjectionSystemPrompt(level)`.
  `direct`/null/invalid → return `OBJECTION_SYSTEM_PROMPT` **unchanged**. Others append a short
  "DELIVERY INTENSITY" block that changes ONLY tone/hedging and states the negative space
  explicitly: same belief, same fire/abstain decision, ~25 words, no fabrication. Append to the
  (uncached) system string so the user-content cache prefix stays byte-identical.
- [ ] `dig-prompt.mjs`: same pattern + `buildDigSystemPrompt(level)`.
- [ ] `objection-signal.ts`: thread `confrontation` (trailing optional param, default `direct`)
  through ALL FOUR: `generateObjectionCard`, `streamObjectionCard`, `generateObjectionAttempt`,
  `streamObjectionAttempt`; swap `system:` in BOTH attempt functions.
- [ ] `dig-signal.ts`: thread `confrontation` through `streamDigCard`; swap the builder.
- [ ] `kb-signal/route.ts`: read `confrontation` from body, whitelist → default `direct`, pass to
  both generators (objection call, dig call).
- [ ] `src/types/index.ts`: `ConfrontationLevel` union + `CardStyle` type.
- [ ] `scripts/confrontation-eval.mjs` (imports the REAL `.mjs` builders):
  - **(unit, hard gate)** byte-identity: `build*SystemPrompt('direct'|null|'garbage') === constant`.
  - **(judge-validation FIRST)** prove the blind A/B intensity judge picks human-labeled harder
    lines ≥ high threshold before trusting it to gate anything.
  - **(hard gate) fire/silence stability** — the actual product invariant:
    · objection ABSTAIN fixtures → all 4 levels still abstain (`challenger` invents nothing)
    · objection real-objection fixtures → all 4 still return a line (`consultative` floor)
    · dig take-the-close fixtures → all 4 still emit the close-nudge (`challenger` forces no dig)
  - endpoint separation `consultative` << `challenger` (hard) + no-inversion adjacency
    (majority-of-3; drop strict adjacent-monotonic to avoid flaky CI).
  - diagnosis-constant (same-core-ask judge at unambiguous fixtures); zero-fabrication (esp.
    `challenger`); ≥1 threaded objection fixture. Dual judge Claude + gpt-4o, run 3×.

## Phase 1b — Dashboard wiring
- [ ] `DashboardClient.tsx`: `confrontation` state init from `profile.card_style?.confrontation ?? 'direct'`;
  include in the objection body + dig body.
- [ ] `src/app/api/profile/card-style/route.ts` (NEW): auth the user via `getUser()`, then
  service-role client → `set_card_style_key` scoped to the verified `user.id` (mirrors
  `/api/profile/update`). Keep `card_style` OUT of `/api/profile/update`'s writable columns.
- [ ] Settings/Personalize control (4 named levels) → saves via the new route; always shows the
  current level prominently.

## Phase 2 — Mid-call HUD toggle + persist (closed loop)
- [ ] HUD cog: "Intensity" segmented control (4 named levels) below the word-color picker,
  **seeded by the dashboard** (not localStorage — DB is the one source of truth).
- [ ] Reverse seed dashboard→main→HUD on deploy/HUD-show AND on any confrontation change.
- [ ] Toggle: `window.hud.setConfrontation(level)` → `ipcMain.handle("hud:set-confrontation")`
  → `mainWindow.webContents.send("wingman:confrontation-changed")` → dashboard updates state
  (next press uses it immediately) AND calls `/api/profile/card-style`.
- [ ] Closed-loop obviousness: cog shows a pending state instantly, resolves to
  "Saved as your default for every call" ONLY on a 200 echoed back HUD-side; on failure, honest
  "changed for this call, didn't save your default" (never a false "saved"). `main.ts` only relays
  — no new module-level state.

## Open decisions for Sebastian (before Phase 0)
1. **RPC auth:** service-role route + SECURITY DEFINER RPC scoped to authenticated `user.id`
   (matches existing `/api/profile/update`)?  ✅ recommended.
2. **Schema:** approve new `card_style jsonb` column + `set_card_style_key` RPC as a real migration?
3. **Persist footgun:** also add a post-call one-liner ("Your intensity is set to Challenger for
   every call") after a mid-call change, so a heat-of-the-moment bump doesn't silently reshape every
   future call?  ✅ recommended, low cost.

## Test steps (filled in per phase as built)
- Phase 1a: `node scripts/confrontation-eval.mjs` green 3×; byte-identity unit gate green; typecheck.
- Phase 1b: set each level in Settings → confirm it persists + rides the press body.
- Phase 2: mid-call toggle on a real call → next card shifts intensity; "saved as default" only on
  success; dashboard + HUD agree after.
