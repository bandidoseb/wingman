# Anti-Vision

Last updated: 2026-04-02

What Wingman explicitly is NOT and will never be. Every boundary here exists for a reason. When a "what if we just added..." conversation starts, come here first.

---

## Not a CRM

Wingman does not manage pipeline, track deal stages, store contact records, or replace a CRM. It has no contact database. It doesn't sync to Salesforce or HubSpot. It doesn't know who the prospect is before the call starts.

**Why this boundary exists:** CRMs are a completely different category of software with a completely different buyer (ops/management) and a completely different purchase process (long evaluation, IT approval). Being a CRM is a distraction from the core product — real-time coaching. Every hour spent on pipeline management features is an hour not spent making signal cards better.

---

## Not a Dialer

Wingman does not make or receive phone calls. It does not manage a lead list. It does not auto-dial. It does not have a power dialer.

**Why this boundary exists:** Dialers are for SDRs running high-volume cold outreach. Wingman is for closers running low-volume, high-value discovery and close calls. Different user, different workflow, different product. The Recall.ai Desktop SDK listens to calls happening in Zoom or Google Meet — it's not a phone system.

---

## Not a Call Recorder

Wingman does not record audio or video. It does not produce a playable recording of the call. Users cannot download a recording from Wingman.

**Why this boundary exists:** Legal exposure (two-party consent in many states). Privacy — storing a prospect's voice without their knowledge. And more practically: our target user doesn't want a recording. They want a debrief and a grade. Call recording tools (Gong, Chorus) serve a completely different use case (manager review, deal inspection). Wingman serves the rep, not the manager.

---

## Not a Notetaker

Wingman does not generate meeting notes, action items, or summaries that get emailed to the prospect. It does not join calls as a visible bot to take notes.

**Why this boundary exists:** Notetaking tools (Otter.ai, Fireflies, Fathom) are designed to summarize the full meeting for all participants. Wingman is designed to coach the rep without the prospect knowing Wingman is there. These are incompatible philosophies. A notetaker bot visible to the prospect instantly destroys the "invisible copilot" positioning.

---

## Not Built for SDRs or Appointment Setters

Wingman does not coach cold callers or appointment setters. It is not designed for high-volume outbound prospecting, scripted cold calls, or discovery calls where the goal is to book a meeting (not close a deal).

**Why this boundary exists:** SDR calls have a completely different structure than closing calls. The objections are different, the psychology is different, the success metrics are different. The Sales KB is built on closing methodology content. Building SDR support means a different KB, a different prompt, and a different UX — effectively a second product. That's scope creep that kills the core.

---

## Not an Enterprise Tool

Wingman does not have team dashboards, multi-seat billing, SSO, admin controls, compliance reports, or procurement-friendly packaging.

**Why this boundary exists:** Enterprise means a 6-month sales cycle, an IT security review, a procurement process, and features that serve the organization's needs rather than the individual rep's. The info product closer market is the exact opposite — fast-moving, ROI-driven, individual buyer. Chasing enterprise prematurely dilutes the product and slows the company down at exactly the moment speed matters most.

---

## Not a Chatbot

Wingman does not have a general-purpose AI chat interface. The "Ask Wingman" feature in Mission Intel is specifically scoped to answering questions about the rep's own call history and patterns — not general sales questions, not role-play, not research.

**Why this boundary exists:** General-purpose chatbots are commoditized. ChatGPT exists. The value Wingman adds is contextual specificity — it knows *this rep's* calls, *this rep's* offer, *this rep's* patterns. Diluting that into a general sales assistant destroys the differentiation.

---

## Not a Tool That Fires Constantly

Wingman is not a real-time audio transcription ticker. It is not a tool that puts something on screen every 30 seconds. It is not a tool that shows everything the prospect says. It is not a notification machine.

**Why this boundary exists:** This is the most important anti-vision. A tool that fires constantly gets ignored. Reps tune it out. Then it becomes noise. Then it gets closed. Then it's useless. The entire product value proposition depends on signal cards being rare enough that when one fires, the rep pays attention. The 90-second cooldown, the trigger classifier, the stage-based suppression — all of it exists to enforce this boundary. Any feature request that increases card frequency is a product threat, not a feature improvement.

---

## Not for Closers Who Are Just Starting Out

Wingman is not onboarding training. It is not a script for beginners. It is not a tool that tells you what to say on every line of the call. It assumes the rep already knows how to sell — it just makes their best moments happen more often and prevents their worst moments from costing deals.

**Why this boundary exists:** A rep who doesn't know how to sell can't use Wingman effectively. They won't understand when the signal card fires or why. They'll read it verbatim, sound like a robot, and blame the product. The target user is an experienced closer who already closes at 20%+ and wants to get to 30%+. A rep at 5% needs a coach, not a copilot.
