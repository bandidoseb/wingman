# Decisions Log

A running log of every major architectural or product decision made on Wingman. Append only — never delete. Each entry captures the decision, the date, the reasoning, and any alternatives that were rejected.

Last updated: 2026-07-07

---

## 2026

### 2026-07-07 — ↓ Dig is a SUPPLEMENT, not the foundation of discovery; transcript-only for v1, offer-awareness deferred pending live-test data
**Decision:** Dig ships (4a.1) reading ONLY the live transcript + the Belief Ladder (which is itself built from the transcript) — it gets NO offer context (verified: `kb-signal` route loads none; the `summarize`/belief-ladder route is transcript-only too). Dig is positioned as a **supplement** to the rep's own discovery — it helps when they blank or want to go a layer deeper — NOT a tool that runs their whole discovery. This must be set correctly in the dashboard tooltip (draft in the Inbox note). Making Dig **offer-aware** (feed a compact offer summary so early/thin-transcript openers are offer-tuned — "what monthly cash flow?" not "what's your goal?") is a real, tractable near-term upgrade but is **DEFERRED until after the 4a.1 live test** tells us whether transcript-only is actually a problem in practice.
**Why:** The off-topic risk is LOW once there's real conversation — Dig mirrors what the prospect actually said (a real-estate prospect talking rentals gets cash-flow digs; there's no generic question bank it pulls from). The gap is only the early/thin moments, where Dig falls back to a category-safe-but-generic opener. Discovery questions differ enormously offer-to-offer (real estate "cash flow" vs fitness "weight to lose" — same belief, different words), so a rep leading their own process + Dig supplementing is the right division of labor until Wingman actually knows the rep's process. Don't build offer-awareness speculatively before the live test proves it's needed; when we do, inject the offer summary into the Belief Ladder summarizer too so BOTH objection + dig benefit, and add offer-aware eval fixtures (real-estate/fitness/agency) guarding against fabrication from the offer text. **Bigger vision (its own build):** "Wingman learns your discovery process" — a dashboard back-and-forth that captures the rep's exact questions/sequence/language so Dig can LEAD, not just supplement. Captured in `_Inbox/2026-07-07 Wingman learns your discovery process.md`.
**Status:** Active — 4a.1 shipped transcript-only (built + wingman-reviewer APPROVE, awaiting live test). Offer-aware Dig + discovery-capture = queued, not scheduled.

---

### 2026-07-07 — ↓ Dig Deeper = a press-driven DIG FLOW; autonomous auto-advance = an EXPERIMENTAL top-tier toggle, built for now, decided by observed behavior
**Decision:** Phase 4a's ↓ arrow is not one card — it is a **Dig Flow**, the twin of the shipped Objection Flow, built in three stages: **4a.1** single-shot quality → **4a.2** press-driven flow (chunk-down threading, "DIG #N · <BELIEF>" chrome) → **4a.3** **auto-advance** (inside an armed Dig Flow, Wingman surfaces the next probe on the prospect's turn-end with no re-press) shipped as an **EXPERIMENTAL / BETA feature, gated to the top pricing tier, off by default, user-toggleable** with a tooltip that explains the risk. The flow engine is built NOW with a swappable advance-trigger (`press` | `auto`) so autonomy is a trigger flip, not a rebuild. Design doctrine locked the same day: press #1 = belief-gap scan (find the untouched belief, tee the opening question); chunk-down ladder (surface → clarify → quantify → emotionalize → widen) starts press #2+; cards are FIRST-PERSON spoken words, never instructions (only-money-left → the money-qualifier question verbatim); coverage standard = ALL 7 beliefs (money last); never hammer a locked belief; stop states = take-the-close / next-open-belief / transition-to-pitch.
**Why:** The rep's press is a *feature* (a human saying "they're done — next layer"): rhythm stays the rep's art, and "nothing fires unsummoned" survives because the summon opens a *session*, not a single card. But the technical blocker on autonomy is weaker than previously assumed — Deepgram (already our provider) natively ships `speech_final` + `UtteranceEnd` turn-end events, and the industry has moved to semantic turn detection — and Sebastian wants Wingman at the cutting edge of live-call AI, so we build for it now rather than retrofit. The "doors get lost" fear (a long answer holds ~4 threads, human working memory holds ~4 chunks) is solved by the transcript regardless of trigger — the press only decides WHEN the card appears, not what Wingman knows — which narrows autonomy's value to zero-press smoothness: real, but not worth betting the product on. Tier-gating covers the extra cost (each auto-fire ≈ a penny of Sonnet; an armed 5-min flow ≈ 5–10¢) with top-tier margin, and "Experimental" labeling makes users opt into the risk knowingly. **Distinguished from the REJECTED armed-objection-listener (2026-06-15):** that predicted objections BEFORE any press (wrong-card risk, autonomous-model reversal); this continues a flow the rep explicitly opened. Final call ships by observed behavior on Sebastian's real calls — same test-don't-assume doctrine as the 2026-06-11 failover decision.
**Status:** Active — governs the Phase 4a build (`tasks/plan-phase4a-dig.md`).

---

### 2026-07-03 — #41 fix = merge Deepgram partials at press time; stay on Deepgram
**Decision:** Fix the stale-objection-tail bug by merging Deepgram's partial (unfinalized) transcript stream into the objection-card request AT PRESS TIME, rather than switching providers or moving the whole live pipeline onto partials. Finals remain the authoritative/durable record (DB, summarizer, anchors, cursors); the partial "live tail" is ephemeral and rides only the outgoing request's volatile uncached segment. A ≤350ms settle wait fires only when a partial is <1.5s old.
**Why:** Measured on 2 real calls — finals lag speech ~500ms median (up to 4.1s); Deepgram partials lag **126ms** and already hold **68%** of press-time missing words. The bug was never the provider — it was that we ignored Deepgram's fast partial stream (and `interim_results` defaulted OFF, so we got zero partials at first). **Rejected: switching to AssemblyAI** — its own claimed ~300ms is slower than measured Deepgram partials; a switch would delete the reconciliation layer but isn't warranted. AssemblyAI stays the accuracy fallback only.
**Status:** Active — shipped PR #36 (web). Packaged apps get the Electron side on the next desktop release.

---

### 2026-07-03 — Contextual abstain chips replace the generic "no objection detected" card
**Decision:** When the objection model abstains, return `{"line":null,"reason":<enum>}` and show a short DIRECTIVE chip instead of the generic "no objection detected" — a small fixed set: "They're ready — close now." / "Let them finish." / "Waiting on their response." / "Nothing standing — keep going." / "Just logistics — answer it straight." / "Handled — move forward." Build AFTER #41 lands.
**Why:** A rep fumbling for a next move while the prospect says "yeah, let's do it" is the most expensive silence on the call — a dead-end "no objection" card wastes it; a "close now" directive is arguably Wingman's highest-value card. Must build on clean input (#41 fixed) or it could flash "close now!" on half-arrived transcript. Chips stay directive, never scripted lines (robot-risk). Keep the set SMALL for reliable classification.
**Status:** Planned — next objection-slot work after the circle-back fix.

---

### 2026-07-03 — The → close arrow is a PRE-PITCH readiness read, not a mid-action closing button
**Decision:** Phase 4's → close slot answers "am I clear to pitch? what are my odds of an objectionless close?" — used BEFORE the rep pitches. It is NOT a "give me a closing line" button pressed mid-objection-battle.
**Why:** Sebastian's framing: once you've pitched, figuring out "should I close yet" is moot — you're already there. The pre-pitch readiness read is the genuinely useful moment. Mid-objection "they're ready, close now" is the abstain-chip's job (above), not this arrow's. This keeps the two features from overlapping and defines how Phase 4 must be built.
**Status:** Active (guides unbuilt Phase 4).

---

