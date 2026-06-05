# iMessage Funnel

Last updated: 2026-04-02

Full spec of the automated iMessage conversion funnel. This is the mechanism that converts free-tier users to paying subscribers at the highest-leverage moment possible.

---

## The Big Idea

The best moment to ask someone to pay for a tool is immediately after the tool helped them win.

For Wingman, that moment is: a free-tier closer just finished a call where Wingman detected close signals. They're feeling the high of a successful call. The ask to subscribe arrives in their phone — not in an email they'll read tomorrow, not in a pop-up they'll click away from — but in iMessage, where it feels personal and immediate.

This is the Cal AI / Alex Hormozi playbook applied to sales tools: trigger the conversion at the peak emotional moment.

---

## The Trigger Conditions

The iMessage fires when ALL of the following are true:
1. The user is on the free tier (has not yet subscribed)
2. The user is approaching their free tier call limit (e.g., call 5 of 5)
3. Wingman detects close-stage signals on the call (prospect asking about next steps, rep presenting price, objection handling, etc.)
4. The call has ended

**Why all four conditions?**
- Condition 1: Don't send to paying users (they've already converted)
- Condition 2: Timing — the limit creates urgency naturally
- Condition 3: The emotional peak. A call where nothing happened doesn't trigger this. A call where the rep was close to closing does.
- Condition 4: Wait until the call ends. Don't interrupt a live call.

---

## The Message (Working Draft)

*(Copy below predates the 2026-06-05 tiering — "unlimited" is now Pro-only; reframe as "upgrade" when finalized.)*

**Scenario A — Rep appears to have closed:**
> "Hey [first name] 👋 Wingman caught something on your last call. Looks like it went well. Ready to upgrade and keep Wingman on every call? meetwingman.ai/subscribe"

**Scenario B — Rep was in Close stage but unclear outcome:**
> "You've hit your free call limit with Wingman. Upgrade to keep Wingman in your corner on every close. meetwingman.ai/subscribe"

**Key principles:**
- Personal tone, not marketing speak
- Short — under 2 sentences
- Direct link to subscribe (reduce friction to zero)
- No pressure language ("you HAVE to upgrade") — just an invitation
- Sent from a number that can receive replies (not a no-reply shortcode)

---

## AI Reply Handling

When the rep replies, an AI (via Blooio) reads the message and routes accordingly:

| Reply type | AI response |
|-----------|------------|
| "Yes" / "How do I?" | Direct link to checkout: meetwingman.ai/subscribe |
| "How much?" / "What's the price?" | "$149/month. One close pays for a year. [link]" |
| "Not now" / "Maybe later" | "Got it — I'll check back with you. Wingman will still be there when you're ready." (then no follow-up for 7 days) |
| Question about the product | Answer it and route back to subscribe |
| No reply within 24 hours | No follow-up. Don't spam. |

**What the AI should NOT do:**
- Hard-sell or pressure
- Offer discounts unprompted
- Send more than one follow-up if there's no reply
- Pretend to be a human in a deceptive way

---

## The Tech Stack

**Blooio / Project Blue:** iMessage API that allows sending and receiving iMessages programmatically from a real phone number. Used for the outbound message and reading replies.

**Webhook from Railway:** When the post-call job completes and the trigger conditions are met, Railway sends a webhook to Blooio to trigger the iMessage.

**AI reply handler:** A Claude-powered response router that reads incoming replies and generates appropriate responses.

**Status:** Not yet built. Blooio account needs to be set up. Webhook integration needs to be built on the Railway side.

---

## Legal Considerations

- Users must opt in to SMS/iMessage communication during the signup flow. This is a legal requirement (TCPA in the US).
- The opt-in must be explicit: "By signing up, you agree to receive occasional text messages from Wingman. Reply STOP to unsubscribe."
- STOP must work immediately and permanently. No follow-up messages to users who reply STOP.
- One-party consent is sufficient for content about the user's own account, but the opt-in is still required to send marketing messages.

**Action required:** Add explicit SMS/iMessage consent to the signup flow before this feature is launched.

---

## Current Status

| Component | Status |
|-----------|--------|
| Free tier call limit enforcement | Need to verify implementation |
| Close-stage signal detection (for trigger) | In progress (part of live call pipeline) |
| Blooio/Project Blue integration | Not started |
| Outbound iMessage sending | Not started |
| AI reply handling | Not started |
| Webhook from post-call job | Not started |
| SMS consent in signup flow | Not yet added |

---

## Success Metrics

- **Trigger rate:** What % of free-tier users hit the trigger conditions?
- **Open/reply rate:** What % of users who receive the iMessage reply?
- **Conversion rate:** What % of triggered users subscribe within 48 hours?
- **Conversion rate by message copy:** Test Scenario A vs Scenario B
- **Opt-out rate:** What % reply STOP? (High opt-out = message is too aggressive)
