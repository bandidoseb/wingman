---
name: feedback-status-lives-in-git
description: Brain/sprint notes go stale because they hand-copy status that git/GitHub already owns; reconcile before trusting prose
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5aa2c6b6-3cf2-4571-9101-4ba5a3b189bb
---

Sebastian was frustrated that every session opens with "these notes are stale." Root cause: `Current Sprint.md` (and the memory index) are hand-written at session end by `/wrap` and describe status ("branch not pushed", "PR not merged", "release not cut") as prose — but that status keeps moving in git/GitHub *after* the note is written (e.g. streaming was written up as "not yet pushed" then merged as [PR #24], and no wrap re-ran). A hand-copy of authoritative state always drifts.

**Why:** prose can hold things git can't (decisions, intent, "why"), but restating status as prose creates a second copy that rots. git/GitHub is the source of truth for merge/release/branch/tag state.

**How to apply:** At session start, reconcile before reporting status — run `git branch --show-current && gh pr list --state merged --limit 5 && git tag --sort=-v:refname | head -3 && gh release view --json tagName,isDraft`. Report from that, not the prose. If a note contradicts git, git wins — say so out loud. When wrapping, derive the "Live now" line from that command and OVERWRITE the old status, never append. Keep status and decisions separate in the sprint file. Fix shipped 2026-07-01 into CLAUDE.md session-start (step 4), the `wrap` SKILL.md (step 5), and the top of `Current Sprint.md`. Related: [[feedback_response_length]].
