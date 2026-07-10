# Dig Deeper Card Eval — 4a.1 single-shot

Generated 2026-07-09 15:38 · 11 fixtures × 1 · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6` + gpt-4o cross
> AI judge is triage. **Sebastian is the final tonality judge** — read the questions.

## ✅ GATE PASS

- no false-silence (gave a question when one was needed) ✅
- no wrong-dig (took the close when ready) ✅
- zero fabrication ✅
- zero order-violations ✅
- tonality ≥4.5 ✅ (5.00)
- right-belief ≥80% ✅ (100%)

## Per-fixture

### #1 — gap-scan: pick Desire (⬜) over Money (⬜) — order-aware  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"Okay so flip side of that — where do you actually want to be? Like what does good look like for you?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Hits Desire (⬜ weakest link) cleanly, sounds natural and conversational, no fabricated specifics, clean flip from their pain into vision.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question smoothly targets the weakest belief, Desire, with a warm lead-in and clear focus.</sub>

### #2 — at-risk: Trust ⚠️ (got burned) — dig the burn  _(expect: question)_
- ✅ (20/15) belief=`Trust` (want Trust): **"So after you paid, he basically disappeared — what would've had to happen differently for it to actually work?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors the prospect's own words back naturally, then opens exactly the right door — what would real coaching look like — hitting the ⚠️ Trust wound dead center with zero wind-up.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question directly addresses the weakest belief, Trust, by exploring the past coaching failure with excellent tonality and brevity.</sub>

### #3 — open belief, minimal facts — opening question, ZERO fabrication  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"When you say things could be better — what's the biggest thing that's not working right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors the prospect's exact words and drives straight at the vague Pain with a single clean question — textbook elite discovery.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Sharp, open question aimed squarely at the vague Pain point.</sub>

### #4 — partial Pain (softened) — chunk DOWN, go to the worst part  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"When you say 'managing' — what does that actually look like day to day?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Mirrors his exact word 'managing' and asks him to paint the reality — perfectly targets Pain (🟡) before touching any deeper belief.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question is direct, warm, and targets the weakest belief, Pain, without wind-up or fabrication.</sub>

### #5 — ALL LOCKED — take the close, do not dig  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #6 — prospect closing themselves — take the close even if 1 belief soft  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #7 — only Money open — the money qualifier, pre-framed  _(expect: question)_
- ✅ (20/15) belief=`Money` (want Money): **"Can I ask you something personal? What would you need to feel like this is a smart investment right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfect execution — warm permission-ask leads into a clean Money qualifier aimed squarely at the only open belief, sounds exactly like an elite closer.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Warm, aims at Money, but slightly padded with two questions, ties to investment.</sub>

### #8 — early call / NO summary — generic opener, no fabrication  _(expect: question)_
- ✅ (20/15) belief=`Pain`: **"Nice — so what's the biggest challenge in the business right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfect opener — warm, brief, one clean question aimed squarely at Pain with zero wind-up and no fabricated specifics.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question is warm, concise, a single clear question, asks a relevant question given the early stage of discovery, and follows naturally with no windup.</sub>

### #9 — order-awareness: Pain wide open, early — must NOT jump to Money/Support  _(expect: question)_
- ✅ (19/15) belief=`Pain` (want Pain): **"What does 'a lot more' look like — what's the biggest thing that's not where you want it right now?"**
  <sub>tone 5 · brev 2 · 1-q 1 · is-q 2 · belief 2 · no-windup 2 — Perfectly targets Pain (⬜) using the prospect's own words as a springboard, though it technically stacks two related questions — the second rescues the first cleanly enough that a top closer would still use it.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Engages the prospect to elaborate on their Pain with a direct question, maintaining curious and pleasant tonality.</sub>

### #10 — partial Desire (no number) — dig for the number + why  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"Okay, so when you say 'make more' — what's the actual number you're shooting for?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Locks onto their exact words, targets the missing number in Desire (the weakest link), and sounds like a natural closer — clean and effective.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — The question directly addresses the weakest belief, Desire, by asking for a specific target number, and does so with natural tonality and brevity.</sub>

### #11 — Cost of inaction open — quantify the cost of staying stuck  _(expect: question)_
- ✅ (20/15) belief=`Cost` (want Cost): **"What's it actually costing you — like, what's life looking like if it's still the same a year from now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Nails the weakest link (Cost/inaction) with natural, conversational language and a clean future-pace that opens the emotional cost door — textbook elite closer move.</sub>
  <sub>gpt-4o: tone 5 · belief 2 · fab false · order false — Excellent tonality and aims directly at the cost of inaction, the weakest belief.</sub>
