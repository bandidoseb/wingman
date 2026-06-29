# Objection Card Eval — v1 vs v2 vs v2+anchors

Generated 2026-06-28 18:30 · 30 scenarios · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6` · **COMPACT MODE**

**COMPACT MODE:** the card sees a thin, production-like belief-ladder summary (not the rich discovery dump). So **A vs D (both v1, no-anchors vs +anchors) is the real anchor test.** Judge grades against full ground truth, so fabrication is still caught.

**Arms:** A = v1 (current prompt) · B = v2 (no anchors) · C = v2 + anchors · D = v1 + anchors.
> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.
> `fabrication` and `shaky #` are trust-killers: any card with one scores **composite 0** (out of 20).

## Scoreboard (averages)

| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks |
|---|---|---|---|---|---|---|---|---|---|
| **A** v1 (current prompt) | 19.03 | 4.77 | 1.97 | 1.80 | 1.77 | 1.97 | 2.00 | 0 | 0 |
| **B** v2 (no anchors) | 19.03 | 4.87 | 2.00 | 1.77 | 1.63 | 1.90 | 2.00 | 0 | 0 |
| **C** v2 + anchors | 19.30 | 4.83 | 1.97 | 1.83 | 1.90 | 1.93 | 2.00 | 0 | 0 |
| **D** v1 + anchors | 19.33 | 4.90 | 2.00 | 1.83 | 1.80 | 1.90 | 2.00 | 0 | 0 |

## 🚨 Trust-killer incidents (fabrication / shaky-number leaks)

_None — no arm invented or leaked a shaky number._

## Per-scenario (cards side by side)

### #1 — "I need to think about it"  _(stall)_

- **A** (16/20): Jenna, totally — and honestly, what's the part that still feels uncertain? Because it sounds like you already know it's right.
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Solid human tonality and correctly targets the fear-not-logic stall, but stacks two moves (open question + reframe/tie-down) and misses the chance to anchor to her specific '20k and actual team' quote or the contractor history.</sub>
- **B** (19/20): Jenna, totally — and that doesn't quite sound 100%. Be honest with me, what's the part you're actually not sure about?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, human, elite closer move — paces then pulls out the real hesitation; loses one anchored point for not tying to a Jenna-specific detail (the contractor story or the 20k goal) but otherwise sharp.</sub>
- **C** (16/20): Jenna, I hear you — and that's totally fair. But be honest with me, what's the part you're actually not sure about?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Clean human opener and good move to surface the real objection, but misses the known anchor (fear of losing control / contractor history) that could make this land harder instead of fishing generically.</sub>
- **D** (16/20): Jenna, totally — and honestly, what part feels uncertain? Because earlier you said money's not the issue and it fits... so what's actually going on?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 2 · belief 1 · no-windup 2 — Anchors well to her money comment and sounds human, but stacks two moves — an open question plus a summary push — and asking 'what's actually going on' risks re-opening a resolved objection rather than addressing the known fear of letting g</sub>

### #2 — "It's too expensive"  _(price)_

- **A** (20/20): I hear you — but money aside for a sec, do you actually feel like this gets you past the plateau you've been stuck at?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Cleanly sidesteps the price frame and redirects to conviction — anchored to the confirmed two-year plateau with a single commitment question, no fabricated specifics.</sub>
- **B** (19/20): Andre, I hear you — money aside for a sec, do you honestly feel like this gets you past the plateau?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 1 · no-windup 2 — Sounds elite and human, hits the plateau anchor cleanly, but sidesteps the core weak belief — that $9k is an expense vs. the cost of two more stuck years — so it doesn't fully reframe ROI.</sub>
- **C** (20/20): I hear you, Andre — and before we talk numbers, real quick: money aside, do you honestly feel like this gets you out of those 70-hour weeks and stops you being the bottleneck on every job?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook value-before-price pivot — pulls Andre's confirmed pain verbatim, isolates the real belief gap (ROI vs. expense), and does it in one clean question with zero fabrication.</sub>
- **D** (20/20): Yeah, I hear you — and before we talk price, I gotta ask: money aside, do you honestly feel like this gets you out of the bottleneck and off the tools?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean permission-ask that sidesteps price to expose the real belief gap — anchored to 'bottleneck' which mirrors Andre's exact pain, natural closer voice throughout.</sub>

### #3 — "I don't have the money"  _(affordability)_

