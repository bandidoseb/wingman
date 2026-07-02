# Objection Card Eval — production prompt + abstain gate

Generated 2026-07-01 22:27 · 12 real + 0 no-objection · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6`

**PROD arm** = the real production prompt (single source of truth), objection inferred from the transcript (Groq removed), 150-token cap.
> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.
> `fabrication`/`shaky #` are trust-killers (composite 0). `expectAbstain` scenarios MUST return `{ line: null }`.

## ✅/❌ GATE

- **PROD: ✅ PASS** — no false silence on real objections ✅ · abstains on no-objection ✅ (0/0) · zero fabrications ✅ · tonality ≥4.7 ✅ (5.00)

## Scoreboard — handled real objections (averages)

| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks | False-silence |
|---|---|---|---|---|---|---|---|---|---|---|
| **PROD** production (objection inferred, Groq removed) | 19.58 | 5.00 | 1.92 | 1.83 | 1.83 | 2.00 | 2.00 | 0 | 0 | 0 |

## 🚨 Critical incidents (fabrication / shaky-number / false-silence)

_None — no fabrication, no shaky number, no false silence._

## Abstain check — no-objection scenarios (must return `{ line: null }`)

## Per-scenario — real objections (cards)

### #1 — "I need to think about it"  _(stall)_

- **PROD** (19/20): Yeah, totally — and I get that. But Jenna, be honest with me... what's the actual thing you're sitting with?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, human, elite-closer move that correctly diagnoses fear-of-change as the real stall and invites Jenna to name it herself — loses one anchored point for not tying to her specific 20k goal or contractor history, and 'I get that' is a mi</sub>

### #2 — "It's too expensive"  _(price)_

- **PROD** (20/20): Yeah, I get it — $9k is real money. But Andre, can I ask you something? If nothing changes, what's another two years of 70-hour weeks actually costing you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite closer move — validates, names the real number (confirmed), then flips to the cost of inaction using his exact confirmed pain anchor; no fabrications, clean single beat.</sub>

### #3 — "I don't have the money"  _(affordability)_

- **PROD** (19/20): I hear you — and I believe you. So let me ask: is there a payment structure that'd actually make this workable, or is the timing just not right at all?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real cash constraint head-on and respects her honesty, though it technically stacks two moves (payment structure offer + timing qualifier), which slightly dilutes the one-beat purity.</sub>

### #4 — "I need to talk to my business partner"  _(authority)_

- **PROD** (20/20): Totally — and is this more like Dave needs to be in the loop, or is there a real chance he pumps the brakes on something you've already decided you want?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to Dave by name, asks the one surgical question that separates loop-in from veto — elite closer move, clean and conversational.</sub>

### #5 — "I'm too busy"  _(time)_

- **PROD** (20/20): Tom, the reason you're slammed is exactly the thing we're fixing — so what if the calls are what buys you time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe — busy is the symptom, not a valid reason to wait — with a clean tie-down and zero wasted words.</sub>

### #6 — "What if it doesn't work for me?"  _(risk)_

- **PROD** (18/20): Yeah — sit in that for a sec. That fear makes sense. But Dana, you already get your clients results. The thing that's not working is doing it for yourself — so what makes you think you're the exception?
  <sub>tone 5 · brev 1 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the identity reframe with her real proof point, but stacks two moves (reframe + rhetorical question) and runs slightly long.</sub>

### #7 — "What makes you different?"  _(differentiation)_

- **PROD** (20/20): Yeah, fair — and I'd be asking the same thing. Can I ask you something first though? The last two programs — what specifically did they not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite move — validates, flips to a qualifying question anchored directly to his confirmed 'all theory, no implementation' history, zero wind-up, one clean beat.</sub>

### #8 — "Send me some information"  _(deflection)_

- **PROD** (19/20): Rachel, totally — and I will. But just so I send you what actually matters, can I ask — when you picture going through it, what's the one thing you're really hoping to find the answer to?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Elegantly disarms a polite dodge with a single diagnostic question that forces Rachel to surface her real concern — tonally perfect, appropriately brief, no fabricated specifics, though not tied to a named anchor like hiring chaos or the pr</sub>

### #9 — "I can do this myself"  _(diy)_

- **PROD** (20/20): Kev, I hear you — and you probably could. But you've started two plans on your own and didn't finish them. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook closer move — paces his belief, anchors directly to his confirmed history of two abandoned plans, then lands one surgical question that makes him confront his own pattern.</sub>

### #10 — "I've been burned before"  _(trust)_

- **PROD** (20/20): Yeah — that $20k and someone just disappearing, that's real. What did that program not do that you actually needed it to?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Directly mirrors her confirmed $20k anchor, names the ghosting, and opens with a single trust-building question — exactly what the weakest link demands.</sub>

### #11 — "This sounds too good to be true"  _(skepticism)_

- **PROD** (20/20): Yeah, I get it — sounds like hype, I'd be skeptical too. Sam, forget the number for a sec — do you honestly feel like what you've been doing is actually gonna get you more time with your kids?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Validates skepticism naturally, sidesteps the shaky number, and drives straight to his confirmed emotional anchor (kids/time) with one clean reframe question — textbook elite closer move.</sub>

### #12 — "The timing isn't right"  _(timing)_

- **PROD** (20/20): Bianca, I hear you — but isn't Q4 exactly what you're worried about missing? The timing feeling off *is* the thing we're here to fix.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weakest link — 'later' costs her the season — using her own Q4 anxiety as the reframe, in natural closer cadence with no fabricated specifics.</sub>