### 2026-06-30 — Unified the two phase-numbering systems into ONE master roadmap (objection "Phase 1/2/3" → Phase 3.6)
**Decision:** Collapse the "small" objection-card refinement numbering (its own Phase 1/2/3, from the 06-21 → 06-29 sessions) into the "big" Hotkey Signal-Card Model (Phases 0–5). The small track is renamed **Phase 3.6** — a deepening of the ↑ objection arrow *inside* big-model Phase 3. 3.6a = shipped (Sonnet prompt/KB cut/headless card), 3.6b = confidence-aware summarizer (next), 3.6c = anchor library (deferred). A MASTER ROADMAP table now lives at the top of `Current Sprint.md`; all future build logs use these unified numbers.
**Why:** Two live numbering systems collided — last session's "Phase 1 shipped" referred to the *small* track, which read as if the big project had restarted, and Sebastian (correctly) couldn't tell whether the larger 1-through-5/6 project was finished. It is not: done through 3.5; **Phase 4 (← answer · ↓ dig · → close) and Phase 5 (cleanup) are still outstanding.** One list prevents work (and progress) from getting lost.

### 2026-06-30 — Desktop releases go through a PR + must be published manually; auto-update is broken (release-blocking)
**Decision:** The documented `npm version patch; git push --tags` direct-push release flow is dead — `main` is protected by a GitHub ruleset. Releases now route: branch → `npm version patch` → PR → squash-merge → re-tag the merged commit → push tag → **publish the draft** (`gh release edit vX.Y.Z --draft=false`). CLAUDE.md updated to match. Logged **Issue #45**: the auto-updater has never worked (releases built as drafts; Sebastian downloads the `.dmg` by hand) and is **release-blocking for public beta**.
**Why:** Discovered while cutting v0.1.22 (the first release since June 5 — 6 PRs had merged un-released). Direct push was rejected by the ruleset; the build uploaded as a draft invisible to `electron-updater`. The pipeline must auto-publish + actually deliver updates before any beta user can be onboarded.

### 2026-06-29 — Objection card SHIPPED; production prompt = v1 tonality + a spliced no-fabrication fence (a MERGE)
**Decision:** Ship the 2026-06-21 objection prompt's TONALITY verbatim, but splice in an explicit accuracy section ("USING THEIR DETAILS — NEVER MAKE ANYTHING UP": no invented/rounded/sharpened numbers, no invented social proof, confidence-gated digits, anchor-only-when-it-sharpens). The fence existed only in a v2 rewrite that was otherwise rejected; the body is v1.
**Why:** A multi-run offline eval (`scripts/objection-eval.mjs`, AI judge for volume + Sebastian as final tonality judge) showed the v2 rewrite did NOT beat v1 on tonality (tied; v1 edged it) — but v1 lacked any no-fabrication rule. The merge keeps the proven voice and adds the guardrail. Built + validated offline before wiring (zero live risk). **Methodology baked in:** objection-prompt work is now eval-driven — scored rubric, change one variable, re-run for variance — not vibes.

### 2026-06-29 — Anchor library ("it remembered me" store) DEFERRED, not killed
**Decision:** Do not build the persistent per-prospect anchor library yet. Keep the design; revisit as a guarded Phase 3.
**Why:** Across eval runs, structured anchors gave NO aggregate quality lift (within judge noise) AND carried a fabrication tail (~1 bad card / 3 runs) until the social-proof fence landed. The real value is per-scenario (a kill-shot detail like "you said you can't go back to a 9-5"), which the AI judge under-measures — that's a live, human call. Build it later WITH the fence (and ideally a deterministic "cite-only-provided-details" check) + a `calls.anchors` schema. The Belief Ladder summary already retains a few verbatim quotes, so little is lost by waiting.

### 2026-06-29 — Objection-card fabrication is prevented at the PROMPT layer, not a runtime validator
**Decision:** Stop card fabrication with targeted prompt rules; do NOT add a runtime card-validator.
**Why:** Both observed fabrications were the same move — inventing third-party social proof ("the coaches who hit $X"), not misusing the prospect's own data. One rule ("NEVER invent claims about other people / manufacture social proof") took fabrications from 1/3-runs → 0/3. A deterministic number-validator would NOT have caught it (the leaked figure was a REAL number; the invented part was the *claim*) and would add a latency step. **Rejected:** the validator, on Sebastian's (correct) push that a text rule can fix this.

### 2026-06-29 — No prompt caching on the live objection card
**Decision:** Do not cache the objection-card system prompt; do not pad it to become cacheable.
**Why:** Sonnet 4.6's minimum cacheable prefix is **2,048 tokens** (verified via the claude-api skill — the ~1,024 figure is OLDER Sonnet only; an earlier claim of mine was wrong). Our prompt is ~1,700 tok, so caching would never fire. Padding to 2,048 would slow cold-press TTFT, dilute instructions (hurts quality), and save only fractions of a cent. Speed comes from short output + (queued) streaming. Model-coupled — re-check if the model or prompt size changes.

### 2026-06-29 — Model-resilience = central source-of-truth + daily canary (NOT auto-rotate)
**Decision:** Address model-deprecation risk with (a) one `src/lib/wingman/models.ts` every route imports and (b) a daily **canary** that checks each model via Anthropic's Models API (`GET /v1/models`) and alerts on deprecation — plus watching deprecation emails. Do NOT auto-rotate model IDs.
**Why:** A retired model (`claude-sonnet-4-20250514`, retired ~June 15) silently 502'd the Coach because model IDs are scattered string literals and one drifted. Auto-rotating to "latest" is risky — new models shift quality/cost and prompts are tuned per-model. Anthropic gives months of notice + emails the account owner, so the fix is: one place to update, automated early warning, and a watched inbox. Own session (touches ~6 routes) — Known Issue #44, Sprint NEXT #2.

### 2026-06-21 — KB CUT from the live objection/signal-card path (kept for the Wingman Coach only)
**Decision:** The live press-time objection card no longer uses the KB — no embed, no `searchKnowledge`, no retrieved-script. The KB is retained ONLY for the Wingman Coach / Mission Intel (`searchCoachingKnowledge`).
**Why:** A blind A/B (12 objections × 4 arms — KB vs Claude-free vs "like Miner" vs "like Gordon"; `scripts/kb-ab-*.mjs` + `grader.html`) showed the KB card indistinguishable from / worse than no-KB, and the KB whiffed on ~1/12 even in test. Worse, `knowledge-signal.ts`'s rule *"base your headline directly on the retrieved script"* actively CONSTRAINED good cards toward mediocre guru scripts. A KB of public YouTube sales advice is not a moat (Claude knows the canon); the real moat is the per-rep **Belief Ladder** context. **Validated, not assumed.** Wiring pending — `tasks/wiring-objection-prompt.md`.

### 2026-06-21 — Objection card = context-driven prompt (belief-diagnosis → tie-down), no retrieval
**Decision:** Replace KB retrieval for the objection slot with one prompt that diagnoses which of the 7 beliefs is weak → handles uncertainty-first → pace + tie-down anchored to the prospect's own words → ONE first-person line.
**Why:** Cole Gordon's own teaching: *"every objection traces back to one of the 7 beliefs."* Wingman's live summary (`belief-ladder.ts`) already tracks all 7 + the gap + emotional why + verbatim quotes — the gap was never *capture*, it was *usage* (the old prompt received the summary but never mined it). Distilled from 7 training videos (Cole Gordon + Matthew Ryder) + 13 live-call transcripts → `knowledge-base/objection-transcripts/PLAYBOOK-SYNTHESIS.md` + `LIVE-CALL-FINDINGS.md`. Prompt source: `scripts/objection-prompt-test.mjs`.

### 2026-06-21 — Objection card model = Sonnet 4.6 (not Haiku)
**Decision:** Generate the live objection card with Claude Sonnet 4.6, not Haiku.
**Why:** Tonality is the product on an objection card, and Haiku has a stubborn "wind-up" tic (preambles like "real talk" / "here's what I'm asking") that prompt-engineering + few-shot could NOT kill — remove one phrase, it substitutes another. The same prompt on Sonnet is clean and human with no tic (every flagged issue fixed). Latency: Sonnet ~2.1s typical vs Haiku ~1.7s (~0.4s more; one 6.2s tail spike) — the budget was freed by cutting the KB (no embed/search), and the streaming reveal masks the rest. **Rejected:** Haiku + a deterministic wind-up strip (band-aid, wouldn't match Sonnet's phrasing).