- **A** (17/20): Priya, I hear you — so let's figure out if we can actually make the numbers work. What do you have access to right now?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Correctly respects the real cash constraint and pivots to problem-solving rather than reframing value, but 'Priya' as opener and 'I hear you' combo is slightly formulaic and the anchor is generic rather than tied to her specific situation.</sub>
- **B** (19/20): I hear you, Priya — and I believe you. So let me see what we can actually do on terms, because I don't want that to be what stops you. Can we look at the numbers together?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Respects the real constraint, offers terms without slick reframe, sounds human — loses one anchored point for not tying to a confirmed specific like savings draining or $3k/mo reality.</sub>
- **C** (20/20): Priya, I hear you — and I believe you. So let's just figure out what's actually possible. What do you have access to right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated to a real cash constraint — validates without dismissing, then opens a practical path forward with one clean question; no fabricated specifics, no reframe that ignores her reality.</sub>
- **D** (15/20): Priya, I hear you — and I believe you. So let me ask: is the money the only thing in the way, or is there a part of you that's still not sure this works?
  <sub>tone 5 · brev 2 · 1-beat 0 · anchor 1 · belief 0 · no-windup 2 — The line stacks two moves (confirm money OR reframe to doubt) and worse, it subtly gaslit Priya by implying her real cash objection might just be a belief problem — the ground truth explicitly says this is NOT a smokescreen and must be resp</sub>

### #4 — "I need to talk to my business partner"  _(authority)_

- **A** (20/20): Totally — and is this more of a 'Dave, I'm doing this, heads up' situation, or does he actually need to weigh in before you can move?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real issue — is Dave a true gate or a courtesy call — using Marcus's own dynamic, in a conversational elite-closer frame with no fluff.</sub>
- **B** (20/20): Totally — is this you telling Dave what's happening, or does he actually have to approve it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean, human, one surgical question that surfaces whether Dave is a formality or a real gate — directly tied to the confirmed 'Dave and I decide together' anchor without fabricating anything.</sub>
- **C** (15/20): Totally, I respect that. But real quick — is this you genuinely needing his blessing, or do you already know this is the move and it's more of a heads-up?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 1 · no-windup 2 — Clever question but it stacks two framings (blessing vs. heads-up) rather than one clean move, and misreads the ground truth — Dave is a real, legitimate financial decision-maker Marcus himself flagged, so framing it as 'just a heads-up' ri</sub>
- **D** (20/20): Totally — and Marcus, real talk, is Dave gonna tell you no, or is he just gonna want to hear you're confident it's the right call?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real dynamic — Dave as a rubber-stamp vs. a true veto — using Marcus's own words and the confirmed decision structure, delivered in a voice that sounds exactly like an elite closer.</sub>

### #5 — "I'm too busy"  _(time)_

- **A** (20/20): Tom, the reason you're slammed right now — that's literally what we're fixing. So what if these calls are what buys you the time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe — 'too busy' is the symptom, the program is the cure — in two punchy sentences with a clean tie-down, anchored to Tom's exact situation, zero wind-up.</sub>
- **B** (20/20): Tom, the reason you're slammed is exactly what we're fixing — so what if the calls are what buys the time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Tight, confident reframe that flips 'too busy' into the reason to act, anchored directly to his stated pain — reads like a seasoned closer said it.</sub>
- **C** (20/20): Tom, the reason you're slammed is the exact thing we're fixing — so what if a few calls a week are what buy you your time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the reframe cleanly — uses the objection as proof of the pain, then flips the investment into a time trade, all in one tight beat with zero wind-up.</sub>
- **D** (20/20): Tom, the reason you're slammed right now — that's the exact thing we're fixing. So what if the calls are what buy you the time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean reframe that flips the objection into the solution, grounded in Tom's exact situation, tight and natural — reads like a top closer.</sub>

### #6 — "What if it doesn't work for me?"  _(risk)_

- **A** (19/20): Yeah — sit in that for a sec, because that's a real feeling. But Dana, you already get your clients results. Why are you the one person you don't believe in?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the identity/self-belief core with a razor-sharp reframe anchored to her real proof point, though it stacks a pace + a reframe + a rhetorical question, costing one beat point.</sub>
- **B** (18/20): Dana, that's real — and honestly, good that you're nervous, means it matters. But tell me — do you actually believe you can't do this, or are you just scared that you can?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Nails the identity/self-belief reframe with a punchy mirror question and human tonality, but stacks a pace + reframe + question making it slightly more than one clean beat, and misses the available anchor (her offline results proving capabi</sub>
- **C** (20/20): Dana, you get your clients results every day — that's not the question. The real thing is, can you do it for yourself?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly names the real objection (self-belief, not capability), anchors to her confirmed offline proof, and lands as one clean mirror — reads exactly like an elite closer.</sub>
- **D** (20/20): Yeah — that fear's real, and I'm not gonna brush past it. But Dana, you already get your clients results. So what makes you think you're the one person you can't do it for?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the identity reframe with her real proof point; 'I'm not gonna brush past it' is a mild self-narrating wind-up but the rest is elite closer language that directly dismantles her self-doubt anchor.</sub>

### #7 — "What makes you different?"  _(differentiation)_

