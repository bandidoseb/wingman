# Dashboard Sweep — Sebastian's Pass

*Created 2026-07-28. This is the capture instrument for the full dashboard rebuild.*

**How to use this:** open the dashboard (`npm run electron:dev` → or just app.meetwingman.ai), go tab by tab in the order below, and dump whatever sticks out. Don't organize it. Don't be nice. Don't filter for "is this doable" — that's my job. Half-sentences are fine.

**The three questions per section** (answer only where you have an opinion):
- **KILL** — this shouldn't exist
- **FIX** — right idea, wrong execution
- **MISSING** — I expected something here and it isn't there

**One rule for you:** say what's wrong, not how to fix it. "This feels dead" is more useful to me than "make it blue." Your eye is the signal; the implementation is mine.

---

## Global — before you go tab by tab

Things to notice while moving *between* tabs, not inside one:

- [ ] Does anything shift, jump, or reflow when you switch tabs?
- [ ] Do the tabs feel like the same app? Where does that break first?
- [ ] Sidebar: right items? Right order? Right names?
- [ ] What's the FIRST thing you'd show a Test Pilot? Is it the first thing they see?
- [ ] Anything you've never once clicked?

**Free dump:**
```


```

### ⚑ One decision only you can make: the typeface

Found 2026-07-28 while wiring tokens. The app currently ships **Geist** (loaded in `src/app/layout.tsx` via `next/font`). The Design Language §4 says the **system sans (SF Pro on Mac)** should do the talking, with "character from the scale, weights, and negative tracking — not a novelty font."

Those are two different answers and the code has been quietly winning. Both are defensible — Geist is clean and geometric; SF Pro is what every native Mac app uses, which supports the "focused instrument a professional keeps open all day" north star.

**Which one do you want? (I changed nothing — it restyles every screen either way.)**
```

```

---

## 1. Home
*Sections found in code: live/standby state · "Recording now" · "Waiting for outcome" · "No calls yet today"*

**What is this tab FOR, in one sentence (your words):**
```

```

**KILL / FIX / MISSING:**
```


```

> ⚑ Open question from the Design Language doc: homepage redesign spec says *chart-on-top hero (close-rate trend), drop the "Total Closes" vanity card, Week/Month/Year toggle*. Still what you want?

---

## 2. Flight Plan
*Sections: Your Market · Call Style (Problem-first / Outcome-first) · Offer Context · Investment Profile · Custom Checkpoints*

**What is this tab FOR:**
```

```

**KILL / FIX / MISSING:**
```


```

> ⚑ **Structural decision needed:** this overlaps hard with Sales DNA. Should Flight Plan and Sales DNA be ONE tab? If they stay separate — what's the one-sentence difference a rep would understand?

---

## 3. Sales DNA (`PersonalizeTab`)
*Sections: Your Offer · Main offer · Downsells & other offers · The Core · Your Discovery*

**What is this tab FOR:**
```

```

**KILL / FIX / MISSING:**
```


```

---

## 4. Flight Log ← the worst offender (137 hardcoded colors, 17 different greys)
*Sections: call list · AI Debrief · Stage Breakdown · Topics Missed Before Pitch · Framework Coverage · Transcript · Ask Wingman · Outcome picker*

**What is this tab FOR:**
```

```

**Per-section verdict** (this one I need granular — it's Session 1b):

| Section | Keep / Kill / Fix | Note |
|---|---|---|
| Call list (left) | | |
| AI Debrief | | |
| Stage Breakdown | | |
| Topics Missed Before Pitch | | |
| Framework Coverage | | |
| Transcript | | |
| Ask Wingman | | |
| Outcome picker | | |

> ⚑ **Already-flagged:** "Topics Missed Before Pitch" looks like a third rendering of Stage Breakdown + Framework Coverage. Candidate for deletion — your call.
> ⚑ **Already-flagged:** raw internal keys (`cant_diy`, `investment_readiness`, `why_you`) leak into the debrief prose AND the chips. Fixing after you decide what survives.

**Free dump:**
```


```

---

## 5. Objection Vault
*Sections: objection list · Edit / Cancel · Add objection manually*

**What is this tab FOR:**
```

```

**KILL / FIX / MISSING:**
```


```

---

## 6. Signal Vault ← ⚠️ supposed to be RETIRED
*Sections: Signal Display Mode · Preview — what pops up mid-call · Cost of Waiting / Option 2 · Edit*

`CLAUDE.md` says this tab was retired and replaced by the Playbook. It is still in the sidebar and still renders.

**Verdict — kill it, or does something in here need to survive first?**
```

```

> ⚑ The "Preview — what pops up mid-call" surface may be worth keeping *somewhere* — it's the only place a rep sees what a card looks like outside a live call.

---

## 7. Intel
*Sections: Overall Score · Total DQs · Disqualified · Stage Performance Heatmap · Strong / Danger Zone*

**What is this tab FOR:**
```

```

**KILL / FIX / MISSING:**
```


```

> ⚑ Design Language locks the **sunset gradient** (red→amber→green, colored by real score) for exactly this surface. Currently it uses its own colors. Does the heatmap read right to you today?

---

## 8. Settings
*Sections: Your Profile · Member Since · Zoom Display Name · Plan & Billing · Calls This Month · Wingman Assist · Alerts & Notifications · AI Performance · Account*

**What is this tab FOR:**
```

```

**KILL / FIX / MISSING:**
```


```

> ⚑ "AI Performance" — is this a real setting a rep should touch, or leftover dev tooling?

---

## Last question (most important one)

If a Test Pilot opened this dashboard after their first call and you could only fix ONE thing before they saw it — what is it?

```

```
