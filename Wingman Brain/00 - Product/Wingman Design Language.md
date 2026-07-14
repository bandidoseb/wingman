# Wingman Design Language

> **Status:** v0.1 — proposed 2026-07-11, pending Sebastian's approval of the feel.
> **Purpose:** The single source of truth for how Wingman looks and moves. Every screen (dashboard) and every overlay (HUD) inherits from this. This doc exists because the design thinking was real but scattered across eight notes and never consolidated — which is *why* the dashboard felt Frankensteined. This is the consolidation.
> **Living visual reference (tokens + sample components, light + dark):** built as an interactive artifact 2026-07-11. Values below are the durable record; the app CSS is the eventual home.

Related: [[Signal Card Design Science]] · [[Bubble Discipline]] · [[Card Placement Studio + Notch Mode]] · [[Post-call belief heatmap + readiness hue]]

---

## 1. North Star

**Granola-clean.** Warm neutrals, generous whitespace, subtle depth, calm premium. The dashboard should feel like a focused instrument a professional keeps open all day — not a busy SaaS dashboard. Granola is the explicit benchmark (recurring in the vault: "clean, draft-first," "just works"). Sebastian's own words for the current state: "feels flimsy," "Frankensteined," "nothing cohesive." The fix is not more visual flair — it's **consistency + shared motion.** Smooth is mostly the absence of things fighting.

**The agency rule:** define the rules once; every component obeys them. Nothing gets its own opinion. That is the entire difference between "made by five people" and "made by one hand."

---

## 2. One Language, Two Surfaces (the key reconciliation)

Wingman lives in two very different contexts. They do **not** look identical — forcing that would break the HUD's research-backed design. They are unified by type, motion, restraint, and accent.

