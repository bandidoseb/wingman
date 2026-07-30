---
name: Run the Plan Review Loop before presenting anything architectural
description: Sebastian caught me presenting stage filtering without thinking through its failure modes first
type: feedback
originSessionId: a98a647f-02ca-46c9-875f-6aa1a763d2e0
---
Never present an architectural suggestion without first running the Plan Review Loop internally. Sebastian should not have to ask "when does this break?" — that question should already be answered before the suggestion lands.

**Why:** Suggested junction table + stage filtering as the "best architecture." Stage filtering seemed obviously good but had a critical flaw: stage detection is stale (poll-based, not real-time) and objections transcend stage boundaries. Sebastian had to prompt me to think harder before I caught it. That's a failure of the technical lead role.

**How to apply:** Before presenting any architectural idea, explicitly run: "What are the silent failure modes? What happens when the underlying assumption is wrong?" For stage filtering, the assumption was "stage detection is accurate and current" — which is false. One question kills weak ideas before they cost Sebastian time.
