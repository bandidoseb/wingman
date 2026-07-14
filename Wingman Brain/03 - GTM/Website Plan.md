# Website Plan — meetwingman.ai

Last updated: 2026-04-25

Source of truth for what the Wingman website needs to contain, in what order, and why. Pull copy from `Messaging.md` and `Marketing Honesty Principles.md`. Pull pricing from `06 - Finance/`. Pull legal requirements from `05 - Operations/Wiretap Compliance Research.md`.

---

## Sitemap

| Page | Priority | Status |
|------|----------|--------|
| `/` — Landing page | P0 | Not built |
| `/terms` — Terms of Service | P0 — beta blocker | Not built |
| `/privacy` — Privacy Policy | P0 | Not built |
| `/pricing` | P1 | Not built |
| `/compliance` — Recording law guide | P2 | Not built |
| `/about` or `/philosophy` | P2 | Not built |

**P0 = must exist before any beta user signs up.** The onboarding compliance checkbox links to `/terms` — that URL must resolve.

---

## Landing Page — Section by Section

Hierarchy locked in `Messaging.md`. Expanding here with build notes.

### 1. Hero

**Goal:** Immediately communicate what it is and who it's for. One sentence. One CTA.

**Headline options (from Messaging.md):**
- ~~*"Free to fly. Pay when you win."*~~ — **RETIRED 2026-05-31** (old free-until-close model is dead; no tagline locked yet — see Messaging.md)
- *"The AI copilot that tells you exactly what to say — right when you need it."*

**Subhead:** One sentence. Who it's for + the core mechanic.
> *"Wingman sits invisibly on your Mac during high-ticket sales calls and fires a signal card at the exact moment you need it. No bot. No noise. Just the right move at the right time."*

**CTA:** "Get Early Access" or "Join the Beta"

**Design note:** Hero needs a visual. Either a screenshot of the signal card on a real call, or a short looping GIF of a card firing. This is the most important asset on the page — prioritize this before launch.

---

### 2. The Moment — Product Demo

**Goal:** Show, don't tell. A prospect watching the page should understand the product in 10 seconds without reading a word.

**Format:** Video or GIF of a signal card appearing on screen during a call. No narration needed. The product sells itself visually.

**What to capture:** A real call (or staged call) showing:
- Rep's screen with Zoom open
- Signal card fades in bottom-left
- Card shows a clean objection handle
- Rep clicks "Got it" and it fades out

**Note:** This requires a working product demo recording. Don't launch the hero section without this asset.

---

### 3. How It Works

**Goal:** 3 steps. No jargon.

1. **Wingman listens** — Runs quietly on your Mac while you're on Zoom, Teams, or Google Meet. No bot joins the call.
2. **Detects the moment** — When a prospect objects, hesitates, or uses a trigger phrase, Wingman fires a signal card.
3. **You close** — See the card. Use it or dismiss it. The prospect never knows it's there.

---

### 4. Social Proof

**Goal:** Real quotes from real beta closers. Verbatim. Specific.

Pull from `02 - Market/User Voice Verbatim.md` when populated.

**What to avoid:** Generic testimonials ("This tool is amazing!"). What converts: specific moments ("Right when she said 'let me think about it', Wingman told me to ask what she was really thinking about. I asked it. She closed.").

**Placeholder until beta data exists:** Don't fabricate. Ship without social proof before shipping with made-up proof.

---

### 5. The ROI Math

**Goal:** One close pays for the tool. Make that math obvious.

**Format:** Simple visual. Not a spreadsheet.

> If you close one extra deal per month because of Wingman, the math works.
> At $179/month — one extra close at $5k = $4,821 net.

Vary the numbers to match the target buyer's average deal size ($3k–$15k range). Keep it simple — one row, one close.

---

### 6. System Requirements

**Must be explicit.** Closers will download and be frustrated if this isn't upfront.

> **Requirements:** Mac with Apple Silicon chip (M1, M2, M3, or later) · macOS 13 Ventura or later · Zoom, Microsoft Teams, or Google Meet (Chrome)
>
> *Intel Macs and Windows are not supported.*

Source: `CLAUDE.md` system requirements section.

---

### 7. FAQ

Pre-written copy lives in `Messaging.md`. Core questions:

- Is this cheating?
- Does the prospect know?
- Will it fire constantly and distract me?
- What if I don't like the suggestion?
- Does it work on Windows?

**Add from Marketing Honesty Principles:**
- Will Wingman make me a better closer? *(Honest answer: it helps with one piece — catching what you miss. You still bring tonality, authority, and the close.)*

---

### 8. CTA — Bottom

Repeat the primary CTA. Keep it identical to the hero CTA so there's no decision fatigue.

**"Get Early Access"** or **"Join the Beta"** → email capture or Stripe checkout.

---

## Pricing Page

**Current direction (REVISED 2026-06-05 — now TIERED):** Free 10 calls / **Core $149** (soft-capped ~75 calls + overage) / **Pro $299** (unlimited + calendar / prospect memory / pre-call briefings / deal coach). Final numbers pending sign-off — see `06 - Finance/Tier Pricing Proposal + Unit Economics.md`. *(Was: "$179–199 flat unlimited.")*

**Copy principle:** One plan. One price. No tiers. Closers don't read pricing tables — they make a fast decision based on whether the ROI math works.

