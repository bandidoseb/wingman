# Dig Card — Threading, Exhaustion & Natural Transition

**Captured:** 2026-07-11 (design conversation, Sebastian + Claude). NOT built. This is the context
for a future dedicated session on the ↓ Dig card's next evolution (roughly "Phase 4a.2 threading",
but the scope grew in this conversation). Read this whole note before starting that session.

**Precondition before building ANY of this:** live-test the CURRENT single-shot dig card (the one
that now carries the Sales DNA from Phase 1b) on real calls first. Watch where it actually falls
short on "deeper vs. new belief" and on natural flow. Design against real evidence, not in the
abstract — the single-shot may already handle more than expected, which keeps the threading simpler.
Over-building this is how we'd wreck the "feels like intuition" quality.

---

## The starting question (Sebastian)

The ↓ Dig button does two jobs today with one press:
1. **Breadth** — "I don't know what to ask next in discovery; touch on a belief we haven't covered."
2. **Depth** — "Chunk down on what the prospect JUST said."

Sebastian's worry: how does Wingman know which the rep wants, and is leaving it to the AI risky?
He floated a **split button** (press ↓ → then choose left = discovery question / right = chunk-down).

## Resolved in this conversation

**Don't split the button.** Reasons:
- A mid-call two-level menu fights the core rules ("bumpers not a script", "never make reps robotic",
  rare/surgical/feels-like-intuition). A closer mid-sentence can't do a menu dance.
- It asks the rep to pre-classify a need they often can't classify — people press ↓ *because* they're
  stuck. If they could classify it, they'd be half-way to the answer.
- It collides with the existing 4-arrow compass (← = answer, → = close are already taken).

**What the down arrow actually does today (accurate, from `dig-prompt.mjs`):** it is NOT two modes.
Every press produces the single best next question from TWO inputs — (1) the belief ladder
(touched vs. cold) and (2) the last ~120s of transcript. Breadth vs. depth is *emergent* from those,
not a fork the rep or the model explicitly chooses.

**Real problem found by intuition:** the current priority order aims at the lowest-status belief
"⚠️ at-risk → ⬜ open → 🟡 partial." That puts a COLD belief *ahead of* something they half-said —
so pressing ↓ wanting to deepen a juicy live thread can jump to a cold belief instead. Genuine miss.

## The intended solve: threading (no menu)

- **1st ↓ press** → best next question (breadth or depth as the moment calls for).
- Rep asks it; prospect answers.
- **Press ↓ again** → because it's a *repeat press on a live thread* and the prospect's fresh answer
  is now the newest transcript, "go deeper on what they just said" is the natural read. Each further
  press chunks down another layer on the SAME thread.
- How it knows deeper-vs-move-on is **not a mode the rep selects** — it's "are you pressing repeatedly
  on a live thread, or pressing fresh after the conversation moved?" Read from context, not guessed blind.
- **Flow window:** mirror the objection flow — the dig flow stays live ~2 min after the last press;
  a press inside the window continues the thread, a press after it starts fresh.

## Exhaustion detection — "have I dug this enough?"

- The belief ladder's **✅ locked** = "the prospect affirmed it in their own words" = literally the
  "dug enough, move on" signal. The **WEAKEST LINK** line then already points to the next belief.
  So the "topic done → here's next" machinery mostly exists in the summarizer output.
- **⚠️ The catch: the belief ladder only re-scores ~every 2 min.** The dig flow moves faster. You can
  lock a belief live in the last 90s while the ladder still says 🟡. So exhaustion detection needs
  **two signals, not one:** the slow map (belief ladder) AND the fast one (the flow's own recent
  back-and-forth — "I've asked 3 layers on Pain and they've now owned it"). The objection flow already
  does this two-speed thing (rolling flow recap + frozen belief snapshot) — mirror it.

## The genuinely hard part (build carefully)

