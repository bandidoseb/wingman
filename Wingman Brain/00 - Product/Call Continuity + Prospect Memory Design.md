# Call Continuity + Prospect Memory — Design

**Status:** DESIGN IN PROGRESS. Brainstormed live with Sebastian on 2026-06-05. Not yet built, not yet fully locked — this captures the shape so we can keep refining and then sequence it against the hotkey phases. No code written.
**Why this exists:** Wingman currently treats every call as an island — it remembers nothing from one call to the next. Two real-world problems break that assumption. This doc is the plan to fix both.

---

## The problem (two time horizons, one root cause)

Wingman is amnesiac between calls. That fails reps in two ways:

1. **Call drops (minutes).** WiFi dies — the rep's or the prospect's — the call ends, they rejoin. Today Wingman starts fresh and loses everything from 2 minutes ago. Sebastian hits this **2–3×/month**, so every rep will hit it a few times a month.
2. **Multi-call closes (days).** Most high-ticket sales are **not** one-call closes — they're 2–3 call closes. The discovery from call 1 (pain, the gap, budget, who decides) must carry into calls 2 and 3. If Wingman opens every call blank, reps get annoyed that "it doesn't remember anything," and that kills trust.

Both are the same root capability: **memory that outlives a single call session and is tied to a prospect, not a call.**

---

## Tiering (LOCKED 2026-06-05)

| Capability | Tier | Rationale |
|------------|------|-----------|
| **Drop-resume** — reload the call you *just* lost to WiFi | **CORE** | Basic reliability. Losing context to a dropped connection is a bug-level failure, not a luxury. |
| **Cross-call deal memory** — remember a *different* call from days ago, carry it into the follow-up | **PREMIUM** | The relationship/pipeline intelligence. This is the moat + the upsell. |
| Calendar connect, prospect/deal pages, pre-call briefings, deal-level "coach that knows everything" chat | **PREMIUM** | All part of the pipeline-memory upsell. |

**The clean line:** resuming *the same call* = core. Remembering *a different call* = premium.
**Upsell story:** *"Wingman remembers your whole pipeline."*

---

## The mental model: a "Prospect" thread (groups calls)

Today `calls` are standalone rows. The shift: introduce a **Prospect** entity that groups every call with the same person. The distilled call memory (the Belief Ladder) accumulates at the **prospect level**, not the call level.

- Call 1 ends → its final Belief Ladder rolls **up** into the prospect's memory.
- Call 2 starts (linked to that prospect) → Wingman **loads** that memory as the *starting* scorecard, not a blank one. The first arrow press on call 2 already knows everything from call 1.
- Call 1's post-call job also writes a **"next-call game plan"**: *"Locked: pain, desire. Still open: budget, spouse. They said they'd talk to their wife. Pick up here."*

> Naming TBD — "Prospect" vs "Deal" vs "Thread." Using **Prospect** in this doc (identity = the person). A future "repeat buyer = multiple deals per prospect" split is deferred.

This is the difference between a per-call gadget and **the rep's memory of the relationship.** That's the moat.

---

## The identity backbone: Recall calendar + email

The thing that makes cross-call linking *safe* is a **stable prospect ID**, and the only reliable one is **email** (a Zoom display name is not — two people are both "Mike"). We get email from the **calendar**, via Recall (we already use Recall, so we lean on it rather than building Google OAuth ourselves).

**What Recall's calendar integration gives us:**
- **Providers:** Google Calendar + Microsoft Outlook. OAuth connect.
- **Per event:** an **attendees array with emails** + response status, start/end time, and the **meeting URL** (auto-detected; precedence Zoom → Meet → Teams → Webex → GoTo).
- **Fuzzy match (the magic):** Recall matches the calendar invite's attendee **names+emails** to the **live call's display names** — handling nicknames (Robert↔Bob), spelling, romanization. So the prospect's **email gets attached to their live transcript lines.** That's how Wingman knows *who* is on the call, by email, mid-call.
  - **Degrades safely:** low confidence / group invite that doesn't expand / ambiguous → returns **null**, never a wrong guess. We fall back to the explicit picker. (No silent wrong-merge — ever.)
  - **Only for calendar-scheduled calls** (not ad-hoc / API-scheduled bots). Off-calendar calls use the Zoom-name + explicit-pick fallback.

**Operational reqs:**
- Participant-email matching is behind a **Recall feature flag** → email Recall support / Slack channel to enable. One-time.
- Likely use **Calendar V2** (more control: granular bot scheduling, webhooks for calendar events). Evaluate V1 vs V2 at build.
- Calendar sync is async (the connection's `platform_email` may be null briefly right after connect).

**Event filtering ("which events are real sales calls?"):** an event with a **meeting URL** + at least one **attendee outside the rep's email domain** = a client call. Internal blocks / solo time / personal events get filtered out of the rep-facing views. (It's fine if the whole calendar syncs behind the scenes — most reps have a separate business calendar — we just *show* the client meetings.)

