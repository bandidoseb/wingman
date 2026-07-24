# Flight Recorder — Dev-Only Full-Call Telemetry (SPEC)

Status: HARDENED via plan-review (2026-07-22) → §0 below SUPERSEDES conflicting parts of the draft. Not yet approved to code.
Owner ask (Sebastian, 2026-07-22): capture **everything** that happens during a live call so it
can be pasted into a Claude Code session for the voice grind — "a full, full, full view of
everything." Two surfaces: a file Claude reads directly + a dev dashboard page with a Copy button.

---

## 0. HARDENING FROM PLAN-REVIEW (supersedes conflicting draft below)

**Guiding invariant (new):** the live path appends **raw facts only** (verbatim inputs, terminal
outputs, epoch `tMs`, exact usage only where already free). EVERY diff / trajectory / tic-scan /
hallucination-check / adoption / reply-pairing / token-estimate is computed **offline** in the
Phase-4 pass over the merged record. Hot-path surface shrinks to "append one JSON line."

Fixes applied (severity order):
1. **Correlation = hardened A2 (A1 is impossible).** No `callId` exists at `call:start` —
   `DashboardClient.handleStartCall` calls `startCall()` FIRST and only mints the session/`callId`
   *after* it confirms (deliberate: "no DB session until Electron confirms"; do NOT reorder). So:
   main mints a `recorderId` at recording-start (reuse `measurement-log`'s timestamp), names its file
   `call-<recorderId>.main.jsonl`. After the renderer gets `call_id`, it fires a **dev-only,
   fire-and-forget** IPC `devlogLink(callId)` → main writes `{kind:"recorder-link", recorderId,
   callId}` and tags later lines. **Touches NO lifecycle state** (call:start/end, isRunning,
   callActive, deployState, autoStop) → Invariants #2/#4/#5 untouched by construction.
2. **Gating (defense-in-depth, per process):** server helper + `/devlog` route +
   `/devlog` page → `NODE_ENV !== "production" && WINGMAN_DEVLOG === "1"`. **Electron main → `!app.isPackaged
   && WINGMAN_DEVLOG === "1"`** (in a packaged app `NODE_ENV` is undefined, so the old check was
   vacuously true — `app.isPackaged` is the correct dev signal). **Renderer → `NEXT_PUBLIC_WINGMAN_DEVLOG`**
   (browser can't read server env; without this it'd POST on every real user's press → 404 in a hot
   path). NB: the sensitive data (Sales DNA, full prompts) is **server-only → on Railway only →
   architecturally cannot land on a user's Mac.** Confirm the flags are absent on Railway/packaged builds.
3. **Next dev file-watcher perturbation:** `next dev` watches the repo root; the main file gets
   Deepgram partials several/sec → FS-event churn can jitter a live test call. Fix: add
   `watchOptions.ignored: **/dev-logs/**` in `next.config.ts` (keeps both files in-tree for easy Read/merge).
4. **Card tokens — EXACT (Sebastian 2026-07-22).** The streaming generators don't surface usage today
   (`objection-signal.ts` ignores `message_start`/`message_delta`; `dig-signal.ts` logs-only). v1 will
   surface exact tokens: yield a `usage` event from the **terminal** `message_delta`/`message_stop`
   only (input from `message_start.usage`, output from the final `message_delta.usage`) — a minimal,
   wingman-reviewer-gated change to both generators + their route consumers. Constraint: it emits
   AFTER the last content delta, so it **cannot perturb the card output or TTFT**. `summarize` already
   has `data.usage` (free). Cost tally = exact everywhere.
5. **Hallucination-watch / diffs move to Phase 4.** `summarize/route.ts` only has the delta window,
   not the full transcript → an inline check guarantees false positives + adds paid-tick CPU. The
   merged record has the full transcript; derive there.
6. **Single `t0` merge:** two processes have different natural epochs → every line carries absolute
   `tMs`; the merge recomputes `elapsedMs` from ONE `t0` (earliest `tMs`). Deterministic sort:
   `(tMs asc, then source priority main < server < renderer)`.
7. **System prompt:** don't extract literal bytes from the hot generator — capture the **raw inputs
   verbatim + a template version hash**; reconstruct the exact prompt offline. (It's what the voice
   grind needs anyway: chunk + summary + dial + DNA.)
8. **Write safety:** per-`callId` `fs.WriteStream` in a module Map (measurement-log pattern:
   buffered/ordered, disable-on-error, never throws) — NOT concurrent `appendFile` (interleaves →
   corrupt JSONL). Cap any field > 32 KB; prune `dev-logs/` to last N calls at record-start.
9. **No hot-loop accumulator:** the terminal `done`/`nudge`/`abstain`/`error` event already carries
   the final line (`ev.line`). TTFT = one `if(!firstDeltaAt) firstDeltaAt = now` on first delta; ALL
   logging deferred to the post-`controller.close()` finally.

**Open decisions for Sebastian** (§9 hardened): (1) retention N (default 20 calls?) + 32 KB field
cap OK? (2) estimate card tokens for v1 (exact = fast-follow)? — recommend yes. (3) confirm
`WINGMAN_DEVLOG` / `NEXT_PUBLIC_WINGMAN_DEVLOG` are NOT set on Railway or in packaged builds.

Phasing unchanged (0 plumbing → 1 server → 2 renderer → 3 main → 4 offline derive → 5 /devlog → 6
prod dataset). Verdict: with §0 applied, clears the bar.

---

## 1. Goal

One consolidated, chronological record of a single live call — transcript, every AI generation with
its full input payload and raw output, summarizer evolution, actions, timing, and cost — so we can:
- perfect the card **voice** (see each card paired with the exact prospect context that triggered it),
- tune the **summarizer** (watch the belief ladder evolve; catch live hallucinations),
- debug **timing/cost/reliability**,
- and measure whether cards are actually **useful** (card adoption).

The record must be trivially ingestible: Claude Reads the file; Sebastian clicks Copy on `/devlog`.

## 2. Non-goals & hard constraints (load-bearing)

- **DEV-ONLY.** Gated behind `NODE_ENV !== "production"` **AND** an explicit env flag
  (`WINGMAN_DEVLOG=1`). The packaged Railway app and every real user get **byte-identical behavior
  with the recorder absent**. (The future production *adoption dataset* in §8 is the ONE piece that
  runs in prod — separately gated, separately designed.)
- **MUST NEVER affect the live call.** Same discipline as `measurement-log.ts`: every fs/network op
  wrapped, failure disables the recorder for the rest of the call, never throws into a hot path,
  never added to an `await` that blocks a card stream or a transcript event.
- **No new audio/video storage** (Invariant #6 untouched — text/metadata only).
- **Does not change any card/summarizer OUTPUT.** Pure observation. If wiring the recorder would
  alter a prompt, a payload, or timing that the model sees, that's a bug.
- **Respects existing invariants** (#2 isRunning, #3 single stop path, #5 auto-stop chain): the
  recorder's lifecycle piggybacks on the recording lifecycle, it does not create a parallel one.

## 3. Architecture — three processes, one logical record

Data is scattered across the three processes; the recorder funnels them into ONE call-scoped record,
correlated by `callId`.

| Source | Has | Capture mechanism |
|---|---|---|
| **API routes** (`kb-signal`, `summarize`, `session`) | the real prompt payloads, raw model outputs, tokens, server timing, Sales DNA, summarizer in+out | direct calls to a shared server helper `devlog.append()` (callId already in scope) |
| **Renderer** (`DashboardClient`, `useWingmanPoller`) | callId, card lifecycle (client POV), the exact chunk sent, close-readiness, adoption scan, client-observed actions | `POST /api/wingman/devlog` → same server helper |
| **Electron main** (`main.ts`, `recall.ts`) | hotkey presses, Recall SDK lifecycle, **Deepgram partials**, timers/auto-stops | extend existing `measurement-log.ts` writer |

**Correlation (the key problem):** `callId` is minted by the renderer at `/api/wingman/session` and
today only reaches main at `call:end`. Fix: **pass `callId` (or a shared `recorderId`) to main at
call START** via a new IPC message on the deploy/start path, so main can tag its records from the
first line. (Design choice A below.)

**Sink — two files per call in `<project>/dev-logs/`, merged at read time:**
- `dev-logs/call-<callId>.server.jsonl` — API + renderer events (server-written).
- `dev-logs/call-<callId>.main.jsonl` — main-process events incl. partials (main-written).
- Rationale for two writers instead of one: **partials are high-frequency** (many/sec). Routing each
  partial over HTTP to a server endpoint is wasteful and risky in the transcript hot path, so main
  keeps its own local file writer (cheap, in-process). Low-frequency data unifies via the server.
- `<project>` = `process.cwd()` of the local Next dev server = the repo root in `npm run
  electron:dev`. So both files land in the working tree where **Claude can Read them directly**.
  `dev-logs/` is **gitignored**.
- Every line: `{ t: <ISO>, tMs: <epoch>, callId, elapsedMs, source: "server"|"renderer"|"main",
  kind, ...payload }`. One clock reference (call-start epoch) lets the reader compute `elapsedMs`
  consistently across processes and interleave everything into the "call film."

**Design choice A — how main gets callId / writes its file:**
- **A1 (recommended):** IPC `call:start` carries callId → main names its file `call-<callId>.main.jsonl`.
- A2 (fallback if start-path plumbing is fragile): main keeps generating a `recorderId` at record
  start, writes `call-<recorderId>.main.jsonl`, and the renderer logs a one-line
  `{kind:"recorder-link", recorderId, callId}` so the reader can join them. Avoids touching the
  start path but adds a join step.
- Plan-reviewer: which is safer given Invariants #2/#4 (isRunning/callActive must move together)?

## 4. Complete data catalog (what we capture)

Grouped by concern. (🆕 = added during the 2026-07-22 design convo; ✅ = explicitly confirmed by Sebastian.)

**A. Header (once, at call start)** — callId, ISO start, app version, **git branch + commit**,
model-per-slot, confrontation dial level, feature flags, active-prompt hash(es), **full Sales DNA
JSON** loaded for the call. So any two calls are comparable + reproducible.

**B. Transcript**
- Full speaker-labeled transcript (rep vs prospect) with `elapsedMs`.
- ✅ **Deepgram interim partials** (from main) — what it saw mid-sentence, to judge partial quality.
- The **exact chunk each card saw** (the rolling buffer sent to `/kb-signal`) — "why it pulled that
  transcript."
- 🆕 The **prospect's reply immediately after each card** (outcome signal — did the line land?).

**C. Each signal-card generation** (server-side, per press)
- slot; beat number + flow state.
- **Full system prompt actually sent** (or a hash + the dynamic deltas: Sales DNA block, active
  few-shot anchors, confrontation level) and the **full user payload** (chunk, belief-ladder summary,
  and for flow: linesGiven / historyTranscript / beatNumber / leversUsed / flowRecap / gapFlag).
- model + params (max_tokens, temperature).
- **raw output line**; nudge/abstain flag; the inferred objection / the dig's targeted belief +
  weakest-link parse.
- 🆕 **tic-gate result** on the output (which pattern, or clean).
- 🆕 **latency breakdown** ✅: transcription-arrival → client decision → network → **time-to-first-
  token** → full line. (TTFT governs perceived speed.)
- 🆕 tokens in/out → feeds the cost meter.

**D. Card lifecycle & actions**
- summon → throttle/thinking/pending → generation start → first token → done/abstain/error →
  displayed → dismissed, each stamped.
- 🆕 **non-fires & drops**: presses that abstained (nudge/null) with reason; presses
  throttled/dropped/coalesced. (The silences are half the product.)
- hotkey actions: compass open, arrow picked, flow-mode in/out, readiness-dig arm, ✕ dismiss.
- Recall lifecycle: meeting detected, recording started/stopped, disconnects, upload-token fetch,
  auto-stop reasons.

**E. Summarizer (every ~2 min + force-refresh on → close)** — server-side in `summarize/route.ts`
- the transcript window it read; the **full scorecard output**.
- 🆕 **diff vs previous snapshot** (belief status changes, anchors added/dropped/superseded,
  momentum shift).
- 🆕 **live hallucination watch** ✅: auto-diff output vs input window for any **number/named fact in
  the output that is absent from the input** → flag. (Our zero-fab eval, running free on real calls.)
- 🆕 **belief-ladder trajectory**: derived rollup — each belief's status timeline
  (`Pain ⬜→🟡@4:10→✅@11:30`, `Money ✅→⚠️@18:00`), incl. regressions.
- latency + tokens.

**F. Close-readiness** — each → press: score, label, blocking beliefs, gap names shown, the summary
it scored against.

**G. 🆕 Card adoption** ✅ (§8 has the two-home design) — for each fired card, classify the rep's
next ~30s of speech: **used verbatim / paraphrased / ignored**, and store `{card → rep's actual
phrasing}`. Computed as a **post-call pass** over the merged record (we have card timestamps + the
full transcript), so it never touches the live hot path.

**H. 🆕 Errors** — every exception across all three processes with stack: mid-stream network drop,
controller-closed, Recall disconnect, API 429/500. The "what broke" channel.

**I. Footer (once, at call end)** — aggregates: cards by slot, summarizer ticks, duration, **total
tokens + $ cost** ✅ (running meter, final tally), tic flags, adoption tallies, error count.

**Shelved for v1 (future toggle):** 🔻 **shadow generation** — same live moment, what other dial
levels / the old prompt would've said, side by side. Powerful (tuning + positioning-wedge demo) but
it's extra model calls per card, so it's opt-in later, not v1.

## 5. Where it lands — the two surfaces

1. **The JSONL files** (`dev-logs/call-<callId>.*.jsonl`) — Claude Reads them directly. Zero-effort
   path: Sebastian runs a call → says "done" → Claude ingests + merges.
2. **`/devlog` dev-only dashboard page** — renders the **latest call merged into one chronological
   "call film"**: transcript interleaved with card fires (payload collapsible), summarizer ticks
   (with diffs), actions, and a header/footer. Styled like terminal output. **"Copy everything"**
   button → paste into Claude Code. Also: a per-card **inline annotation** field so Sebastian's
   verdict ("this was the bad dig") rides along in what he pastes. Page is gated (dev flag) and
   never linked in the prod sidebar.

## 6. Gating & safety

- Server helper `devlog.append()` and the `/api/wingman/devlog` route both **early-return unless**
  `process.env.NODE_ENV !== "production" && process.env.WINGMAN_DEVLOG === "1"`.
- Main writer extends `measurement-log.ts`'s proven pattern (wrapped fs, disable-on-error, no-op when
  no session, never throws), same flag.
- `/devlog` page + `/api/wingman/devlog` return 404 when the flag is off, so nothing ships live.
- `dev-logs/` gitignored. No secrets in the log: **Sales DNA is captured but `.env`/keys are NOT**;
  the header records model IDs + prompt hashes, never API keys.

## 7. Phasing (build serially — each phase independently testable, live-pipeline is shared state)

- **Phase 0 — plumbing:** `devlog.ts` server helper + `/api/wingman/devlog` route (gated); `dev-logs/`
  + gitignore; the shared record schema + callId correlation (Design choice A). Prove with a
  hand-fired event.
- **Phase 1 — server capture:** header (session route: Sales DNA + config), card generations
  (kb-signal: payload + output + tokens + tic result + server timing), summarizer (summarize:
  snapshot + diff + hallucination-check). The richest data, lowest risk (server-only).
- **Phase 2 — renderer capture:** card lifecycle + latency breakdown (incl. TTFT) + non-fires/drops +
  close-readiness + the exact chunk, via `POST /devlog`.
- **Phase 3 — main capture:** extend `measurement-log.ts` to also emit to `dev-logs/` with callId;
  add Recall lifecycle + partials + presses (much already logged — mostly re-point + enrich).
  ⚠️ **Wiring rule (reviewer #4):** `closeDevlog(callId)` MUST fire on EVERY session-end path (manual
  end, auto-stop, crash/meeting-lost) — mirror `endMeasurementLog()` inside `stopRecallAI()`, or each
  dev test call leaks one open fd + Map/Set entry.
- **Phase 4 — derived passes (post-call):** merge the two files; card adoption classification;
  belief-ladder trajectory; prospect-reply-after-card pairing; footer aggregates + cost tally.
- **Phase 5 — `/devlog` page:** the merged "call film" renderer + Copy button + inline annotations.
- **Phase 6 (LATER, separate):** the production adoption dataset (§8) — its own PR, its own review.

Each phase gated to "done" by: typecheck + `wingman-reviewer` on the diff + a real local call proving
the data lands and the live call is unaffected.

## 8. Card adoption — two homes (Sebastian 2026-07-22)

1. **Dev flight recorder (now):** used/paraphrased/ignored per card, for the voice grind. Phase 4.
2. **Production backend dataset (LATER — Phase 6, separate PR + review):** store `{card output → rep's
   actual phrasing}` pairs across real users, invisibly, during launch/testing. Once there's volume,
   use it to refine outputs toward how strong closers naturally re-word them (a self-improving voice
   loop + Core-Rules #10/#11 quality metric). Shares the capture *logic*; destination is a Supabase
   table, not a local file. Needs its own mini-design: table schema, retention, and a privacy note
   (transcripts are already retained per Invariant #6, so no new line is crossed, but this is
   real-user data and must be gated + documented). **Not built with v1.**

## 9. Failure modes / risks / open questions (for plan-reviewer)

1. **Cross-process correlation** — Design choice A1 vs A2. Does adding `callId` to a `call:start` IPC
   risk the Invariant #2/#4 state machine (isRunning/callActive together)? Is A2's join safer?
2. **Hot-path safety** — partials are high-frequency; confirm main's file writer (append stream) is
   O(1) and can't back-pressure the transcript handler. Confirm no `devlog` call is ever `await`ed
   inside the card SSE `start()` loop or the transcript event handler.
3. **Streaming capture** — capturing the raw output server-side means accumulating deltas in
   `kb-signal`'s stream `start()`; must not perturb the existing controller-closed guards or TTFT.
   Prefer logging AFTER the terminal event, from an accumulated string, in a `try/catch` tail.
4. **File growth / cost** — full prompts + full transcript per call = sizeable JSONL. Acceptable for
   dev, but cap per-line size and note it. `dev-logs/` cleanup policy (keep last N calls?).
5. **Prod leakage** — triple-check the gate: helper, route, page, and main writer all honor the flag;
   a missing check anywhere = telemetry (and Sales DNA) writing on a real user's machine. Highest-
   severity risk in this build.
6. **Two-file merge determinism** — clock skew between processes is nil (same machine), but ordering
   ties need a stable sort (tMs, then source priority). Specify it.
7. **Hallucination-watch false positives** — a number the prospect said in an EARLIER window (not the
   current delta) isn't a hallucination. The check must diff against the running transcript, not just
   the last delta. Flag for tuning, don't hard-fail.
8. **`/devlog` reading a live file** — the page reads a file that's still being appended; render must
   tolerate a partial last line (JSONL parse-per-line, skip the incomplete tail).

## 10. Files touched (nothing outside this list without re-listing)

New: `src/lib/wingman/devlog.ts` (server helper) · `src/app/api/wingman/devlog/route.ts` · `src/app/
(dashboard)/devlog/page.tsx` (+ a small client component) · `.gitignore` (add `dev-logs/`).
Edited: `electron/measurement-log.ts` (dual-write + callId) · `electron/main.ts` +
`electron/recall.ts` (call:start callId IPC + Recall lifecycle events) · `src/app/api/wingman/
session/route.ts` (header) · `src/app/api/wingman/kb-signal/route.ts` (card capture) · `src/app/api/
wingman/summarize/route.ts` (snapshot/diff/hallucination) · `src/hooks/useWingmanPoller.ts` +
`src/app/(dashboard)/dashboard/DashboardClient.tsx` (renderer capture). Post-call/derived passes:
a `scripts/` merge+adoption analyzer (or a `/devlog` server route) — TBD in Phase 4.
