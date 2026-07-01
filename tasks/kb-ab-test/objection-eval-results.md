# Objection Card Eval — production prompt + abstain gate

Generated 2026-06-30 19:59 · 30 real + 7 no-objection · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6`

**PROD arm** = the real production prompt (single source of truth), objection inferred from the transcript (Groq removed), 150-token cap.
> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.
> `fabrication`/`shaky #` are trust-killers (composite 0). `expectAbstain` scenarios MUST return `{ line: null }`.

## ✅/❌ GATE

- **PROD: ✅ PASS** — no false silence on real objections ✅ · abstains on no-objection ✅ (7/7) · zero fabrications ✅ · tonality ≥4.7 ✅ (4.93)

## Scoreboard — handled real objections (averages)

| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks | False-silence |
|---|---|---|---|---|---|---|---|---|---|---|
| **PROD** production (objection inferred, Groq removed) | 19.57 | 4.93 | 2.00 | 1.90 | 1.87 | 1.93 | 2.00 | 0 | 0 | 0 |

## 🚨 Critical incidents (fabrication / shaky-number / false-silence)

_None — no fabrication, no shaky number, no false silence._

## Abstain check — no-objection scenarios (must return `{ line: null }`)

### #31 — "(none — clear yes, ready to buy)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #32 — "(none — plain logistics question)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #33 — "(none — early rapport)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #34 — "(none — concern already resolved, moving forward)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #35 — "(none — answering a discovery question)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #36 — "(none — excited buying signal)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

### #37 — "(none — strong agreement on a tie-down)"  _(no-objection)_
- **PROD**: ✅ ABSTAINED

## Per-scenario — real objections (cards)

### #1 — "I need to think about it"  _(stall)_

- **PROD** (19/20): Yeah, totally — and I wanna make sure 'think about it' isn't just me not answering something. What's the part that still feels uncertain?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, human opener that correctly diagnoses the fear-of-change stall and opens the real conversation, but stays generic rather than pulling in Jenna's specific contractor history or $20k goal to sharpen the dig.</sub>

### #2 — "It's too expensive"  _(price)_

- **PROD** (20/20): Yeah, I hear you — and I'm not gonna argue that. But honestly, Andre, what's two more years of 70-hour weeks actually costing you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief (expense vs. cost of staying stuck), uses Andre's confirmed pain point verbatim, sounds like a real closer, and lands in one clean reframe.</sub>

### #3 — "I don't have the money"  _(affordability)_

- **PROD** (14/20): Yeah, I hear you — and I believe you. So let me ask: is money the only thing standing between you and moving forward, or is there any part of you that's still unsure this works?
  <sub>tone 4 · brev 2 · 1-beat 0 · anchor 1 · belief 1 · no-windup 2 — Stacks two moves (is it really money? + is it doubt?) when the ground truth says the constraint is real and not a smokescreen, so the second question subtly implies she might be hiding doubt — that's a mismatch with the confirmed anchor and</sub>

### #4 — "I need to talk to my business partner"  _(authority)_

- **PROD** (20/20): Totally — and is that a courtesy thing, or does Dave actually need to weigh in before you can move?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook closer move — names Dave (real anchor), asks the one question that separates a real gate from a social deflection, and does it in under 20 words with zero wind-up.</sub>

### #5 — "I'm too busy"  _(time)_

- **PROD** (20/20): Tom, the reason you're slammed is exactly what we're fixing — so what if the calls are what buys you time back instead of costing it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Crisp reframe that flips 'too busy' into proof of need, grounded in Tom's exact pain, delivered in a single punchy move with natural closer tonality.</sub>

### #6 — "What if it doesn't work for me?"  _(risk)_

- **PROD** (20/20): Dana, you already get your clients results — that's not in question. Real thing is, can you do it for yourself?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — identity/self-doubt vs. capability — using her confirmed offline proof point, delivered in a crisp, human, closer-style reframe with no wind-up.</sub>

### #7 — "What makes you different?"  _(differentiation)_

- **PROD** (20/20): Yeah, fair — and I'm not gonna pitch you on that. You told me the last two were all theory, no implementation. So what would've actually had to happen in those programs for them to work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook move — quotes his exact words back, flips the frame with one question, zero wind-up, and forces him to define the difference himself rather than being pitched at.</sub>

