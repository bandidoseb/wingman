# Objection Flow — Doctrine + the Cole Gordon / Jeremy Miner Lens

**Status:** DOCTRINE captured 2026-07-19 (reconciled against the built pipeline). The multi-turn objection flow (Phase B/C) IS built and wired: rep presses ↑ → move 1 → prospect replies → rep presses ↑ → move 2 that knows the prior moves + reads the latest reply + won't repeat → … → the close. This doc is the *why* + the master-closer evaluation + the open design questions. (Supersedes the stale 2026-04 `Future Features/Objection Sequences (Option A).md`, which described a KB-sequence concept that predates the real build.)

---

## The closer's LOOP (not a linear pipeline)

Sebastian's mental model — **tee-up → the cards after → the swing → work toward the close** — is correct, but a master closer would sharpen it from a straight line into a **loop**:

**Disarm → Isolate the real objection → Reopen the gap → Tie down → Close — looping back to re-diagnose whenever a new belief surfaces.**

- **Disarm** — take the edge off in the rep's own words (not a canned permission-ask). Same side of the table.
- **Isolate** — the single highest-leverage move. *"Besides that, is there anything else holding you back?"* Kills stacked/smokescreen objections and finds the REAL one. Must fire early.
- **Reopen the gap** — pull them back into the pain / the cost of inaction / the desired outcome, in THEIR words. This is where the anchors live.
- **Tie down** — get them to say the belief out loud themselves (consistency principle).
- **Close** — only once the belief is genuinely built. The ask (`direct-close`) or the terms (`financial-trade`).
- **Loop** — if a new belief/objection surfaces mid-flow, drop back to isolate/diagnose it from scratch rather than plowing toward the close.

The built system already behaves like a loop: it switches "plays" (11-lever taxonomy), won't repeat its last play, forces re-diagnosis on a gap, and holds "handle before you close." So this is a reframe of the *mental model*, not a missing capability.

---

## How the built flow maps to it (code-grounded)
- **Beat-scaled close-lean:** each continuation beat tells the model "the deeper the beat, the more you lean toward the trade/close rather than another reframe." Not a probability knob — model judgment, steered by beat depth. Gated by "only once basically handled."
- **The "trade"** = the `financial-trade` lever: better terms (payment plan / split / flexibility) in exchange for a decision now. **More Cole Gordon than Jeremy Miner** — Cole teaches terms-structuring as a close tool; Miner leans away (a discount can lower perceived value) and prefers a pull-question. The prompt reaches for it only after the objection is handled — never as the thing that does the selling.
- **Re-diagnosis safety (`gap_flag`)** = **40s+ since the rep's last ↑ PRESS** (NOT transcript silence — corrected 2026-07-19). A long gap between presses ⇒ the exchange likely drifted ⇒ suppress the close-lean, re-diagnose. Costs **zero extra latency** (same single streaming call, one extra prompt paragraph).
- **The belief vs. fact seam:** the objection flow handles BELIEFS (↑). Factual/logistics answers are the ← "answer" slot (KB-backed). See open question #2.

---

## Through Cole Gordon's eyes
Would largely **approve** — isolate → tie-down → trade → direct-close is his playbook. Wants: **isolation reliably first** (*"is that the only thing, or is there something else?"*), and he's fine with the terms-trade + assumptive close as built.

## Through Jeremy Miner's (NEPQ) eyes
Two pushes:
1. **Questions over statements.** In NEPQ almost every move is a *question* that makes the prospect resolve their own objection — the rep never argues. A statement/reframe lets them stay passive; a question makes them talk themselves past it. → **Prompt biased toward question-shaped moves (2026-07-19 edit).**
2. **"An objection is a discovery gap."** A live objection means something was missed earlier — so the strongest move references what they said in discovery (*"earlier you told me ___"*). → This is exactly why **[[Prospect Anchor Capture]]** strengthens the swing. Biggest lever.

---

