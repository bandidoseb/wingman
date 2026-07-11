# Dig Deeper Card Eval — 4a.1 single-shot

Generated 2026-07-11 14:23 · 14 fixtures × 1 · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6` + gpt-4o cross
> AI judge is triage. **Sebastian is the final tonality judge** — read the questions.

## ✅ GATE PASS

- no false-silence (gave a question when one was needed) ✅
- no wrong-dig (took the close when ready) ✅
- zero fabrication ✅
- zero order-violations ✅
- tonality ≥4.5 ✅ (4.83)
- right-belief ≥80% ✅ (100%)

## Per-fixture

### #1 — gap-scan: pick Desire (⬜) over Money (⬜) — order-aware  _(expect: question)_
- ✅ (19/15) belief=`Desire` (want Desire): **"Okay so flip it — what does consistent actually look like for you? Like where do you want revenue to be?"**
  <sub>tone 5 · brev 2 · 1-q 1 · is-q 2 · belief 2 · no-windup 2 — Nails Desire (⬜ weakest link) with natural closer energy, but stacks two questions ('what does consistent look like' + 'where do you want revenue to be') costing one point on one_question.</sub>
  <sub>gpt-4o: tone 5 · belief 1 · fab false · order false — Calm and curious tone with a warm lead-in. A bit lengthy with two related questions; explores Desire but doesn't directly pin the goal.</sub>

### #2 — at-risk: Trust ⚠️ (got burned) — dig the burn  _(expect: question)_
- ✅ (20/15) belief=`Trust` (want Trust): **"After you paid — like, what actually happened? What did you get, or not get?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Nails the ⚠️ Trust wound by inviting the prospect to relive exactly what went wrong, in a natural two-part phrasing that still reads as one conversational question — sounds like a real closer.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question targets the weakest belief, Trust, with genuine curiosity, but asks multiple questions.</sub>

### #3 — open belief, minimal facts — opening question, ZERO fabrication  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"When you say things could be better — what's the biggest thing that's not working right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors the prospect's exact words back and asks one clean, open-ended question aimed squarely at sharpening the vague Pain — textbook elite discovery.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Targets the soft Pain belief directly with a clear and warm question.</sub>

### #4 — partial Pain (softened) — chunk DOWN, go to the worst part  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"What's the worst part of 'tight' for you day to day?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors his exact word 'tight,' asks him to own the lived pain in concrete terms — perfect move to deepen the 🟡 Pain before anything else.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Warm, direct question targeting Pain, the weakest belief, and elicits a personal response.</sub>

### #5 — ALL LOCKED — take the close, do not dig  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #6 — prospect closing themselves — take the close even if 1 belief soft  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #7 — only Money open — the money qualifier, pre-framed  _(expect: question)_
- ✅ (20/15) belief=`Money` (want Money): **"Can I ask you something personal — financially, where are you at with making an investment like this?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook Money opener — warm permission-ask leads cleanly into the exact weakest belief with no fabrication and Pain fully locked.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — This is a warm, concise, single question targeting the open Money belief with a natural lead-in.</sub>

### #8 — early call / NO summary — generic opener, no fabrication  _(expect: question)_
- ✅ (20/15) belief=`Pain`: **"Nice — so what's the biggest challenge in the business right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook clean opener — warm, brief, one question aimed squarely at Pain with zero wind-up and no fabricated specifics.</sub>
  <sub>gpt-4o: tone 5 · belief 1 · fab false · order false — Warm and concise without fabrication, aims reasonably at Pain since no belief is explored yet.</sub>

### #9 — order-awareness: Pain wide open, early — must NOT jump to Money/Support  _(expect: question)_
- ✅ (18/15) belief=`Pain` (want Pain): **"What's the biggest thing holding you back from doing more right now?"**
  <sub>tone 4 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Clean, warm, direct question aimed squarely at Pain (the weakest link), picks up naturally on the prospect's own words 'doing a lot more,' no fabrication or order issues.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Concise, focused on Pain, with a natural conversational flow.</sub>

### #10 — partial Desire (no number) — dig for the number + why  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"Okay so when you say 'make more' — what's the actual number you're shooting for?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Warm, clean mirror of the prospect's own words that lands exactly on the weakest link — pinning the missing number in Desire.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Targets Desire by asking for a specific goal number without any extra windup.</sub>

### #11 — Cost of inaction open — quantify the cost of staying stuck  _(expect: question)_
- ✅ (17/15) belief=`Cost` (want Cost): **"What does another 18 months at the same level actually cost you — like, what doesn't happen if this stays the same?"**
  <sub>tone 4 · brev 2 · 1-q 1 · is-q 2 · belief 2 · no-windup 2 — Hits Cost (⬜) squarely and uses their own timeframe naturally, but the clarifying tag '— like, what doesn't happen if this stays the same?' pads it into mild double-question territory.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Well-aimed, warm question on the cost of inaction with no fabrication or windup.</sub>

### #12 — OFFER-AWARE root-driver chunk-down: 'quit my job' → the cash-flow number  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"Okay — so what's the number you'd need coming in every month to actually pull the trigger on that?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfectly chunks 'quit my job' down to a concrete monthly number — exactly the weakest link — with natural closer tonality and zero wind-up.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Targets the weak 'Desire' by asking for a specific number related to quitting the job, grounded in offer context.</sub>

### #13 — FABRICATION TRAP: DNA is full of numbers the prospect never said  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"And what's that doing to the business — like what's actually falling through the cracks because you're stuck on calls?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfectly targets the weakest link — costing Pain — with natural closer tonality, no wind-up, and no fabricated specifics.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — A warm, clear question targeting the cost of Pain without fabricating details.</sub>

### #14 — OFFER-AWARE regression guard: order discipline holds with DNA present  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"When you say some months are dead — what does that actually look like for you?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors their exact words to deepen Pain ownership — clean, warm, perfectly aimed at the weakest link with zero fabrication or violations.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question is warm, concise, directly targets Pain, and avoids any unsupported specifics.</sub>