- **A** (20/20): Honestly, Luis — can I flip that? What did the last program not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean permission-ask that redirects to his exact wound — the two failed programs — letting Luis indict them himself instead of the rep claiming differentiation.</sub>
- **B** (20/20): Honestly Luis, can I flip that? What did the last program not do that you actually needed — because that's probably the real answer.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook redirect that forces Luis to name implementation/accountability himself, directly targeting the weak belief without fabricating anything or over-explaining.</sub>
- **C** (20/20): Honestly Luis, can I flip that back on you? The two programs you did — what did they NOT do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Flips to a question that forces Luis to self-identify the implementation gap — exactly the right move, grounded in his confirmed history, no fabrications, sounds like a real closer.</sub>
- **D** (20/20): Honestly? Nothing — on paper. Can I ask you something though? Those two programs that were 'all theory, no implementation' — what specifically did they not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Mirrors his exact quote, disarms with a bold opener, and pivots to a single diagnostic question that forces Luis to articulate the implementation gap himself — textbook elite closer move.</sub>

### #8 — "Send me some information"  _(deflection)_

- **A** (20/20): Rachel, totally — but real talk, what's actually going on? Because ten minutes ago you were fired up about this.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the conflict-avoidant anchor by reflecting her own energy shift back at her in a warm, direct way — exactly the right move to surface the real concern without pressure.</sub>
- **B** (16/20): Rachel, I hear you — but honestly, what's the part you're not feeling 100% on? Because 'send info' usually means something's off.
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Correctly diagnoses the real issue (something's off post-reveal) and calls it directly in a human tone, but stacks two moves — a permission-ask plus an explicit meta-label of the objection pattern — making it slightly compound; no real anch</sub>
- **C** (19/20): Yeah, totally — and I'll send whatever's helpful. But Rachel, be honest with me, what's the part you're not sure about?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Perfectly calibrated for a conflict-avoider — pace + permission disarms the polite deflection and opens the real concern without pressure; slightly generic (no specific anchor to hiring chaos or the price-reveal cool-down) but the move is t</sub>
- **D** (19/20): Yeah, of course — before I do, can I be honest with you? What is it that's actually holding you back right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean permission-ask that surfaces the real objection behind a conflict-avoidant 'send info' deflection — natural, direct, and exactly what a top closer would do here, though it doesn't tie to a specific anchor.</sub>

### #9 — "I can do this myself"  _(diy)_

- **A** (19/20): Kev, I believe you — but you could've done it yourself already, right? What's actually stopped you?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the anchored history ('could've done it already') and the right belief (self-directed hasn't worked), but stacks two moves — a reframe AND a follow-up question — instead of landing one clean beat.</sub>
- **B** (20/20): Kev, I believe you — but you could've done it yourself already. So what's been stopping you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Tight, confident, human — agrees with his pride then immediately flips it using his own confirmed history of abandoned plans; one clean question, no fabrications, no wind-up.</sub>
- **C** (20/20): Kev, I get it — and you probably can. But you've started two of these on your own and walked away both times. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook pattern-interrupt — validates his pride, then lands his own confirmed history (two abandoned plans) as the reframe, closes with a single question that forces him to confront the gap himself.</sub>
- **D** (20/20): Kev, I get it — and you probably could. But you've started two plans on your own and didn't finish them. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite closer move — paces his pride, then uses his own confirmed history (two abandoned plans) to land a single pointed question that he has to answer honestly.</sub>

### #10 — "I've been burned before"  _(trust)_

- **A** (18/20): Marie, I hear you — and that $20k program that left you hanging, what did it not do that you actually needed?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Sharp, human, anchored exactly to her $20k ghost experience — opens discovery to surface the unmet need rather than defending; clean single move.</sub>
- **B** (16/20): Yeah, that's real — and I respect it. What did that program not do that you actually needed?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Solid, human tone and tight delivery, but asking what the program didn't do is a discovery move when the ground truth already told us exactly what went wrong — it sidesteps the $20k ghosting anchor and delays the de-risking that's the actua</sub>
- **C** (20/20): Marie, I'd be scared too — that $20k ghost would make anyone cautious. What did they not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to the confirmed $20k ghost detail, human tone, single diagnostic question — textbook trust-layer opener with no wind-up or fabrication.</sub>
- **D** (20/20): Yeah — that $20k and getting ghosted, that's real. What did that mentor not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact confirmed anchor ($20k + ghosted), sounds fully human, asks one clean diagnostic question that opens the trust conversation — textbook elite closer move.</sub>

### #11 — "This sounds too good to be true"  _(skepticism)_

- **A** (16/20): Yeah, I hear you — can I ask you something honest? Setting that aside, do you actually believe what we laid out can get you to where you said you wanna be?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Smart belief-gap move that correctly targets Sam's disbelief, but it stacks two moves — a dismissal ('setting that aside') plus a conviction-check question — making it slightly compound rather than a clean single beat, and 'where you said y</sub>
- **B** (19/20): Yeah, I'd be skeptical too — so be honest with me, is it that you don't think it's possible at all, or that you don't think it's possible for *you*?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Sharp diagnostic question that nails the exact weak belief (possible vs possible for HIM), sounds like a real closer, but doesn't tie to a specific Sam anchor like the trades context or his grinder identity.</sub>
- **C** (20/20): Sam, I get it — and that instinct's probably kept you from a lot of BS. Be honest with me though: is it that you don't believe it works, or that you don't believe it works for you specifically?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (it works vs works for HIM), anchors to his grinder/skeptic identity, lands in one clean diagnostic question — textbook elite closer move.</sub>
- **D** (20/20): Yeah, I'd say the same thing — so be honest with me, do you actually feel like this can get you to that number and more time with your kids, or does it just sound like noise?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (outcome not realistic for HIM), paces naturally, anchors to his real goal without citing the shaky figure, and flips it back with one clean question.</sub>

### #12 — "The timing isn't right"  _(timing)_

- **A** (20/20): Bianca, the busy season you're worried about — isn't that exactly why you came here today?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Razor-sharp tie-down that flips her own anxiety into the reason to act now — anchored to Q4 and the real weak belief without a single wasted word.</sub>
- **B** (20/20): Bianca, totally hear you — but can I be honest? The season you're worried about missing is exactly what we'd be building for. Starting after it means you already missed it.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weakest link from ground truth — 'later' costs her the season — with a clean reframe, grounded in her confirmed timing anchor, and lands in natural closer voice.</sub>
- **C** (19/20): Bianca, I hear you — but can I be honest? The reason Q4 feels scary at 18k is exactly what we'd fix. Waiting through it means you hit the same ceiling again.
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe (waiting costs her the season) with real anchors and natural closer tone, but slightly stacks two moves — the honest-reframe plus the ceiling consequence — instead of landing one clean beat.</sub>
- **D** (20/20): Bianca, totally — and can I be honest with you for a sec? The reason the timing feels off is Q4, right? That season is exactly what this fixes.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean reframe that flips her Q4 anxiety into the exact reason to move now, with a natural permission-ask opener and no invented specifics.</sub>

### #13 — "I need to talk to my spouse"  _(authority)_

- **A** (20/20): Yeah, totally — is that more of a courtesy thing, or do they actually need to weigh in for you to move?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly targets the exact weak link flagged in the ground truth — is the spouse a real gate or courtesy — in natural, elite-closer language with zero fluff.</sub>
- **B** (19/20): Yeah, totally — and I'd expect that. Quick question though: is this you needing their blessing, or do you already know this is right and you just wanna loop them in?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Nails the real diagnostic — is this a gate or courtesy — with a dead-natural two-option question that real closers use; docks one on anchored since it doesn't tie to any confirmed detail (team-building pain, $22k, their own quote).</sub>
- **C** (20/20): Totally — and is this more of a courtesy call, or do they actually need to weigh in before you decide?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Surgically targets the exact weakest link flagged in the ground truth — courtesy vs. real gate — in one clean, human question with no fluff.</sub>
- **D** (16/20): Yeah, totally — and I respect that. But real talk, Jordan — is this you genuinely unsure, or do you already know this is the move and just want to loop them in?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Sharp belief-diagnosis question that correctly probes whether the spouse consult is a real gate or a courtesy, but stacks two moves (validation pace + binary question) and lacks a specific anchor from Jordan's call facts.</sub>

### #14 — "I need to check with my accountant"  _(authority)_

- **A** (20/20): Derek, totally respect that — is this you genuinely needing his sign-off, or is this your call to make and he just handles the paperwork after?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — accountant as logic gate vs. real decision-maker — with a clean binary question that forces Derek to own the call himself, grounded in the ground truth dynamic.</sub>
- **B** (20/20): Derek, totally respect that — is that a courtesy call you're making, or does he actually have a say in whether you do this?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real weak belief — accountant is a deferral mechanism, not a real veto — with a sharp, human binary question that forces Derek to own the decision without sounding confrontational.</sub>
- **C** (20/20): Totally respect that — and Derek, you literally just said 9 grand isn't the issue. So is this your accountant's call to make, or yours?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real objection — accountant as emotional deferral, not a real financial gate — by quoting Derek's own confirmed words and forcing him to own the decision.</sub>
- **D** (20/20): Yeah, totally — and is your accountant gonna tell you whether this gets you to where you wanna be, or is that really your call to make?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak link — accountant as logic gate vs. Derek's real decision — in a conversational, pressure-free question that sounds like a top closer said it.</sub>

### #15 — "I tried something like this before and it didn't work"  _(trust)_

- **A** (16/20): Yeah — and that's fair. What did that program not do that you actually needed it to?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Tonally solid and clean, but the question opens a rabbit hole about the old program rather than pivoting to her own admitted non-implementation — the real weak link is accountability/her own gap, not what the program failed to deliver.</sub>
- **B** (16/20): Yeah, I hear you — what did that program not do that you actually needed it to?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Clean, human, one question — but asks what the program lacked rather than surfacing her own admission of non-implementation, which is the real gap and strongest anchor available.</sub>
- **C** (20/20): Alyssa, I hear you — and can I be honest for a sec? You mentioned you didn't really implement it last time. So was it that it didn't work, or that it didn't get done?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to her own admission about non-implementation, one clean reframe question, natural human pace, no fabrications — textbook elite closer move.</sub>
- **D** (20/20): Yeah, I hear you — and can I be honest for a sec? You mentioned you didn't really implement it last time. So was it the program, or just that nothing made you actually do it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to Alyssa's own admission about non-implementation, one clean reframe that surfaces the accountability gap, and sounds exactly like a top closer would say it live.</sub>

### #16 — "Can you do a payment plan or a discount?"  _(price)_

- **A** (19/20): Yeah, Tony, we can work something out — before I do, are you 100% in if we make the numbers work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Textbook commitment-lock before terms — nails the move exactly right for a prospect who's already sold; loses one anchor point for not tying to his specific 'I want to do it' signal or the stepping-back goal.</sub>
- **B** (19/20): Yeah, we can work something out on the payment side — if you're fully in, let's lock it and I'll make the numbers work for you.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, confident close that correctly reads this as a terms conversation and moves straight to locking the decision — loses one anchored point for not tying to Tony's 'step back' goal or his 'I want to do it' signal.</sub>
- **C** (18/20): Yeah, Tony, we can work something out on terms — if you're in, I can split it up. You're good to go?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean, human, direct — acknowledges terms, uses his name, presupposes the close; no specifics invented and correctly skips the discount ask to move straight to yes.</sub>
- **D** (19/20): Yeah, totally — I can work with you on a payment plan. If we split it into two payments, would you be ready to lock it in today?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, human, closes correctly on a terms question without re-selling — loses one anchored point for not tying to Tony's 'I want to do it' signal or his step-back goal, but otherwise elite execution.</sub>

### #17 — "I'm already working with a coach"  _(differentiation)_

- **A** (20/20): Yeah, totally — and I'm not here to replace anyone. But Nina, you said it's stalled. So is it working?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Crisp, elite-closer delivery that disarms loyalty guilt immediately, then lands directly on her own 'stalled' admission with a clean one-beat close question — no fabrications, no shaky numbers, no AI wind-up.</sub>
- **B** (17/20): Nina, I hear you — and I respect that. But you said it's stalled. So honestly, is what you're doing right now actually getting you there?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Solid anchor to her own 'plateaued' quote and a sharp closing question, but stacks a pace + reframe + question making it slightly more than one beat; 'I respect that' risks sounding slightly formal but overall feels human and on-target.</sub>
- **C** (20/20): Yeah, totally — and you said you've kind of plateaued with them. So is that working well enough, or is that why we're talking?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook pace-plus-tie-down using her exact words ('kind of plateaued'), lands a single binary question that makes her own the contradiction — clean, human, and fully grounded.</sub>
- **D** (20/20): Yeah, totally — and I'm not here to trash that relationship. But you just told me you've plateaued. So honestly, is what you have now actually getting you to that next level?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the loyalty guilt with a disarming pace, then pivots straight to her own admitted plateau — clean single-beat question that forces honest self-assessment.</sub>

### #18 — "Let me finish my current launch first"  _(timing)_

- **A** (20/20): Greg, totally — can I be honest with you for a sec though? This launch is live right now. Wouldn't you rather have this working for you during it, not after?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Tight, human, and directly hits the weakest link — that the program amplifies the live launch rather than competing with it — without inventing any facts.</sub>
- **B** (20/20): Greg, real talk — what if this is exactly what makes the launch bigger?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the weakest link dead-on — the program amplifies the launch rather than competing with it — in a tight, natural, closer-sounding line with zero fluff.</sub>
- **C** (20/20): Greg, real talk — what if this is actually what makes the launch bigger, not something on top of it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Pulls the exact weakest-link reframe from ground truth almost verbatim, delivered conversationally and in a single tight move — near-perfect execution.</sub>
- **D** (20/20): Yeah, totally — and can I be honest with you for a sec? What if the thing that makes this launch bigger is exactly what we're talking about right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe from the ground truth — the program is what makes the launch bigger, not a competing task — in a natural, human voice with zero fabrication.</sub>

### #19 — "I need to see proof or a guarantee"  _(risk)_

- **A** (19/20): Carla, totally fair — can I be honest with you for a sec? The only thing that actually guarantees results is you doing the work. So are you 100% in on that part?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Nails the core belief shift — moves guarantee from seller to prospect's control — with clean tonality and a tight commitment question, but misses using Carla's specific risk-averse/wasted-money anchor for a stronger tie-down.</sub>
- **B** (19/20): Carla, I hear you — can I be honest for a sec? The only thing that actually guarantees results is you doing the work. So are you in on that part?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Nails the weakest link — puts certainty back on what she controls — with elite closer cadence, though it doesn't hook a specific Carla anchor like her fear of wasting money or being capped on time.</sub>
- **C** (17/20): Carla, can I be honest? The only thing I can't guarantee is whether you'll actually do the work — so what's really going on, is it the program you're unsure about, or yourself?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the trust/risk reframe and ties directly to her fear of a bad bet, but stacks two moves — the work reframe plus a binary question — making it slightly compound.</sub>
- **D** (19/20): Carla, can I be honest with you for a sec? The only guarantee that actually matters here is you — so do you genuinely feel like this can get you there?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Hits the exact right belief (certainty lives in her doing the work, not an external guarantee) in a natural, elite-closer voice — only misses a point because it doesn't tie to a specific confirmed anchor like her $15k cap or her stated fear</sub>

### #20 — "The economy is too uncertain right now"  _(timing)_

- **A** (20/20): Hassan, I hear you — and can I be honest for a sec? When everyone else pulls back, what happens to the guys who don't?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Tight, human, and lands the exact counter-belief — downturns create openings for those who stay in — without inventing any facts.</sub>
- **B** (20/20): Hassan, can I be honest? Every competitor you have is saying the exact same thing right now — so who do you think wins when things stabilize?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (fear dressed as macro logic) using the ground-truth gap anchor about competitors pulling back, delivered concisely with a natural permission-ask open and a single rhetorical close.</sub>
- **C** (20/20): Hassan, can I be honest? The guys who are gonna eat your market share — they're saying the exact same thing right now.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — permission-ask opener, one sharp reframe hitting the exact fear-dressed-as-logic weak belief, anchored to the competitor pullback gap from ground truth, no invented specifics.</sub>
- **D** (20/20): Hassan, I hear you — but who do you think gains market share when everyone else pulls back and goes quiet?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact gap in the ground truth (competitors pulling back = opening) with a single rhetorical question, natural pace, and zero fabrication.</sub>

### #21 — "I want to do more research and compare options"  _(stall)_

- **A** (20/20): Beth, can I be honest with you? You've been researching this for a year — at what point does more research become the reason it never happens?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core weak belief (research-as-avoidance) with a direct anchor to her confirmed year of inaction, delivered in a single reframe question with a natural permission-ask opener.</sub>
- **B** (20/20): Beth, you've been researching this for a year — at what point does more research become the reason nothing changes?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — research as avoidance — by mirroring her own confirmed anchor back as a rhetorical question, with zero wind-up and elite-level economy.</sub>
- **C** (20/20): Beth, you've been researching this for a year — so what's one more option gonna tell you that you don't already know?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (more research = better decision) using her own confirmed anchor (a year of no movement), delivered in one sharp rhetorical question with zero fluff.</sub>
- **D** (20/20): Beth, totally — and can I be honest with you for a sec? You've been researching this same problem for a year. At what point does more research become the thing that's keeping you stuck?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite closer move — warm pace, permission-ask, then one precise reframe nailing her confirmed year-of-researching anchor and the exact fear-of-being-stuck belief; nothing fabricated, perfectly brief.</sub>

### #22 — "I've already spent a lot on this kind of thing"  _(money)_

- **A** (20/20): Yeah — and what did those get you that stuck? Like, what was actually missing?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Tight, human, elite-closer move — opens with a natural pace then fires a single diagnostic question that leads Omar to name the missing accountability himself, perfectly targeting the weakest link without stating any specifics.</sub>
- **B** (20/20): Yeah — and what did all of it have in common that made it not stick?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — A clean, natural Socratic move that directs Omar to self-discover the missing accountability — exactly the weak belief behind this objection — without stating any unconfirmed specifics.</sub>
- **C** (18/20): Omar, I hear you — and what did all of those get you? Be honest.
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Sharp, direct flip that uses his own name and forces honest self-reflection on the gap — exactly the right belief to attack — though the bluntness of 'be honest' is a slight tonal risk.</sub>
- **D** (20/20): Yeah, I hear you — and real talk, can I ask you something? All that stuff you bought... was any of it holding you accountable to actually implement it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly isolates the accountability gap — the exact missing piece — with a natural human pace and a single surgical question, no fabricated specifics, no shaky numbers.</sub>

### #23 — "My niche is unique — a general program won't fit"  _(skepticism)_

- **A** (20/20): Sofia, can I be honest with you for a sec? Every agency owner I've ever talked to says that — and the bottleneck is never the niche. It's always the same thing. Does that feel true to you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief (niche uniqueness vs universal bottleneck), natural permission-ask opener, tight and conversational, ends with a tie-down — textbook elite closer move.</sub>
- **B** (19/20): Sofia, every agency owner I've ever talked to says that — and the bottleneck is always the same: it's you in the middle. So be honest, is the niche really the issue, or is it something else?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe (bottleneck is universal, not niche-specific) and uses a sharp tie-down, but stacks two moves — the reframe AND a probing question — making it a hair compound.</sub>
- **C** (20/20): Sofia, can I be real with you for a sec? The bottleneck isn't medical billing — it's you doing everything with no systems. That part's the same in every business.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook reframe — names her real bottleneck directly, ties to the confirmed ground truth that the constraint is universal, and does it in one clean move with a natural permission-ask opener.</sub>
- **D** (20/20): Sofia, can I be honest for a sec? — is it really the niche, or is it that you're the bottleneck and there's no system holding it together without you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook reframe that uses her exact name, permission-asks naturally, then drives straight at the confirmed weakest link — the bottleneck — without inventing a single fact.</sub>

### #24 — "I don't want to be locked into a contract"  _(risk)_

- **A** (20/20): Yeah, totally — and honestly, Trent, the lock-in isn't the real thing, is it? It's more like... what if it doesn't work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly mirrors Trent's actual fear (trapped in something that doesn't work) in natural closer language, with zero fluff and one precise reframe.</sub>
- **B** (19/20): Yeah, I get it — but Trent, real talk, six months is exactly why it works. So is the lock-in the issue, or is it that you're not sure it'll actually get you there?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real fear and reframes the commitment correctly, but stacks two moves — a reframe AND a question — where one would be cleaner.</sub>
- **C** (20/20): Trent, I get it — so be honest with me, is it the six months, or is it 'what if it doesn't actually work?'
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real fear (trapped in something that doesn't work) by splitting it from the surface objection (six months), sounds exactly like an elite closer, and stays tight — no fabrication, no shaky numbers.</sub>
- **D** (20/20): Trent, totally — so be honest with me, is it the six months, or is it 'what if it doesn't actually work?'
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real fear — being trapped in something that doesn't work — by splitting the objection into its two true components, which is exactly the weak belief exposed in the ground truth.</sub>

### #25 — "I want to but I'm scared to invest right now"  _(affordability)_

- **A** (16/20): Yeah — that fear is real, and I'm not gonna brush past it. Can I ask you something honestly though? What scares you more — putting down the investment, or still being here at $5k a month six months from now?
  <sub>tone 4 · brev 1 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Tonally strong and anchored to her confirmed $5k figure, but stacks two moves (validation + question) and runs slightly long; the question itself is a solid reframe of her fear but the wind-up ('I'm not gonna brush past it') edges toward se</sub>
- **B** (18/20): Yeah — Maya, that fear makes total sense, honestly. So be real with me: is it the money that's actually the blocker, or is it fear that it won't work?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Smart diagnostic question that earns trust and separates real money concerns from fear — matches the 'honesty and steadiness' mandate — but stacks two distinct moves (validate + binary question) instead of one clean beat.</sub>
- **C** (20/20): Yeah — that fear makes sense, and I'm not gonna talk you out of it. Honest question though: what scares you more — this investment, or ending up back at a 9-5?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Validates fear without slick-talking, anchors directly to her '9-5' quote, and delivers one clean contrast question — exactly right for this prospect's emotional state and the ground truth's honesty directive.</sub>
- **D** (20/20): Yeah — I hear you, and that fear makes total sense. But Maya, you said you can't go back to a 9-5. So what happens if you don't make this move?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Validates honestly, quotes her exact words, and lands one clean cost-of-inaction question — textbook elite closer move with no slick reframe.</sub>

### #26 — "I need to run it by my team"  _(authority)_

- **A** (18/20): Victor, is this actually your call to make, or do they have veto power over a business decision like this?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Cuts straight to the real dynamic — Victor's avoidance pattern — with a clean binary that forces him to own the decision, exactly what the ground truth calls for.</sub>
- **B** (20/20): Victor, is this a courtesy thing — like you're gonna tell them — or do they actually have a say in this call?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Surgically names the real dynamic — his avoidance of personal accountability — in his own frame, with zero wind-up and exactly one incisive question.</sub>
- **C** (20/20): Victor, it's your company — so is this a courtesy heads-up to your team, or do they actually have a vote here?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Surgical, human, and directly names the real dynamic — his avoidance pattern — by forcing Victor to own whether this is real consultation or deflection, anchored to his own 'it's my company' reality without inventing any facts.</sub>
- **D** (20/20): Victor, it's your company though — so is this you genuinely needing their input, or is this more like you wanting the cover if it doesn't work out?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Surgically names his real avoidance pattern (wanting cover if it fails) using his own framing, delivered as a calm direct question — textbook elite close.</sub>

### #27 — "I'm just not sure I'm ready"  _(stall)_

- **A** (20/20): Renee, I hear you — and honestly, has there ever been a moment in your life where you felt totally ready before doing something big?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly targets the 'nobody feels ready' weak link with a single rhetorical question that lets Renee's own history close the loop — clean, human, no fabrications.</sub>
- **B** (19/20): Renee, can I be honest? Nobody ever feels ready — that's not a real signal. So what's the actual thing you're scared of?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the core belief perfectly and sounds like a real closer, but stacks two moves — the reframe ('nobody feels ready') plus a follow-up question ('what's the actual thing you're scared of?') — which costs one_beat.</sub>
- **C** (17/20): Renee, I hear you — and honestly? Nobody ever feels ready. The coaches who blew past where you are right now — they all started before they felt ready. So what's the part that's actually scaring you?
  <sub>tone 5 · brev 1 · 1-beat 0 · anchor 2 · belief 2 · no-windup 2 — Nails the core belief and anchors to the exact gap in the ground truth, but stacks two moves — the reframe AND a diagnostic question — instead of landing one clean beat; slightly long for a live read.</sub>
- **D** (20/20): Renee, honestly — do you think that feeling ever just shows up on its own?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly targets the core weak belief — readiness as a feeling that arrives — with a single Socratic question, human tone, and no fabricated specifics.</sub>

### #28 — "How do I know you're not just another guru?"  _(trust)_

- **A** (20/20): None taken — that's a fair shot. What did the last guy not do that actually would've made the difference for you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Masterfully meets the cynicism head-on without defensiveness, flips it back on Reggie with one clean question that surfaces his real standard — exactly what the ground truth calls for.</sub>
- **B** (20/20): Reggie, fair shot — honestly, what did the last guy not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Meets the cynicism head-on with a calm, confident question that flips it back on Reggie and forces him to articulate the real standard — exactly the right move for a trust/authority gap.</sub>
- **C** (20/20): Reggie, fair — I'd ask the same thing. Honestly, what did the last guy not do that you needed him to?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Meets the cynicism head-on with calm peer energy, flips it back on Reggie with one clean question, no fabricated specifics, no AI wind-up — textbook elite closer move for this exact trust/authority objection.</sub>
- **D** (20/20): Fair question — and honestly, you don't yet. So tell me, what did the last one not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Disarms cynicism perfectly by admitting uncertainty, then flips to a qualifying question that puts it back on him — exactly what the ground truth calls for.</sub>

### #29 — "I need to pray on it"  _(stall)_

- **A** (20/20): Grace, I love that — honestly. Before I let you go, is it purely that, or is there any other part of you that's not fully settled yet?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly executes the ground truth's 'weakest link' directive — respects the prayer anchor without rushing it, then gently surfaces whether anything else is holding her back, all in one clean move.</sub>
- **B** (20/20): Grace, I love that — and I'd expect nothing less from you. Honestly though, is it just the prayer, or is there something else sitting with you too?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly respects her faith anchor, stays warm and human, then executes the exact move the ground truth calls for — gently surfacing whether anything else is holding her back — in one clean question.</sub>
- **C** (20/20): Grace, I respect that completely — that's real. Can I just ask honestly — is there anything else sitting on your heart, or is it purely just taking it to God?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly respects her faith anchor while executing the exact prescribed move — gently surfacing whether anything else is holding her back — in warm, natural, elite-closer language.</sub>
- **D** (20/20): Grace, I love that — and I'd never want you to skip that step. Can I just ask, is there anything besides that, sitting in the back of your mind?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly respects her faith anchor, skips wind-up, lands the one prescribed move — surfacing whether anything else is holding her back — in a natural, human closer voice.</sub>

### #30 — "Money's really tight right now, but I want this"  _(affordability)_

- **A** (18/20): Diego, I hear you — and I believe you. So let's figure out the numbers together, because 'want this' is the hardest part, and you're already there.
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Warm, human, and honest — respects the real cash constraint and pivots to a collaborative path, but 'figure out the numbers together' plus 'want this is the hardest part' is two moves, and it doesn't pull in any of Diego's specific anchors </sub>
- **B** (20/20): Diego, I hear you — and I believe you. So let's figure out what actually works right now, 'cause I'm not letting money be the thing that keeps you in that cycle.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Honest, warm, zero manipulation — meets the cash-timing constraint head-on by pivoting to a real path, ties directly to the cycle anchor without inventing any facts.</sub>
- **C** (20/20): I hear you — and I'm not gonna pretend that away. So let's make the numbers actually work for where you're at right now. What does cash flow look like over the next 30 days?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Honest, human, no tricks — directly addresses the cash-timing constraint and opens a real path forward with one clean question.</sub>
- **D** (16/20): I hear you — and I respect that, genuinely. So let's figure out what actually works for your cash right now, and see if we can make this happen.
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Solid human tone and right belief (cash timing, not value), but 'figure out' + 'make this happen' stacks two micro-moves and stays generic when 'truck repair' or 'job to job' were available anchors.</sub>
