# Objection Card Eval — v1 vs v2 vs v2+anchors

Generated 2026-06-28 22:23 · 30 scenarios · gen=`claude-sonnet-4-6` · judge=`claude-sonnet-4-6`

**Arms:** A = v1 (current prompt) · B = v2 (no anchors) · C = v2 + anchors · D = v1 + anchors.
> The AI judge is triage for volume. **Sebastian is the final tonality judge** — read the lines.
> `fabrication` and `shaky #` are trust-killers: any card with one scores **composite 0** (out of 20).

## Scoreboard (averages)

| Arm | Composite /20 | Tonality /5 | Brevity /2 | One-beat /2 | Anchored /2 | Right-belief /2 | No-windup /2 | Fabrications | Shaky # leaks |
|---|---|---|---|---|---|---|---|---|---|
| **V1** v1 (tonality baseline) | 19.27 | 4.87 | 1.93 | 1.77 | 1.87 | 1.97 | 2.00 | 0 | 0 |
| **P** merged prod (no anchors) | 19.50 | 4.90 | 2.00 | 1.83 | 1.87 | 2.00 | 2.00 | 0 | 0 |
| **PA** merged prod + anchors | 18.97 | 4.80 | 1.93 | 1.67 | 1.80 | 1.97 | 2.00 | 0 | 0 |

## 🚨 Trust-killer incidents (fabrication / shaky-number leaks)

_None — no arm invented or leaked a shaky number._

## Per-scenario (cards side by side)

### #1 — "I need to think about it"  _(stall)_

- **V1** (16/20): Jenna, I hear you — and what specifically do you feel like you still need to think through?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Clean, human opener with a solid clarifying question, but it treats the objection as informational rather than emotional — Jenna's weak link is fear of change, not missing info, so a reframe toward that stall would score higher on right_bel</sub>
- **P** (17/20): Yeah, totally — and honestly, that doesn't quite sound 100%. What's the real thing going on?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Solid, human closer move that correctly identifies the stall isn't logic but fear — though it misses a chance to anchor to Jenna's specific goal or contractor history to make it land harder.</sub>
- **PA** (18/20): Yeah, totally — and I hear you. But Jenna, what's the part that actually needs more thinking? Because you told me twice you want 20k and a real team, money's not the issue... so what's really going on?
  <sub>tone 5 · brev 1 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real stall (fear, not logic) with her exact anchors, but stacks two moves — a reframe plus a direct question — making it slightly long and double-barreled.</sub>

### #2 — "It's too expensive"  _(price)_

- **V1** (20/20): Yeah, I get it — $9k's real money. But Andre, set that aside for a sec — do you honestly feel like this gets you out of those 70-hour weeks and to that bigger month you're after?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core weak belief (expense vs ROI) by anchoring to Andre's confirmed pain and goal in one clean question — tonality is natural, pace is brief, and no shaky numbers are cited.</sub>
- **P** (20/20): Yeah, I hear you — and I wanna make sure we're looking at this right. Money aside for a sec, do you honestly feel like this is what gets you out of those 70-hour weeks?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean pace, one sharp question that reframes $9k as ROI by pointing directly at the confirmed 70-hour-week anchor — no fabricated specifics, no AI wind-up.</sub>
- **PA** (20/20): Yeah, I hear you — and money aside for a sec, do you honestly feel like this can get you out of the 70-hour weeks and off every job site?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook price-to-value pivot — sidesteps the expense frame and forces Andre to self-qualify against his exact confirmed pain (70-hour weeks, every job site), delivered in natural closer cadence with no fabricated specifics.</sub>

### #3 — "I don't have the money"  _(affordability)_