### #8 — "Send me some information"  _(deflection)_

- **PROD** (20/20): Yeah, totally — and I'll send whatever's helpful. I just wanna make sure I'm not wasting your time with the wrong stuff. Be honest with me — when the price came up, what was actually going through your head?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails it — paces the 'send info' request to lower resistance, then directly surfaces the price-reveal cooling with a single honest question, perfectly matched to Rachel's conflict-avoidant pattern.</sub>

### #9 — "I can do this myself"  _(diy)_

- **PROD** (20/20): Kev, I hear you — and you probably could. But you've started two plans on your own and didn't finish them. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook closer move — validates pride, then weaponizes his own confirmed history (two abandoned plans) with a single surgical question that exposes the accountability gap without lecturing.</sub>

### #10 — "I've been burned before"  _(trust)_

- **PROD** (20/20): Yeah — that $20k and getting ghosted, that's real. What did that program not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact anchor (her $20k ghosting experience, confirmed), opens with a natural human pace, asks one clean diagnostic question — textbook elite closer move with zero fabrication.</sub>

### #11 — "This sounds too good to be true"  _(skepticism)_

- **PROD** (20/20): Yeah, fair — I'd think the same thing. Sam, forget the numbers for a sec — do you honestly feel like what we've been talking about could actually get you to where you wanna be?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — paces the skeptic, sidesteps the shaky number, and flips ownership of belief back to Sam with a single question anchored to his real gap.</sub>

### #12 — "The timing isn't right"  _(timing)_

- **PROD** (20/20): Bianca, I hear you — but the reason the timing feels off is the exact thing we're fixing. If not now, before Q4, when?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the weakest link — 'later' costs her the season — with a tight reframe and a closing question, all grounded in the Q4 timing anchor she confirmed.</sub>

### #13 — "I need to talk to my spouse"  _(authority)_

- **PROD** (20/20): Yeah, totally — and I'd expect that. Quick honest question though: is this more of a courtesy check-in, or do you genuinely need their green light before you can move?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact diagnostic question the ground truth flags — is this courtesy or a real gate — in natural closer language with zero fabrication.</sub>

### #14 — "I need to check with my accountant"  _(authority)_

- **PROD** (20/20): Derek, totally — and is that a courtesy call because you're already in, or does he actually have a vote on this?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook closer move — one sharp question that exposes the accountant as a logic gate without confronting Derek directly, perfectly matched to his real decision avoidance pattern.</sub>

### #15 — "I tried something like this before and it didn't work"  _(trust)_

- **PROD** (20/20): Alyssa, I hear you — and can I be honest for a sec? You said you didn't really implement it. So was it the program, or just no one holding you accountable?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact accountability gap from ground truth using Alyssa's own admission, delivered in a tight two-sentence reframe that sounds like a real closer.</sub>

### #16 — "Can you do a payment plan or a discount?"  _(price)_

- **PROD** (19/20): Yeah, totally — let's make it work. If we can get the numbers right, you're in today?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean commitment-lock that fits the 'basically sold' framing perfectly — loses one anchored point for not tying to Tony's 'step back from the tools' why, but the move itself is exactly right.</sub>

### #17 — "I'm already working with a coach"  _(differentiation)_

- **PROD** (20/20): Yeah, totally — and you mentioned that coaching's kind of stalled. So honestly, is it actually getting you where you wanna go?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact anchor ('kind of stalled') and lands one clean question that lets Nina's own words do the work — textbook elite pace-plus-tie-down with zero bloat.</sub>

### #18 — "Let me finish my current launch first"  _(timing)_

- **PROD** (20/20): Greg, I hear you — but the reason you're maxed right now is exactly what we're fixing. What if this is what makes the next launch bigger, not one more thing on top of it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly mirrors the ground truth's weakest-link reframe almost verbatim, sounds like an elite closer, tight and human with a natural pace opener.</sub>

### #19 — "I need to see proof or a guarantee"  _(risk)_

- **PROD** (20/20): Carla, totally fair — can I be honest with you for a sec? The only real guarantee is you. What would *you* need to see from yourself to know you'd actually do the work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook risk-reframe — flips the certainty question back onto Carla's control exactly as the ground truth prescribes, sounds fully human, no fabricated specifics.</sub>