---

## Linking: all three methods, never silently merge

**Hard safety rule:** a match may *suggest*, never auto-apply. Loading Prospect A's memory into Prospect B's call (two "John"s) would make the rep look insane mid-call and torch trust. Confirm, always.

1. **Explicit** — before deploying, rep picks "Follow-up with [prospect]" from a list. The floor; always works; accurate. For a known follow-up this feels natural, not annoying.
2. **Auto-suggest (calendar email)** — Wingman matches the live call to a calendar event → its external attendee email → an existing prospect. Prompts: *"Follow-up with Sarah (sarah@acme.com)? [Resume] [New prospect]."* Confident because it's email-based.
3. **Drop / reconnect (high-confidence, CORE)** — a call with the same identity ended < ~10 min ago → near-automatic *"Reconnecting to your call with Sarah? [Resume]."*

All three run on **one mechanism** (load a prospect's memory into the current call). Explicit is the floor; auto-suggest rides on calendar email; drop-resume is auto-suggest with a tighter recency trigger.

---

## What carries between calls (and what doesn't)

**Carries (the distilled memory — kept forever, prospect-scoped):**
- The rolling **Belief Ladder** (the 7 beliefs + status, the GAP, their exact-words quotes, open objections, weakest link).
- **Next-call game plan** (what's locked, what's open, what they committed to, what to do next).
- Prospect facts (name, email, company, phone if on the invite), call history, outcomes.
- **Full transcripts of every call** (premium deal page + deal-level chat read these).

**Does NOT carry / never stored:** audio, video. (Unchanged invariant.)

**Rollup mechanics:** the post-call Sonnet job (runs on every call end) merges that call's final Belief Ladder into `prospect.deal_memory` using the same **"recent overrides stale"** principle (call 2 says budget is $10k, not the $5k from call 1 → memory updates, doesn't append a contradiction). On the next linked call, `deal_memory` is loaded at call start as the live summary's starting point (same way `flight_plan_snapshot` is already loaded today).

---

## The pre-call briefing — "Today's Calls" home panel (PREMIUM)

A panel on the dashboard home that makes Wingman a **daily habit** (the retention unlock):