- **V1** (20/20): Priya, I hear you — and I believe you. So let me ask: is it that $9k isn't there right now, or is it that the full amount upfront doesn't work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean, human, respects her genuine constraint and opens a payment-structure path without reframing away her real cash problem — exactly the right move given the ground truth.</sub>
- **P** (20/20): Priya, I hear you — and I believe you. So let me ask: is it that $9k doesn't exist, or is it that you can't hand it over all at once right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Respectful, human, and surgically precise — acknowledges the real constraint without dismissing it, then opens the one door (lump sum vs. access) that actually moves the conversation forward without a slick reframe.</sub>
- **PA** (19/20): I hear you, Priya — and I believe you. Before we talk numbers, can I ask you something honestly? If we could make it work financially, are you actually in?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Respects the real cash constraint without reframing it away, isolates commitment cleanly, and reads the genuine money objection correctly — but uses Priya's name without anchoring to any specific detail from her situation.</sub>

### #4 — "I need to talk to my business partner"  _(authority)_

- **V1** (20/20): Totally — and honestly I'd expect that. Real quick though: is this you saying Dave needs to sign off, or do you already know this is right and just want him in the loop?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real gate — distinguishes sign-off vs. loop-in using Dave's actual role from the ground truth, sounds completely human, one clean question, no wind-up.</sub>
- **P** (19/20): Yeah, totally — and that makes sense. Is this more you need his sign-off on the money, or you're actually already in and just want to loop him in?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Sharp question that isolates whether Dave is a true financial gate vs. a courtesy loop — perfectly anchored to the ground truth — but it stacks two sub-questions (sign-off vs. loop-in), nudging one_beat to 1 rather than 2.</sub>
- **PA** (16/20): Yeah, totally — and I respect that. Quick thing though: is this you genuinely needing Dave's input, or have you already kind of made up your mind and this is more of a heads-up conversation?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Smart move to probe whether Dave is a real gate or a rubber stamp, and tonality is solid, but it stacks two moves (respect + question) and misses the confirmed 'Dave runs finances / big spends we decide together' anchor that would've ground</sub>

### #5 — "I'm too busy"  _(time)_

- **V1** (20/20): Tom, being too slammed — that's literally the thing we're fixing. So doesn't that mean now's exactly when this has to happen?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Crisp reframe that uses his exact objection as the proof he needs the program — sounds natural, no fabrication, perfectly anchored to the 'too busy is the symptom' ground truth.</sub>
- **P** (17/20): Tom, I hear you — but being slammed IS the problem we're solving. So what if the reason you don't have time right now is exactly why you need to make time?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Solid reframe that lands the 'too busy is the symptom' truth directly, but it stacks a declarative reframe AND a rhetorical question rather than committing to one clean move.</sub>
- **PA** (20/20): Tom, being slammed IS the problem we're fixing — so what if the calls are actually what buys you your time back?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly reframes 'too busy' as proof of need, uses Tom's name naturally, ties to his exact pain, and lands one clean rhetorical question — nothing fabricated, nothing wasted.</sub>

### #6 — "What if it doesn't work for me?"  _(risk)_

- **V1** (20/20): Dana, you already get your clients results — that's not in question. Real talk, is it the program you doubt, or is it you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Locks onto the real weak belief (self-doubt vs. offer doubt), uses her confirmed proof point precisely, and delivers it in a clean, human two-sentence gut-punch with zero wind-up.</sub>
- **P** (20/20): Dana, I hear you — and that's worth sitting in for a sec. But you already get your clients results. Why are you the one person you don't trust?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the identity/self-belief objection with a single reframe anchored directly to her proven offline results, delivered in calm elite-closer cadence with no fabricated specifics.</sub>
- **PA** (17/20): Dana, I hear you — and that fear makes sense. But you already get your clients results. The thing that hasn't worked yet isn't your ability — it's you doing it alone. So what's really going on?
  <sub>tone 5 · brev 1 · 1-beat 0 · anchor 2 · belief 2 · no-windup 2 — Nails the identity reframe and uses her real proof point, but stacks two moves (reframe + closing question) and runs slightly long.</sub>

### #7 — "What makes you different?"  _(differentiation)_

