/**
 * dig-eval-corpus.mjs — fixtures for the ↓ Dig Deeper card eval (4a.1 single-shot).
 *
 * Each fixture is a Belief Ladder state (the LIVE CALL MEMORY the card reads) + the recent
 * transcript, plus what the card SHOULD do. Covers every case from the Phase 4a plan:
 *   - belief-gap scan picks the RIGHT weakest belief
 *   - ⚠️ at-risk / ⬜ open / 🟡 partial targeting
 *   - all-locked & prospect-closing → take the close (return {belief:null, line:null})
 *   - only-Money-open → the money question
 *   - early call / no summary → a generic opener grounded only in the transcript
 *   - order-awareness: don't surface Money/Support while Pain is wide open early
 *
 * `context` is the belief ladder (or null for the early-call/no-summary case). It doubles as
 * the judge's ground truth, so fabrication (any specific the ladder doesn't support) is caught.
 */

export const SCENARIOS = [
  {
    id: 1,
    label: "gap-scan: pick Desire (⬜) over Money (⬜) — order-aware",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 12m · Syntax: problems-first
▸ THE GAP
  Current "hell":   inconsistent lead flow, ~$8k/mo, feast or famine
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "I never know where the next client's coming from"
  2 Doubt (can't DIY)    ✅ — "courses didn't move the needle for me"
  3 Cost (of inaction)   🟡 — stress mentioned, not quantified
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "I never know where the next client's coming from"
  • "feast or famine, every single month"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Desire (⬜) — pin the goal before quantifying the gap; then Cost (🟡)`,
    transcript: `Rep: So walk me through what's not working with the lead flow right now.
Prospect: Honestly it's just so inconsistent. One month I'll close three deals, the next month it's dead silent. I never know where the next client's coming from. It's exhausting.`,
    targetBelief: "Desire",
    forbidBeliefs: ["Money", "Support"], // order-aware: too early for these
  },
  {
    id: 2,
    label: "at-risk: Trust ⚠️ (got burned) — dig the burn",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Press · Elapsed: 20m · Syntax: problems-first
▸ THE GAP
  Current "hell":   plateaued at $15k/mo, can't break through
  Desired "heaven": $40k/mo · $GOAL 40000 · why that #: hire a team, stop doing everything
  Final straw / emotional why: "I'm burnt out doing it all myself"
  Core driver: Certainty
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "burnt out doing it all myself"
  2 Doubt (can't DIY)    ✅ — "I've plateaued, can't figure out the next level"
  3 Cost (of inaction)   ✅ — "another year like this and I'm done"
  4 Desire               ✅ — "$40k, hire a team"
  5 Money                🟡 — has budget, not confirmed ready
  6 Support (who decides) ✅ — sole decision-maker
  7 Trust (why you)      ⚠️ — "I paid $20k for a coach last year and got nothing"
▸ KEY ANCHORS (their exact words)
  • "I paid $20k for a coach last year and got nothing"
  • "burnt out doing it all myself"
▸ OPEN OBJECTIONS: skepticism from past coach — open
▸ WEAKEST LINK → Trust (⚠️) — surface what the last coach didn't do before anything else`,
    transcript: `Rep: You mentioned you worked with someone before.
Prospect: Yeah, dropped twenty grand on a coaching program last year. Total waste. Barely heard from the guy after I paid.`,
    targetBelief: "Trust",
    forbidBeliefs: [],
  },
  {
    id: 3,
    label: "open belief, minimal facts — opening question, ZERO fabrication",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 6m · Syntax: —
▸ THE GAP
  Current "hell":   —
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 🟡 — "things could be better" (vague)
  2 Doubt (can't DIY)    ⬜ — not discussed
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "things could be better"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain (🟡) — it's soft and vague; sharpen the real problem before moving on`,
    transcript: `Rep: How's business going overall?
Prospect: I mean, it's alright. Things could be better, honestly. Not where I want to be.`,
    targetBelief: "Pain",
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 4,
    label: "partial Pain (softened) — chunk DOWN, go to the worst part",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 10m · Syntax: problems-first
▸ THE GAP
  Current "hell":   cash flow tight, but "managing"
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 🟡 — "things are tight, but we're managing" — not fully owned
  2 Doubt (can't DIY)    ⚠️ — "I've been doing this seven years" (thinks he can figure it out)
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "things are tight, but we're managing"
  • "I've been doing this seven years"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain (🟡) — softened; get him to own the real cost before Doubt`,
    transcript: `Rep: You said cash flow's been tight.
Prospect: Yeah, I mean, things are tight but we're managing. Been doing this seven years, we always figure it out.`,
    targetBelief: "Pain",
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 5,
    label: "ALL LOCKED — take the close, do not dig",
    expect: "takeClose",
    context: `LIVE CALL MEMORY
Stage: Confirm · Elapsed: 28m · Syntax: problems-first
▸ THE GAP
  Current "hell":   $15k/mo, stuck, doing everything solo
  Desired "heaven": $50k/mo · $GOAL 50000 · why that #: buy back his time, hire a team
  Final straw / emotional why: "missed my kid's recital for a client call"
  Core driver: Significance
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "missed my kid's recital"
  2 Doubt (can't DIY)    ✅ — "I've tried on my own for two years"
  3 Cost (of inaction)   ✅ — "another year of this isn't an option"
  4 Desire               ✅ — "$50k, get my time back"
  5 Money                ✅ — "I've got the budget set aside"
  6 Support (who decides) ✅ — "it's just my call"
  7 Trust (why you)      ✅ — "this is exactly the structure I've been missing"
▸ KEY ANCHORS (their exact words)
  • "this is exactly the structure I've been missing"
  • "I've got the budget set aside"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → all beliefs locked — ready to close`,
    transcript: `Rep: So that's how the program works end to end.
Prospect: Man, this is exactly what I've been missing. This makes so much sense. I'm in — what do we need to do?`,
    targetBelief: null,
    forbidBeliefs: [],
  },
  {
    id: 6,
    label: "prospect closing themselves — take the close even if 1 belief soft",
    expect: "takeClose",
    context: `LIVE CALL MEMORY
Stage: Confirm · Elapsed: 25m · Syntax: goals-first
▸ THE GAP
  Current "hell":   $12k/mo, capped out on time
  Desired "heaven": $30k/mo · $GOAL 30000 · why that #: replace the day job, go full time
  Final straw / emotional why: "I'm done being stuck"
  Core driver: Certainty
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "capped out, can't grow past $12k on my own"
  2 Doubt (can't DIY)    ✅ — "clearly what I'm doing isn't enough"
  3 Cost (of inaction)   ✅ — "I'm done being stuck"
  4 Desire               ✅ — "$30k, go full time"
  5 Money                🟡 — hasn't confirmed budget, but no resistance
  6 Support (who decides) ✅ — sole decision-maker
  7 Trust (why you)      ✅ — "you get it, this is the right fit"
▸ KEY ANCHORS (their exact words)
  • "you get it, this is the right fit"
  • "I'm done being stuck"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Money (🟡) — only soft spot, and prospect is signaling ready`,
    transcript: `Rep: So does this feel like the right path for you?
Prospect: Honestly, yeah. You get it, this is the right fit. I don't want to keep spinning my wheels — how do we get started?`,
    targetBelief: null,
    forbidBeliefs: [],
  },
  {
    id: 7,
    label: "only Money open — the money qualifier, pre-framed",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Confirm · Elapsed: 26m · Syntax: problems-first
▸ THE GAP
  Current "hell":   $20k/mo, stalled, no systems
  Desired "heaven": $60k/mo · $GOAL 60000 · why that #: scale without burning out
  Final straw / emotional why: "I can't keep working 70-hour weeks"
  Core driver: Growth
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "70-hour weeks, no systems"
  2 Doubt (can't DIY)    ✅ — "I've hit a ceiling I can't break alone"
  3 Cost (of inaction)   ✅ — "I'll burn out if nothing changes"
  4 Desire               ✅ — "$60k without the grind"
  5 Money                ⬜ — not discussed at all
  6 Support (who decides) ✅ — "just me"
  7 Trust (why you)      ✅ — "this is the system I've been missing"
▸ KEY ANCHORS (their exact words)
  • "I can't keep working 70-hour weeks"
  • "this is the system I've been missing"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Money (⬜) — last belief; qualify readiness to invest`,
    transcript: `Rep: So the structure covers the systems piece you're missing.
Prospect: Yeah, that's exactly it. That's the part I could never build on my own.`,
    targetBelief: "Money",
    forbidBeliefs: [],
  },
  {
    id: 8,
    label: "early call / NO summary — generic opener, no fabrication",
    expect: "question",
    context: null, // no belief ladder yet (first ~2 min of the call)
    transcript: `Rep: Appreciate you hopping on. So tell me a bit about your business — what do you do?
Prospect: Yeah, of course. So I run a small marketing agency, been going about three years. We help local businesses with ads mostly.`,
    targetBelief: null, // any solid opening discovery question is fine; judge grades quality
    earlyCall: true,
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 9,
    label: "order-awareness: Pain wide open, early — must NOT jump to Money/Support",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 5m · Syntax: —
▸ THE GAP
  Current "hell":   —
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ⬜ — not surfaced yet
  2 Doubt (can't DIY)    ⬜ — not discussed
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • (none captured yet)
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain (⬜) — nothing surfaced yet; find the problem first`,
    transcript: `Rep: So what made you book this call?
Prospect: I saw one of your posts and figured I'd reach out. Things are okay but I feel like I could be doing a lot more.`,
    targetBelief: "Pain",
    forbidBeliefs: ["Money", "Support", "Trust"],
  },
  {
    id: 10,
    label: "partial Desire (no number) — dig for the number + why",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 14m · Syntax: goals-first
▸ THE GAP
  Current "hell":   $10k/mo, inconsistent
  Desired "heaven": "grow, make more" (vague) · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "inconsistent, stuck at $10k"
  2 Doubt (can't DIY)    🟡 — hinted, not owned
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               🟡 — "I want to grow, make more" — no number, no why
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "I want to grow, make more"
  • "stuck at ten grand a month"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Desire (🟡) — no number and no why; pin the real target`,
    transcript: `Rep: So where do you want this to go?
Prospect: I just want to grow, you know? Make more, get past where I'm stuck.`,
    targetBelief: "Desire",
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 11,
    label: "Cost of inaction open — quantify the cost of staying stuck",
    expect: "question",
    context: `LIVE CALL MEMORY
Stage: Press · Elapsed: 18m · Syntax: problems-first
▸ THE GAP
  Current "hell":   $18k/mo, plateaued 18 months
  Desired "heaven": $45k/mo · $GOAL 45000 · why that #: buy a house, more freedom
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "plateaued 18 months, can't break through"
  2 Doubt (can't DIY)    ✅ — "I've tried everything I know"
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ✅ — "$45k, buy a house"
  5 Money                ⬜ — not discussed
  6 Support (who decides) ✅ — sole decision-maker
  7 Trust (why you)      🟡 — warming up
▸ KEY ANCHORS (their exact words)
  • "plateaued for a year and a half"
  • "$45k would let us finally buy a house"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Cost (⬜) — build urgency: what staying stuck actually costs`,
    transcript: `Rep: 18 months at the same level — that's a while.
Prospect: Yeah, it's frustrating. I know I'm capable of more, I just can't seem to get over the hump.`,
    targetBelief: "Cost",
    forbidBeliefs: ["Money", "Support"],
  },

  // ═══ Phase 1b — offer-aware fixtures (Sales DNA present) ═══════════════════
  // salesDna is the REP's saved offer context (averages) — never the prospect's
  // words. The judge sees it labeled that way, so any question asserting a DNA
  // specific as the prospect's is graded as fabrication.
  {
    id: 12,
    label: "OFFER-AWARE root-driver chunk-down: 'quit my job' → the cash-flow number",
    expect: "question",
    salesDna: {
      transformation: "People go from stuck at a W2 to doing land deals full-time",
      root_driver: "A monthly cash-flow number that replaces their job income",
      emotional_root: "Freedom — being their own boss, owning their time",
      guarantee: "Full refund if you don't close a deal in 120 days",
      syntax: "problems",
      pain: "Grinding at a job they hate, side-hustle going nowhere",
      desire: "'Quit my job', 'be free', 'do this full-time' — it all comes down to a monthly cash-flow number that replaces the paycheck",
      cost: "Another year at the W2, watching deals go to people who started later",
      doubt: "Bought courses, watched YouTube, never did a deal — no one in their corner",
      trust: "We walk the first deal WITH them, not theory",
      money: "I ask if they have money set aside to invest in themselves",
      support: "Often a spouse — I surface it early",
    },
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 11m · Syntax: problems-first
▸ THE GAP
  Current "hell":   hates the W2, side-hustle stalled
  Desired "heaven": "quit my job" (vague) · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 ✅ — "I dread Monday mornings, every single week"
  2 Doubt (can't DIY)    🟡 — hinted at stalled self-efforts
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               🟡 — "I just want to quit my job" — no number, no why, nothing underneath
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "I dread Monday mornings, every single week"
  • "I just want to quit my job"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Desire (🟡) — "quit my job" is surface; chunk down to what it really means`,
    transcript: `Rep: So if this works the way you want, what does it actually look like?
Prospect: Honestly? I just want to quit my job. That's the whole dream.`,
    // The offer-aware win: a generic card asks "what's the goal?" — the DNA-aware card
    // chunks "quit my job" DOWN toward what it must mean for THIS offer (the monthly
    // number that replaces the paycheck) WITHOUT asserting any number for them.
    targetBelief: "Desire",
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 13,
    label: "FABRICATION TRAP: DNA is full of numbers the prospect never said",
    expect: "question",
    salesDna: {
      transformation: "Agency owners go from founder-led sales to a closing team",
      root_driver: "Getting the founder OUT of the sales seat — typically at $30k/mo and up",
      emotional_root: "Getting their life back from the calendar",
      guarantee: "We don't offer a formal guarantee.",
      syntax: "goals",
      pain: "Founder is the only closer; growth is capped at their calendar — most come in around $25-35k/mo",
      desire: "'Scale to $100k months' is the common phrasing — it comes down to a team that closes without them",
      cost: "Typically $40k+ per quarter in deals they can't take",
      doubt: "Tried hiring one closer before, churned them in 60 days",
      trust: "We recruit, train, AND manage the first closer with them",
      money: "They're already spending $5-10k/mo on ads, so budget exists",
      support: "Usually a co-founder",
    },
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 9m · Syntax: goals-first
▸ THE GAP
  Current "hell":   founder does all the sales calls himself
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 🟡 — "my calendar is just calls, back to back" — not yet costed
  2 Doubt (can't DIY)    ⬜ — not discussed
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "my calendar is just calls, back to back"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain (🟡) — owned lightly; what is it actually costing him?`,
    transcript: `Rep: So walk me through a normal week for you.
Prospect: It's just calls, man. My calendar is just calls, back to back. I haven't touched the actual product side in months.`,
    // The trap: the DNA carries $30k/mo, $25-35k/mo, $100k, $40k/quarter, $5-10k ads —
    // NONE of it said by this prospect. A question like "so you're at around $30k a month,
    // right?" is the exact fabrication the fence must stop. The judge sees the DNA labeled
    // as rep context and flags any DNA specific asserted as the prospect's.
    targetBelief: "Pain",
    forbidBeliefs: ["Money", "Support"],
  },
  {
    id: 14,
    label: "OFFER-AWARE regression guard: order discipline holds with DNA present",
    expect: "question",
    salesDna: {
      transformation: "Coaches go from referral-only to a predictable client pipeline",
      root_driver: "A repeatable weekly flow of qualified sales calls",
      emotional_root: "Certainty — knowing next month is already handled",
      guarantee: "90-day results guarantee",
      syntax: "problems",
      pain: "Feast-or-famine months, everything depends on referrals",
      desire: "'Consistent $20k months' is common — it comes down to predictable call volume",
      cost: "Sliding back to a job, burning savings in slow months",
      doubt: "Posted content for a year, nothing compounded",
      trust: "We install the system and run the first campaigns together",
      money: "I ask what they invested in growth in the last 12 months",
      support: "Usually solo deciders",
    },
    context: `LIVE CALL MEMORY
Stage: Discovery · Elapsed: 7m · Syntax: problems-first
▸ THE GAP
  Current "hell":   referral-dependent, unpredictable months
  Desired "heaven": — · $GOAL — · why that #: —
  Final straw / emotional why: —
  Core driver: —
▸ BELIEF LADDER  (✅ locked · 🟡 partial · ⬜ open · ⚠️ objected)
  1 Pain                 🟡 — "some months are great, some are dead" — not yet owned
  2 Doubt (can't DIY)    ⬜ — not discussed
  3 Cost (of inaction)   ⬜ — not discussed
  4 Desire               ⬜ — not discussed
  5 Money                ⬜ — not discussed
  6 Support (who decides) ⬜ — not discussed
  7 Trust (why you)      ⬜ — not discussed
▸ KEY ANCHORS (their exact words)
  • "some months are great, some are dead"
▸ OPEN OBJECTIONS: none
▸ WEAKEST LINK → Pain (🟡) — lightly owned; make the inconsistency real before anything else`,
    transcript: `Rep: How's the client flow been this quarter?
Prospect: Up and down honestly. Some months are great, some are dead. It all depends on who refers me.`,
    // Regression guard: the DNA mentions money-qualification and a $20k figure — the card
    // must STILL respect order (Pain is 🟡, call is early: no Money/Support questions) and
    // must not import the $20k. DNA context never overrides the order doctrine.
    targetBelief: "Pain",
    forbidBeliefs: ["Money", "Support"],
  },
];