For each of today's scheduled client calls (from the calendar):
- Prospect name + company + time.
- **Where you left off** (last call's summary in a sentence).
- **What's still open** (the open beliefs / missing topics).
- **Wingman's recommended play** — how to advance/close this person next.
- A **chat button** → talk to Wingman about this prospect before the call.

Reps open this before every call to get ready. Daily-active-use is the holy grail for retention; this is what creates it.

---

## The prospect/deal page + deal-level "Ask Wingman" (PREMIUM — the phat upsell)

A page per prospect that carries **everything**: all calls, every transcript, the Belief Ladder, metadata, outcomes, the next-call game plan. On it:
- **"Ask Wingman about this prospect"** — the existing per-call Ask Wingman chat, scaled to the whole relationship. *"A coach that's read every minute of every call with this person and knows exactly where the deal stands."* Same engine, wider context.

This is the clearest premium value: the more calls in a deal, the more irreplaceable the memory becomes (switching cost = moat).

---

## Privacy & retention rails (mandatory — not optional)

Keeping everything forever, now tied to a **named, emailed prospect**, raises the stakes from "semi-anonymous transcript blob" to "identifiable third-party record" (exactly what Gong/Chorus do — industry-normal, but must be deliberate). The rails that ship *with* this:

- **User-controlled deletion** — per call, **per prospect (wipe the whole relationship, transcripts included)**, and account-wide. Ties to the existing compliance work (Known Issue #33).
- **Privacy policy** discloses retention of prospect PII (name/email/phone/transcripts) + how to delete.
- **Recording consent** (wiretap) posture already covers the prospect (ToS-shifts-to-rep approach, #33).
- **Calendar scope/transparency** — be clear we read calendar events to identify prospects + show today's calls; rep can disconnect (revoke) the calendar anytime.
- **Unchanged:** no audio, no video, ever.

---

## Data model (SKETCH — needs Sebastian's explicit approval + a migration before anything runs)

- **`prospects`** (new): `id`, `user_id`, `email` (identity key; nullable for off-calendar), `name`, `company`, `phone`, `status` (open / won / lost / dormant), `deal_memory` (JSONB — rolled-up Belief Ladder + next-call game plan + key facts), `first_seen_at`, `last_call_at`, timestamps. Soft-unique on `(user_id, email)` when email present.
- **`calls`** (existing): add `prospect_id` (nullable FK → prospects).
- **`calls.live_summary`** (from Phase 2): the persisted live Belief Ladder for that call (the keystone — see below).
- **`calendar_connections`** (new): `id`, `user_id`, `recall_calendar_id`, `provider`, `status`, `connected_at`. (Recall holds the actual event data; we store the connection ref + query/sync as needed.)
- Possibly a **scheduled-events cache** for the "Today's Calls" panel (or query Recall live).

---

## How this nests with Phase 2 (the one change to Phase 2)

My original Phase 2 plan held the live Belief Ladder summary **ephemerally in the app** (no DB). Call continuity makes that wrong. **The one change: Phase 2 persists the live summary to `calls.live_summary` on each ~90s tick** (still client-triggered, still Vercel-safe — the app just also writes it to the call row).

That single change is the **keystone** for everything here:
- **Drop-resume** = reload `calls.live_summary` from the just-dropped call. (Core, ships earliest.)
- **Cross-call memory** = the post-call job rolls `calls.live_summary` up into `prospect.deal_memory`. (Premium.)

So **Phase 2 is not wasted — persisting the summary is the foundation for both horizons.** Everything else stacks on top.

---

## Proposed phasing (to sequence against the hotkey build)

- **Phase 2 (current, adjusted):** build the live Belief Ladder summary **and persist it to `calls.live_summary`.** Keystone.
- **Phase A — Drop-resume (CORE):** detect a recently-ended call with the same identity (<~10 min) → on redeploy, offer "Resume?" → reload `live_summary` as the new call's starting memory. Can ship with Zoom-name + recency matching *before* full calendar (simpler, core reliability).
- **Phase B — Calendar connect + identity (PREMIUM foundation):** Recall calendar (V2), `prospects` keyed by email, fuzzy-match live call → prospect, the explicit picker.
- **Phase C — Cross-call deal memory (PREMIUM):** post-call rollup → `deal_memory` + next-call game plan; load at call start for linked follow-ups; the prospect/deal page; deal-level Ask Wingman.
- **Phase D — Pre-call briefing (PREMIUM):** the "Today's Calls" home panel.

(Phases A–D are the *continuity* track; the hotkey Phases 3–5 are the *live-card* track. Sequencing between the two tracks is a separate call — they share the live pipeline so likely still serial.)

---

## Open questions / still to decide

1. **Naming:** Prospect / Deal / Thread for the entity + the UI page.
2. **Drop-resume v1 without calendar?** Recommend yes — ship core drop-resume on Zoom-name + recency first; calendar makes it better later. (Confirm.)
3. **Dormancy/archive:** when does a prospect stop carrying memory — on won/lost, or time-based?
4. **Repeat buyers:** multiple deals per prospect — deferred, but confirm the v1 simplification (prospect ≈ deal).
5. **Premium gating mechanics** (Stripe tier boundaries) — defer to billing build.
6. **Deal-level chat context budget:** how much transcript across N calls to feed the chat (cost/latency) — build-time tuning.
7. **Calendar V1 vs V2** — confirm V2 at build.
8. **Dropped-then-resumed call must not double-count** — a WiFi drop + rejoin must NOT burn two of the rep's free calls (`calls_used` billing) or create two graded calls that pollute stats. The resumed call links/merges to the dropped one. (Phase A — real, must solve there.)
9. **Which "drop" are we solving?** — the rep's side ending (their WiFi/app died, or the meeting got recreated) is the real case. If only the *prospect* drops and rejoins the *same* meeting, Recall keeps recording and Wingman never lost context — nothing to resume. Be precise in Phase A so we don't over-build.
10. **Live summary format: text vs JSON** — store the filled Belief Ladder as plain text (simplest; the generation model reads it fine) or structured JSON (better for Phase 4's close-readiness scoring + any future visual ladder). Recommend text for v1; revisit if Phase 4 needs hard belief-state fields.

---

## One-paragraph essence

Connect the rep's calendar (via Recall) → Wingman identifies each prospect by **email** (fuzzy-matched from the invite to the live call) → a **Prospect page** carries everything about that relationship (transcripts + Belief Ladder + metadata + next-call game plan) → that memory **loads into every follow-up call** so Wingman is never blank → a **"Today's Calls"** panel briefs the rep before each call → and a **deal-level coach** chat knows the entire history. Drop-resume (reload a just-lost call) is **core reliability**; the cross-call relationship memory is the **premium moat.** The keystone that makes it all possible is Phase 2 persisting the live call summary to the database.
