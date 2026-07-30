---
name: project-flight-recorder
description: "Dev-only full-call telemetry (\"flight recorder\") — capture everything a live call does into JSONL + a /devlog page, for the voice grind"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0265a86b-74f1-4faf-8515-639878d13915
  modified: 2026-07-24T12:45:15.048Z
---

**Flight Recorder** — dev-only full-call telemetry so real-call outputs can be pasted into Claude Code for the voice/summarizer grind. Requested by Sebastian 2026-07-22. SPEC: `tasks/plan-flight-recorder.md` (read it cold — full data catalog, architecture, phasing, risks).

**Problem it solves:** live hotkey cards (objection/dig) are NOT persisted or even logged anywhere today — only timing. So after a real call there's no way to see what cards fired or the context that produced them. This builds that visibility.

**Captures (v1):** header (Sales DNA + git branch/commit + model-per-slot + dial level) · full speaker-labeled transcript · **Deepgram interim partials** · exact chunk each card saw · prospect's reply after each card · full card generation payload (system+user prompt, raw output, tic-gate result, tokens) · **card adoption** (used/paraphrased/ignored) · summarizer snapshots + **diffs** + **live hallucination watch** (number/fact in output absent from input) · belief-ladder trajectory · close-readiness · **latency breakdown** (incl. time-to-first-token) · **running cost meter** · non-fires/drops · errors across all 3 processes · footer aggregates. **Shelved for v1:** shadow generation (other dial levels side-by-side — future toggle, costs extra calls).

**Architecture:** 3 processes → one call-scoped record, correlated by `callId`. Server helper `devlog.append()` (API routes) + `POST /api/wingman/devlog` (renderer) → `dev-logs/call-<id>.server.jsonl`; extended `measurement-log.ts` → `dev-logs/call-<id>.main.jsonl` (partials/presses, high-freq stays in-process, NO HTTP in hot path). Merged at read time. `dev-logs/` gitignored, in repo root (`process.cwd()` of local Next dev = Claude can Read directly). Surfaces: the JSONL files (Claude reads) + a dev-only `/devlog` "call film" page (merged chronological view + Copy button + per-card inline annotation).

**HARD CONSTRAINTS:** DEV-ONLY — gated `NODE_ENV !== "production" && WINGMAN_DEVLOG === "1"` on helper + route + page + main writer (a leak = Sales DNA/prompts writing on a real user's machine, highest-severity risk). MUST NEVER affect the live call (wrapped, disable-on-error, never awaited in a hot path — same discipline as `measurement-log.ts`). No new audio/video. Only works when running LOCALLY (`npm run electron:dev`) — the installed app hits Railway (prod, gated off).

**Card adoption has TWO homes:** (1) dev recorder now; (2) FUTURE Phase 6 (separate PR) = production Supabase dataset of `{card → rep's actual phrasing}` across real users → refine outputs toward natural paraphrasing at volume. Shares capture logic; needs its own schema + privacy note. Related: [[project-card-voice-rework]] (this feeds it), [[feedback-plan-review-loop]].

**Status 2026-07-23: BUILT — Phases 0-5 DONE, all wingman-reviewed + typecheck-clean + live-tested locally on real calls.** Held local on `feat/confrontation-dial` (not pushed). Gate to turn on: `WINGMAN_DEVLOG=1` + `NEXT_PUBLIC_WINGMAN_DEVLOG=1` in `.env.local` (both present now). Files: `src/lib/wingman/devlog.ts` (server sink) + `devlog-client.ts` (renderer) + `flight-recorder-core.mjs` (shared merge/analysis) · `src/app/api/wingman/devlog/{route,report/route}.ts` · `electron/measurement-log.ts` (dual-writes `dev-logs/*.main.jsonl`) + preload `devlogLink` + main `devlog:link` IPC · capture hooks in `session/kb-signal/summarize/route.ts` + `DashboardClient.tsx` · CLI `scripts/flight-recorder.mjs` → `dev-logs/call-<id>.report.md` · **owner dashboard `src/app/owner/page.tsx` + `src/components/owner/OwnerDashboard.tsx`** (owner-gated via new `src/lib/owner.ts`; Flight Recorder tab + stubbed Users/Revenue/Cost tabs). Reads: run local call → `node scripts/flight-recorder.mjs` (Claude reads the report.md) OR `localhost:3000/owner` (Sebastian, authed).

**Caught 2 real bugs on first live runs (both in Known Issues):** #53 → close press freezes the compass ~40s (forced summarize holds the global isGeneratingRef; 5-10s summaries + 30s rate-limit); #52 dig card says "go for the close" when no discovery has happened. Both have task briefs.

**Still deferred:** exact CARD tokens (Phase 1b — needs a small generator change; summarizer tokens already exact) · **Phase 6** = production cost-log (Supabase, unlocks the owner Cost tab + real aggregate cost) + card-adoption dataset · wiring the Users/Revenue business tabs.

Original phasing: 0 plumbing → 1 server → 2 renderer → 3 main → 4 derived/adoption → 5 owner dashboard (was /devlog page) → 6 prod dataset.
