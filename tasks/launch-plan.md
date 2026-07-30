# Wingman Launch Plan — The Cutline

*Written 2026-07-26. This is the scope contract until launch. Nothing gets built unless it's on this list. New ideas go to the Parking Lot at the bottom — no exceptions, even good ones. ESPECIALLY good ones.*

**The rule:** before building anything, ask — *"does this block a Test Pilot from using the 4 arrows?"* If no → Parking Lot.

---

## Track 1 — Test Pilot Beta (target: ~2 weeks)

Goal: 5–10 hand-picked closers ("**Test Pilots**") using Wingman free on real calls, giving feedback. No website, no Stripe needed for this track.

### Session 1 — Ship the backlog 🚢 ✅ DONE 2026-07-27
- PR #54 (feature payload) + PR #55 (version bump) both merged to main → Railway auto-deployed the web half
- **v0.1.29 published LIVE** to `bandidoseb/wingman-releases` (draft=false, signed + notarized, `latest-mac.yml` present → auto-update works). Build 11m50s.
- Two `wingman-reviewer` rounds before merge caught: (1) auto-stop safety pill clobbered → permanent "Debrief ready" over a live call [`hubSafetyClaimed` latch]; (2) post-call polling re-ran the full dashboard load (20 calls × transcripts, ~180MB per call ended) → light `GET /api/calls/[id]`, ~2000× cut; (3) SELF-INFLICTED regression — dropping transcripts from the list query silently starved "Ask Wingman" of its transcript context.
- Merge snag resolved: PR #53 was squash-merged to main, so the branch's identical Live Hub work conflicted (12 HUD + 3 doc). Each inspected; branch was a strict superset everywhere except the deliberate post-call morph change.
- Migration 011 shipped (outcome_source confirmed present in prod). Migration 010 (card_style) intentionally NOT run — dial is inert.
- ⚠️ STILL UNPROVEN ON A REAL CALL (→ Session 8 dogfood): HUD safety latch (needs a 2-hr call or 20-min silence), post-call pill morph on a real call end, AI outcome auto-detect quality, #52 cold-ladder dig fix.

### Session 1b — DASHBOARD REBUILD 🗂️ (widened 2026-07-28 — was "Flight Log redesign")
> **SCOPE CHANGE 2026-07-28.** Sebastian pulled **"Dashboard full rebuild" OUT of the Parking Lot into Track 1**. Claude flagged the cutline; Sebastian reaffirmed, with a method: Claude builds the missing foundation while Sebastian sweeps the dashboard and reports everything that sticks out. Full plan: `tasks/todo.md`. Sweep instrument: `tasks/dashboard-sweep.md`.
>
> **What justified widening it:** the rebuild is mostly *mechanical*, not aesthetic. Measured 2026-07-28 — the Design Language's own Rollout step 2 ("tokens into the app") was **never done**: `globals.css` has zero tokens, and the dashboard carries **577 hardcoded hex literals across 41 unique colors** (spec defines ~20), with only 5 shared primitives. That absence is *why* it reads "Frankensteined" — every tab invented its own palette. Session A lands the token layer + primitives + a `token-lint` CI gate; screens then rebuild one per PR.
>
> **Cutline discipline retained:** one screen per PR, every session ships, and `DashboardClient.tsx` data/polling logic is off-limits (PR #54's ~2000× cost regression lived there).

Flight Log is still the FIRST screen rebuilt (Session B), and the original ruling stands — decide what the Flight Log SHOWS before fixing how it displays; fixing labels inside a section we're about to delete is wasted work.
- **Redundancy:** "Topics Missed Before Pitch" is a third rendering of data already shown twice — its `press stage/confirm stage/pitch/close` chips are just the incomplete rows of STAGE BREAKDOWN, and `cant_diy/investment readiness/why you` are just the unchecked rows of FRAMEWORK COVERAGE. Candidate for deletion.
- **Raw internal keys leaking to users:** `cant_diy`, `investment_readiness`, `why_you` appear BOTH in the AI debrief prose AND the missed-topics chips. Cause: `post-call/route.ts` defines the pillars to the model in snake_case (lines ~31-92), so it echoes them. Fix = prompt rule (never emit internal keys) + a display-side key→label mapper as a backstop. `PILLARS` in `FlightLogTab.tsx` already holds the human labels.
- Granola-referenced visual pass. Design Language spec is the north star.
- ⚠️ Do NOT patch the underscores before this session — they live in a section that may not survive it.

### Session 2 — Replay Harness (the voice-grind engine) 🎯
The centerpiece. Sit for hours testing real card outputs without being on a call.
- **Input:** Land Geek closer-call transcripts (preferred: text w/ speaker labels + timestamps; video OK → local transcribe ~$0.30/call) + Sebastian's own past-call transcripts from Supabase
- **Behavior:** load a call → scrub to any moment → summon ↑ objection or ↓ dig → get the EXACT card the live system would produce (same prompts, same code path, same belief-ladder context)
- **Grading:** ✓ / ✗ / rewrite capture per card (extends `voice-batch.mjs` workflow) → feeds the grind rounds
- **Cost control:** cache summarizer states per call so re-grinding the same call doesn't re-pay; est. ~$1–1.50 per replayed call-hour
- **Privacy:** transcripts stay local, NEVER committed to the repo. Confirm team is OK with usage.

### Sessions 3–5 — The Voice Grind 🎤
- Sebastian's #1 lever this week. Hours of harness reps: summon → grade → Claude encodes → repeat
- Reward signal = Sebastian, not an LLM metric
- Tic gate + confrontation eval stay green every round
- Timeboxed: when cards consistently pass Sebastian's ear on real-call replays, it SHIPS. Perfection is post-launch.

**Bundled into this week (all decided 2026-07-26, all eval-gated):**

**A) The cold-open ruling — ↓ must be allowed to stay quiet.** Today TWO instructions force a question no matter what: `dig-prompt.mjs` line ~78 ("an early call is a reason to START discovery, never a reason to stay silent") and the no-summary fallback in `buildDigUserSegments` ("...so ask a solid OPENING discovery question grounded in what they just said"). Both must change together. LOCKED RULES:
1. The test is **"has the prospect revealed anything real?"** — NEVER "how many minutes in." Real = a problem, goal, number, frustration, constraint, what they've tried, why they took the call. Not real = greetings, location, weather, tech check, scheduling, "got your book," "still researching."
2. Something real on the table → **dig it**, anchored to their exact words. Identical at minute 2 and minute 40. (Unchanged normal path.)
3. Nothing real yet → **Wingman admits it has nothing.** It may NEVER invent a discovery question from its own head. No anchor → no card.
4. Never take-the-close on a cold ladder (#52 — already shipped).
5. The quiet state is **honest, not instructional**: `"Nothing to work with yet."` replaces `"Start discovery."` (Rejected: "Still listening." — reads like a loading spinner on a terminal state.)
- Doctrine: **Wingman speaks only when it knows something the rep doesn't.** At minute 1 with nothing said, it doesn't — and saying so IS the feature. This is the product-rule-#10/#11 line and the [[project-positioning-gutter-moments]] marketing story.

**B) Exhaustion detection — "when is enough enough" (PULLED FROM PARKING LOT — pre-beta REQUIRED, Sebastian 2026-07-26).** Reps will mash ↓. Today the ladder redirects once a belief locks ✅, but there's no sense of exhaustion WITHIN a belief — the third question about their timeline is one too many, and the prospect feels interrogated. That's product rule #11 breaking in front of the first ten users. Scope: repeat-press awareness on the same belief → either move on or hand back "nothing more here." Graded in the harness alongside the voice grind. (The rest of the dig-threading track stays parked.)

