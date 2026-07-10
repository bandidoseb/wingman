# Content Topic Bank

Started 2026-07-07 (Sebastian's idea). A running list of content-worthy topics mined from real product decisions, sales science, and training doctrine. Every deliberate decision we make is a potential blog post / Instagram post / ad angle that builds credibility: "every single little detail was purposeful."

**Add to this file whenever a session produces an interesting WHY.** One line per topic is enough — the decision logs hold the depth.

---

## ⚠️ THE GUARDRAIL — what we NEVER publish

The goal is to sound like geniuses, not to hand competitors the recipe. Hard rule:

- **PUBLISH the WHY:** psychology, sales science, product philosophy, the reasoning behind decisions, what we rejected and why (at the concept level).
- **NEVER publish the HOW:** prompts, prompt structure, eval methodology, model choices per slot, latency budgets/thresholds, architecture diagrams, pipeline internals, tuning parameters, anything a competitor could feed to an AI and replicate.
- Litmus test before posting: *"If a competitor read every post we've ever made, could they rebuild the product?"* If a post moves the answer toward yes, cut the HOW half.

---

## Topic list

### Product philosophy / decisions
- **Rhythm is the rep's art — why autonomy builds something inhuman.** Cards firing on every exchange = a teleprompter = robotic reps. The rep's press IS the endpoint signal — a human deciding "they're done, I want the next layer." (From the 2026-07-06/07 press-vs-autonomous discussion.)
- **The bowling-bumpers thesis.** Wingman only activates when silence would cost money. Reps who sound like they're reading AI lose deals — the highest-performing closers judge robotic behavior harshly.
- **The golf caddy standard.** A tool that tees you up and drives away isn't a copilot. Why we built flows (multi-turn) instead of one-shot cards.
- **Why signal cards are first-person words to SAY, never instructions.** Mid-call, a rep can read a line; they can't parse advice. (Sebastian doctrine, 2026-07-07.)
- **"Doors" — why long prospect answers contain 4 threads and closers lose 3 of them.** Working-memory science (humans hold ~4 chunks); a 5-minute answer opens doors faster than a human can track. How elite closers pick which door to walk through. (Sebastian voice note, 2026-07-06.)
- **Why we never store audio or video.** Trust + compliance as product design.
- **Why almost nothing fires during rapport.** Stage-aware restraint.
- **One card at a time, never a queue.** Attention is the scarcest resource on a live call.

### Sales science / training doctrine (credibility content)
- **Consistency bias & socratic dialogue** — why the prospect closing themselves beats hard closing (Cialdini's *Influence*; the objection-less close).
- **The order of discovery questions** — why "do you have money?" can't come first; warming up to the emotional nitty-gritty; money last.
- **Chunking down** — "tell me more" / "when you say X, what do you mean exactly?" — why one question is never enough and depth beats breadth.
- **Surface → clarify → quantify → emotionalize → widen the gap** — the anatomy of a great dig sequence.
- **Tie-downs in the prospect's exact words** — why verbatim beats paraphrase (they can't argue with their own words).
- **Internal vs external pressure** — heaven/hell island, the gap, and why tension (not pressure) closes deals.
- **"Don't talk them out of the sale"** — why the most dangerous moment is right after they're ready, and why a great tool tells you to STOP digging.

### Turn-taking science (Sebastian-flagged 2026-07-07 — "make us look like smart mfrs")
- **How do you know when someone is done talking?** The turn-detection problem: silence timers vs semantic understanding — why a pause isn't the end of a thought, and why the human press beats the machine guess (for now). Source material: [Deepgram end-of-speech docs](https://developers.deepgram.com/docs/understanding-end-of-speech-detection-while-streaming), [LiveKit turn-detection post](https://livekit.com/blog/turn-detection-voice-agents-vad-endpointing-model-based-detection), [AssemblyAI turn-detection post](https://www.assemblyai.com/blog/turn-detection-endpointing-voice-agent).
- **Why voice AI interrupts you** — the two failure modes of machine turn-taking (fires too early / feels too slow) and what it says about conversation itself.
- **The experimental-feature philosophy** — why we label bleeding-edge features as beta and let users opt into the risk, instead of pretending everything's perfect.

### Engineering-flavored (publish carefully — WHY only)
- **Why sub-second matters mid-call** — the psychology of a rep waiting on a tool while a prospect waits on them. (No latency numbers/architecture.)
- **Why we measured before we fixed** — the measurement-first culture (partials story at the concept level; no pipeline detail).
- **Why we run offline evals before anything touches a live call** — quality gates as respect for the rep's reputation. (No methodology detail.)
