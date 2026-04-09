# Beta Users

Last updated: 2026-04-02

A running list of every beta user. Add new entries as users are onboarded. Update status and feedback summary as data comes in.

---

## Active Beta Users

| Alias | How They Found Us | Offer They Close | Date Onboarded | Feedback Summary | Status |
|-------|------------------|-----------------|---------------|-----------------|--------|
| *No beta users yet — launching now* | | | | | |

---

## Churned / Inactive

| Alias | How They Found Us | Offer | Date Onboarded | Date Churned | Churn Reason |
|-------|------------------|-------|---------------|-------------|-------------|
| *None yet* | | | | | |

---

## Beta Waitlist

People who have expressed interest but haven't been onboarded yet.

| How They Found Us | Offer Type | Date Added | Notes |
|------------------|-----------|-----------|-------|
| *None yet* | | | |

---

## Onboarding Notes

When onboarding a new beta user:

1. **Send the beta invite email** — includes:
   - Download link (GitHub Releases)
   - Step-by-step install instructions
   - The quarantine removal command: `xattr -dr com.apple.quarantine "/Applications/Wingman.app"`
   - What to do on their first call
   - How to reach Sebastian for help

2. **Set them up in Supabase** — confirm their account exists and subscription_status is set correctly for beta

3. **Add them to this table** — use an alias or role description, no full names

4. **Follow up within 48 hours** — ask how the first call went. This is the most important conversation.

---

## Beta Goals

- First 5 users: Validate that the live pipeline works end-to-end (signal cards fire on real calls)
- First 10 users: Get diverse offer types (fitness, biz op, investing, etc.) to test KB quality across categories
- First 25 users: Enough data to tune signal card frequency and trigger classifier quality
- First feedback: At least one verbatim "this was exactly right" moment from a real call
