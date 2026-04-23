# Wiretap Compliance Research

Last updated: 2026-04-23

Source of truth for Wingman's legal/compliance posture around call transcription. Generated from deep research on 2026-04-23 and should be revisited whenever a new case ruling or competitor pattern emerges.

---

## TL;DR

- **Recall.ai provides zero compliance air cover** — all liability sits with the developer (Wingman).
- **Cluely (the closest architectural analog) shifts liability via ToS** and markets as "undetectable" while internally requiring users get consent. They had a 2025 breach exposing 83K transcripts — cautionary tale.
- **Real 2025 case law has confirmed AI transcription IS subject to wiretap laws.** *Ambriz v. Google* and *Brewer v. Otter.ai* are the pivotal cases.
- **Every major competitor uses bot-in-call with visible presence.** Wingman + Cluely are silent-desktop outliers.
- **The viable invisibility-preserving path:** layered silent disclosure (auto chat post + calendar invite + ToS + onboarding acknowledgment) with a pre-built audible-notification kill-switch ready to ship in 48h if challenged.
- **Transcript retention:** keep indefinitely, user-deletable. The risk is breach exposure, not retention period.

---

## 1. Recall.ai Official Compliance Guidance

Recall's stance is hands-off. From their Desktop Recording SDK FAQ: *"The developer is responsible for staying compliant with recording laws, and Recall only provides the tools to enable recording on desktop."*

Key points:
- **No "silent recording" guidance page exists.** Recall has not published compliance playbooks, state-by-state guidance, or recommended disclosure patterns.
- **Recall's Terms of Use** require developers to use the service in compliance with all applicable laws, prohibit illegal/harmful activity, and disclaim liability — standard SaaS language.
- **Compliance certifications** (SOC 2 Type 2, ISO 27001, GDPR, CCPA, HIPAA) apply to Recall's handling of data — not to whether Wingman's recording practice is legal.
- The SDK is sold as a capability to record without host permission — that's the feature, the liability is ours.

**Bottom line:** Expect zero air cover from Recall if a rep gets sued.

Sources:
- https://docs.recall.ai/docs/desktop-recording-sdk-faq
- https://docs.recall.ai/docs/desktop-sdk
- https://www.recall.ai/terms-of-use
- https://security.recall.ai/controls

---

## 2. How Cluely Handles This

Cluely is the closest architectural analog to Wingman — silent desktop AI overlay on Zoom calls. Their case is a template in what and what not to do.

- **Cluely's ToS explicitly prohibits use of audio-capture features in two-party consent jurisdictions without consent from all parties.** Their privacy policy tells users they *"must inform all call participants that recording is happening and get their consent."*
- **Cluely provides no built-in disclosure mechanism** — no Zoom chat auto-post, no pre-call email. They shift the entire compliance burden to the user in the ToS.
- **Not sued over consent grounds (as of April 2026)** but widely criticized in press for marketing "undetectable" while their ToS requires disclosure.
- **Mid-2025 data breach** exposed ~83,000 users' transcripts and screenshots.
- **By late 2025 they rebranded** away from "cheat on everything" toward "standard meeting assistant" framing.

**Lessons for Wingman:**
1. ToS-only approach is survivable but pairs badly with "undetectable" marketing — reads as a liability trap.
2. Don't market invisibility as the point — market it as "non-distracting."
3. Long-term transcript storage is reputational dynamite — breach exposure is worse than retention length itself.

Sources:
- https://cluely.com/privacy-policy
- https://cluely.com/terms
- https://en.wikipedia.org/wiki/Cluely
- https://tldv.io/blog/cluely-review/

---

## 3. Two-Party Consent Law — 2026 State-by-State

**All-party consent states (telephonic/electronic communications):** California, Connecticut, Delaware, Florida, Illinois, Maryland, Massachusetts, Michigan, Montana, Nevada, New Hampshire, Oregon, Pennsylvania, Washington. (~12–14 states depending on in-person vs. electronic distinctions.)

**Federal baseline:** 18 U.S.C. § 2511 (ECPA) is one-party consent.

**Cross-state rule:** Courts apply the **stricter standard**, per *Kearney v. Salomon Smith Barney* (Cal. Sup. Ct. 2006). If either party is in a two-party state, treat it as two-party. Practically — for a US-wide sales app, assume all-party consent is required.

**Critical 2025 case law — AI transcription specifically:**