- **V1** (19/20): Luis, the last two gave you theory, right? No one sat in the weeds with you. Here, it's literally the opposite — so what would've had to happen in those programs for you to still be at $25k right now?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Brilliantly anchored to his exact pain and flips it with a sharp question, but stacks two moves — a reframe ('literally the opposite') plus a question — making it one beat short of clean.</sub>
- **P** (19/20): Luis, can I be honest with you? The last two didn't fail because you picked bad programs — they failed because nobody actually got in the weeds with you. So tell me, what would 'different' actually have to look like?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Near-perfect — reframes the failure origin and ties directly to his 'all theory, no implementation' anchor, but stacks two moves (reframe + question) making it a one_beat deduction.</sub>
- **PA** (20/20): Honestly — can I flip that? You've done two programs. What specifically did they not do that left you stuck at 25k?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite move — flips the frame with a permission-ask, pins the exact confirmed anchors (two programs, $25k plateau), and forces Luis to self-articulate the gap rather than accepting a generic pitch.</sub>

### #8 — "Send me some information"  _(deflection)_

- **V1** (20/20): Yeah, of course — before I do, can I be honest with you for a sec? When you heard the investment, something shifted — what actually came up for you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated to Rachel's conflict-avoidant pattern — grants the request, earns permission, then pins the exact moment she cooled (price reveal) to surface the real objection, all in two clean sentences.</sub>
- **P** (20/20): Yeah, totally — I can do that. But Rachel, be honest with me, when you saw the investment just now, what went through your head?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly reads her conflict-avoidant pattern — pace-and-pivot directly to the price reveal signal — tight, human, and grounded in the exact moment the ground truth flags.</sub>
- **PA** (17/20): Yeah, totally — I can do that. But Rachel, be honest with me, what's really going on?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, human, and correctly diagnoses the polite-deflection pattern — but 'what's really going on' is generic when a sharper anchor to the price-reveal cooling moment was available.</sub>

### #9 — "I can do this myself"  _(diy)_

- **V1** (20/20): Kev, I know you could — genuinely. But you've started two plans on your own and didn't finish them. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook mirror-and-challenge: validates his pride, then lands the confirmed history of two abandoned plans as the reframe, closes with one surgical question — nothing invented, nothing wasted.</sub>
- **P** (20/20): Kev, I get it — and you probably could. But you've started two plans on your own and didn't finish them. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook closer move — validates the pride, then turns his own confirmed history into the reframe with a single tight question.</sub>
- **PA** (20/20): Kev, I get it — and you probably could. But you've put your head down on this twice already and didn't finish. So what's actually different this time?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to his two abandoned plans, one clean question challenges his belief without attacking his pride — reads exactly like an elite closer.</sub>

### #10 — "I've been burned before"  _(trust)_

- **V1** (20/20): Marie, that $20k — what did that person not do that you actually needed them to?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Sharp, human, single diagnostic question anchored directly to her $20k confirmed anchor — opens her to define the gap so the rep can differentiate, exactly the right move for a trust objection.</sub>
- **P** (20/20): Marie, that $20k — what did they not do that you actually needed them to?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Pinpoint use of her exact $20k anchor to open a diagnostic question that surfaces the trust gap without deflecting — textbook elite move.</sub>
- **PA** (20/20): Marie, that $20k — what did they not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly anchored to her exact $20k figure and opens a diagnostic question that attacks the trust gap directly — elite move, clean execution.</sub>

### #11 — "This sounds too good to be true"  _(skepticism)_