## Prioritized upgrades
1. **Prospect Anchor Capture** — lets every objection move reference discovery (Miner's #1). Biggest impact. (Own design doc.)
2. **Bias moves toward questions** — DONE 2026-07-19 (objection-prompt doctrine).
3. **Cleaner answer-slot handoff** for factual questions mid-flow — see open question #2.

---

## OPEN DESIGN QUESTIONS (raised by Sebastian 2026-07-19 — to resolve in build sessions)

### 1. Payment-terms / discount configurator in Sales DNA (LOCKED as the approach)
Wingman must NOT offer a `financial-trade` (payment plan / discount) to a rep who doesn't sell that way — and must know the ACTUAL terms when they do. So the offer's terms belong in **Sales DNA** as a configurator:
- "Do you offer payment plans / discounts / flexible terms? **Yes / No.**"
- If **yes** → let the rep list every plan/term (e.g. "2-pay, 3-pay, PIF-discount 10%").
- If **no** → Wingman knows never to float a payment-plan or discount trade (it would read as "that's not how I sell").
- Mechanism: a toggle/field in Sales DNA that **conditionally changes the objection prompt** — a lightweight configurator (DB field → prompt injection). When "no terms," the `financial-trade` lever is effectively suppressed / re-pointed to a value-reframe instead. Full spec belongs in `Sales DNA Capture — Design.md` (added to Section 1 — Your Offer / fast-follows).

### 2. Logistics questions + ONE continuous flow (brainstorm — don't over-engineer)
Most prospects won't raise many questions this late; when they do it's either objection-shaped (the flow handles it) or **logistics** ("how many calls/week? how often with my coach? what's the guarantee?").
- **Should common logistics Q&A be captured in Sales DNA** so Wingman can feed the answer? (Maybe a "Logistics / FAQ" section in the capture.) TBD — weigh value vs. capture burden.
- **Continuity problem:** if the rep answers a logistics question themselves mid-flow (20–40s), then presses ↑ for move 3 — the flow is still live (under the 120s idle cap), BUT >40s trips `gap_flag` → the flow re-diagnoses as if the topic drifted, even though the rep just answered a quick factual question and wants to continue the SAME objection. Result could feel choppy / lose thread.
- **Goal (Sebastian):** it should feel like ONE continuous flow when the rep needs it — not choppy, not losing context when they bounce between arrows. Possible directions: let the flow absorb a factual answer without treating it as drift; a cleaner ↑↔← handoff that preserves thread state; or a "still same objection" signal. **Flagged, not yet designed.**

### 3. Re-diagnosis latency — RESOLVED
No added latency (same single streaming call).

### 4. Unlocked belief = LATENT objection (Sebastian 2026-07-19 — the Cole thesis)
Cole's core philosophy: **every belief NOT locked in discovery becomes an objection at the close.** So ⬜ open / 🟡 partial are NOT neutral — they are objections that haven't detonated yet. Reframe the four states as TIMING, not safe-vs-risky:
- ⚠️ at-risk = the objection has **already fired** → reactive, HANDLE now (↑).
- ⬜ open / 🟡 partial = the objection is **latent/loaded, will fire at the close** → predictive, BUILD before pitch (↓).
**Keep the four states** (do NOT collapse unlocked → "at-risk"): the states drive WHICH play/card — ⬜ → dig to build; ⚠️ → handle the objection. Flattening them loses that. What DOES need to reflect Cole's urgency is the **close-readiness** layer: audit whether `close-readiness.mjs` weights ⬜/🟡 as hard as Cole would ("you have N unbuilt beliefs — do NOT pitch/drop price yet"). The ✅ bar (PROSPECT must affirm in own words; rep asserting ≠ locked) is pure NEPQ and correct — keep it.

### 5. Digging an untouched belief MID-objection-flow? Qualification vs persuasion (Sebastian 2026-07-19)
Question: if a belief (e.g. Support ⬜) was never touched before the pitch, should the objection flow go DIG/build it mid-flow, after price is on the table? Cole/Jeremy distinction:
- **Persuasion beliefs (Pain, Desire, Cost, Trust-nuance):** NO — do not stop mid-flow to run open discovery. After price is out, backing into "tell me more about your goals" reads as backpedaling and kills momentum. If it detonates as an objection, HANDLE it in the flow; don't DISCOVER it. It should've been built pre-pitch.
- **Qualification beliefs (Support = who decides, Money = can they afford):** YES — confirm these before the final ask, always, because closing into an unconfirmed decision-maker / unknown budget is a WASTED close. But NOT as a clumsy discovery dig — as a **close-integrated tie-down**: "so if this makes sense — is this a decision you can make today, or is there someone else you'd want in on it?" That's part of asking for the sale, not backing up.
- **Buildable doctrine:** when a QUALIFICATION belief is ⬜/🟡 at close, the objection flow should fold a quick confirmation into the close beat — never a separate mid-flow discovery detour, and never force-dig a persuasion belief. Upstream fix: close-readiness should warn the rep to confirm open beliefs BEFORE pitching (don't drop price with qualification beliefs open).