### #20 — "The economy is too uncertain right now"  _(timing)_

- **PROD** (20/20): Hassan, I get it — and can I be honest with you for a sec? The guys who pull back right now are the exact reason there's an opening for you.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (macro fear = logic) with the competitor pullback reframe anchored directly to the ground truth gap, in a tight, human permission-ask open.</sub>

### #21 — "I want to do more research and compare options"  _(stall)_

- **PROD** (20/20): Yeah, totally — and real question: how long have you been researching this particular problem?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook Socratic mirror — short, human, and the single question lands directly on her real anchor (a year of research with no movement), exposing the weak belief without stating it.</sub>

### #22 — "I've already spent a lot on this kind of thing"  _(money)_

- **PROD** (16/20): I hear you — and honestly, what did those programs not give you that you actually needed?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Solid human tone and clean one-move question, but it asks Omar to re-diagnose a gap he already revealed (accountability/implementation) rather than tying back to that known anchor and pressing the real distinction.</sub>

### #23 — "My niche is unique — a general program won't fit"  _(skepticism)_

- **PROD** (20/20): Sofia, totally — and can I be honest for a sec? The bottleneck isn't medical billing. It's you being in everything with no systems. That part's not niche-specific at all.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief (bottleneck is universal, not niche-specific), uses her name and real pain anchor, stays tight, and the 'can I be honest' opener is textbook elite-closer — nothing fabricated.</sub>

### #24 — "I don't want to be locked into a contract"  _(risk)_

- **PROD** (20/20): Trent, I get it — and can I be honest with you for a sec? The reason it's six months is the exact reason you're still stuck. Real change isn't a 30-day thing. You already know that.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — six months IS the point — ties to Trent's capped/stuck reality, sounds like a real closer, and the permission-ask opener is textbook elite; no fabrications.</sub>

### #25 — "I want to but I'm scared to invest right now"  _(affordability)_

- **PROD** (20/20): Yeah — that fear makes sense, and I'm not gonna slick-talk you past it. So be honest with me: is it that the money genuinely isn't there, or is it that you're scared and the money's the safer thing to say?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated to Maya's exact emotional profile — honest, direct, non-slick, and forces the real distinction between genuine money constraint and fear-masking, exactly what the ground truth calls for.</sub>

### #26 — "I need to run it by my team"  _(authority)_

- **PROD** (20/20): Victor, I hear you — and you run a 12-person agency, so the call's yours to make. Is this you genuinely wanting input, or is it a little bit of cover in case it doesn't work out?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real avoidance pattern with a direct, human either/or question anchored to the confirmed 12-person detail — elite closer move, zero fluff.</sub>

### #27 — "I'm just not sure I'm ready"  _(stall)_

- **PROD** (19/20): Renee, I hear you — and honestly? Nobody feels ready. The coaches who grow just start before they do. So what would 'ready' even look like for you?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the core belief gap perfectly and stays human throughout, but stacks two moves — the reframe ('nobody feels ready') plus a follow-up question — instead of landing on one.</sub>

### #28 — "How do I know you're not just another guru?"  _(trust)_

- **PROD** (20/20): Fair — honestly, you shouldn't just take my word for it. So tell me, what did the last guy not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Meets the cynicism head-on without defending, flips control back to Reggie, and the question digs directly into the trust/authority weak link — textbook elite closer move.</sub>

### #29 — "I need to pray on it"  _(stall)_

- **PROD** (20/20): Grace, I totally respect that — and I'd expect nothing less from you. Before you do, honest question: is prayer the one thing, or is there something else quietly sitting underneath this too?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — respects her faith without rushing it, uses her name, and executes the exact prescribed move of gently surfacing whether something else is also holding her back, all in under 35 natural words.</sub>

### #30 — "Money's really tight right now, but I want this"  _(affordability)_

- **PROD** (20/20): Yeah, I hear you — and I'm not gonna run a 'money aside' thing on you, that'd be disrespectful. So let's just talk real — what does tight actually look like right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated to the ground truth — honors the cash-timing constraint with radical honesty, skips value tricks as instructed, and opens the real conversation with one clean question.</sub>