**Format:**
- Single card
- Price front and center
- 4–5 bullet points max (what's included)
- ROI line underneath: *"One close pays for 6 months."*
- CTA: "Start now"

**Affiliate tracking:** Rewardful script must be on this page before affiliates are activated. See `05 - Operations/Stripe and Billing.md`.

---

## Legal Pages — P0 Blockers

### `/terms` — Terms of Service

**Why it's a blocker:** The onboarding compliance checkbox links here. This URL must resolve before any beta user goes through onboarding.

**Must include (for wiretap compliance posture):**
- Rep warrants they will comply with all applicable call-recording laws in their jurisdiction
- Rep indemnifies Wingman against any claims arising from their recording practices
- Wingman is a SaaS tool provider — the rep is the recorder, not Wingman
- Mirror Cluely's ToS language as a baseline — it's industry-standard and has survived scrutiny

**Tone:** Plain English where possible. This is not a buried legal doc — beta users will actually read it.

Source: `05 - Operations/Wiretap Compliance Research.md` — Section 6.

---

### `/privacy` — Privacy Policy

**Must cover:**
- What data Wingman collects (call transcripts, user profile, usage data)
- How long transcripts are retained (indefinitely, user-deletable)
- How users can delete their data (per-call + account wipe — to be built)
- No audio or video stored — text only
- Subprocessors: Supabase, Recall.ai, Anthropic, OpenAI, Stripe

---

### `/compliance` — Recording Law Guide (P2)

**What it is:** A plain-English guide to call-recording consent laws by state. Tells reps what they need to know to stay compliant when using Wingman.

**Why:** Reduces Wingman's liability, positions Wingman as a responsible company, and pre-handles the "is this legal?" objection.

**Not urgent.** Ship post-beta.

Source: `05 - Operations/Wiretap Compliance Research.md` — Section 3.

---

## Copy Rules (from Messaging.md)

1. Sound like a closer, not a SaaS company. Say "close," "land," "handle" — not "leverage" or "utilize."
2. Specific beats vague. "Told me to go silent for 12 seconds after price reveal" beats "helps with price objections."
3. Never say "AI" where you can say "Wingman." Wingman is a character. Characters are more trustworthy than categories.
4. The prospect's presence is always implied. Every line is written with live-call tension in the background.
5. Don't oversell. Wingman is a tool in the tool belt. See `Marketing Honesty Principles.md` for the full rules.

---

## Assets Needed Before Launch

| Asset | Status |
|-------|--------|
| Product demo GIF/video (signal card firing on a real call) | Not captured |
| Real beta testimonials (verbatim) | Not yet (no beta users yet) |
| Final pricing locked | TBD — direction is $179–$199/month |
| `/terms` page written and live | Not written |
| `/privacy` page written and live | Not written |
| Rewardful script added to site | Not set up |
| Apple notarization (removes quarantine warning) | ✅ Done 2026-07-01 (v0.1.27+) — no warning, no quarantine command |

---

## Notes

- Don't build the website before the product works end-to-end. A broken product with a polished website is worse than no website.
- The first real beta users will come from Sebastian's personal network — direct DMs, not the website. The website is for the public launch phase.
- Onboarding flow redesign is planned (Cluely's flow as inspiration). Coordinate website CTA with whatever the new onboarding entry point becomes.

---

## What to Show vs What to Protect (added 2026-07-14)

The `00 - Product/Wingman Design Language.md` artifact came out beautiful and Sebastian wants some of it on the website — especially the **close-readiness** visual and the signal-card mockups. Real concern raised: don't spew so much that someone scrapes the site and rebuilds Wingman with Claude Code.

**The rule: show OUTPUTS, hide MECHANISMS.**

- **The UI is NOT the moat.** A pretty card is four colored words — anyone can copy the *look* from a screenshot (always could). Linear/Stripe/Granola show their UI freely; the look isn't the business. Copying it gets a competitor an empty shell.
- **The moat is NOT visible on a marketing site anyway** — it's the Sales DNA / Belief Ladder learning layer, offer-aware personalization, the real-time pipeline, the per-rep data flywheel. None of that is scrapeable from a picture.
- **The actual leak risk is the EXPLANATIONS, not the pixels.** What would let someone rebuild it is the *why* — "driven by the Belief Ladder score," "diagnose the weakest belief," the prompts, the architecture, the methodology mapping. The design-language artifact is dangerous to publish **as-is** only because it's annotated with that rationale. Strip the annotations and the visuals are safe.

**✅ Safe to show (hooks that convert):**
- Close-readiness visual (the 4-step chip: Not Ready → Continue Discovery → Almost Ready → Ready to Pitch)
- Signal-card mockups (the look)
- The **generic-vs-offer-aware side-by-side** (the positioning wedge — `Positioning wedge — Offer-Aware vs Generic.md`; Sebastian flagged HIGH). Shows the RESULT, not the method = the moat made visible without giving the recipe.

**❌ Keep private:**
- The Belief Ladder pillars / Cole Gordon methodology mapping
- Prompt logic, "how we decide when to fire," architecture / RAG pipeline / model choices
- The annotated Wingman Design Language doc itself (internal only)

**Rule of thumb for any website visual:** it shows *what the rep sees*, never *what Wingman thinks*. The site version = polished component + marketing copy, with every "how it works" caption stripped.
