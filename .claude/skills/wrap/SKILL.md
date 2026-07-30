---
name: wrap
description: >
  End-of-session wrap for Wingman. Reconciles the real state from git/GitHub, writes a dated
  build log in the Obsidian brain, updates Current Sprint + Known Issues, adds a plain-English
  changelog entry, refreshes memory, and commits it all. Run this at the end of EVERY session —
  CLAUDE.md's Session End Protocol makes it non-negotiable. Invoke when Sebastian says "wrap",
  "wrap it up", "/wrap", or is about to step away.
---

# /wrap — Wingman session wrap

The next session opens blind to whatever this misses. Treat it as handing off to an engineer
who was not here.

---

## Step 0 — RECONCILE FIRST. Never write prose you haven't checked against git.

The brain files are hand-written and **lag reality**. Prose holds decisions and intent; **git and
GitHub hold status.** Run this and report from *its* output:

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC" && \
  git branch --show-current && \
  echo "ahead of origin/main: $(git log --oneline origin/main..HEAD | wc -l | tr -d ' ')" && \
  git status --short && \
  gh pr list --state all --limit 5 && \
  git tag --sort=-v:refname | head -3 && \
  gh release view --json tagName,isDraft 2>/dev/null
```

If a note says "not pushed / not merged / not released" and git disagrees, **git wins — say so
out loud in the log.** Two specific traps:

- `git log origin/main..HEAD` counts commits ahead of **main**, not ahead of the remote branch.
  A branch can be partially pushed already. Check `git log origin/<branch>..HEAD` before claiming
  "N unpushed commits".
- A PR for the branch may already exist. `gh pr list --head <branch> --state all` before opening
  a new one.

---

## Step 1 — Build log: `Wingman Brain/01 - Build Log/YYYY-MM-DD.md`

**One file per session. Never append to yesterday's, never overwrite.** Use today's real date.

Write for someone who wasn't here. For each thing shipped:

- **What broke and why**, not just what changed. The root cause is the reusable part.
- **The measurement**, when there was one (contrast ratios, px, ms, token counts, test counts).
- **What was NOT verified.** This is the highest-value line in the file. If something was checked
  by arithmetic and not by eye, say that.
- **Bugs Claude caused**, in their own section, with the structural fix that prevents recurrence.
  These are more useful to the next session than the features.
- Quote Sebastian verbatim when he made a call — his wording carries intent that paraphrase loses.

End with a **🔴 Next session** block: the first concrete action, any blockers, and any decision
waiting on Sebastian.

## Step 2 — `Wingman Brain/01 - Build Log/Current Sprint.md`

Replace the **top block only**; leave the history below it intact. This is the file the
session-start protocol actually acts on, so anything meant to shape the next session must land
here — not only in memory. Lead with what's NEXT, not with what's done.

## Step 3 — `Wingman Brain/01 - Build Log/Known Issues.md`

Update `Last updated:`. Add new issues at the top; mark fixed ones **✅ RESOLVED + date**.
**Never delete a row** (vault rule). A bug worth an entry: anything that reached Sebastian, cost
money, or would take a fresh session more than ten minutes to rediscover.

## Step 4 — Changelog entry: `src/data/changelog.json`

Prepend one entry. Schema in `src/lib/changelog/types.ts`; category is one of
`speed | fix | feature | ui | ai | security | infra | release`.

**Plain English, zero jargon** (CLAUDE.md rule #9) — no token names, no file paths, no
"refactored". Describe what a rep would notice. `id` is `YYYY-MM-DD-slug` and must be unique.
Skip this step only when the session shipped nothing user-visible.

## Step 5 — Memory

Update `MEMORY.md`'s "Current State" bullet and any `project_*.md` the session changed. Memory is
the durable cross-session index; Current Sprint is what gets read first. **Both, not either.**

## Step 6 — Commit

```bash
git add -A && git commit -m "chore: session wrap YYYY-MM-DD — <one line>"
```

Then state plainly: what is committed, what is **pushed**, what is **merged**, and what is
**deployed**. Those are four different things and conflating them is how a session ends with
everyone believing work is live when it is sitting on a laptop.

⚠️ **Pushing and merging need Sebastian's explicit approval** (CLAUDE.md rule #0). Recommend, and
name the risk, but do not run them unasked.

---

## Rules that keep this honest

- **Never `npm run build`** as a check — it overwrites `.next` and kills Sebastian's running dev
  server. Use **`npm run build:verify`**.
- **Never claim a gate passed without running it.** Paste the real numbers.
- **Name what's unverified.** "Verified by arithmetic, needs an Electron run" beats silence.
- If `/wrap` itself couldn't do a step (a missing file, a failing command), **say so in the log**
  rather than quietly skipping it.