### 2026-06-21 — Signal cards drop the headline (type-tag + first-person line)
**Decision:** Remove the ≤5-word headline from ALL signal cards. New shape: a tiny type-tag (e.g. "Objection handle" / the pressed arrow) + main text = the first-person line the rep says.
**Why:** Sebastian — the headline + subtext two-tier was confusing to read live, and on an objection the reading-flow IS the tonality. The new objection prompt already outputs a single spoken line. **Supersedes** the "Two-Tier Card Format" in `00 - Product/Signal Card Design Science.md` and the HEADLINE/SUBTEXT prompt in `00 - Product/Prompt Library.md`.

### 2026-06-15 — Live KB vector search runs IN THE NODE SERVER'S MEMORY (not the Supabase RPC); Pinecone NOT needed
**Decision:** The live press-path vector search loads the entire eligible KB (6,554 trigger embeddings, ~40MB) into the Railway server's RAM at boot and brute-forces cosine in-process (~10–20ms, exact). The Supabase RPC stays only as a circuit-breaker-guarded fallback for the post-deploy boot window. Shipped as PR #17.
**Why:** EXPLAIN ANALYZE proved the RPC took **2,091ms** — its `DISTINCT ON (e.id) … ORDER BY e.id, distance` shape structurally cannot use a vector index, so every press seq-scanned all 6,554 vectors on a small shared instance. At 6.5k vectors (40MB) the right move is in-memory brute force, not a faster DB or a vendor. **Rejected: Pinecone migration** (Sprint item 0e/0j) — earns its keep at millions of vectors, not thousands; in-memory is faster, exact, and removes a network hop. Parity gate proved identical retrieval to the RPC (sims within 1e-4). **Scale ceiling honestly documented** in `kb-memory.ts`: brute-force on the event loop is safe to ~100k triggers (~3k entries); past that → in-process ANN (usearch/hnswlib) in a worker thread, then a binary-snapshot boot loader; a >25k-trigger load-time alarm prevents silently outgrowing it.

### 2026-06-15 — Self-hosted local embeddings chosen OVER the cross-user shared cache (build quality/speed before scale)
**Decision:** To kill the ~500ms OpenAI embedding on the live path, the direction is a **local embedding model running in-process on Railway** (BGE via `fastembed`), NOT an app-wide cross-user objection cache. Self-host is sequenced LAST of the three latency fixes (see sequencing entry). The cross-user cache is deferred to `_Inbox/Future Build - Cross-User Objection Cache.md`.
**Why (Sebastian):** "You can't build the speed on top of a user base you don't have yet." The shared cache only pays off at thousands of users (0 today) — it does nothing now. A local model helps from user #1, removes OpenAI as a live-path dependency, and (at 384-dim) shrinks the in-memory KB ~4x. **The two are also largely redundant** — local embedding is already ~10–50ms, so the cache would shave an imperceptible ~30ms for real Redis infra. **Caveat (must validate):** switching the query model requires re-embedding the entire KB with that model and a per-objection quality gate — it may not do as well as OpenAI on OUR objections; abort if it regresses (offline, zero prod risk). Hardened plan: `tasks/plan-selfhost-embeddings.md`.

### 2026-06-15 — REJECTED: the "armed objection listener" (rep-armed auto-fire / predictive pre-generation)
**Decision:** Do NOT build a mode where the rep "arms" objection-listening during the pitch and Wingman auto-fires or speculatively pre-generates objection cards.
**Why:** It re-opens the autonomous-firing model that Phase 1 deliberately retired (the whole pivot to rep-summoned cards). It's the highest-cost, most failure-prone option (predicting objections → wrong-card risk, extra Haiku calls), and it doesn't even dodge the transcript lag (it still needs the objection text to write the right card). Partials + streaming + (later) self-host get press-to-card to ~1s without that complexity or that philosophical reversal. Captured so a future session doesn't re-propose it.

