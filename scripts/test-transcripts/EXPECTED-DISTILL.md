# EXPECTED-DISTILL — Query distiller answer key (Phase 3.5)

Pre-registered **before** running the distiller harness (`scripts/test-distill.mjs`), so grading
is objective. The distiller sees only the LAST 12 LINES of each transcript (≈ the 120s rolling
buffer at press time) and must extract the prospect's current objection — or `null` if there
genuinely isn't one.

Auto-grading: each case lists phrases the extraction MUST mention (any-of per group) and phrases
it MUST NOT center on. The harness checks these mechanically; final judgment is still a human read.

---

## 01-fake-yes.txt — Stall behind the partner
**The real objection in-window:** Jordan won't commit — "let me just loop Dev in first… let me
circle back," with Dev controlling the money. Enthusiasm is cover for a stall.
**MUST mention (any of):** `dev` | `partner` | `circle back` | `loop`
**MUST NOT center on:** price being too high (he never objects to the $8k itself).
**NONE is a FAIL** — the stall is a real objection.

## 02-guarded-skeptic.txt — Price/value skepticism + brush-off
**The real objection in-window:** "Five grand? For what exactly though" + "just send me some
info and I'll look it over… I'll think about it." Value not seen; classic deflect.
**MUST mention (any of):** `five grand` | `5` | `what` (value question) | `send me` | `info` | `think about it`
**NONE is a FAIL.**

## 03-strong-close.txt — REVERSE TRAP: no objection exists
**In-window:** Tasha: money set aside, sole decision-maker, "Honestly no" pause-check, "I trust
the process, I just want in… I'll sign right now."
**Expected: `null` (NONE).** Extracting any "objection" here is the failure mode the quality
gate exists to kill — this is the case that produced the garbage fallback card live.
**Any extraction is a FAIL.**

## 04-contradiction-longcall.txt — Spouse sign-off gate
**The real objection in-window:** "I'd want to walk through the final number with my husband
before we pull the trigger… I just wouldn't sign $18k without him in the room."
**MUST mention (any of):** `husband` | `him in the room` | `together`
**MUST NOT center on:** budget/price (she explicitly says they have it — "I'd find $15 to 20k").
**NONE is a FAIL.**

## 05-hidden-objection.txt — THE JUDGMENT TEST: fear of failure, not logistics/money/refund
**The real objection in-window:** "If I drop nine grand on this and I still don't follow
through — then it's not the program, it's me… It's the follow-through thing. It's me I'm
worried about." Money explicitly fine ("I have it set aside, that's not the issue").
**MUST mention (any of):** `follow through` | `follow-through` | `scared` | `it's me` | `myself` | `finish`
**MUST NOT center on:** `refund` | `money` | `price` | logistics (group size / calls per week).
**NONE is a FAIL.** Extracting "what's the refund policy" is the exact shallow read this
distiller must beat.

---

## Retrieval comparison gate (part b)
For every case with a real objection (01, 02, 04, 05): KB search with the DISTILLED phrase must
match or beat the RAW 12-line tail on top-match similarity — and the matched technique must be
plausibly on-topic. If raw beats distilled across the board, the ~300ms serial hop is not paying
for itself: STOP and rethink before touching the route.
