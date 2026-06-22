/**
 * kb-ab-corpus.mjs — the objection test set for the KB A/B test (v2: WITH context).
 *
 * 12 distinct high-ticket objections. Each now carries a realistic `context` — the
 * discovery the rep already ran (decision-maker status, the money reveal, the pain,
 * the emotional anchor, the weakest link). This is fed to EVERY arm as the live
 * call summary, exactly the way production feeds the Belief Ladder to the card
 * generator. Without it, every card is generic and impossible to grade "yes, that's
 * what I'd say" (Sebastian, 2026-06-15).
 *
 * `context`    = the discovery summary (stands in for live_summary / Belief Ladder).
 * `transcript` = the moment itself — the recent exchange ending at the objection.
 * `objection`  = verbatim label used in the results breakdown.
 *
 * Same offer across all: a ~$9,000, six-month business-growth coaching program
 * (weekly coaching + community). Different prospect per scenario for texture.
 *
 * TWEAK FREELY — if a context feels unrealistic, fix it and re-run the harness.
 */

export const OFFER =
  "A ~$9,000, six-month business-growth coaching program (weekly group coaching + 1:1 + community).";

export const SCENARIOS = [
  {
    id: 1,
    category: "stall",
    objection: "I need to think about it",
    context:
      "Prospect: Jenna, solo bookkeeper, ~$6k/mo, turning away clients because she's maxed on hours.\n" +
      "Pain uncovered: no systems to delegate; tried one contractor, micromanaged it, gave up.\n" +
      "Money: she has the $9k saved — said plainly \"money's not really the issue.\"\n" +
      "Decision: solo, entirely her call.\n" +
      "Emotion: comfortable but stuck; scared to take her hands off the wheel.\n" +
      "Wants: $20k/mo and an actual team.\n" +
      "Weakest link: she believes it would work and can afford it — the stall is fear of change, not money or logistics.",
    transcript:
      "Rep: So that's the full program — six months, weekly coaching, the system to build your team. I think you're exactly who this is for. Want to get started today?\n" +
      "Prospect: It does sound right for me... I think I just need to sit with it and think about it for a bit.",
  },
  {
    id: 2,
    category: "price",
    objection: "It's too expensive",
    context:
      "Prospect: Andre, owns a 4-person landscaping company, ~$30k/mo, plateaued two years.\n" +
      "Pain uncovered: 70-hour weeks; every job needs him; no time to grow.\n" +
      "Money: flinched at $9k — but mentioned they just put $15k into new equipment.\n" +
      "Decision: his call.\n" +
      "Emotion: proud, frustrated, a little skeptical of \"coaching.\"\n" +
      "Wants: step back, $50k/mo, a manager running jobs.\n" +
      "Weakest link: he's framing $9k as an expense, not ROI — hasn't connected it to the cost of two more years stuck at 70-hour weeks.",
    transcript:
      "Rep: The investment is $9,000 for the six months, everything included.\n" +
      "Prospect: Yeah... that's a lot of money. Honestly that's more than I pictured — it feels too expensive right now.",
  },
  {
    id: 3,
    category: "affordability",
    objection: "I don't have the money",
    context:
      "Prospect: Priya, went full-time as a coach 4 months ago, ~$3k/mo, feast-or-famine.\n" +
      "Pain uncovered: inconsistent leads; no system; savings draining month over month.\n" +
      "Money: genuinely tight — she was honest that $9k would be a real stretch right now. This is NOT a smokescreen.\n" +
      "Decision: her call (single).\n" +
      "Emotion: anxious, determined, a touch desperate.\n" +
      "Wants: replace her old $7k/mo salary.\n" +
      "Weakest link: a real cash constraint. The honest question is whether there's a path (entry point / plan) and whether the urgency justifies a stretch — NOT a slick value reframe that ignores her reality.",
    transcript:
      "Rep: With everything you've told me, this is the thing that gets you unstuck. It's $9,000 for the six months.\n" +
      "Prospect: I want to, I really do — but I genuinely don't have the money right now. Cash is really tight.",
  },
  {
    id: 4,
    category: "authority",
    objection: "I need to talk to my business partner",
    context:
      "Prospect: Marcus, co-owns a 6-person marketing agency with his partner Dave.\n" +
      "Pain uncovered: lead flow is inconsistent; stuck at ~$40k/mo for a year; a sales VA hire failed.\n" +
      "Money: confirmed $9k is affordable — he said budget isn't the blocker.\n" +
      "Decision: earlier he said \"big spends, Dave and I decide together\"; Dave runs the finances.\n" +
      "Emotion: frustrated and a little embarrassed about being stuck.\n" +
      "Wants: $100k/mo and to step back from delivery.\n" +
      "Weakest link: Marcus is sold; Dave is a real gate who's never been on a call — this is a genuine approval step, not a brush-off.",
    transcript:
      "Rep: Sounds like this solves exactly what you've been stuck on. Want to move forward?\n" +
      "Prospect: I do, yeah. The thing is I can't pull the trigger alone — I need to talk to my business partner Dave first.",
  },
  {
    id: 5,
    category: "time",
    objection: "I'm too busy",
    context:
      "Prospect: Tom, owns an HVAC business, ~$60k/mo, 8 employees.\n" +
      "Pain uncovered: drowning in day-to-day ops; growth stalled; tried delegating, things broke, he took it all back.\n" +
      "Money: didn't flinch at $9k — affordability is fine.\n" +
      "Decision: his call.\n" +
      "Emotion: overwhelmed, exhausted, skeptical he can add one more thing.\n" +
      "Wants: out of the day-to-day, the business running without him.\n" +
      "Weakest link: \"too busy\" is the symptom of the exact problem the program fixes. He hasn't seen that this buys time back rather than costing it.",
    transcript:
      "Rep: We can get you started this week — first call's Thursday.\n" +
      "Prospect: That's exactly my problem though. I'm slammed, I'm too busy — I don't know how I'd fit the calls in.",
  },
  {
    id: 6,
    category: "risk",
    objection: "What if it doesn't work for me?",
    context:
      "Prospect: Dana, fitness coach, ~$8k/mo trading time for money, burning out.\n" +
      "Pain uncovered: capped by hours; tried a cheap course, never implemented it.\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: self-doubt — she believes in the program, doubts herself.\n" +
      "Wants: $25k/mo and location freedom.\n" +
      "Weakest link: the objection is identity/self-belief, not the offer. She already gets clients results offline — capability isn't in question, her self-image is.",
    transcript:
      "Rep: This is built for exactly where you are. Shall we get you enrolled?\n" +
      "Prospect: My worry is... what if it doesn't work for me? I've seen it work for other people, but maybe I'm the exception.",
  },
  {
    id: 7,
    category: "differentiation",
    objection: "What makes you different?",
    context:
      "Prospect: Luis, e-commerce store owner, ~$25k/mo, wants to scale ads and ops.\n" +
      "Pain uncovered: plateaued; did two other coaching programs that were \"all theory, no implementation.\"\n" +
      "Money: fine.\n" +
      "Decision: his.\n" +
      "Emotion: skeptical, guarded, burned by generic gurus.\n" +
      "Wants: $75k/mo.\n" +
      "Weakest link: he's comparing. A real answer ties the difference to why the last two failed him — implementation and accountability — not a generic feature list.",
    transcript:
      "Rep: I really do think this is the right move for you.\n" +
      "Prospect: Maybe. But there are a million of these programs. What actually makes you different from everyone else?",
  },
  {
    id: 8,
    category: "deflection",
    objection: "Send me some information",
    context:
      "Prospect: Rachel, agency owner, ~$35k/mo. Warm and interested through the call.\n" +
      "Pain uncovered: hiring/retention chaos; churn eating her growth; tried an SOP course.\n" +
      "Money: affordable for her.\n" +
      "Decision: hers.\n" +
      "Emotion: conflict-avoidant — uses politeness to avoid saying no directly. She cooled noticeably right after the price reveal.\n" +
      "Wants: $75k/mo without the people-chaos.\n" +
      "Weakest link: \"send me info\" is cover. A real concern (most likely price or uncertainty) surfaced at the reveal and she's retreating behind materials rather than naming it.",
    transcript:
      "Rep: So should we get you signed up today?\n" +
      "Prospect: Can you just send me some information to look over? I'll go through it and circle back.",
  },
  {
    id: 9,
    category: "diy",
    objection: "I can do this myself",
    context:
      "Prospect: Kev, sharp technical founder, ~$20k/mo, loves figuring things out himself.\n" +
      "Pain uncovered: he knows what to do, he just doesn't do it — gets distracted building, no accountability. Started and abandoned two self-directed plans.\n" +
      "Money: fine.\n" +
      "Decision: his.\n" +
      "Emotion: pride / independence.\n" +
      "Wants: $60k/mo.\n" +
      "Weakest link: he genuinely could learn it — but his own history (abandoned plans) proves self-directed hasn't worked. The gap is accountability and speed, not knowledge.",
    transcript:
      "Rep: This program shortcuts all of that for you.\n" +
      "Prospect: I hear you, but honestly I feel like I could just do this myself if I put my head down. Why pay for it?",
  },
  {
    id: 10,
    category: "trust",
    objection: "I've been burned before",
    context:
      "Prospect: Marie, owns two salons, ~$45k/mo, wants location #3.\n" +
      "Pain uncovered: expansion stalled; cash flow gets scary at scale.\n" +
      "Money: can afford it, but gun-shy.\n" +
      "Decision: hers.\n" +
      "Emotion: distrust and fear of repeating a mistake — she paid a $20k \"business mentor\" last year who overpromised and ghosted her.\n" +
      "Wants: open location #3 without the cash-flow terror.\n" +
      "Weakest link: trust. She believes she needs help but is scared of being burned again. Needs specific de-risking (proof, guarantee, a small first step) anchored to that $20k experience — not a generic \"I understand.\"",
    transcript:
      "Rep: I really think we can help you get there. Want to move forward?\n" +
      "Prospect: I'll be honest with you — I've been burned before. Paid a lot for a program that left me hanging. I'm cautious now.",
  },
  {
    id: 11,
    category: "skepticism",
    objection: "This sounds too good to be true",
    context:
      "Prospect: Sam, trades business owner, ~$30k/mo, a grinder who distrusts \"online stuff.\"\n" +
      "Pain uncovered: capped, no systems, running himself ragged; hasn't tried anything structured.\n" +
      "Money: fine.\n" +
      "Decision: his.\n" +
      "Emotion: flat disbelief — the result sounds like hype to him.\n" +
      "Wants: $60k/mo and more time with his kids.\n" +
      "Weakest link: the outcome claim outran his belief. He doesn't believe the result is realistic for HIM specifically. Needs the claim grounded in mechanism + proof for someone like him — and the pressure taken off — not more selling.",
    transcript:
      "Rep: So that's genuinely what's possible for you in the next six months.\n" +
      "Prospect: Honestly? That sounds too good to be true. What's the catch?",
  },
  {
    id: 12,
    category: "timing",
    objection: "The timing isn't right",
    context:
      "Prospect: Bianca, e-commerce, ~$18k/mo, with a busy Q4 season approaching.\n" +
      "Pain uncovered: plateaued; knows she needs systems before she can scale; has been winging it.\n" +
      "Money: fine.\n" +
      "Decision: hers.\n" +
      "Emotion: anxious about adding load before Q4 — but also afraid of missing the window.\n" +
      "Wants: $50k/mo.\n" +
      "Weakest link: she thinks she should wait until after the busy season, but the program is exactly what makes that season profitable instead of chaotic. \"Later\" costs her the very season she's worried about — she hasn't seen that yet.",
    transcript:
      "Rep: So — ready to get going?\n" +
      "Prospect: I love it, I do. I just feel like the timing isn't right to start something this big right now.",
  },
];
