# Wiring Brief — ship the new objection prompt (cut KB from live, Sonnet, headless card)

**Status:** DECIDED + validated offline (2026-06-21). NOT wired. This is the next session.
**Run the Plan Review Loop + `plan-reviewer` before touching the live pipeline, then `wingman-reviewer`
on the diff. Live-call gate is the definition of done.**

## What's already done (read these first)
- Prompt (source of truth): `scripts/objection-prompt-test.mjs` → `OBJECTION_SYSTEM_PROMPT`. Model =
  Sonnet (`claude-sonnet-4-6`). Validated cards: `tasks/kb-ab-test/objection-prompt-results.md`.
- Method it's built from: `knowledge-base/objection-transcripts/PLAYBOOK-SYNTHESIS.md` +
  `LIVE-CALL-FINDINGS.md`.
- Context engine it leans on (already live): `src/lib/wingman/belief-ladder.ts` (the 7-belief summary,
  passed to the card generator as `live_summary`).

## The decisions to implement
1. **Cut the KB from the live objection slot.** No embed, no `searchKnowledge`, no forced-script.
2. **New objection card** = belief-diagnosis → uncertainty-first → pace + tie-down anchored to the
   prospect's own words → ONE first-person line. Generated with **Sonnet**.
3. **KB stays for the Wingman Coach** (`searchCoachingKnowledge` / Mission Intel) — do NOT touch that.
4. **Signal cards lose the headline** (all card types): tiny type-tag ("Objection handle" / the arrow) +
   main text = the first-person line.

## The work (each its own reviewed step — don't batch)
1. **New prod module** `src/lib/wingman/objection-signal.ts` — `generateObjectionCard(transcript, liveSummary, …)`
   using `OBJECTION_SYSTEM_PROMPT` (port verbatim from the harness) + Sonnet. Output `{ line }`.
   - **Harden the JSON parse:** Sonnet sometimes appends "why this works" commentary after the JSON.
     Production parser MUST tolerate trailing text (extract the first `{...}` / regex the `"line"` value),
     or it returns null → retry pill. (Same bug bit the harness — see its `getLine` fix.)
2. **Rewire `src/app/api/wingman/kb-signal/route.ts`** — for the `objection` slot: stop calling
   `searchKnowledge` + `generateSignalCard`; call `generateObjectionCard`. **Decide the distiller's fate:**
   without KB search we don't need it for retrieval; keep it only if we still want its nudge gate
   (no-standing-objection → honest nudge). Leaning: keep the Groq nudge gate, drop the embed/search.
   Other slots (answer/dig/close) — decide separately; out of scope for this step.
3. **Card-shape change** through the pipeline — route response (`signal_header`/`signal_text` → type +
   line), IPC, and the HUD render. **HUD = `electron/hud/index.html`** — kill the headline element, render
   a small type-tag + the line. ⚠️ HUD changes need a full `electron:dev` restart + re-stage
   (`electron-dist/` copy) — see `tasks/lessons.md` (2026-06-05).
4. **Latency:** confirm Sonnet press-to-card live (~2.1s typical, watch the tail). The streaming reveal
   (gated PR on the roadmap) is the real latency mask — sequence accordingly.
5. **Docs:** once wired, flip the "decided — wiring pending" notes in `CLAUDE.md` + Brain canonical docs
   to "shipped," and log the build.

## Watch-outs
- The `knowledge-search.ts` / `kb-memory.ts` / in-memory search machinery stays (the Coach still uses the
  RPC path; ingestion still embeds). Only the *objection card* stops using it.
- Don't regress the nudge / honest-empty-press behavior (no dead air on a press).
- Sonnet tail latency (one 6.2s sample in testing) → keep a timeout + the retry pill; streaming helps.
- Gender-neutral spouse handling + the tonality rules are IN the prompt — port it verbatim, don't trim.