- **Ambriz v. Google (N.D. Cal., Feb 10, 2025)** — Court denied motion to dismiss and held CIPA's third-party wiretap definition extends to AI voice products that have the capability to use data for the software provider's benefit. AI transcription is NOT exempt from CIPA just because no human hears it.
- **Brewer v. Otter.ai (N.D. Cal., Aug 2025)** — Active class action alleging Otter's Notetaker joins meetings and records non-host participants without consent. Still in litigation.
- **IAPP, Morrison Foerster, Fisher Phillips, Littler, Reed Smith** — all published 2025 advisories warning AI notetakers are in the wiretap-litigation crosshairs.

**Penalties (CIPA example):** Up to $5,000 per violation or three times actual damages, plus criminal misdemeanor exposure. **Civil class actions are the realistic threat, not criminal prosecution.**

Sources:
- https://www.recordinglaw.com/party-two-party-consent-states/
- https://iapp.org/news/a/dressing-old-laws-in-class-action-suits-applying-anti-wiretapping-laws-to-ai-transcription-services
- https://www.goodwinlaw.com/en/insights/publications/2025/02/alerts-practices-dpc-ftec-ai-voice-products-subject-to-california-invasion-of-privacy-claims
- https://www.mofo.com/resources/insights/260220-a-mofo-privacy-minute-q-a-wiretapping-theories-reach-ai-notetakers
- https://captaincompliance.com/education/old-wiretapping-laws-new-ai-tools-what-brewer-v-otter-ai-and-ambriz-v-google-mean-for-ai-transcription-services/
- https://www.npr.org/2025/08/15/g-s1-83087/otter-ai-transcription-class-action-lawsuit
- https://legalclarity.org/recording-phone-calls-across-state-lines-what-you-need-to-know/

---

## 4. Invisibility-Preserving Disclosure Mechanisms — Legal Viability

**A. Silent Zoom/Meet/Teams chat post at call start** — **Moderate protection.** Industry practice (Fireflies pins an in-meeting chat compliance message; Gong announces "Gong is in the room"). Continuing the call after visible notice generally constitutes implied consent in California and most two-party states. Weakness: prospects may not read chat; "clear and audible" is the safer standard under CIPA case law. **This is the best invisibility-preserving option for Wingman.**

**B. Pre-call email disclosure (calendar invite / confirmation)** — **Weak on its own.** Industry guidance: disclosure must occur at or immediately before the call begins. Fathom uses 24-hour-ahead email but layers it with an in-meeting notification. Useful as a layer, not the only layer.

**C. ToS / website disclosure** — **Weakest.** No court has accepted website ToS as sufficient for call-recording consent. Useful only as a backstop that documents the rep was told their obligations.

**D. Recording beep/tone** — Historically accepted under FCC rules for phone monitoring but courts require the tone be audible and identifiable. Untested for AI transcription of video calls. Also arguably breaks invisibility.

**E. No disclosure at all (current Wingman design)** — **Real, not theoretical, risk.** *Brewer v. Otter* and *Ambriz v. Google* show plaintiffs' bar is actively suing AI transcription products in California. Enforcement pattern: civil class actions against the company, not individual users. But a rep in California could face CIPA civil liability personally ($5K per violation).

Sources:
- https://guide.fireflies.ai/articles/7003995379-Recording+Consent+and+Meeting+Compliance+in+Fireflies:+Opt-In,+Opt-Out,+and+Controls
- https://help.fathom.video/en/articles/294272
- https://www.avoma.com/blog/ai-notetaker-security-features
- https://support.zoom.com/hc/en/article?id=zm_kb&sysparm_article=KB0068402
- https://www.vonage.com/resources/articles/call-recording-disclosure/

---

## 5. Competitive Benchmark

| Tool | Approach | Disclosure mechanism |
| --- | --- | --- |
| Gong | Bot-in-call | Verbal "Gong is in the room" + visible participant |
| Chorus (ZoomInfo) | Bot-in-call | Visible participant + consent prompts |
| Fireflies.ai | Bot-in-call | Email 1hr prior + pinned in-meeting chat + visible participant |
| Otter.ai / OtterPilot | Bot-in-call | Visible, **actively being sued** (Brewer) over non-host consent |
| Fathom | Bot-in-call | 24hr-ahead email + in-meeting notification |
| Read.ai | Bot-in-call | Visible participant |
| Grain | Bot-in-call | Visible + chat notification |
| Avoma | Bot-in-call | Email reminders + verbal bot announcement |
| **Cluely** | Silent desktop | ToS-only (no built-in mechanism) |
| **Wingman (today)** | Silent desktop | None |

Every major competitor uses bot-in-call with visible presence. Wingman + Cluely are the only silent-desktop outliers. **No competitor requires the rep to verbally announce — the bot does it.** This is important: the competitive norm is automated disclosure, not rep-delivered.

