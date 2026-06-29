/**
 * objection-eval-corpus.mjs — 30 context-rich objection scenarios for the eval.
 *
 * Each scenario carries:
 *   context    — the discovery summary (stands in for live_summary / Belief Ladder).
 *   transcript — the moment itself, the recent exchange ending at the objection.
 *   objection  — verbatim label.
 *   anchors    — the structured anchor library arms C/D are fed. Each: { tag, text, conf? }
 *                conf = "confirmed" (said/echoed, safe to quote the number)
 *                     | "shaky"     (heard once / low confidence — NO digit stored, lean on meaning)
 *                     | undefined   (qualitative, no number)
 *
 * CONFIDENCE-GATED-AT-STORAGE (the 2026-06-28 catch #1 fix, applied here):
 *   A shaky number's DIGITS are NOT stored anywhere — not in context, not in anchors.
 *   We keep the meaning ("a much bigger month") but drop the figure, so a card physically
 *   cannot leak a wrong number (and the no-fabrication rule blocks inventing one).
 *   Confirmed numbers (current revenue, money-on-hand, a quoted past spend) ARE kept —
 *   those are the safe, powerful anchors.
 *
 * Same offer across all: a ~$9,000, six-month business-growth coaching program.
 * TWEAK FREELY — if a context/anchor feels unrealistic, fix it and re-run the eval.
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
      "Wants: $20k/mo and an actual team (she stated this clearly, twice).\n" +
      "Weakest link: she believes it would work and can afford it — the stall is fear of change.",
    transcript:
      "Rep: So that's the full program — six months, weekly coaching, the system to build your team. I think you're exactly who this is for. Want to get started today?\n" +
      "Prospect: It does sound right for me... I think I just need to sit with it and think about it for a bit.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 6 grand a month right now\"" },
      { tag: "goal", conf: "confirmed", text: "wants \"20k a month and an actual team\" (stated clearly, twice)" },
      { tag: "money", conf: "confirmed", text: "has the $9k saved — \"money's not really the issue\"" },
      { tag: "why", text: "comfortable but stuck; scared to take her hands off the wheel" },
      { tag: "history", text: "tried one contractor, micromanaged it, gave up" },
    ],
  },
  {
    id: 2,
    category: "price",
    objection: "It's too expensive",
    context:
      "Prospect: Andre, owns a 4-person landscaping company, ~$30k/mo, plateaued two years.\n" +
      "Pain uncovered: 70-hour weeks; every job needs him; no time to grow.\n" +
      "Money: flinched at $9k — also mentioned a recent equipment purchase (amount not confirmed).\n" +
      "Decision: his call.\n" +
      "Emotion: proud, frustrated, a little skeptical of \"coaching.\"\n" +
      "Wants: to step back, a much bigger month, a manager running jobs.\n" +
      "Weakest link: he's framing $9k as an expense, not ROI — hasn't connected it to the cost of two more years stuck at 70-hour weeks.",
    transcript:
      "Rep: The investment is $9,000 for the six months, everything included.\n" +
      "Prospect: Yeah... that's a lot of money. Honestly that's more than I pictured — it feels too expensive right now.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 30k a month, plateaued two years\"" },
      { tag: "pain", conf: "confirmed", text: "70-hour weeks; every job needs him" },
      { tag: "money", conf: "shaky", text: "mentioned a recent equipment purchase (amount heard once, not confirmed)" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month and a manager (figure not confirmed)" },
      { tag: "why", text: "wants to step back, stop being the bottleneck on every job" },
    ],
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
      "Wants: to replace her old salary (figure not confirmed).\n" +
      "Weakest link: a real cash constraint — NOT a value reframe that ignores her reality.",
    transcript:
      "Rep: With everything you've told me, this is the thing that gets you unstuck. It's $9,000 for the six months.\n" +
      "Prospect: I want to, I really do — but I genuinely don't have the money right now. Cash is really tight.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 3k a month, feast or famine\"" },
      { tag: "money", conf: "confirmed", text: "GENUINELY tight — $9k is a real stretch, not a smokescreen; respect it, no slick reframe" },
      { tag: "goal", conf: "shaky", text: "wants to replace her old salary (figure heard once, not confirmed)" },
      { tag: "why", text: "savings draining month over month; anxious and a little desperate" },
    ],
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
      "Wants: a much bigger month and to step back from delivery (figure not confirmed).\n" +
      "Weakest link: Marcus is sold; Dave is a real gate who's never been on a call.",
    transcript:
      "Rep: Sounds like this solves exactly what you've been stuck on. Want to move forward?\n" +
      "Prospect: I do, yeah. The thing is I can't pull the trigger alone — I need to talk to my business partner Dave first.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"stuck around 40k a month for a year\"" },
      { tag: "money", conf: "confirmed", text: "$9k is affordable — \"budget isn't the blocker\"" },
      { tag: "decision", text: "\"big spends, Dave and I decide together\" — Dave runs finances, never on a call" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month and to step back from delivery (figure not confirmed)" },
      { tag: "why", text: "frustrated, a little embarrassed about being stuck a full year" },
    ],
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
      "Weakest link: \"too busy\" is the symptom of the exact problem the program fixes.",
    transcript:
      "Rep: We can get you started this week — first call's Thursday.\n" +
      "Prospect: That's exactly my problem though. I'm slammed, I'm too busy — I don't know how I'd fit the calls in.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 60k a month, 8 employees\"" },
      { tag: "pain", conf: "confirmed", text: "drowning in day-to-day ops; growth stalled" },
      { tag: "history", text: "tried delegating, things broke, took it all back" },
      { tag: "why", text: "wants out of the day-to-day, business running without him" },
      { tag: "money", conf: "confirmed", text: "didn't flinch at the price" },
    ],
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
      "Wants: a much bigger month and location freedom (figure not confirmed).\n" +
      "Weakest link: the objection is identity/self-belief, not the offer. She already gets clients results offline.",
    transcript:
      "Rep: This is built for exactly where you are. Shall we get you enrolled?\n" +
      "Prospect: My worry is... what if it doesn't work for me? I've seen it work for other people, but maybe I'm the exception.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 8k a month, trading time for money\"" },
      { tag: "why", text: "self-doubt — believes in the program, doubts herself" },
      { tag: "proof", text: "already gets her own clients results offline — capability isn't the question" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month and location freedom (figure not confirmed)" },
      { tag: "history", text: "bought a cheap course, never implemented it" },
    ],
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
      "Wants: a big jump in revenue (figure not confirmed).\n" +
      "Weakest link: he's comparing. A real answer ties the difference to why the last two failed him — implementation and accountability.",
    transcript:
      "Rep: I really do think this is the right move for you.\n" +
      "Prospect: Maybe. But there are a million of these programs. What actually makes you different from everyone else?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 25k a month\"" },
      { tag: "history", conf: "confirmed", text: "did two coaching programs — \"all theory, no implementation\"" },
      { tag: "why", text: "burned by generic gurus; guarded; comparing options" },
      { tag: "goal", conf: "shaky", text: "wants a big jump in revenue (figure not confirmed)" },
    ],
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
      "Wants: a much bigger month without the people-chaos (figure not confirmed).\n" +
      "Weakest link: \"send me info\" is cover. A real concern (most likely price or uncertainty) surfaced at the reveal.",
    transcript:
      "Rep: So should we get you signed up today?\n" +
      "Prospect: Can you just send me some information to look over? I'll go through it and circle back.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 35k a month\"" },
      { tag: "pain", text: "hiring/retention chaos; churn eating her growth" },
      { tag: "signal", text: "cooled noticeably right after the price reveal" },
      { tag: "why", text: "conflict-avoidant — uses politeness to avoid a direct no" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month without the people-chaos (figure not confirmed)" },
    ],
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
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: his own history (abandoned plans) proves self-directed hasn't worked. The gap is accountability and speed.",
    transcript:
      "Rep: This program shortcuts all of that for you.\n" +
      "Prospect: I hear you, but honestly I feel like I could just do this myself if I put my head down. Why pay for it?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 20k a month\"" },
      { tag: "history", conf: "confirmed", text: "started and abandoned two self-directed plans" },
      { tag: "gap", text: "knows what to do, just doesn't do it — no accountability" },
      { tag: "why", text: "pride / independence; loves figuring things out himself" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
    ],
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
      "Emotion: distrust and fear of repeating a mistake — she paid a $20k \"business mentor\" last year who overpromised and ghosted her (she stated the $20k directly).\n" +
      "Wants: open location #3 without the cash-flow terror.\n" +
      "Weakest link: trust. Needs de-risking anchored to that $20k experience — not a generic \"I understand.\"",
    transcript:
      "Rep: I really think we can help you get there. Want to move forward?\n" +
      "Prospect: I'll be honest with you — I've been burned before. I paid 20 grand for a program that left me hanging. I'm cautious now.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 45k a month, two salons\"" },
      { tag: "history", conf: "confirmed", text: "paid a \"$20k business mentor\" last year who overpromised and ghosted (she said 20 grand directly)" },
      { tag: "why", text: "distrust, fear of repeating the mistake; gun-shy" },
      { tag: "goal", text: "open location #3 without the cash-flow terror" },
      { tag: "money", text: "can afford it" },
    ],
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
      "Wants: roughly double, and more time with his kids (figure not confirmed).\n" +
      "Weakest link: the outcome claim outran his belief. He doesn't believe the result is realistic for HIM.",
    transcript:
      "Rep: So that's genuinely what's possible for you in the next six months.\n" +
      "Prospect: Honestly? That sounds too good to be true. What's the catch?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 30k a month, trades business\"" },
      { tag: "why", text: "flat disbelief; distrusts \"online stuff\"; a grinder" },
      { tag: "gap", text: "result claim outran his belief — doesn't believe it's realistic for HIM" },
      { tag: "goal", conf: "shaky", text: "wants to roughly double and more time with his kids (figure not confirmed)" },
    ],
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
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: \"later\" costs her the very season she's worried about — she hasn't seen that yet.",
    transcript:
      "Rep: So — ready to get going?\n" +
      "Prospect: I love it, I do. I just feel like the timing isn't right to start something this big right now.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 18k a month, e-commerce\"" },
      { tag: "timing", text: "busy Q4 season approaching; anxious about adding load" },
      { tag: "gap", text: "the program is what makes that season profitable instead of chaotic" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "affordability fine" },
    ],
  },
  {
    id: 13,
    category: "authority",
    objection: "I need to talk to my spouse",
    context:
      "Prospect: Jordan, runs a Shopify apparel brand, ~$22k/mo. Married.\n" +
      "Pain uncovered: maxed out, doing everything solo, can't scale without help.\n" +
      "Money: confirmed fine — \"the price isn't the issue.\"\n" +
      "Decision: earlier said \"my spouse and I make the big money calls together.\"\n" +
      "Emotion: sold on the call, but genuinely partners with their spouse on big spends.\n" +
      "Wants: a much bigger month and an actual team (figure not confirmed).\n" +
      "Weakest link: support — is this courtesy (already decided) or a real gate?",
    transcript:
      "Rep: Sounds like this is exactly it. Ready to get started?\n" +
      "Prospect: I'm into it, I really am. I just need to talk to my spouse before I commit to something this size.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 22k a month\"" },
      { tag: "decision", text: "\"my spouse and I make the big money calls together\"" },
      { tag: "money", conf: "confirmed", text: "price is fine — not the blocker" },
      { tag: "why", text: "wants to finally build a team and stop being the bottleneck" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
    ],
  },
  {
    id: 14,
    category: "authority",
    objection: "I need to check with my accountant",
    context:
      "Prospect: Derek, agency owner, ~$50k/mo, very numbers-driven.\n" +
      "Pain uncovered: knows he's the bottleneck; growth flat for 8 months.\n" +
      "Money: confirmed not tight — \"9 grand isn't the issue.\"\n" +
      "Decision: says his accountant vets big spends.\n" +
      "Emotion: hides behind logic/process to avoid an emotional yes.\n" +
      "Wants: a much bigger year (figure not confirmed).\n" +
      "Weakest link: the accountant is a logic gate to defer the real decision, which is his.",
    transcript:
      "Rep: So shall we lock it in?\n" +
      "Prospect: Before I spend 9 grand I run it past my accountant — that's just how I operate.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 50k a month\"" },
      { tag: "money", conf: "confirmed", text: "not tight — \"9 grand isn't the issue\"" },
      { tag: "decision", text: "accountant vets big spends (his stated process)" },
      { tag: "why", text: "knows he's the bottleneck; defers emotional calls to \"process\"" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger year (figure not confirmed)" },
    ],
  },
  {
    id: 15,
    category: "trust",
    objection: "I tried something like this before and it didn't work",
    context:
      "Prospect: Alyssa, course creator, ~$12k/mo.\n" +
      "Pain uncovered: launches are feast-or-famine; no consistent system.\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: skeptical from a past program — but admits she didn't really implement it.\n" +
      "Wants: consistent monthly launches.\n" +
      "Weakest link: trust, but partly her own non-implementation last time — the gap is accountability.",
    transcript:
      "Rep: This is the path to consistent launches.\n" +
      "Prospect: Honestly, I tried a program like this before and it just didn't work for me.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 12k a month\"" },
      { tag: "history", conf: "shaky", text: "joined some group program last year — \"did nothing for me\" (figure not confirmed)" },
      { tag: "gap", text: "admits she didn't really implement it last time" },
      { tag: "why", text: "wants consistent launches instead of feast-or-famine" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 16,
    category: "price",
    objection: "Can you do a payment plan or a discount?",
    context:
      "Prospect: Tony, contractor, ~$28k/mo.\n" +
      "Pain uncovered: stuck on the tools; can't step back.\n" +
      "Money: workable but cautious; asking for terms.\n" +
      "Decision: his.\n" +
      "Emotion: basically sold — said \"I want to do it\" — this is a terms conversation.\n" +
      "Wants: step back and run the business, not work in it.\n" +
      "Weakest link: he's sold; don't re-sell — get the decision, then handle terms.",
    transcript:
      "Rep: So we're good to go?\n" +
      "Prospect: I want to do it — can you do a payment plan, or knock something off the 9k?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 28k a month\"" },
      { tag: "signal", conf: "confirmed", text: "\"I want to do it\" — basically sold" },
      { tag: "money", text: "workable; wants better terms, not a no" },
      { tag: "why", text: "wants to step back from the tools and run the business" },
      { tag: "price", conf: "confirmed", text: "the program is $9k (discussed)" },
    ],
  },
  {
    id: 17,
    category: "differentiation",
    objection: "I'm already working with a coach",
    context:
      "Prospect: Nina, consultant, ~$30k/mo.\n" +
      "Pain uncovered: plateaued; her current coaching has \"kind of stalled.\"\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: loyal but quietly frustrated with current help.\n" +
      "Wants: a genuine new level (figure not confirmed).\n" +
      "Weakest link: differentiation + a little loyalty guilt — tie to her own admission that she's stalled.",
    transcript:
      "Rep: Let's get you in.\n" +
      "Prospect: I appreciate it, but I already work with a coach.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 30k a month\"" },
      { tag: "history", text: "has a coach but \"we've kind of plateaued\"" },
      { tag: "why", text: "wants a new level; quietly frustrated, feels stuck with current help" },
      { tag: "goal", conf: "shaky", text: "wants a genuine new level (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 18,
    category: "timing",
    objection: "Let me finish my current launch first",
    context:
      "Prospect: Greg, info-product owner, ~$40k/mo, mid-launch right now.\n" +
      "Pain uncovered: maxed during launches; no system to scale past them.\n" +
      "Money: confirmed fine.\n" +
      "Decision: his.\n" +
      "Emotion: feels too slammed to add anything until the launch ends.\n" +
      "Wants: the next level without burning out.\n" +
      "Weakest link: the program is what makes the launch bigger, not a competing task.",
    transcript:
      "Rep: Ready to jump in?\n" +
      "Prospect: Love it. Let me just get through this launch first, then I'll come back to it.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 40k a month\"" },
      { tag: "timing", text: "mid-launch; wants to wait until after" },
      { tag: "gap", text: "the program is what makes the launch bigger, not a competing task" },
      { tag: "why", text: "wants the next level but feels maxed right now" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 19,
    category: "risk",
    objection: "I need to see proof or a guarantee",
    context:
      "Prospect: Carla, coach, ~$15k/mo, risk-averse.\n" +
      "Pain uncovered: capped on time; scared to waste money on the wrong thing.\n" +
      "Money: confirmed fine, but cautious.\n" +
      "Decision: hers.\n" +
      "Emotion: needs certainty before spending; fear of a bad bet.\n" +
      "Wants: a much bigger month without trading more hours (figure not confirmed).\n" +
      "Weakest link: trust/risk — put the certainty question back on what she controls (doing the work).",
    transcript:
      "Rep: Shall we get you started?\n" +
      "Prospect: Before I put down 9k, I'd need to see some proof this actually works — do you guarantee results?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 15k a month\"" },
      { tag: "why", text: "risk-averse; scared to waste money on the wrong thing" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month without more hours (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine but cautious" },
      { tag: "price", conf: "confirmed", text: "the program is $9k (discussed)" },
    ],
  },
  {
    id: 20,
    category: "timing",
    objection: "The economy is too uncertain right now",
    context:
      "Prospect: Hassan, e-commerce, ~$35k/mo.\n" +
      "Pain uncovered: plateaued; knows he needs systems to grow.\n" +
      "Money: confirmed fine.\n" +
      "Decision: his.\n" +
      "Emotion: nervous about the macro economy; wants to play it safe.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: fear dressed as macro logic — downturns are when competitors pull back.",
    transcript:
      "Rep: Let's move forward.\n" +
      "Prospect: With how the economy is right now, I just don't know if it's smart to spend on this.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 35k a month\"" },
      { tag: "why", text: "nervous about the economy; wants to play safe" },
      { tag: "gap", text: "downturns are when competitors pull back — the opening" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 21,
    category: "stall",
    objection: "I want to do more research and compare options",
    context:
      "Prospect: Beth, SaaS founder, ~$45k/mo, very analytical.\n" +
      "Pain uncovered: same growth problem for a year; over-researches, under-acts.\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: analysis paralysis; fear of making the wrong call.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: she's been \"researching\" the same problem for a year with no movement.",
    transcript:
      "Rep: Ready to start?\n" +
      "Prospect: I'm interested, I just like to research and compare all my options before I commit.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 45k a month\"" },
      { tag: "why", text: "analytical; fears making the wrong call" },
      { tag: "gap", text: "been \"researching\" the same problem for a year with no movement" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 22,
    category: "money",
    objection: "I've already spent a lot on this kind of thing",
    context:
      "Prospect: Omar, agency owner, ~$20k/mo.\n" +
      "Pain uncovered: bought courses/masterminds, never implemented; frustrated with himself.\n" +
      "Money: workable.\n" +
      "Decision: his.\n" +
      "Emotion: sunk-cost frustration; tired of buying things he doesn't use.\n" +
      "Wants: to finally implement and scale.\n" +
      "Weakest link: what those purchases lacked was accountability — exactly the difference here.",
    transcript:
      "Rep: This is the one that gets you unstuck.\n" +
      "Prospect: I've already dumped a ton of money into this kind of thing, man.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 20k a month\"" },
      { tag: "history", conf: "shaky", text: "spent a lot on courses/masterminds (rough figure, not confirmed)" },
      { tag: "gap", text: "all self-paced — no accountability, never implemented" },
      { tag: "why", text: "tired of buying things he doesn't use" },
      { tag: "money", text: "workable" },
    ],
  },
  {
    id: 23,
    category: "skepticism",
    objection: "My niche is unique — a general program won't fit",
    context:
      "Prospect: Sofia, runs a medical-billing agency, ~$25k/mo.\n" +
      "Pain uncovered: she's the bottleneck; no systems; can't scale.\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: believes her industry is too specific for outside help.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: the bottleneck (her, no systems) is universal — not niche-specific.",
    transcript:
      "Rep: This fits exactly where you are.\n" +
      "Prospect: Maybe, but my niche is really specific — I'm not sure a general program gets my situation.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 25k a month\"" },
      { tag: "why", text: "believes her industry is too unique for outside help" },
      { tag: "gap", text: "the bottleneck — her, no systems — is the same in every business" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 24,
    category: "risk",
    objection: "I don't want to be locked into a contract",
    context:
      "Prospect: Trent, fitness studio owner, ~$18k/mo.\n" +
      "Pain uncovered: capped; needs systems to grow past himself.\n" +
      "Money: confirmed fine.\n" +
      "Decision: his.\n" +
      "Emotion: commitment-shy; scared of being trapped in something that doesn't work.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: the six-month commitment IS the point — real change isn't a 30-day thing.",
    transcript:
      "Rep: Six months, and we get you there.\n" +
      "Prospect: I just don't love being locked into a six-month thing.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 18k a month\"" },
      { tag: "why", text: "commitment-shy; scared of being trapped in something that doesn't work" },
      { tag: "gap", text: "six months is the point — real change isn't a 30-day thing" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 25,
    category: "affordability",
    objection: "I want to but I'm scared to invest right now",
    context:
      "Prospect: Maya, new coach, ~$5k/mo, recently quit her job.\n" +
      "Pain uncovered: inconsistent income; needs a system and accountability.\n" +
      "Money: a real stretch but not impossible — be honest, don't slick-talk her.\n" +
      "Decision: hers.\n" +
      "Emotion: scared but determined; \"I can't go back to a 9-5.\"\n" +
      "Wants: to replace her old paycheck (figure not confirmed).\n" +
      "Weakest link: fear + a genuine-ish money stretch — needs honesty and steadiness, not a slick reframe.",
    transcript:
      "Rep: This is your move — let's make it happen.\n" +
      "Prospect: I want this so bad. I'm just scared to put down that kind of money right now.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 5k a month\", recently quit her job" },
      { tag: "money", conf: "confirmed", text: "a real stretch, not impossible — be honest, no slick reframe" },
      { tag: "why", text: "scared but determined to make coaching work" },
      { tag: "final_straw", text: "\"I can't go back to a 9-5\"" },
      { tag: "goal", conf: "shaky", text: "wants to replace her old paycheck (figure not confirmed)" },
    ],
  },
  {
    id: 26,
    category: "authority",
    objection: "I need to run it by my team",
    context:
      "Prospect: Victor, owns a 12-person agency, ~$70k/mo.\n" +
      "Pain uncovered: he's the bottleneck on growth; wants to scale big.\n" +
      "Money: confirmed fine.\n" +
      "Decision: it's HIS company — he just \"likes leadership buy-in.\"\n" +
      "Emotion: defers decisions to avoid being personally wrong.\n" +
      "Wants: to lead, not do; a much bigger year (figure not confirmed).\n" +
      "Weakest link: this is his call — running it by the team is avoidance, gently named.",
    transcript:
      "Rep: Let's do it.\n" +
      "Prospect: I'd want to run it by my team before pulling the trigger.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 70k a month\", 12 people" },
      { tag: "decision", text: "it's his company — \"I like my leadership team's buy-in\"" },
      { tag: "why", text: "defers decisions to avoid being personally wrong" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger year (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 27,
    category: "stall",
    objection: "I'm just not sure I'm ready",
    context:
      "Prospect: Renee, coach, ~$10k/mo.\n" +
      "Pain uncovered: capped; needs structure to grow.\n" +
      "Money: confirmed fine.\n" +
      "Decision: hers.\n" +
      "Emotion: waiting to feel \"ready\" — fear dressed as timing.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: nobody feels ready — the people who grow start before they do.",
    transcript:
      "Rep: Ready to start?\n" +
      "Prospect: I don't know... I'm just not sure I'm ready for something this big yet.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 10k a month\"" },
      { tag: "why", text: "waiting to feel \"ready\" — fear dressed as timing" },
      { tag: "gap", text: "the people who grow start before they feel ready" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 28,
    category: "trust",
    objection: "How do I know you're not just another guru?",
    context:
      "Prospect: Reggie, trades business owner, ~$32k/mo, cynical about online coaching.\n" +
      "Pain uncovered: capped; no systems; running ragged.\n" +
      "Money: confirmed fine.\n" +
      "Decision: his.\n" +
      "Emotion: doesn't want to be sold; wants substance, not hype.\n" +
      "Wants: a much bigger month (figure not confirmed).\n" +
      "Weakest link: trust/authority — meet the cynicism head-on, calmly, put it back on him.",
    transcript:
      "Rep: I can help you get there.\n" +
      "Prospect: No offense, but how do I know you're not just another guru with a course?",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 32k a month\"" },
      { tag: "why", text: "cynical about online coaching; doesn't want to be sold" },
      { tag: "gap", text: "wants substance and proof, not hype" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month (figure not confirmed)" },
      { tag: "money", conf: "confirmed", text: "fine" },
    ],
  },
  {
    id: 29,
    category: "stall",
    objection: "I need to pray on it",
    context:
      "Prospect: Grace, faith-driven coach, ~$8k/mo.\n" +
      "Pain uncovered: capped; needs a system and support.\n" +
      "Money: workable.\n" +
      "Decision: hers.\n" +
      "Emotion: genuinely faith-led — prays on big decisions. Respect this; never mock or rush it.\n" +
      "Wants: a much bigger month and to serve more people (figure not confirmed).\n" +
      "Weakest link: respect the value, gently check if anything ELSE is also holding her back.",
    transcript:
      "Rep: Shall we move forward?\n" +
      "Prospect: This is a big one — I really need to pray on it before I decide.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"around 8k a month\"" },
      { tag: "why", text: "faith-driven; prays on big decisions — respect it, never mock or rush" },
      { tag: "gap", text: "gently surface whether anything else is also holding her back" },
      { tag: "goal", conf: "shaky", text: "wants a much bigger month and to serve more people (figure not confirmed)" },
      { tag: "money", text: "workable" },
    ],
  },
  {
    id: 30,
    category: "affordability",
    objection: "Money's really tight right now, but I want this",
    context:
      "Prospect: Diego, contractor, ~$16k/mo, just came off a brutal slow season.\n" +
      "Pain uncovered: boom-bust cycle; no systems to smooth it out.\n" +
      "Money: genuinely tight right now — a truck repair drained his cash. Be real, don't trick him.\n" +
      "Decision: his.\n" +
      "Emotion: wants it badly; \"I'm done living job to job.\"\n" +
      "Wants: steady income year-round (figure not confirmed).\n" +
      "Weakest link: real cash-timing constraint — honesty + a real path, not a value trick.",
    transcript:
      "Rep: This is the move that ends the boom-bust.\n" +
      "Prospect: I want this more than anything — but money's really tight right now after a brutal slow season.",
    anchors: [
      { tag: "current", conf: "confirmed", text: "\"about 16k a month\", just off a brutal slow season" },
      { tag: "money", conf: "confirmed", text: "GENUINELY tight now — a truck repair drained his cash; be real, don't trick him" },
      { tag: "why", text: "wants out of the boom-bust cycle for good" },
      { tag: "final_straw", text: "\"I'm done living job to job\"" },
      { tag: "goal", conf: "shaky", text: "wants steady income year-round (figure not confirmed)" },
    ],
  },
];