- **V1** (20/20): Yeah, I'd probably say the same thing. Sam, forget the numbers for a sec — do you actually believe what you're doing right now can get you to where you wanna be?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — validates the skepticism, sidesteps the shaky claim entirely, and pivots to a single question that exposes the real gap (his current path can't get him there), all in a natural closer voice.</sub>
- **P** (20/20): Yeah, fair — I'd think the same thing. But set that aside for a sec — do you honestly feel like what we talked about today could actually get you more time with your kids and off the tools?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook belief-gap close — paces his skepticism naturally, sidesteps the hype claim entirely, and redirects to his own confirmed emotional anchor (kids, off the tools) with a single commitment question.</sub>
- **PA** (20/20): Yeah, fair — I'd feel the same way. Set that aside for a sec though — do you honestly feel like what we talked about could actually get you more time with your kids?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — paces the skepticism naturally, sidesteps the unbelievable number entirely, and redirects to his confirmed emotional anchor (kids/time) with a single honest question that rebuilds belief from the inside out.</sub>

### #12 — "The timing isn't right"  _(timing)_

- **V1** (19/20): Bianca, totally — and can I be honest for a sec? The reason you're scared of Q4 is you don't have the systems yet. So what does waiting actually do for you?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Near-perfect line — human, direct, ties exactly to her real fear and the weakest link — slight ding on one_beat because it stacks a reframe AND a question, but they flow naturally enough to forgive.</sub>
- **P** (20/20): Bianca, I hear you — but isn't Q4 exactly why the timing is right? Going into your biggest season without the systems is the thing we're fixing.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — that waiting protects her — by flipping Q4 from a reason to delay into the reason to act now, using her own confirmed context with natural closer tonality.</sub>
- **PA** (20/20): Bianca, I hear you — but the reason timing feels off is Q4, right? So what if waiting on the systems is exactly what makes Q4 chaotic instead of big?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weakest-link reframe — waiting on systems is what creates the chaos she fears — using her own Q4 anchor, in natural closer voice, at the right length.</sub>

### #13 — "I need to talk to my spouse"  _(authority)_

- **V1** (19/20): Jordan, totally — and I'm not trying to skip that. Real quick though: in your gut, is this a 'yes and I wanna loop them in,' or are you genuinely not sure yet?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Nails the core diagnostic move — separates 'real gate' from 'courtesy loop-in' cleanly and in Jordan's own voice, but doesn't tie to any confirmed anchor (team, bottleneck, $22k) so anchored stays generic.</sub>
- **P** (16/20): Yeah, totally — and I respect that. But be honest with me: is this you wanting their blessing, or do you actually still have your own doubts?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Sharp question that correctly probes whether the spouse objection is a real gate or a proxy for doubt, but 'I respect that' + 'be honest with me' stacks two moves (a pace then a challenge) rather than landing one clean beat, and the line mi</sub>
- **PA** (18/20): Yeah, totally — and I respect that. Quick honest question though: is this you saying you genuinely need their blessing, or do you already know this is right and you're just looping them in?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Nails the real belief question (courtesy vs. real gate) and sounds like a genuine closer, but stacks a light pace + a reframe + a clarifying question, making it technically more than one beat.</sub>

### #14 — "I need to check with my accountant"  _(authority)_

- **V1** (20/20): Derek, totally — but real talk, is this actually an accounting decision, or is it yours to make?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — accountant is a logic gate, not the real decision-maker — in a sharp, direct, human-sounding question that a top closer would actually say.</sub>
- **P** (20/20): Yeah, totally — and I respect the process. But Derek, is this actually your accountant's call, or is it yours?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief — accountant as logic gate for his own emotional decision — in a clean, human, direct question with no fabrication.</sub>
- **PA** (19/20): Derek, you literally just said 9 grand isn't the issue — so is your accountant gonna change that, or is this more about making sure you're fully certain yourself?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real belief — accountant is a logic gate, not a real gate — and uses his own confirmed quote against him cleanly; docks one beat point for stacking the pace ('9 grand isn't the issue') and a binary question together, which is two </sub>

### #15 — "I tried something like this before and it didn't work"  _(trust)_

- **V1** (20/20): Alyssa, I hear you — and you actually mentioned you didn't fully implement it. So was it the program that didn't work, or did you just not have someone holding you accountable?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook anchor-and-reframe — uses Alyssa's own admission to redirect blame from the program to accountability, which is the exact gap in the ground truth, delivered in tight conversational language.</sub>
- **P** (20/20): Totally — and you mentioned you didn't really implement it. So was it the program, or was it having no one keeping you accountable to actually do the work?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Pins her own admission back on her cleanly, pivots to accountability as the real gap — exactly what the ground truth flags as the weakest link.</sub>
- **PA** (17/20): Yeah — and you actually said it yourself: you didn't really implement it. So what would have to be different this time for you to actually follow through?
  <sub>tone 4 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real gap (accountability/non-implementation) with her own words, but stacks two moves — the pace/reframe AND a follow-through question — making it slightly compound rather than a clean single beat.</sub>

### #16 — "Can you do a payment plan or a discount?"  _(price)_

- **V1** (19/20): Yeah, we can work with you on terms — so if we make the numbers work, we're doing this today?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean commitment loop — yes to terms, then locks the decision today; slightly generic but perfectly calibrated to a prospect who's already sold and just needs terms resolved.</sub>
- **P** (19/20): Yeah, Tony, we can work something out on terms — if we lock it in today, I can split it up for you. You good to move forward right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, natural closer move that correctly reads this as a terms conversation and drives to a decision without re-selling, though it doesn't tie back to Tony's specific 'step back from tools' anchor.</sub>
- **PA** (19/20): Yeah, totally — let's make it work. If I can get you on a payment plan that fits, you're ready to go today?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Clean, natural close that correctly reads this as a terms conversation and locks in commitment before discussing logistics — slightly generic but the move is exactly right.</sub>

### #17 — "I'm already working with a coach"  _(differentiation)_

- **V1** (20/20): Yeah, totally — and I'm not here to replace anyone. But Nina, you just told me things have kind of stalled. So honestly, is what you've got right now actually getting you to that next level?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the loyalty-guilt reframe by immediately pacing it ('not here to replace anyone') then pivoting straight to her own admission of stalling — clean, human, one move, zero fabrication.</sub>
- **P** (20/20): Yeah, totally — and I'm not here to talk you out of that. But you did say it's kind of stalled. So honestly, is it getting you to that next level?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook elite closer move — disarms loyalty guilt immediately, then pivots straight to her own confirmed quote ('kind of stalled') to let the objection collapse on itself with one clean question.</sub>
- **PA** (19/20): Yeah, totally — and I respect that. But Nina, you just told me you've kind of plateaued. So is it that you wanna stay loyal, or is it that it's actually still working?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the real tension (loyalty vs. results) using her exact words, but stacks two moves — a reframe plus a binary question — instead of landing on one clean beat.</sub>

### #18 — "Let me finish my current launch first"  _(timing)_

- **V1** (20/20): Greg, totally — but the reason this launch has you maxed is exactly what we're fixing. So what if this is what makes the next one bigger without burning you out?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe — the program is the fix for the maxed launch, not a competing demand — using Greg's own situation and his stated desire to scale without burnout, all in one crisp move.</sub>
- **P** (20/20): Greg, totally — but the reason you're maxed right now is exactly what we're fixing. What if this is what makes the next launch bigger, not one more thing on the list?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact reframe from ground truth almost verbatim — the program makes the launch bigger, not a competing task — delivered calmly and concisely with a natural pace opener.</sub>
- **PA** (20/20): Greg, I hear you — but can I be honest for a sec? The reason this launch feels maxing you out is the exact thing we're fixing. So what if the program is what makes the next launch bigger, not one more thing on your plate?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe from the ground truth almost verbatim, sounds fully human, stays tight, and ties directly to Greg's maxed-out launch pain — a clean, elite closer line.</sub>

### #19 — "I need to see proof or a guarantee"  _(risk)_

- **V1** (16/20): Carla, I get it — and can I be honest with you for a sec? The proof question I can answer, but the guarantee's really on you. So first — do you honestly feel like this can get you to bigger months without more hours?
  <sub>tone 4 · brev 1 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the trust/risk reframe by flipping certainty back to Carla and anchors her stated goal (bigger months, no more hours), but stacks two moves — the proof/guarantee split AND a closing question — making it slightly long and not a clean s</sub>
- **P** (20/20): Carla, I hear you — and honestly, good. So can I be real with you for a sec? The only thing a guarantee actually protects against is you not doing the work. Is that the part you're unsure about?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly reframes the guarantee objection back onto Carla's own agency, matches her risk-averse profile exactly, sounds fully human, and lands a single tight tie-down without any fabricated specifics.</sub>
- **PA** (19/20): Carla, totally fair — can I be honest with you for a sec? The guarantee is really whether YOU do the work. So honestly — do you feel like this can actually get you to that bigger month without more hours?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the trust/risk reframe by putting certainty back on Carla's control and ties to her exact goal, but stacks a reframe AND a closing question making it technically two moves.</sub>

### #20 — "The economy is too uncertain right now"  _(timing)_

- **V1** (14/20): Hassan, I hear you — but be honest with me, is it the economy, or is it just a scary decision?
  <sub>tone 3 · brev 2 · 1-beat 1 · anchor 1 · belief 2 · no-windup 2 — Correctly diagnoses fear dressed as logic and tonality is punchy, but 'be honest with me' + the either/or question stacks a mild challenge on top of a pace, and it misses the real anchor (competitors pulling back) that would have made it la</sub>
- **P** (20/20): Hassan, I hear you — but can I be honest for a sec? When things get uncertain, what do you think your competitors are doing right now?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the ground truth gap anchor (competitors pulling back) with a clean Socratic question, natural human pace, and zero fabrication.</sub>
- **PA** (20/20): Yeah, I hear you — can I be honest for a sec? Every competitor you have is pulling back right now. So what happens to your slice if you're the one who doesn't?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief (fear dressed as macro logic) using the confirmed gap anchor (competitors pull back in downturns), sounds fully human, one clean reframe question — nothing fabricated or shaky.</sub>

### #21 — "I want to do more research and compare options"  _(stall)_

- **V1** (20/20): Beth, can I be honest? You've been researching this same problem for a year. At what point does more research become the thing that's keeping you stuck?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Hits the exact weak belief (research-as-avoidance), uses her confirmed one-year anchor, lands a single reframe question — textbook elite closer execution.</sub>
- **P** (20/20): Beth, can I be honest with you for a sec? You've been researching this same problem for a year. At what point does more research become the reason it doesn't get solved?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly mirrors the ground truth anchor ('researching this same problem for a year'), lands the exact reframe Beth needs, tonally sounds like a top closer, and the permission-ask opener is textbook elite technique.</sub>
- **PA** (20/20): Beth, I hear you — but you told me you've been researching this same problem for a year. So at what point does more research become the thing that's keeping you stuck?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core weak belief (research IS the avoidance) with her exact anchor ('researching this same problem for a year'), lands as one clean reframe-question, and sounds exactly like a composed elite closer.</sub>

### #22 — "I've already spent a lot on this kind of thing"  _(money)_

- **V1** (20/20): Yeah, I hear you — and honestly, what do you think made those not stick? Because from what you told me, it wasn't the info you were missing.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly bridges the sunk-cost objection back to Omar's own admission about implementation, using his exact anchor to reframe without stating any unconfirmed specifics.</sub>
- **P** (20/20): Yeah, I hear you — and be honest with me, was it the info that was missing, or was it someone actually holding you accountable to use it?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly reframes the sunk-cost objection by isolating the exact missing ingredient — accountability — using Omar's own history without stating any shaky figures.</sub>
- **PA** (16/20): Yeah, I hear you — and that's exactly why I wanna ask: what did those things not give you that you actually needed?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 1 · belief 1 · no-windup 2 — Solid human tone and one clean question, but the question opens a discovery loop rather than reframing toward the known answer (accountability), missing a chance to tie directly to Omar's confirmed gap.</sub>

### #23 — "My niche is unique — a general program won't fit"  _(skepticism)_

- **V1** (20/20): Yeah, totally — can I be honest with you for a sec? The bottleneck you described, everything running through you, no systems — that's got nothing to do with medical billing. Does that resonate?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (bottleneck is universal, not niche-specific), echoes her own language, stays tight, and closes with a natural tie-down — textbook elite closer move.</sub>
- **P** (20/20): Sofia, can I be honest with you for a sec? The bottleneck, no systems, can't scale — that's not a medical-billing problem. So what makes you feel like that part's different?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (bottleneck is universal, not niche-specific), uses her real pain verbatim, lands a single reframe-question, and the opener is a classic closer permission-ask — clean and elite.</sub>
- **PA** (20/20): Sofia, can I be honest with you for a sec? The bottleneck you described — you're the one doing everything, no systems — that's not a medical-billing problem. That's the same thing we fix in every business. Does that land?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief (industry-specific vs universal bottleneck), uses a real anchor from the call, permission-ask opener is textbook closer technique, and stays in one clean move.</sub>

### #24 — "I don't want to be locked into a contract"  _(risk)_

- **V1** (19/20): Yeah, I get it — and can I be honest with you for a sec? The reason it's six months is because 30 days doesn't actually fix what's keeping you capped. So does the timeline feel wrong, or is it more like you're not sure it'll work?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Near-perfect — nails the real fear (trapped if it doesn't work) and the six-month reframe with a real anchor ('capped'), but the closing double-question is technically two moves, costing one beat point.</sub>
- **P** (20/20): Trent, I get it — can I be honest with you for a sec? The reason you're scared of being locked in is the same reason 30 days doesn't work. Real change takes time — you know that from training clients.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the core reframe — commitment-shy fear is recast as proof six months matters — and the fitness analogy grounds it in Trent's own world without inventing any facts.</sub>
- **PA** (18/20): Yeah, I get it — nobody wants to be stuck in something that doesn't work. But real talk, Trent — do you honestly feel like this is something that can get you past where you're at right now?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real fear ('stuck in something that doesn't work' mirrors his exact anchor), pivots with a single commitment-testing question, stays brief and conversational — solid elite-closer move.</sub>

### #25 — "I want to but I'm scared to invest right now"  _(affordability)_

- **V1** (19/20): Yeah — honestly, good. Means this actually matters to you. But Maya, you told me you can't go back to a 9-5. So what happens if you sit on this another 3 months?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Excellent anchoring to her exact quote and steady, human tone — docked one beat point because it stacks a reframe ('fear = caring') plus a future-pace question, making it two moves in one line.</sub>
- **P** (19/20): Yeah — that fear makes sense, and I'm not gonna talk you out of it. But scared of investing, or scared it won't work?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Honest, warm, and sharp — validates without slick reframing and splits the fear cleanly, though the closing question is technically two moves (pace + bifurcation), keeping one_beat at 1.</sub>
- **PA** (18/20): Yeah — and that fear makes sense. But Maya, what scares you more: investing now, or still being at $5k a month a year from now?
  <sub>tone 4 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Clean, calm, human — acknowledges the fear honestly then flips to consequence using her confirmed $5k anchor; no slick reframe, no fabricated specifics, one tight move.</sub>

### #26 — "I need to run it by my team"  _(authority)_

- **V1** (20/20): Victor, it's your company though — so is this you wanting their input, or are you not fully sure yourself yet?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the real issue — his avoidance pattern — by naming it directly and cleanly with a binary question, anchored to the confirmed 'it's his company' truth without fabricating anything.</sub>
- **P** (20/20): Victor, I hear you — but this is your company. Is this genuinely their call, or are you just not 100% sure yet yourself?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief — avoidance masking as process — ties directly to 'his company' anchor, clean one-move question, human and direct throughout.</sub>
- **PA** (20/20): Victor, it's your company though — so is this you wanting their input, or is this you wanting cover if it doesn't work out?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Surgically names the real behavior (seeking cover vs. genuine input) using his own anchors — direct, human, and exactly one move.</sub>

### #27 — "I'm just not sure I'm ready"  _(stall)_

- **V1** (19/20): Renee, honestly — nobody feels ready. The coaches who actually hit those bigger months? They started before they felt ready too. So what would 'ready' even look like for you?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief and uses real anchors naturally, but stacks a reframe plus a question — two moves instead of one.</sub>
- **P** (20/20): Renee, I hear you — but can I be honest? Nobody feels ready. The coaches who grow are just the ones who start before they do.
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the exact weak belief from ground truth almost verbatim, tonality is natural and elite, no fabrications, tight and punchy.</sub>
- **PA** (19/20): Renee, I hear you — and honestly, nobody ever does. The coaches who grow? They started before they felt ready too. So what would ready even look like for you?
  <sub>tone 5 · brev 2 · 1-beat 1 · anchor 2 · belief 2 · no-windup 2 — Nearly perfect — nails the core belief gap and her exact objection word-for-word, but stacks a reframe AND a question rather than landing on one clean move.</sub>

### #28 — "How do I know you're not just another guru?"  _(trust)_

- **V1** (20/20): Fair question — I'd ask the same thing. What did the last guy not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated to Reggie's cynicism — validates it without defensiveness, then flips control to him with one clean question that exposes the real gap; no numbers, no hype, no AI wind-up.</sub>
- **P** (20/20): Fair question. So tell me — what did the last guy not do that you actually needed?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook cynicism-disarm — flips the guru question back on Reggie with a single surgical question that surfaces his real standard without defending or pitching.</sub>
- **PA** (20/20): Reggie, fair — and I'd be asking the same thing. Honestly, what would a guru NOT do that you'd actually need to see here?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Textbook move — validates his cynicism, flips the frame back onto him with one clean question, no fabrications, perfectly calibrated to his trust/authority weak link.</sub>

### #29 — "I need to pray on it"  _(stall)_

- **V1** (20/20): Grace, I love that — and I'd expect nothing less from you. Before you go to prayer, is there anything else sitting in your heart that we haven't talked through yet?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly respects her faith identity, executes the exact instructed move (surface anything else holding her back), warm and human with zero AI wind-up.</sub>
- **P** (20/20): Grace, I love that — genuinely. And I'd expect nothing less from you. Can I ask though — is it the prayer, or is there something else underneath this that still doesn't feel settled?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly respects Grace's faith identity while executing the exact coached move — gently surfacing whether something else is holding her back — with warm, human tonality and no fabricated details.</sub>
- **PA** (20/20): Grace, I respect that — genuinely. And while you're praying on it, be honest with me: is it the prayer, or is there something else sitting in the back of your mind too?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Respects the faith anchor fully, stays brief and human, and executes exactly the 'gently surface whether anything else is holding her back' instruction with one clean question.</sub>

### #30 — "Money's really tight right now, but I want this"  _(affordability)_

- **V1** (19/20): Diego, I believe you — and I'm not gonna run some 'money's just a mindset' thing on you. You said you're done living job to job. So let's figure out what's actually workable right now — what does tight look like for you?
  <sub>tone 5 · brev 1 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Nails the honesty-first mandate, quotes his exact words, lands on one clean question — slightly over 25 words but earns the length.</sub>
- **P** (19/20): Diego, I hear you — and I'm not gonna dance around it. So let's figure out what's actually possible right now. What do you have to work with?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 1 · belief 2 · no-windup 2 — Honest, human, and correctly reads the real constraint — cash timing — without tricks or fabrication; loses one anchored point for not tying to a confirmed specific like the truck repair or 'done living job to job.'</sub>
- **PA** (20/20): I hear you, Diego — and I believe you. So let's be real: what does 'tight right now' actually look like for you?
  <sub>tone 5 · brev 2 · 1-beat 2 · anchor 2 · belief 2 · no-windup 2 — Perfectly calibrated — honest, human, uses Diego's name, leans into the ground truth directive to be real rather than trick him, and opens the cash-timing constraint with one clean diagnostic question.</sub>