Not exhaustion detection — the **override / correction path when Wingman guesses wrong** on
deeper-vs-switch. If Wingman silently teleports from digging Pain to asking about budget and the rep
wasn't ready, that's the jarring robotic moment. And correction is awkward (pressing ↓ again just
gives another new-belief question, not "take me back").

**Default recommendation:** within a live flow, LEAN toward staying on the current thread; only switch
beliefs when the current one clearly locks; and when it switches, NEVER do it silently.

## Show the belief on the card — ESSENTIAL, not cosmetic (both agreed)

The belief label is the safety mechanism. Card reads **DIG · PAIN** and stays → continuity, rep knows
it's the same thread. Pain locks → label flips to **DIG · DESIRE** → the *change* is the rep's cue the
topic shifted. Rep is never surprised because the card told them before they spoke.
**Already half-built:** the dig card resolves its belief tag pre-paint (before the question text
paints), and the objection flow already ships "FLOW · MOVE #N" chrome. Small extension, not new machinery.

## THE deepest open question — natural transition, not list-checking (Sebastian, this message)

"Weakest belief" answers **what's most IMPORTANT to build** — NOT **what's most NATURAL to say next.**
Optimizing purely for importance IS the robotic failure ("you haven't covered Money, ask about Money"
right after they got vulnerable about their kid = tone-deaf).

Design principles surfaced (for the future session to build around):
- **Natural transition = the next belief must be reachable by a BRIDGE from what they JUST said.**
  Two-factor decision: **importance (weakest link) × reachability (natural bridge from the live thread).**
  When they conflict on a single question, **flow usually wins** — you can always return to a belief
  later; you can't un-sound-robotic. Example: Pain → Cost flows ("and what's that costing you?");
  Pain → Trust ("why do you trust us?") is a jarring jump with no bridge.
- **Naturalness is semi-measurable:** does the next question connect to something in the last exchange?
  A bridge present = natural; a hard topic jump with no bridge = robotic. That's a design lever, maybe
  even an eval dimension.
- **Emotional momentum governs stay-vs-move:** right after a vulnerable/emotional disclosure, the
  natural move is to STAY and deepen, not switch beliefs. Switching there is the robotic tell.
- **Wingman already has SEEDS of natural flow:** (1) the ORDER doctrine in the dig prompt
  (Pain → Desire → Cost/Doubt → … Money/Support/Trust LATER) exists *because* it's the natural
  emotional arc of a discovery conversation, not an arbitrary checklist; (2) "ANCHOR TO THEIR OWN
  WORDS / pull a verbatim phrase from THEIR EXACT WORDS" bridges phrasing. BUT the belief SELECTION
  (weakest link) can currently override flow. **The careful build reconciles them:** weakest-link
  proposes candidates; natural-bridge + doctrine-order + emotional-temperature pick among them;
  phrasing bridges from their exact words.

## Infrastructure already in place to reuse (don't rebuild)

- Objection **flow threading** (Phase B) — flow ledger single-owned in DashboardClient, Electron-main
  `flowModeOpen` + ~2-min idle timer, "MOVE #N" chrome, flow synthesis (rolling recap of the older
  middle + frozen belief snapshot).
- Dig card **belief tag resolves pre-paint** (`decodeBeliefStream` → "DIG · <belief>" before text).
- Belief ladder summarizer already emits **WEAKEST LINK** (the "what's next" pointer) and confidence
  grades (✅ 🟡 ⬜ ⚠️).
- Phase 1b Sales DNA now feeds the dig card + summarizer (offer-aware root-driver chunk-down).

## Sequencing

1. Live-test the current single-shot dig (+ Sales DNA) on real calls. Collect where it misses.
2. THEN a dedicated session: threading + exhaustion (two-speed) + natural-transition selection +
   belief-label chrome + the override/correction path.
3. Naming: "Dig" is fine (covers both new-hole and deeper-in-same-hole). "Deeper"/"Probe" are options.
   Name should follow the settled function — don't rename first.