---

## 6. Recommended Game Plan

**Default stance:** Ship with a **layered silent-disclosure stack** that preserves invisibility while creating a defensible consent record. Do not require rep verbal announcement.

**The three-layer stack:**

1. **Auto-posted Zoom/Meet/Teams chat message at call start** — default on, configurable. Message: *"This call is being transcribed for note-taking. Please let [rep name] know if you'd prefer not to be transcribed."* This is the workhorse. Implied consent by silence. Fireflies does this exact thing. Visible during the call but non-disruptive.

2. **Calendar invite auto-insert** — boilerplate line added automatically when rep connects their calendar: *"By accepting this meeting, you acknowledge it may be transcribed by an AI assistant for the host's note-taking purposes."* Wingman inserts this at onboarding.

3. **Rep-facing ToS** with explicit reps-and-warranties that the user will comply with Recording Laws and will indemnify Wingman. Mirror Cluely's ToS language — industry-standard and has survived scrutiny.

**Onboarding acknowledgment:** One-screen compliance checkbox before first Deploy. Calendar auto-insert opt-in on the same screen. Log the acknowledgment in Supabase with timestamp and IP.

**What preserves invisibility:**
- No bot joins the call.
- No verbal announcement by rep.
- Chat post reads like a normal assistant notification, not a bot.
- Prospect never sees the word "Wingman."

**Residual legal risk:** Moderate but acceptable for a small startup.
- **Company risk:** Wingman is SaaS vendor, not recorder. Liability primarily flows to rep per *Kearney*. But *Ambriz v. Google* shows plaintiffs will try to name the AI provider. Shift risk via ToS indemnification from user.
- **Rep risk:** Layered disclosure + implied consent is defensible but not bulletproof in California.
- **Enforcement reality:** Class actions, not criminal prosecution. Realistic blast radius is one public lawsuit + press cycle, not shutdown.

**Specific things to add:**

- **App:** Default-on chat-post-at-start for Zoom/Meet/Teams; per-call toggle; state-aware warning if rep has configured a location in a two-party state and disables the chat post.
- **Website:** System requirements section gets a line: *"Wingman is designed for sales professionals who comply with applicable call-recording laws in their jurisdiction."* Link to a compliance page covering state-by-state guidance.
- **Rep onboarding:** One-screen compliance acknowledgment checkbox (+ "I understand"). Calendar auto-insert opt-in. Logged.
- **ToS:** Reps-and-warranties + indemnification from user. Industry-standard language.
- **Data:** User-deletable transcripts (per-call + account wipe). Cluely's breach is the cautionary tale. Indefinite retention is fine IF the user controls it.

**Kill-switch option:** If a state AG sends an inquiry or a class action is filed:
1. Ship a mandatory update within 48 hours that enables an audible in-meeting notification via Electron system audio (plays a short TTS "This call is being transcribed by an AI assistant" at call start) — kills invisibility for that state only via geofencing on rep's billing address.
2. Pause Deploy for any rep flagged as operating in the plaintiff's state until acknowledgment is re-signed with new disclosure language.
3. Invoke indemnification clauses in ToS.

**Pre-building the kill-switch — even unshipped — is itself a liability-reduction move.** Shows a reasonable compliance posture if litigation ever happens.

---

## What to Do Next

This is a multi-session build. Break into discrete initiatives:

1. **Rep-facing ToS + onboarding acknowledgment screen** (small — UX + DB table)
2. **Auto-post chat message at call start** (medium — Zoom/Meet/Teams API integrations or Recall SDK chat hook)
3. **Calendar invite auto-insert** (medium — Google Calendar + Outlook API integrations)
4. **User-controlled transcript deletion UI** (small — per-call delete button + account wipe)
5. **Compliance page on marketing website** (small — content writing)
6. **Kill-switch code — unshipped but built** (medium — Electron audio notification + geofencing logic)

Tackle in order 1 → 4 → 5 → 2 → 3 → 6. Number 1 is the minimum legal foothold to ship any public beta.

---

## Open Questions

- Does Recall.ai's Desktop SDK expose a programmatic hook to post messages into the Zoom/Meet/Teams chat from outside the call? Or do we need separate Zoom/Meet/Teams API integrations for this? Research before building.
- Geofencing: billing address is a proxy for location but not accurate for traveling reps. Is there a better signal? IP-based? Let the rep declare their primary state during onboarding?
- Calendar integration scope: Google + Outlook covers most. Apple Calendar? Worth the complexity?