### 2026-06-15 — Press-to-card latency fix order: partials → streaming → self-host embeddings
**Decision:** After PR #17, attack the remaining latency in this order: (1) partial transcripts, (2) streaming card reveal, (3) self-hosted embeddings.
**Why:** Post-PR-17 the budget is generation ~1.5–2s (biggest) > transcript lag 1–3s (makes cards *wrong*) > embedding ~0.2–0.5s (smallest). Partials fixes a *correctness* bug (card fires for the previous objection — Issue #41) and is the cheapest (a measurement first). Streaming kills the dominant generation cost (gated on a Railway SSE-buffering spike). Self-host is the smallest lever and the heaviest build, so it goes last. The plan-reviewer caught that the self-host plan was attacking the 3rd-biggest cost — this sequencing is the correction. **Provider for partials: stay on Deepgram** (lowest-latency streaming specialist, already ours, tunable); AssemblyAI is the accuracy fallback if measured churn is too high.

### 2026-06-11 — Live-pipeline provider resilience = FAILOVER-ONLY (Anthropic direct primary → OpenRouter same-model fallback) + circuit breaker
**Decision:** Wingman gets a provider-resilience layer for the live-call AI path, built as **failover, not middleman**:
1. **Happy path unchanged** — all live-call AI requests go DIRECT to Anthropic, exactly as today. Zero added hops or dependencies when things are healthy.
2. **Per-request reactive failover** — a tight timeout/error on a live request → immediate retry via OpenRouter pinned to the **same model** (Claude Haiku) on alternate infrastructure (Amazon Bedrock / Google Vertex — same weights, same voice, independent server fleets). The rep gets the card a beat late and never knows.
3. **Circuit breaker (server-side, shared across users)** — N failures/slow responses in a short window → ALL live traffic routes via OpenRouter for a cooldown; Anthropic is re-probed periodically (the Phase 3.5 call-start warm-up ping doubles as the probe) and traffic flips back when healthy. One user's bad press protects everyone within seconds.
4. **status.claude.com = SECONDARY signal only** — it has a pollable JSON API, but status pages lag real pain by minutes (human-declared incidents). Own-traffic detection is primary; the status feed may pre-open the breaker during declared incidents + power an ops alert to Sebastian.
**Why:** Sebastian's requirement is uptime peace of mind — "no single company's bad day reaches my reps" (he's personally felt repeated Anthropic slowdowns). **Rejected alternative:** routing 100% of traffic THROUGH OpenRouter — the middleman becomes the new single point of failure, adds its ~50–150ms tax to every press for the rare-failure case, and forces an API-format rewrite of the whole hot path. Failover-only makes BOTH an Anthropic outage AND an OpenRouter outage non-fatal. (Also rejected earlier same-day: per-press model bouncing Claude/GPT/Gemini — 3× prompt-tuning surface, inconsistent card voice mid-call.)
**Scope/sequencing:** **Own build, AFTER Phase 3.5 merges + passes its live gate.** Design TOGETHER with the HUD card-streaming idea (`_Inbox/2026-06-11 HUD card streaming idea.md`) — same call sites, and a stream must survive a mid-stream failover. Prereq: Sebastian creates an OpenRouter account + API key (+ small credit balance). Open questions for the build plan: **which mechanism Wingman actually ships — per-press failover, the circuit breaker, or both layered. Do NOT assume the answer: test and play with each against real/simulated failures during the build and pick by observed behavior (Sebastian, 2026-06-11)** — e.g. per-press alone may be enough if failures are rare one-offs, the breaker earns its keep only if degradation comes in sustained waves. Also: which calls get failover first (press-time card + nudge = yes; Belief Ladder summarizer = lower urgency, self-heals next tick; post-call already has retries), breaker thresholds + cooldown, breaker state location (in-memory on Railway now, Redis later), and the OpenRouter request-format translation layer (OpenAI schema vs Anthropic messages API).
**Status:** Logged, not built. Needs its own Plan Review Loop before any code.

### 2026-06-10 — Compass/HUD position stays bottom-left; per-user layout configurator parked for later
**Decision:** The compass menu (and signal cards) stay **bottom-left** for now. Sebastian's bottom-right instinct ("arrows are on the right side of the keyboard") was considered and set aside: reps don't look at their hands when pressing arrows — what matters is eye placement and screen collision, and bottom-right is where Zoom parks the self-view + meeting controls. Bottom-left also keeps the compass and the card it summons in the same corner. The bigger idea — a **dashboard HUD layout configurator** (mock screen, drag each HUD element or pick preset layouts with live preview) — is captured in `_Inbox/2026-06-10 HUD layout configurator idea.md` and parked until after Phase 3.5. A cheap interim Settings left/right toggle was also rejected for now as premature with the configurator coming.
**Status:** Locked for beta. Revisit via the configurator build.

### 2026-06-10 — Arrow-pick feedback = green flash on the picked arrow → "thinking" pill
**Decision:** When the rep picks a compass direction, the picked arrow **flashes green ~0.5s while the other three vanish**, the compass fades, and the already-locked Phase 3.5 **"Wingman's thinking…" indicator** takes over until the card lands (or the "Couldn't pull that — tap ↑ to retry" error state). This replaces the live-test gap where pressing an arrow gave zero acknowledgment. Rejected: keeping the whole compass on screen ~2s with the highlight (holds screen real estate, delays the thinking state, feels slower).
**Why:** Closes the full feedback loop — input registered (flash) → working (pill) → result (card) — with no dead air, which the 2026-06-10 live test showed is disorienting (Sebastian: "nothing told me the up arrow was pressed").
**Status:** Locked. Build lands **inside Phase 3.5** as part of the summon-state indicator task (same HUD/IPC surface).

### 2026-06-07 — Objection/question retrieval = query distillation on Groq (Llama 3.1 8B Instant)
**Decision:** Before searching the KB for a summoned ↑objection (and later ←answer) card, run a **query-distillation step**: a small fast model reads the last ~120s of transcript and extracts ONE short, specific, first-person objection phrase (e.g. "I can't drop $8k without asking my wife, last program flopped"). That distilled phrase — not the raw 120s buffer — is embedded and searched against the KB. It **doubles as a quality gate**: if no real objection is found, Wingman shows a graceful nudge instead of guessing. Model: **Groq `llama-3.1-8b-instant`** (upgrade path: `gpt-oss-20B` low → `Llama 3.3 70B` only if 8B accuracy falls short on real calls).
**Why:** The current `/kb-signal` embeds the **whole 120s buffer as one vector** → mean-pooling "smoothie" dilution → the sharp short KB triggers (6,554 first-person phrases in `kb_prospect_triggers`) match poorly → low hit rate → too much `generateFallbackCard` *guessing*. Distillation creates **query↔KB symmetry** (search with something shaped like what you're searching for — Sebastian's insight). Groq because for a tiny (~15-token) output, **TTFT dominates**, not throughput — so a fast-provider small model beats a bigger one; 8B is the cheap/fast pick (~$0.05/M ≈ $0.00002/call, free-tier covers beta). Latency: adds ~250–400ms before search → press-to-card ~1.3–1.6s (vs ~1s). **Flattening worry resolved:** distillation drives ONLY the lookup; the card itself is still written from the full 120s transcript + the Belief Ladder's verbatim quotes, so emotion/specificity is never lost. The earlier "Groq too slow for tiny outputs" note is **stale** — 2026 benchmarks put Groq TTFT ~0.18s.
**Alternatives:** **Option A (chop-by-prospect-turn embeddings + max-pool)** kept as the simpler *fallback* if distillation gets finicky on distributed objections — structurally sound, no extra LLM call, but needs a new batched pgvector RPC and is less legible/controllable. **Option B (reuse the Belief Ladder summary as the query)** = KILLED for objections: the summary updates on a ~2-min timer, so a just-dropped objection isn't in it at press time — the one moment freshness matters most. **Option C** = deferred (next entry).
**Status:** Chosen. **Phase 3.5 build** (follow-up after the Phase 3 hotkey/compass plumbing). `GROQ_API_KEY` added to `.env.local` + Railway (2026-06-07) — unblocked, ready to build. **Bundle into 3.5 too (Sebastian, 2026-06-07):** a summon-state HUD indicator — on pick, show "Wingman's thinking…", resolving to either the card or "Couldn't pull that — tap ↑ to retry." Covers the ~1s generation gap AND makes the Phase 3 client fetch-timeout's silent recovery visible to the rep (~5 files: HUD pill + IPC channel + DashboardClient wiring). All first-guess numbers (120s window, model, threshold) are adjustable dials → `Wingman Brain/Beta Tuning Parameters.md`; tune on real calls.

### 2026-06-07 — On-device (local) extraction model deferred to first eng hire (Option C)
**Decision:** Running the objection-extraction step **on-device** (a small ~3B model bundled in the Electron app, inference via Apple MLX / llama.cpp on the rep's Apple Silicon) is **parked** — revisit when Sebastian hires an engineer/dev.
**Why:** Real upside — **~$0/call** (no API bill), **sub-150ms** (no network trip), and a strong **"objection processing never leaves your Mac" privacy story** that fits the Apple-Silicon-only constraint + the wiretap-compliance posture (#33). But it's a **big build**: ~2–4GB added to the app download, ~2–4GB RAM used during a call (on top of Zoom + Recall SDK), a local inference engine to integrate + warm up, and cross-Mac-model testing + ongoing maintenance — and you'd **still** use the cloud to *write* the card (quality), so it doesn't remove the cloud dependency. Distillation-on-Groq captures most of the speed win now for a fraction of the effort. Worth doing later as a cost + privacy play, not to ship beta.
**Status:** Deferred / future. Tied to first engineering hire.

### 2026-06-05 — Summarizer model LOCKED: Claude Sonnet 4.6 (not Haiku)
**Decision:** The Phase 2 Belief Ladder summarizer (the background live-call memory) runs on **Claude Sonnet 4.6.** The live press-time arrow card (Phase 3) stays on **Haiku** — Sonnet is only for the background judge.
**Why:** A 5-transcript trap test with a pre-registered answer key (`scripts/test-transcripts/` + `EXPECTED.md`) scored **Sonnet 5/5 vs Haiku 2 slips.** Both nailed extraction + the rolling-memory mechanics (budget-contradiction override, husband-from-line-1 long-call recall); Haiku's only misses were *judgment* calls — it mistook enthusiasm for desire (01) and muddied a hidden objection (05). The Belief Ladder is mostly a judgment task, so Sonnet's edge is load-bearing. The summarizer is **background** (~90s cadence, off the arrow-press hot path), so Sonnet's slower latency costs nothing live. Haiku stays on the press-time card, which IS latency-critical.
**Cost — and the corrected number:** the earlier "~20¢/call" was measured on tiny test transcripts and was WRONG. Real usage ≈ **1,800 in / 620 out tokens per ~90s tick, flat per tick**; what scales is tick count (~30 on a 45-min call). So un-optimized Sonnet ≈ **44–59¢/call** (Haiku ~15–20¢). Cost levers locked into the build — (1) prompt-cache the system prompt (1h TTL, −90% cached input), (2) cap output ~400 tok (output @ $15/M dominates), (3) ~2-min cadence not 90s, (4) skip silent ticks — bring Sonnet to **~20–25¢/call** with judgment intact.
**The bigger principle (researched 2026-06-05):** AI-native SaaS gross margins average ~52% (ICONIQ 2026) vs ~80% classic SaaS — so the answer to AI COGS is **pricing/packaging (tiers + caps), NOT a cheaper model.** The model isn't the moat (the Sales DNA / prospect-memory data flywheel is); inference falls ~10×/yr. Build with the best judge; protect margin in pricing. Tier proposal: `06 - Finance/Tier Pricing Proposal + Unit Economics.md`.
**Status:** Locked. Keep the summarizer model-agnostic (one-line switch) so we can re-evaluate as prices/models move.

### 2026-06-03 — Call framework: show 4 universal stages, coach the elite depth underneath
**Decision:** The user-facing call structure leads with the 4 stages every closer agrees on — **Rapport · Discovery · Pitch · Close.** The other two beats from the 6-stage model (Press = cost of inaction/urgency; Confirm = the pre-pitch transition) are NOT shown as top-level stages — they're coached as **depth inside Discovery** (Press already maps to the `cost_of_waiting` pillar; Confirm = a transition coaching note). Topic coverage (the 7 pillars) is the universal, flow-agnostic layer; the rigid stage sequence is secondary context.
**Why:** Avoids the "this isn't how I sell" friction (different schools use different labels/sequences) WITHOUT dumping the elite standard. The concepts are universal; only the jargon labels ("Press"/"Confirm") and the strict order feel imposed. Universal surface ≠ lowered bar — the opinionated standard IS the product; a coach that just mirrors a rep's existing habits is worthless. The beachhead (Cole Gordon / Closers.io) is trained on the full framework, so the depth still serves them.
**Status:** Locked direction. Framing/copy decision — not a code change yet (Phase 1 produces the data regardless). Shapes the post-call viz redesign + the Playbook build. Detail: `_Inbox/2026-06-03 Framework universality — is the 6-stage model too opinionated.md`.

### 2026-06-03 — Sales DNA personalizes CONTENT, never the framework standard
**Decision:** Sales DNA adapts to a rep's **content** — their offer, prospect archetypes, real objections, winning language — but it does **NOT** adapt or relax the **framework / coaching standard.** It will never learn "this rep skips the close, so stop grading the close." The bar stays fixed; only the business context personalizes.
**Why:** Sebastian's catch — if Sales DNA "learns how a rep sells," it risks codifying a *bad* rep's broken process (the student grading their own exam). Splitting **content (personalize)** from **standard (hold firm)** keeps the coaching honest while still making Wingman feel native to their specific business.
**Status:** Locked architectural rule for the Sales DNA build (deferred — the big #1 learning build). Detail: `_Inbox/2026-06-03 Framework universality — is the 6-stage model too opinionated.md`.

### 2026-06-03 — Post-call scoring visualization + close-readiness hue
**Decision:** For the **single-call** stage/topic breakdown, use **labeled blocks colored on a continuous green→red "sunset" gradient by exact score** (not flat zone colors, not a scatter plot) — labeled categories are the easiest format for an average person to digest, and the gradient gives the dynamic, varies-every-call feel Sebastian wants. Reserve the **scatter "sunset" heatmap** (dynamically-placed dots) for an **all-calls-over-time TREND view** (x = date, y = score) where dot position actually encodes something. The **right-arrow close-readiness** indicator = a **continuous hue** (red→yellow→green) that flows with the live belief score, always paired with words + the move (never a bare gauge or raw %).
**Why:** Blocks beat scatter for ~6 labeled categories (a scatter only means something with 2 real axes); the gradient delivers the sunset aesthetic without sacrificing readability. The scatter earns its place only where there are many points + real axes (the trend view).
**Status:** Locked direction. V1.5 viz polish (single-call breakdown) + Phase 4 (readiness hue). Open detail for build time: what the trend scatter's two axes are. Detail: `_Inbox/2026-06-02 Post-call belief heatmap + readiness hue.md`.

### 2026-06-02 — Scout CUT from v1; live call summary is timer-driven
**Decision:** The "scout" (demoting `keyword-triggers.ts` to a silent tagger that triggers summary updates) is **removed from the v1 hotkey build.** The rolling Belief Ladder summary instead updates purely **on a timer** (at most once/~60s, at least once/~2min), rate-bounded to pennies/call, written by a background Haiku call that reads [current summary] + [only the new transcript since last update]. **→ MODEL UPDATED 2026-06-05: the summarizer is Claude Sonnet 4.6, not Haiku (5-trap test — see that day's entry). It persists to `calls.live_summary`.**
**Why:** The scout was a *responsiveness* optimization, not load-bearing. The summary stays fresh on the timer, and the live ~90s buffer (sent at press time) already covers recency — so a scout miss can't cause a wrong card. It added build + mental complexity for marginal benefit. Revisit only if real calls show the ~2min lag causing a visibly stale card (unlikely). The autonomous keyword *cards* are removed regardless (hotkey model fires nothing unsummoned).
**Also locked:** the summary updater is **client-triggered** (the app pings a `/summarize` endpoint every ~2min) — never a server-side long-lived timer — so it runs on Railway now AND Vercel later with zero rework.
**Status:** Locked. Full spec: `00 - Product/Phase 2 — Live Call Memory Design.md`.

### 2026-06-02 — Card generation = ONE call, "recent transcript overrides summary"
**Decision:** A summoned card is generated in a **single** Haiku call carrying [picked action] + [pre-digested Belief Ladder summary] + [live ~90s raw buffer] + [KB techniques as examples]. A hard precedence rule lives in the prompt: **the recent transcript is the most current truth and OVERRIDES the summary on any conflict.**
**Why:** Solves speed and correctness together. Speed: the model reads a tiny summary + short clip, not the whole call (heavy work pre-done in the background) → ~1s. Correctness: if a belief was just addressed but the summary lags, the model sees it in the raw clip and trusts the clip → no wrong card. We explicitly do NOT "summarize-then-generate" on press (that doubles the wait); freshness rides in via the buffer inside the one call. The precedence rule is a prompt-design REQUIREMENT — without it, Haiku may over-trust the tidy summary over messy transcript.
**Status:** Locked. Detail in the Phase 2 design doc.

### 2026-06-02 — Prompt caching: 1-hour TTL + warm + keep-warm, and VERIFY min block size
**Decision:** Cache the stable per-call block (system prompt + offer/Sales DNA/rep profile) with a **1-hour TTL** (not the 5-min default — presses can be 20+ min apart). **Warm** the cache at call start (tiny request) so even the first press is fast, and run a background **keep-warm** ping every ~50min so it never goes cold mid-call on long calls (Sebastian's idea). Do NOT cache the per-press dynamic parts (live buffer, current summary, retrieved KB, action).
**⚠️ Hard caveat:** Anthropic only caches a block above a minimum size (~1–2k tokens, model-dependent). If our stable block is under it, **caching silently does nothing and we pay full price every press.** This MUST be verified at build time by reading `cache_creation_input_tokens` / `cache_read_input_tokens` from the API response — measure it, don't assume. Flag loudly in the caching task.
**Status:** Locked as the caching plan. Speculative pre-generation remains a DEFERRED back-pocket lever (pull only if measured latency is bad AND margins allow).

### 2026-06-01 — Hotkey signal cards: input = the 4 arrow keys (directional)
**Decision:** The hotkey menu is driven by the **4 arrow keys** as an eyes-free directional pad, not number keys. Locked mapping: **↑ Handle objection · ← Answer their question · ↓ Dig deeper · → Close it / ask for the sale.** Up also summons the menu (double-tap Up = instant objection help). Menu = a compass matching the keys; dismiss = silent ~5s fade + small "esc" hint (no ticking countdown). Default key = Up Arrow with a Settings override shipping in the same phase (needs a `profiles.call_hotkey` column — show SQL before running).
**Why:** Arrows are findable by touch without looking; "never asking for the sale" is the #1 closer failure (research-backed) so Close earns the 4th slot over a generic search bar or a framework-check arrow. "Search" deferred (free-text needs a focusable input). Replaces the earlier "1–5 number keys / 5 slots" idea.
**Status:** Locked. Detail in `tasks/todo.md`.

### 2026-06-01 — Live call memory = rolling Cole Gordon "Belief Ladder" scorecard
**Decision:** Every arrow card is built from a **rolling, distilled call summary** (updated in the background by cheap Haiku, ~a few cents/call) + the last ~90s (exact words) + offer/content + the technique KB. The summary is structured as a live **Cole Gordon Belief Ladder** scorecard. KEY INSIGHT: Cole's 7 Beliefs ≈ Wingman's existing 7 pillars (Pain=core_problem, Doubt=cant_diy, Cost=cost_of_waiting, Desire=dream_outcome, Money=investment_readiness, Support=whos_involved, Trust=why_you). Tracks THE GAP (current "hell"/desired "heaven" + $ number + why + final straw + core driver), each belief's status + evidence, the prospect's exact words, open objections, and the WEAKEST LINK.
**Why:** A 90s window loses earlier context; can't send the full transcript every press (cost/latency/dilution). The rolling summary gives full-call context cheaply and replaces the `prospect_anchors` emotional memory lost when the live Sonnet poll is killed. Structure grounded in Cole Gordon's training docs (read in full this session).
**Status:** Locked into the core build. Template in `tasks/todo.md`.

### 2026-06-01 — Right arrow (Close) = readiness-aware, 3-state output
**Decision:** Pressing Right computes a close-readiness score from the live Belief Ladder and shows a **color (red→green) + a 2–3 word state + the move**: 🟢 "Close now" + the assumptive close in the prospect's words/number; 🟡 "Almost — lock <gap>" + the question to close the gap; 🔴 "Too early" + the move to build the missing belief. Pair color with words (never a bare gauge or raw %). Readiness on-demand only (never on the ambient dot).
**Why:** Protects against the two biggest close mistakes at once — closing too early (red) and never asking (green). The "weakest link" makes the framework-check ("what am I missing?") free, so no separate arrow is needed. The quality of the suggested lines will need live fine-tuning; the architecture is what's locked.
**Status:** Locked. Detail in `tasks/todo.md`.

### 2026-06-01 — Per-rep content ingestion ("Wingman clone") = premium moat (deferred)
**Decision:** Build (later, as a premium tier) a per-rep content KB: a rep pastes their YouTube channel/blog → Wingman ingests it → "Answer their question" searches **their own content first** (on-brand, founder-voice), then manual offer fields, then general LLM only as a guarded last resort. Inspired by Delphi.ai (which Sebastian uses live via Mark Podolsky's clone).
**Why:** General LLMs are generic and wrong on offer-specific/tax/legal questions; the rep's own content is accurate + a switching-cost moat. Infra already exists (`knowledge-base/ingest.js` does YouTube→transcript→embeddings). Cost is low (~$1–5 one-time for ~2,000 videos with free captions; ~$150 if audio must be transcribed).
**Status:** Logged as a high-priority fast-follow / premium feature AFTER the core hotkey model ships. Not on the v1 critical path.

### 2026-06-01 — "Offer Brain → Sales DNA" rename (Sprint item 0k) is moot
**Decision:** Item 0k is closed as a phantom task. "Offer Brain" was **never in the app code** — verified via full-repo grep + `git log --all -S "Offer Brain"` across src/ + electron/ (zero hits, any commit). It lived only in docs (CLAUDE.md, this vault, `tasks/*.html`). The 8 nav tabs contain no "Offer Brain"; what Sebastian remembered is the **Personalize** tab (offer URL crawl). The "offer" strings in the app are the literal offer feature and must NOT be renamed.
**Why:** Nothing says "offer_brain"/"Offer Brain", so there is nothing to sweep; a careless rename would corrupt the real offer feature. A visible "Sales DNA" surface belongs with the real Sales DNA learning build (deferred). Saved to Claude memory (`project_offer_brain_phantom.md`). CLAUDE.md's note that "DB columns may still say offer_brain" is incorrect.
**Status:** Closed / moot.

### 2026-05-31 — Signal cards become hotkey-summoned, not autonomous (major pivot)
**Decision:** Wingman no longer decides on its own when to surface a signal card. The rep summons help with a single hotkey. Pressing it opens a small fixed menu of options; Wingman generates the card for the option the rep picks.
**Why this is the right call:**
- Autonomous pop-ups assume Wingman knows better than the rep when they need help. It doesn't — and building that judgment to fire *only* at the right moment, *never* at the wrong one, is nearly impossible to do well. A card that fires mid-flow when the rep didn't need it pulls them out of the conversation and makes them resent the product. That reputation damage (closers judging it as "robotic / distracting") kills the business — see Core Product Rules 10 & 11.
- The rep always knows *when* they're in trouble. They just don't always know *what to say*. So put the trigger in their hands and let Wingman supply the words.
- It also makes the economics dramatically better (see cost split below).
**The components of this decision:**
1. **Hotkey = the Up Arrow by default, captured only while a call is live, changeable in Settings.** Up arrow is universally present and findable by touch without looking. Capturing it only during a live call means Wingman doesn't "steal" the key system-wide. A Settings override covers any rep whose keyboard or habits conflict. (Assumption: closers don't navigate with arrow keys mid-call — they use the trackpad. Validate in beta.) **Dismiss is dead-simple — the same key again, or Esc** — so a reflexive press during a screen-share never leaves a card stuck on screen. (Implementation: register the global shortcut on call start, unregister it in `stopRecallAI()` so capture is scoped to the live call and torn down on every stop path.)
2. **The keyword classifier (`keyword-triggers.ts`) is demoted from card-launcher to silent scout.** It no longer fires anything. It runs continuously and tags context (objection raised, question asked, topics covered) into session state, ready to enrich a card the instant the hotkey is pressed. Because it can no longer fire anything on its own, false positives are now harmless — so detection can be made aggressive and broad with zero distraction risk. This is the opposite of the old trade-off where broad detection was dangerous.
3. **The menu is always visually identical and every option is always pressable.** No greying out, no reordering. Reps would misread a greyed option as "unavailable," and a changing menu breaks the eyes-closed muscle memory we want. All contextual intelligence lives in the *backend* (which card gets pre-generated, what context feeds it), never in the menu's appearance. The **candidate fixed slots** (each maps to a number key for blind selection, final set TBD in build):
   - **Handle objection** — uses the scout's tagged recent pushback as context.
   - **Answer their question** — surfaces the prospect's actual recent question text so the rep confirms *which* one before generating (this is the one place question text is shown — it does not require changing the other slots).
   - **Dig deeper** — hands the rep a question to deepen discovery (Sebastian specifically liked this one).
   - **What am I missing?** — checks the Playbook for uncovered framework items (timeline, budget, decision-maker, etc.).
   - **Search** — free-text fallback into the rep's KB for anything the fixed slots don't cover.
4. **The visible Stage Bar is removed during live calls; replaced by an ambient presence indicator** (a single dim/breathing dot — nothing to read). Peripheral motion/text mid-call is the same distraction problem as autonomous pop-ups, just quieter.
5. **Live, paid stage tracking (the Sonnet poll) is killed.** The recent transcript already reveals the stage to the generation model implicitly, so paying to label it live is paying for information the model already has. Full stage analysis moves to the post-call debrief (computed once, cheap), where reading is the point. A rough, free stage sense (elapsed time + keyword milestones) can feed the menu if needed — no AI cost.
6. **Generation structure: build the cheapest version first (Option A).** Menu opens free → rep picks → only then generate that one card (~0.5–1s). Measure real latency on live calls. Only escalate to speculative pre-generation of the top option (Option B) if the post-press wait actually feels bad. Never pay tokens to pre-solve a slowness problem we haven't confirmed.
**The cost split (why this is cheap):**
- **Continuous layer = $0.** Buffering the last ~60s of transcript in memory + keyword/pattern matching. No AI, no embeddings, no API calls.
- **On-keypress layer = the only spend.** Embed the recent chunk (fractions of a cent) → vector search → Haiku generation (cheap). A clean call where the rep never reaches for help costs **zero** in live AI.
**Guiding principle (load-bearing for the whole product):** Wingman's intelligence is *distilled context delivered at the right instant* — not maximum context delivered constantly. Context quality beats context quantity; piling on redundant context costs tokens, adds latency, and can degrade output. The card is built from layered context — recent buffer (the moment) + session state (this call, mostly assembled for free from the scout) + Sales DNA (all past calls, loaded once at call start) + KB retrieval — never from re-sending the raw full transcript.
**Session state (where the scout's findings live):** in-memory on the active session for speed, ideally mirrored to a small Supabase session row (tags only — never raw transcript bloat) so a dropped/reconnected call doesn't lose context. It feeds the menu and live cards during the call, is handed to the post-call job, then **deleted** — same rule as raw transcripts (Architectural Invariant 6). Nothing scout-related persists long-term.
**Files this will likely touch when built (for the future plan — not a commitment):** `electron/recall.ts` (register/unregister the global hotkey on call start/stop), `electron/main.ts` (IPC for hotkey press → menu, presence dot, remove stage bar), `electron/hud/index.html` (the fixed menu UI + ambient dot, remove stage bar), `src/hooks/useWingmanPoller.ts` (stop autonomous firing; drive the scout/tagging instead), `src/lib/wingman/keyword-triggers.ts` (demote to tagger), `src/app/api/wingman/kb-signal/route.ts` (generate-on-keypress for the picked slot), `src/app/api/wingman/session/route.ts` (session state). Removing live Sonnet stage polling touches `src/app/api/wingman/poll/route.ts`.
**Open questions to resolve in the build plan (not yet decided):** final menu slot set + their number-key mapping; exact buffer window (~60s is a starting guess); whether a free heuristic stage sense is worth keeping for menu context or dropped entirely; whether session state needs the Supabase mirror or in-memory is enough for v1.
**Supersedes / forces re-evaluation of:** autonomous keyword cards (2026-04-07), the 90-second cooldown (no longer needed — cards are rep-summoned), the visible stage bar, live Sonnet stage polling, and the JEPA "predictive RAG / next-state predictor" item (the rep's keypress replaces the prediction problem). Pusher push delivery is still useful for getting the generated card to the HUD.
**Status:** Decided. Not yet built. This is the new #1 architectural direction for the live-call experience. When picked up: run the Plan Review Loop and present a build plan before touching the live pipeline.

---

### 2026-05-31 — "Offer Brain" renamed to "Sales DNA"
**Decision:** The per-user intelligence layer is renamed from **Offer Brain** to **Sales DNA**. More neutral, more personal, communicates "this is *you*, learned" rather than a feature name.
**Scope of rename:** User-facing copy first (dashboard, onboarding, paywall, marketing). Internal code identifiers (`rep-profile.ts`, DB columns, JSON keys) can follow in a dedicated rename task — not urgent, and a code-wide rename touches many files, so it gets its own approved session. CLAUDE.md, the Wingman skill, and brain docs still say "Offer Brain" and need updating.
**Status:** Decided. User-facing rename pending; code rename is a separate follow-up task.

---

### 2026-05-31 — Pricing: 10 free calls → $149/mo, unlimited (no cap)
> ⚠️ **REVISED 2026-06-05 → TIERED.** "Flat $149 unlimited, no cap" (below) is superseded. At real usage (3–4 calls/day ≈ 80 calls/mo) flat-unlimited bleeds margin (~45–62%), so we added a **Pro $299** tier (unlimited + calendar / prospect memory / briefings / deal coach) and a **soft cap** on Core (~75 calls + overage — *never* a hard block). Spirit preserved — it's literally the "higher tier for heavy users / if they want more they can buy more" line below. Full model: `06 - Finance/Tier Pricing Proposal + Unit Economics.md`. (Pending final sign-off on the exact cap + Pro price.)

**Decision:** Monetization = **10 free calls**, then **$149/month** to continue, **unlimited calls, no cap.**
**Framing of the free period (important — don't overbuild this):** The 10 free calls are a *taste / added benefit*, not a gate that has to deliver an "insane" Sales DNA before we're allowed to charge. Sebastian's words: "having that Sales DNA isn't the only thing… it's just an added benefit, so still [10] calls." So Sales DNA richness is *one* reason a rep stays, alongside the live in-call help and the Flight Log/debrief value — not the sole conversion lever. Do not gate the paywall on Sales DNA hitting some quality bar; 10 calls is a clean, simple number and that's the rule.
**On counting calls:** Counting only *substantive* calls (excluding no-shows / instant DQs) is a sensible fairness + don't-burn-their-trial touch, but it's a nice-to-have now, not load-bearing — the free period is a taste, not a make-or-break "wow" gate. Decide during build; simplest acceptable version is fine.
**No cap — and why (this reverses the earlier cap idea):**
- A usage cap is a worse user experience than just paying. Sebastian: "having a cap would suck as a user. it's easier to just pay and not have to worry about hitting a cap… I don't want to cap people, if they want more they can buy more." So: flat $149/mo, unlimited usage, no fair-use ceiling.
- **The margin lever is price, not caps.** If a cohort of extreme-usage power users ever threatens margin, the response is to raise the price (or introduce a higher tier for heavy users — "if they want more they can buy more"), never to cap usage on the base plan.
- **What makes unlimited affordable:** the hotkey pivot (above) deletes the live AI cost, leaving Recall.ai transcription (~$0.50/hr) as the dominant cost. Worst-case heavy user (~130 calls × 45 min ≈ 97 hrs ≈ $49 cost) still nets ~67% margin at $149; typical user ~85%. This architecture change is *why* unlimited is safe — and it aligns with the 2026-04-25 finding that 100+-calls/month closers churn on any cap.
**Conversion lever:** make the switching cost visible at the paywall — show the rep what Sales DNA has learned ("mapped your top 3 objections, your pitch pattern, your close timing across N calls") at the exact moment of the ask. (Reinforces the value; not the sole reason to convert.)
**Kills:** the old "free to fly, pay when you win" model (free calls until first close) — confirmed dead, wasteful. Tagline still appears in the Wingman skill and CLAUDE.md and needs removing.
**Supersedes:** the 2026-04-02 "$149/mo" entry (this re-confirms $149 but adds the 10-free-call structure and explicit no-cap) and the 2026-04-25 "$179–$199, unlimited" direction (price reverts to $149; unlimited is kept).
**Status:** Free-call count locked at 10. Price $149/mo locked directionally — confirm before launch. "Substantive call" definition is a build-time detail, not blocking.

### 2026-04-15 — Table renamed: kb_entries → kb_signal_card_entries
**Decision:** Rename the `kb_entries` table to `kb_signal_card_entries` across DB, code, and all references.
**Reasoning:** The original name was ambiguous once the coaching table (`kb_coaching_entries`) was introduced. `kb_signal_card_entries` makes the table's purpose immediately clear — it powers live signal cards, not the chatbot.
**Impact:** SQL migration 007 ran the rename. 4 code files updated. RPC renamed from `search_kb_entries` → `search_kb_signal_card_entries`.
**Status:** Complete.

---

### 2026-04-15 — Dual KB architecture: separate tables for signal cards and coaching chatbot
**Decision:** Split the knowledge base into two separate Supabase tables: `kb_entries` (signal cards, existing) and `kb_coaching_entries` (coaching chatbot, new). One ingestion URL populates both automatically.
**Reasoning:** Signal card entries require surgical precision — 30+ first-person prospect triggers, verbatim script, universal applicability across all offers. Coaching chatbot entries can be broader — mindset, habits, frameworks, general sales advice. The same schema and quality bar can't serve both without compromising one. Two focused tables > one muddled table.
**Rule:** Everything ingested goes into `kb_coaching_entries`. Only entries that pass the strict signal card quality gate ALSO go into `kb_entries`. Signal is a strict subset of coaching.
**Trade-off accepted:** Two ingestion pipelines to maintain. More infrastructure. Worth it for quality.
**Alternatives rejected:** One table with a `use_case` column — rejected because the schemas are genuinely different and the quality bars are incompatible.
**Status:** Active — not yet built. SQL migration is next session priority #1.

---

### 2026-04-15 — Gap-detection signal cards are Playbook cards, not KB cards
**Decision:** "You haven't touched on timeline/budget/decision maker" type signal cards are powered by the Playbook system (pre-call checklist), not by the KB pipeline.
**Reasoning:** KB fires when a prospect says something specific that matches a technique. Gap detection fires when the AI notices a rep hasn't covered a required framework item. These are fundamentally different trigger types requiring different infrastructure.
**Status:** Active — Playbook page not yet built.

---

### 2026-04-02 — Recall.ai Desktop SDK for live audio capture
**Decision:** Use Recall.ai Desktop SDK (not a bot joining the call) to capture audio invisibly.
**Reasoning:** Recall.ai Desktop SDK captures audio at the OS level without joining the call as a participant. This is the "invisible copilot" architecture — the prospect never sees a bot in the meeting. Alternatives considered: LiveKit (would require a visible bot or complex OS audio integration) and building custom macOS audio capture (months of engineering with reliability risk). Recall.ai is proven, works with Zoom/Teams/Google Meet on Apple Silicon Macs.
**Trade-off accepted:** Apple Silicon Mac only. Intel Macs not supported.
**Status:** Active

---

### 2026-04-02 — RAG over static system prompt
**Decision:** Use runtime RAG (vector search against Sales KB) instead of stuffing the full KB into the system prompt at call start.
**Reasoning:** 419 KB entries × ~200 tokens = ~84,000 tokens. At Claude Haiku pricing, that's $0.084 per call in static context alone, before the signal card itself. More importantly, 84k tokens of context the model has to scan degrades output quality. RAG retrieves only the 3 most relevant techniques for the specific trigger moment (~450 tokens). Precision and cost win over convenience.
**Status:** Active

---

### 2026-04-02 — pgvector over Pinecone
**Decision:** Use pgvector extension in Supabase for vector search, not a dedicated vector database like Pinecone.
**Reasoning:** We're already in Supabase for all user data. Adding Pinecone adds a second database dependency, second set of credentials, second bill, and more complexity. At 419 KB entries, pgvector is fast and simple. Pinecone becomes worth the complexity at 100k+ entries or when query latency becomes a proven bottleneck. Don't add infrastructure until the current stack is the bottleneck.
**Status:** Active. Revisit at scale.

---

### 2026-04-02 — Electron for desktop app
**Decision:** Build the Mac desktop app in Electron (TypeScript), not native Swift/SwiftUI.
**Reasoning:** The Wingman dashboard and API are built in Next.js. Using Electron means the dashboard UI runs in a web view inside the desktop app — the same code serves both the web dashboard and the desktop app. A native Swift app would require maintaining two completely separate UIs. Electron's performance overhead is acceptable for this use case (a floating overlay, not a graphics-intensive game). The builder (Sebastian, non-technical) needs Claude Code to maintain this codebase — TypeScript is far more maintainable with AI assistance than Swift.
**Status:** Active

---

### 2026-04-02 — Supabase for database
**Decision:** Use Supabase (PostgreSQL) as the primary database for all persistent data — users, calls, Offer Brain, KB entries, embeddings.
**Reasoning:** Supabase provides PostgreSQL + Row Level Security + auth + realtime subscriptions + pgvector extension — all in one managed platform. The alternative (self-hosted PostgreSQL on Railway) adds operational overhead with no feature advantage. The pgvector extension is the critical capability for KB vector search.
**Status:** Active

---

### 2026-04-02 — Railway for backend hosting
**Decision:** Host the Next.js app and all API routes on Railway.
**Reasoning:** Railway supports Next.js natively, auto-deploys on git push, and has simple pricing. Alternatives: Vercel (would work but hobby plan has serverless function timeout limitations for long-running post-call jobs), AWS (massive operational overhead for a pre-revenue startup). Railway's $5/month hobby plan covers early beta. Upgrade to Pro at scale.
**Status:** Active

---

### 2026-04-02 — $149/month pricing
**Decision:** Set the subscription price at $149/month (directional — may be adjusted pre-launch).
**Reasoning:** The target user closes deals worth $3,000–$15,000. One additional close per month generates 20-100x the subscription cost. At this ROI, price is not the objection. Charging less ($49–$99) doesn't reduce the trust barrier — it signals lower quality. At $149, gross margin after Recall.ai transcription costs stays at ~70%+ for typical user volume.
**Status:** Under review — not finalized. Confirm before launch.

---

### 2026-04-02 — Cole Gordon / Closers.io as beachhead market
**Decision:** Target Cole Gordon's network (Closers.io alumni, high-ticket phone closers in info products) as the first user base.
**Reasoning:** This community is (1) organized and reachable, (2) already sold on investing in tools that improve close rate, (3) ROI-driven enough to pay for something that works, (4) vocal enough to spread by word of mouth if it does work. The community speaks the same language as the Wingman methodology (NEPQ, Gordon Gap, etc.), which means onboarding friction is lower.
**Status:** Active

---

### 2026-04-02 — Delete raw transcripts after post-call processing
> ⚠️ **SUPERSEDED 2026-04-23 → transcripts are RETAINED, user-deletable.** The deletion below was implemented, broke "Ask Wingman" + the Flight Log transcript view, and was reverted (Known Issue #30). Current rule: keep transcripts (text only), user-deletable per-call / account-wide (compliance #33). Audio/video still never stored. Do NOT re-introduce auto-deletion.

**Decision:** Raw transcripts are stored temporarily in Supabase during a call, used by the post-call job, then deleted immediately after the job completes.
**Reasoning:** Legal exposure (storing call transcripts without prospect consent), privacy commitment to users, and infrastructure cost. The insights extracted (grade, debrief, objections, Offer Brain delta) are stored permanently. The raw text is not needed after extraction. This is a hard rule — see Architectural Invariants in CLAUDE.md.
**Status:** Active. Non-negotiable.

---

### 2026-04-02 — Claude Haiku for live signal cards, Claude Sonnet for post-call
**Decision:** Use Claude Haiku for real-time signal card generation (target <800ms) and Claude Sonnet for post-call analysis (async, quality over speed).
**Reasoning:** Haiku's token throughput and latency profile makes it the only Anthropic model that can meet the <1 second end-to-end target reliably. Sonnet is 3-5x slower but produces significantly higher quality analysis for complex tasks (grading a full call transcript, extracting nuanced patterns). Since post-call runs async, latency is irrelevant — quality wins.
**Status:** Active

---

### 2026-04-03 — Recall AI transcript provider key: deepgram_streaming
**Decision:** Use `deepgram_streaming` (not `deepgram`) as the transcript provider key when creating Recall AI recording sessions.
**Reasoning:** Recall AI changed their API format. The old key `deepgram` is no longer valid — the API now requires provider-specific suffixed keys (`deepgram_streaming`, `assembly_ai_streaming`, etc.). This was discovered when every call start returned a 400 error with "Must provide exactly one of: deepgram_streaming, ...". The fix is one word in `recall-upload-token/route.ts`.
**Status:** Active.

---

### 2026-04-03 — Zoom name status synced via IPC tristate (null/true/false)
**Decision:** Sync Zoom display name status from the web app to the Electron main process using a tristate (`null` = unknown, `true` = set, `false` = not set). Only block deploy on explicit `false`.
**Reasoning:** The main process needs to know whether the Zoom name is set so it can show warnings in the tray and HUD before the deploy reaches the dashboard. Using a binary (true/false) defaulting to false would cause false "setup required" warnings if the user opens the tray before the web app has finished loading and reported its status. Null = unknown = pass through to dashboard's existing check. This prevents false positives.
**Status:** Active.

---

### 2026-04-02 — Affiliate model (Rewardful + Stripe) for distribution
**Decision:** Use a creator affiliate model (~20% recurring revenue share) to drive user acquisition, inspired by Cal AI's growth playbook.
**Reasoning:** The target user trusts creators and coaches in the closer space more than ads or cold outreach. A recurring 20% commission creates ongoing incentive to promote (vs one-time bounties). Rewardful + Stripe handles the tracking and payouts cleanly without custom infrastructure.
**Status:** Planned. Not yet active.

---

### 2026-04-07 — Keyword signals bypass the 90-second cooldown
**Decision:** Keyword-triggered objection cards always fire immediately, interrupting any current card and ignoring the 90-second cooldown. Poll-based nudges still respect the cooldown.
**Reasoning:** A prospect raising a live objection is always time-sensitive. Suppressing it because a card fired 60 seconds ago means a buying signal gets no response. Poll-based cards are lower urgency (the rep may already be handling it) — those still respect the cooldown.
**Status:** Active.

---

### 2026-04-07 — Transcript dedup changed to last-text-per-speaker
**Decision:** Dedup transcript chunks by comparing each speaker's new text against their last emitted text. Only emit when the text changes. Replaced the previous 500ms time-window approach.
**Reasoning:** Recall.ai was firing the same utterance 7–9x per speaker turn. The time-window approach was fragile (dependent on timing, not content). Last-text-per-speaker is deterministic — a duplicate is only emitted if the speaker actually said something new. Simpler, more reliable, and immune to timing issues.
**Status:** Active.

---

### 2026-04-09 — Obsidian brain tracked in GitHub repo
**Decision:** Removed `Wingman Brain/` from `.gitignore`. The Obsidian vault is now committed and pushed to the GitHub repo.
**Reasoning:** Sebastian needs to sync the brain across devices (Mac + phone via Poke AI assistant). GitHub is already the sync mechanism for the codebase. Co-locating the brain in the same repo means one push syncs everything. The brain contains no secrets — only product strategy, build logs, and decisions.
**Status:** Active.

---

### 2026-04-09 — /wrap skill for session end automation
**Decision:** Created a Claude Code skill (`wingman-wrap`) that runs at the end of every session. Triggered by "wrap it up" or "/wrap". Writes the daily Obsidian build log, updates Known Issues and Current Sprint, updates any other relevant brain files, commits, and asks for push approval before pushing.
**Reasoning:** Build logs were being skipped at session end (happened on 2026-04-07 — log was blank). A skill is more reliable than a plain text instruction in CLAUDE.md because it's an explicit, named workflow that Claude must invoke rather than a rule it can forget to follow.
**Skill location:** `~/.claude/plugins/marketplaces/claude-plugins-official/plugins/wingman-wrap/skills/wrap/SKILL.md`
**Status:** Active.