| | **Dashboard** (web, Railway) | **HUD** (Electron overlay, needs a release to ship) |
|---|---|---|
| Context | A calm surface you read and operate | A heads-up display floating over a live video call |
| Ground | Light, warm (`--paper` #FAF8F4) | Dark, glassy (`rgba(18,18,24,0.82)` + blur) — **recedes** against video, per [[Signal Card Design Science]] |
| Color | Neutrals + one accent + state | White text only, **no** saturated color coding (color forces focal attention mid-call) |
| Density | Spacious, document-like | Minimal, ≤ one line, sub-second glance |
| Type | SF Pro, full scale | SF Pro, 18px / weight 700 (peripheral legibility) |
| Motion | Calm, one easing curve | 200ms fade-in, no slide (suppresses startle reflex) |

**What unifies them:** SF Pro across both · fade-not-slide, one easing curve · restraint (nothing fires/moves without reason) · the same "signal blue" accent, used sparingly. **Do not** re-skin the HUD card to the light dashboard style. The HUD dark spec is canonical and load-bearing.

---

## 3. Color

Warm neutrals — grey nudged toward the accent so it reads as *chosen*, not defaulted. One confident accent carries interaction. **Three separate color jobs, never mixed:** neutral (structure), accent (interaction), state (outcome). A fourth, the sunset gradient, is data-viz only.

### 3a. Neutrals — Light (dashboard default)
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#FAF8F4` | App background (warm white) |
| `--surface` | `#FFFFFF` | Cards, raised surfaces |
| `--surface-sunken` | `#F1EEE8` | Insets, tab tracks, hover fills |
| `--ink-1` | `#1B1A17` | Primary text (warm near-black) |
| `--ink-2` | `#55524B` | Secondary text |
| `--ink-3` | `#8B877E` | Muted / placeholder |
| `--line` | `#E6E2D9` | Hairline borders |
| `--line-strong` | `#D6D1C6` | Input borders, stronger dividers |

### 3b. Neutrals — Dark (dashboard dark mode)
`--paper` #171613 · `--surface` #201F1B · `--surface-sunken` #100F0D · `--ink-1` #F3F0E9 · `--ink-2` #ADA99F · `--ink-3` #726E64 · `--line` #302E28 · `--line-strong` #403D35. Both themes are *designed*, not inverted.

### 3c. Accent — "Signal blue" (confident, calm, aviation)
| | Light | Dark |
|---|---|---|
| `--accent` | `#3557C7` | `#7E9BFF` |
| `--accent-hover` | `#2A47A3` | `#94ABFF` |
| `--accent-weak` (tint bg) | `#ECEFFA` | `#23294A` |

Used sparingly: primary buttons, focus rings, active tab, links, the HUD objection tag. Not a fill-everything color.

### 3d. State (outcome — separate system, never decoration)
| State | Light hue / weak-bg | Meaning |
|---|---|---|
| `--positive` | `#3E8E5A` / `#E7F1EA` | Closed / won |
| `--warning` | `#B77F27` / `#F6EEDD` | Caution / mid |
| `--critical` | `#C24338` / `#F7E7E4` | Lost / danger |
Dark: positive #67B98A · warning #D4A250 · critical #E07A6F.

### 3e. Sunset gradient (data-viz ONLY — [[Post-call belief heatmap + readiness hue]])
A **continuous** red → amber → green scale for *scoring* surfaces only: post-call belief/framework blocks colored by exact score, and the close-readiness indicator's fluid hue. **Locked decisions (Decisions Log 2026-06-02/03):**
- Single-call breakdown = keep **labeled blocks**, but color each on the sunset gradient by its real score (78% → yellow-green, 20% → red-orange). Blocks win for readability; the gradient delivers the "sunset" feel.
- All-calls-over-time = a sunset **scatter** (x=date, y=score) — that's where a true scatter earns its keep.
- Close-readiness = the indicator's *own color* shifts fluidly (red→yellow→green by live belief score). **Always paired with words + the move** — color for feel, words for action. Never a bare gauge/%.
- User-facing labels use **our** pillar names (Core Problem, Can't DIY, Cost of Waiting, Dream Outcome, Investment, Who's Deciding, Why You), never Cole Gordon's.

This gradient is **not** the accent and **not** the state pills. It is its own track, reserved for score.

---

## 4. Typography

The system sans (SF Pro on Mac) does the talking; character comes from the scale, weights, and negative tracking — not a novelty font. A monospace face handles anything that lines up in a column (durations, grades, timestamps, dollar figures).

- `--font-sans`: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif`
- `--font-mono`: `ui-monospace, "SF Mono", "SFMono-Regular", Menlo, monospace`

| Role | Size | Weight | Tracking |
|---|---|---|---|
| Display | 32px / 2rem | 700 | -0.022em |
| H1 | 24px | 650 | -0.02em |
| H2 | 20px | 600 | -0.015em |
| H3 | 17px | 600 | -0.01em |
| Body | 15px | 400 | -0.006em, line-height 1.55 |
| Small | 13px | 400 | — |
| Label | 11px | 600 | uppercase, +0.09em |
| Data | mono | 500–600 | `tabular-nums` |

(HUD card overrides: 18px / 700 headline — see [[Signal Card Design Science]] §Typography.)

---

## 5. Space · Shape · Motion

The rhythm that makes it feel like one hand — and makes it feel smooth.

- **Spacing:** 4-point scale — 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Layout via flex/grid `gap`, not per-element margins.
- **Radii:** `--r-sm` 6 · `--r-md` 10 · `--r-lg` 14 · `--r-xl` 20 · `--r-full` 999. (Cards = lg, buttons/inputs = md, pills = full.)
- **Elevation:** soft + diffuse, three steps. sm `0 1px 2px rgba(28,26,21,.05)` · md `0 2px 10px rgba(28,26,21,.07)` · lg `0 12px 40px rgba(28,26,21,.10)`. Dark leans on borders more than shadows.
- **Motion:** ONE easing curve — `cubic-bezier(.2,.6,.2,1)` — durations 120 / 180 / 260ms. Fade, don't slide. Respect `prefers-reduced-motion`. HUD card = 200ms fade-in / 150ms fade-out (research-backed, do not change). Card streaming reveal must be "one calm motion, not a stuttering teleprompter" ([[HUD card streaming idea]]) — constant cadence, soft word fade, never raw network chunks.

---

## 5b. Component Foundation — shadcn + tokens (decided 2026-07-13)

**Every UI surface across the whole product uses shadcn/ui as the single component foundation** (already the stack — Nova preset). Rationale + the mechanism that delivers the "one consistent feel" Sebastian wants (the Apple / Anthropic / Granola "smell, taste, look, feel" — deliberately NOT vibe-coded):

- **Two layers, both required.** (1) shadcn = the *parts* — accessible, battle-tested primitives → avoids the janky/vibe-coded floor. (2) Our tokens = the *paint* — mapped into shadcn's theme CSS variables so every component wears the Wingman language, not generic default-shadcn. Default shadcn looks like default shadcn; the tokens are what make it smell like Wingman.
- **Why this fixes the "frankensteined" complaint:** components Sebastian collected from other shadcn-based sites (shadcnblocks, etc.) all read the SAME CSS variables → once tokens are set, imported components inherit the Wingman look automatically and stop looking like guests. Caveat: heavy third-party sets (Aceternity, Magic UI) bake in custom styles/animation that need light manual reconciliation.
- **The real enforcement = discipline in one place (this is what actually separates Apple/Anthropic from everyone):** ONE token file, everything reads from it; NO hardcoded hex / one-off spacing / stray fonts anywhere; every screen built from the same primitives; this design-language page is the reference every screen is checked against. Consistency comes from *no exceptions*, not from the library.
- Build step: map tokens → shadcn theme vars in one `globals.css`, then build every screen from shadcn primitives.

## 6. Component Principles

- One set of primitives (button, input, tabs, pill, card, table row, dialog) that all read from these tokens. Imported shadcn components get **re-skinned to these**, never pasted in raw. That re-skin is what stops them looking like guests.
- What's interactive looks interactive (hover + visible focus state on everything focusable).
- Buttons: primary (accent) · secondary (surface + line-strong) · ghost · danger (critical-weak → critical on hover).
- Status pills carry state color + a dot; grades/durations/money use mono + tabular-nums.
- **PLAIN ENGLISH — no methodology jargon in anything the rep sees live** (Sebastian, 2026-07-13, emphatic). Copy must land in one second for a rep with ZERO sales training. Banned: insider/Cole-Gordon/NEPQ vocabulary like "sized the pain," "cost of waiting," "belief," "one belief from a clean pitch," "the gap." Say the human version: "how much it's hurting them," "how urgent this is," "who makes the final call." This governs **every** card — readiness reads AND generated lines. (Internal AI scratchpad may use methodology terms; the rep-facing surface never does — same split already established for the post-call viz pillar labels.) Ties directly to the #1 quality fear: jargon reads as "mediocre/confusing" even when the underlying call is right.
- **ONE signal-card format for all four moves** (objection / answer / dig / close): a tiny type-tag (which move it is) + a single first-person line the rep says, revealed at constant rate. **No headline, no separator, no italic support line, and NO wrapping quotation marks** — the line is shown plainly as the words to say, not as a quotation. Re-confirmed by Sebastian 2026-07-13 (quote-marks removal added same day). This completes the 2026-06-21 two-tier drop, which only ever got applied to the objection card. ⚠️ **Code gap (two items, both for the HUD rebuild):** (1) the shipping HUD still renders the OLD two-tier mode for answer/dig/close (`hud/index.html` two-tier path + the `kb-signal` `header`/support payload) — reconcile to the single-line `headless` format. (2) Signal-card lines currently render wrapped in quotation marks — strip them (and/or fence the generation prompt in `objection-signal.ts` / the card slots so the model never emits surrounding quotes).

---

## 7. Consolidation — what's canonical vs. stale

Sorting the scattered notes so we stop re-litigating.

**Canonical (folds into this language):**
- [[Signal Card Design Science]] — HUD dark card spec. Live, load-bearing.
- Sunset gradient / readiness hue — decision locked (Decisions Log 2026-06-02/03).
- Granola-clean north star — ratified here.
- Streaming smoothness ([[HUD card streaming idea]] + Beta Tuning `REVEAL_EASE`/`REVEAL_MIN_CPS`).

**Superseded (retire):**
- `_Inbox/2026-06-10 HUD layout configurator idea` → early draft of [[Card Placement Studio + Notch Mode]] (2026-06-30). 06-30 is canonical.
- Light 4-color-variant signal cards → replaced by unified dark (2026-04-10).
- Two-tier ≤5-word headline + subtext card → dropped 2026-06-21 (now: tiny type-tag + one spoken line).

**Done (not a todo):**
- Top-center card placement default → shipped 2026-06-29. The *default* is done; the *customizer page* below is not.

**Full HUD element set (catalogued from code 2026-07-13 — all rendered in the artifact at real spec):**
ambient/live dot · signal card (headless / two-tier / objection-flow "MOVE #N") · compass (↑ objection / ← answer / → close / ↓ dig; picked-green-flash + unpicked-fade) · summon pill (thinking/error/unsupported) · outcome card "How'd it go?" (5 pills) · toast family (call-detected, deploy-status, end-call, auto-stop, approaching-limit, setup-required) · tray popover (idle/live). Retired-but-in-DOM: stage bar (`display:none`, Phase 5 cleanup pending). Dead React components in `src/components/wingman/` (LiveCallView/SignalCard/StageBar/LiveScorecard/SignalLog — not imported anywhere; the OLD light-themed card lives here, not the shipping one).

**Confirmed NET-NEW (verified absent in code — the design page is their spec):**
- **Close-readiness** (red→yellow→green by live belief score) — zero code exists. **Design locked 2026-07-13: readiness is NOT a standalone gauge/bar and NOT tinted onto the compass → arrow.** The compass arrows are *triggers*; putting the outcome-color on the trigger both distracts the choice and kills the press→reveal payoff. **What it answers (Sebastian, 2026-07-13, the cleanest definition):** *"Have I done enough discovery to earn the pitch?"* — i.e. discovery-completeness / pitch-readiness, expressed as a color + a short read of where you stand. It is **driven by the Belief Ladder score** (how many discovery beliefs are established), so the color is synthesized from real data, not vibes. **One synthesized read, NOT a live checklist of pillars** (Playbook rule — no checklist during the call).

Instead, readiness is a **result** of pressing → Close. **FINAL FORM (locked 2026-07-13): a minimal, shrink-to-fit status chip — one color + a two-word label. Word-only, NO reason line, NO script.** The 4-step ladder:

| Color | Label |
|---|---|
| 🔴 red `#C24338` | **Not Ready** |
| 🟠 amber `#D98A3D` | **Continue Discovery** (an instruction, not just a state — tells the rep what to do; Sebastian 2026-07-13) |
| 🟢 yellow-green `#7FA84E` | **Almost Ready** |
| 🟢 green `#3E8E5A` | **Ready to Pitch** |

Rationale for word-only (Sebastian chose this over a with-reason variant): fastest possible glance, **nothing generated** → can't be jargon-y or mediocre (kills the #1 quality fear for this surface), and it's "bumpers not script" (Core Rule #10) — it tells you *where you are* and trusts a pro to act. On a live call the rep sees ONE chip (the current state), sized to the words. Box shrinks to fit — no empty space. The "what's missing / why" reason was explicitly cut from the live HUD (belongs in post-call review if anywhere).

- **Ready = just "Ready to Pitch."** No transition line — everyone's pitch entry is their own; a scripted line would be wrong for most reps.
- **Digging stays on the ↓ trigger — never duplicated on the close card.** One capability, one trigger.
- **All labels plain English, no methodology jargon** (see copy principle above).

Only ever shown after a press (never ambient) → sidesteps the peripheral orienting-reflex problem. Color language = the sunset gradient. The full spectrum bar-with-marker is a **dashboard** post-call pattern only, never the HUD.

**Broader note — signal-card QUALITY is Sebastian's #1 product fear** (that surfaced lines will be "mid/mediocre"). The design lever we control: minimize how often the product must generate a word-for-word line, and lean on the rep's skill (bumpers, not script). Line *quality itself* is a build-time tuning problem (prompt design + Sales DNA context injection + the existing objection-eval harness), not something the design language fixes — but the design should never force a generated line where a lighter nudge suffices.
- **Signal-card color customization** (card background + text/letter color) — no theming hook exists; card colors are hard-coded literals in `electron/hud/index.html`. This would be the first `--signal-*` theming hook. Saved per rep, applied every call. **Spec locked 2026-07-13:** Card color = **2 presets** (dark default `rgba(18,18,24,0.82)` + white `rgba(245,243,238,0.95)`). Text color = **4 presets** (white, blue `#7E9BFF`, green `#4ED188` "slightly neon not too neon", yellow `#F1D24C`) **+ a color-wheel picker** (native `<input type=color>`) on BOTH card and text for any color. ⚠️ **Build must guard readability** — block/auto-correct unreadable combos (e.g. white card + white text). Live preview updates as they pick.

**Unbuilt features that get built IN this language (not part of defining it):**
- [[Card Placement Studio + Notch Mode]] — dashboard page: drag/position the card on a mock call, Notch vs Floating, text color/size; plus live drag during calls. Base component candidate: shadcn draggable-window container. Inspiration: Moody (look + placement, NOT behavior).
- Homepage / metrics redesign — chart-on-top hero (close-rate trend), drop the "Total Closes" vanity card, Week/Month/Year segmented toggle, move outcome capture off the HUD popup into the dashboard (`_Inbox/2026-07-11 Paper capture`, item 4b).

---

## 8. Rollout Order (one language, many rebuilds — NOT one big build)

1. **Lock the language** (this doc + artifact) — approve the feel. ← *we are here*
2. **Tokens into the app** — one CSS source of truth the dashboard reads from.
3. **Rebuild the dashboard screen by screen** against it (first screen TBD after approval).
4. **Reconcile the HUD** to share type/motion/accent (keeps its dark spec) — needs a desktop release to reach installed apps (different shipping track from the web dashboard).
5. **Build features in the finished language** — Card Placement Studio, homepage redesign, etc.

Rationale for staging: dashboard deploys instantly via Railway; HUD needs a version bump + release. Building everything at once would create a giant unmergeable change and risk the live-call pipeline. Language once, rebuilds sequential.