**C) Rename ↓ "Dig Deeper" → "Discover"** (Sebastian-locked 2026-07-26). Rationale: "Deeper" implies something must already exist to deepen — it misdescribes the arrow (which also opens NEW discovery), and it misled Claude while reading the code, so it will mislead reps. "Discover" = asking questions IS discovery.
- **USER-FACING ONLY**: HUD compass label + card chrome (`DISCOVER · PAIN`). Do NOT rename `dig-prompt.mjs`, `DIG_SYSTEM_PROMPT`, `dig-signal.ts`, or eval identifiers — zero user value, real risk to the eval gates pre-launch (CLAUDE.md rule #3).
- Noted + accepted: "Discovery" is also one of the 6 call stages, and the arrow is useful in Press/Confirm too. Precedent: → Close is already both an arrow and a stage without confusion.
- ← stays **Answer** (Sebastian-locked 2026-07-26). The "Explain" idea existed only to dodge an Ask/Answer collision; picking Discover removed the collision entirely. Final set: **↑ Objection · ← Answer · → Close · ↓ Discover**.

### Session ~4 — Prospect Anchors expansion ⚓ (the ONE unfreeze)
- Summarizer already captures anchors (7/22 Cole-brain redesign) — this wires them INTO the objection + dig cards (prospect's own words at the moment of stall)
- Contained: 1–2 sessions, eval-gated (`test-belief-ladder.mjs` + confrontation-eval green)
- Natural overlap w/ queued Offer-Aware Phase 1d (Sales DNA → objection card) — do together if scope allows

### Session 6 — Build the ← Answer arrow
- The only missing arrow. Direct Sonnet call, NO KB (per decided design, `project_answer_card_redesign`)
- **Name stays "Answer"** (Sebastian-locked 2026-07-26). Final compass: **↑ Objection · ← Answer · → Close · ↓ Discover**
- Same voice standards as objection/discover — run its outputs through the harness before calling it done

### Session 7 — Cost guardrails 💸
**MEASURED cost (2026-07-26, from Flight Recorder live-call telemetry + verified Recall pricing):**
| Component | Per recorded HOUR | Source |
|---|---|---|
| Recall.ai recording | $0.50 (prorated/sec) | recall.ai 2026 pricing |
| Transcription (Deepgram via Recall) | ~$0.15 (verify real-time rate on Recall dashboard) | recall.ai 2026 pricing |
| Summarizer (Sonnet 4.6, ~2-min tick, INCREMENTAL transcript, cached prefix) | ~$0.51 | measured: 19:22 call = $0.1655 exact |
| Cards (objection/dig, cached) | ~$0.05 @ 20 summons/hr | measured: $0.0024/card avg |
| Post-call job (Sonnet, max 1.9k out) | ~$0.07/call | computed from code |
| **TOTAL** | **~$1.25/hr** · 30-min call ≈ $0.63 · 20-min SDR call ≈ $0.42 | |

Prompt caching: ✅ ALREADY SHIPPED (summarizer/objection/dig/flow-synth all have cache_control). Summarizer sends only the transcript DELTA each tick — cost is flat per hour, does not grow with call length.

10 Test Pilots @ ~5 calls/day: ~$650/mo if 30-min calls, ~$1,300/mo if hour-long. Margin at current pricing ≈ 50–60% for max-usage users, ~75–80% at moderate average usage.
- **Per-user monthly recorded-hour cap** enforced in-app (friendly "cap reached" message) — the main protection
- Hard monthly spend caps: Anthropic console + OpenAI console (exact clicks provided in-session)
- Verify on Recall dashboard: real-time transcription rate + confirm NO media storage charges (7-day free window; we store nothing)
- Surface per-user monthly cost in the Owner dashboard (Flight Recorder already logs per-call cost telemetry)
- Optimization candidates (post-launch, Parking Lot): trim summarizer OUTPUT tokens (~800/tick @ 5× input price = the single biggest AI line), widen tick to 3 min, A/B a cheaper summarizer model — all eval-gated
- Track 2 note: real margins depend on AVERAGE usage across users, not max — beta telemetry sets REAL pricing before Stripe goes live

### Session 8 — Dogfood gauntlet 🐕
- 3–5 real calls exercising all 4 arrows + flow mode. Flight Recorder captures everything → fix from telemetry
- Double-click / mid-call network drop / back-to-back calls / 2-hour call — the CLAUDE.md survival standard

### Session 9 — Security pass 🔒
- `/security-review` on the full app + Supabase RLS audit + API route auth check + rate limits
- Must pass before any outside user touches it

### Session 10 — Test Pilot launch 🧑‍✈️
- Onboarding email: "You're one of 10 Test Pilots" — free through [date], then $149/mo; feedback after every few calls is the deal
- System requirements (Apple Silicon M1+, macOS 13+, Zoom/Teams/Meet), download link, no quarantine workaround needed (notarized)
- Invite 5–10 → LAUNCHED

---

## Track 2 — Public Paid Launch (~2 weeks after Track 1, while feedback rolls in)
1. Website / landing page (1 session) — must state Apple Silicon requirement
2. Stripe wiring — checkout + webhook + gating; routes already exist (1–2 sessions)
3. ~~Dashboard polish — timeboxed cleanup, NOT the full rebuild~~ → **moved to Track 1 Session 1b as the full rebuild (2026-07-28)**
4. Flip Test Pilots to paid at the pre-announced date

---

## Parking Lot ❄️ (frozen until after launch — do not build, do not discuss)
- Confrontationalness dial (built, stays PINNED)
- A/V recording / notetaker research (invariant #6 revision)
- Summarizer tuning session (brief stays ready in `tasks/plan-summarizer-tuning.md`)
- Calendar detection
- Voice-AI onboarding discovery call
- Owner dashboard (full founder cockpit — only the cost view ships in Track 1)
- Positioning wedge demo
- iMessage funnel (Project Blue)
- ~~Dashboard full rebuild (Design Language #5)~~ → **PULLED INTO TRACK 1 Session 1b (Sebastian, 2026-07-28)**
- Dig threading — the REST of the track (chunk-down flow, belief selection by natural transition, the `support`/`money-qualifier` non-sequitur fix #6). NOTE: **exhaustion detection was pulled OUT of here into Track 1 voice week** (pre-beta required). The remainder stays parked unless the harness shows it's ruining cards.
- Close-readiness follow-ups
- Kb-signal rename + dead-code removal (#37)
- **DIY audio capture (drop Recall)** — researched 2026-07-26: no botless competitor exists (all rivals = visible bots); DIY = macOS system-audio tap + Soniox/AssemblyAI streaming ≈ $0.15–0.30/hr (vs $0.65) but 6–10 dev-weeks + permanent macOS audio ownership + loses speaker names. WAKE TRIGGERS: ~3–5k recorded hrs/mo, Recall price/terms problem, or the A/V notetaker pivot. **COMMITTED DIRECTION (Sebastian 2026-07-26): Wingman WILL build its own capture post-launch** — first post-launch project, built in SHADOW MODE (runs alongside Recall on Sebastian's own calls, compare transcripts on ~20 real calls, flip only at proven parity). NEAR-TERM lever instead: negotiate Recall volume discount (sales-only; mention DIY-at-$0.20/hr as BATNA). ⚠️ PAYG fine print: 2-hr per-recording limit + 500 hr/mo account cap — both lift on Launch tier.

---

## Test Pilot program notes
- Name: **Test Pilots** (alts considered: Squadron One, First Wing)
- Free, time-boxed, reciprocal: feedback is the price
- Cap: start at 5 users → scale to 10 once cost telemetry proves per-user economics
