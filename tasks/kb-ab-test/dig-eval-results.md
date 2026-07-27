# Dig Deeper Card Eval — 4a.1 single-shot

Generated 2026-07-24 13:23 · 15 fixtures × 1 · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6`
> AI judge is triage. **Sebastian is the final tonality judge** — read the questions.

## ✅ GATE PASS

- no false-silence (gave a question when one was needed) ✅
- no wrong-dig (took the close when ready) ✅
- zero fabrication ✅
- zero order-violations ✅
- tonality ≥4.5 ✅ (4.62)
- right-belief ≥80% ✅ (100%)

## Per-fixture

### #1 — gap-scan: pick Desire (⬜) over Money (⬜) — order-aware  _(expect: question)_
- ✅ (17/15) belief=`Desire` (want Desire): **"What does consistent look like for you — like if you fixed this, what's the goal?"**
  <sub>tone 4 · brev 2 · 1-q 1 · is-q 2 · belief 2 · no-windup 2 — Nails the weakest link (Desire/⬜) in plain conversational language, though the 'like if you fixed this' clause adds slight padding that a top closer would trim.</sub>

### #2 — at-risk: Trust ⚠️ (got burned) — dig the burn  _(expect: question)_
- ✅ (20/15) belief=`Trust` (want Trust): **"What did he promise you he'd actually do?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfectly aimed at the ⚠️ Trust wound — pulls out exactly what was promised vs. delivered, in plain casual language, with zero wind-up.</sub>

### #3 — open belief, minimal facts — opening question, ZERO fabrication  _(expect: question)_
- ✅ (18/15) belief=`Pain` (want Pain): **"What's the biggest thing that's keeping it from where you want it to be?"**
  <sub>tone 4 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Crisp, natural question aimed squarely at sharpening the vague Pain anchor using the prospect's own words — exactly right.</sub>

### #4 — partial Pain (softened) — chunk DOWN, go to the worst part  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"what's the worst part of managing it right now?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Clean, warm, direct shot at Pain — mirrors 'managing' back and invites him to own the real cost without fabricating anything.</sub>

### #5 — ALL LOCKED — take the close, do not dig  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #6 — prospect closing themselves — take the close even if 1 belief soft  _(expect: takeClose)_
- ✅ **TOOK THE CLOSE** (belief:null, line:null)

### #7 — only Money open — the money qualifier, pre-framed  _(expect: question)_
- ✅ (20/15) belief=`Money` (want Money): **"Can I ask you something personal? What would you need to be making to where investing in something like this is a complete no-brainer?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook Money probe — warm permission-ask leads into a clean ROI-anchored question that hits the only open belief at exactly the right moment.</sub>

### #8 — early call / NO summary — generic opener, no fabrication  _(expect: question)_
- ✅ (18/15) belief=`Pain`: **"What's the biggest challenge in the agency right now?"**
  <sub>tone 4 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook opening pain-probe — clean, natural, perfectly timed after prospect intro, no fabrication, no order issue.</sub>

### #9 — order-awareness: Pain wide open, early — must NOT jump to Money/Support  _(expect: question)_
- ✅ (18/15) belief=`Pain` (want Pain): **"What's the biggest thing holding you back from doing more?"**
  <sub>tone 4 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Clean, natural question that goes straight at the open Pain belief using the prospect's own language ('doing more') — textbook weakest-link digging.</sub>

### #10 — partial Desire (no number) — dig for the number + why  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"What's 'more' look like — like is there a number you're actually shooting for?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Pulls the prospect's own word 'more' back at them and drives straight at the missing number in Desire — textbook weakest-link targeting in a natural, conversational voice.</sub>

### #11 — Cost of inaction open — quantify the cost of staying stuck  _(expect: question)_
- ✅ (18/15) belief=`Cost` (want Cost): **"What has staying stuck at that same number actually cost you over the past year and a half?"**
  <sub>tone 4 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Locks directly onto the weakest belief (Cost/inaction), uses their own anchor ('year and a half'), clean and conversational — loses one tonality point for being slightly clinical but overall strong.</sub>

### #12 — OFFER-AWARE root-driver chunk-down: 'quit my job' → the cash-flow number  _(expect: question)_
- ✅ (20/15) belief=`Desire` (want Desire): **"What does quitting look like — like what's the number you'd need to actually pull the trigger?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfectly aimed at the weakest link — chunks 'quit my job' down to a real cash-flow number in natural, conversational closer language with zero wind-up.</sub>

### #13 — FABRICATION TRAP: DNA is full of numbers the prospect never said  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"What's the worst part of that — like what's actually slipping because you're stuck on calls?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Perfectly targets the weak Pain belief by surfacing what's slipping — uses the prospect's own frame, warm and conversational, no wind-up, no fabricated specifics.</sub>

### #14 — OFFER-AWARE regression guard: order discipline holds with DNA present  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"what's a dead month actually look like for you?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook pain-deepening question — uses their exact words ('dead month'), no wind-up, forces the prospect to paint the emotional reality of the problem they only lightly acknowledged.</sub>

### #15 — #52 REGRESSION: all-open ladder + small-talk transcript — must DIG, never take-close  _(expect: question)_
- ✅ (20/15) belief=`Pain` (want Pain): **"What's going on that made you want to jump on a call today?"**
  <sub>tone 5 · brev 2 · 1-q 2 · is-q 2 · belief 2 · no-windup 2 — Textbook opener — warm, natural, direct, opens Pain cleanly at the right moment with zero fabrication or ordering risk.</sub>
