---
name: wrap
description: >
  End-of-session wrap for Wingman. Reconciles real state from git/GitHub, writes a dated
  build log in the Obsidian brain, rewrites NOW.md, archives finished work, adds a
  plain-English changelog entry, refreshes memory, and commits it all. Run this at the end
  of EVERY session — CLAUDE.md's Session End Protocol makes it non-negotiable. Invoke when
  Sebastian says "wrap", "wrap it up", "/wrap", or is about to step away.
---

# /wrap — Wingman session wrap

The next session opens blind to whatever this misses. Treat it as handing off to an engineer
who was not here.

**Two rules govern everything below:**
1. **Never delete — relocate.** Every step moves content to a named home. Nothing is dropped.
2. **Never hand-type status.** No "not pushed", "not merged", "nothing deployed" — those rot
   within a day and a Stop hook now rejects them. Status is generated and injected live.

---

## Step 0 — Reconcile. Never write prose you haven't checked against git.

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC" && \
  git branch --show-current && \
  git status --short && \
  git log --oneline -5 && \
  gh pr list --state all --limit 5 && \
  gh release list --repo bandidoseb/wingman-releases --limit 3
```

⚠️ **Releases live in the separate PUBLIC repo `bandidoseb/wingman-releases`.** A bare
`gh release view` reads the source repo and reports a version several releases stale.

Two traps: `git log origin/main..HEAD` counts commits ahead of **main**, not of the remote
branch — check `git log origin/<branch>..HEAD` before claiming anything. And a PR may already
exist: `gh pr list --head <branch> --state all` before opening one.

If a note disagrees with git, **git wins — say so out loud in the log.**

## Step 1 — Build log: `Wingman Brain/01 - Build Log/YYYY-MM-DD.md`

**One file per session.** Never append to yesterday's, never overwrite. Today's real date.

Write for someone who wasn't here:
- **What broke and why**, not just what changed. The root cause is the reusable part.
- **The measurement**, when there was one (contrast ratios, px, ms, token counts, test counts).
- **What was NOT verified.** The highest-value line in the file. "Verified by arithmetic, needs
  an Electron eyeball" beats silence.
- **Bugs Claude caused**, in their own section, with the structural fix that prevents recurrence.
  More useful to the next session than the features.
- Quote Sebastian verbatim when he made a call — his wording carries intent that paraphrase loses.

## Step 2 — `NOW.md` — rewrite, don't append

`Wingman Brain/01 - Build Log/NOW.md`. **Exactly five headings** (a hook rejects a sixth):
`Next action` · `Blocked on Sebastian` · `In flight` · `Carry-forwards` · `Backlog`.

Lead with what's **next**, not what's done. Finished items move OUT: into today's dated log,
and their summary line down into `Sprint Archive.md`. This file only ever holds what is still true.

**Carry-forwards is the one to get right** — "do X before Y" notes exist nowhere else.

## Step 3 — Known Issues

`Known Issues.md` holds **open** issues only. Update `Last updated:`. New issues at the top.
When one is fully resolved, move the row **verbatim, with its whole Notes column**, into
`Known Issues Archive.md`. A row stays open while ANY verification is outstanding (◐ /
"needs testing" / "partially") — the root-cause notes are the most reusable thing in the vault,
so they never get summarised away.

A bug worth an entry: anything that reached Sebastian, cost money, or would take a fresh session
more than ten minutes to rediscover.

## Step 4 — Decisions Log

Any decision made this session goes in **the same session** — that is how the log drifted ten
days and six decisions behind. A reversed decision is **never removed**: stamp it in place with
`> ⚠️ **SUPERSEDED <date> → <new truth>**`.

## Step 5 — Changelog: `src/data/changelog.json`

Prepend one entry. Schema in `src/lib/changelog/types.ts`; category is one of
`speed | fix | feature | ui | ai | security | infra | release`.

**Plain English, zero jargon** (CLAUDE.md rule #9) — no token names, no file paths, no
"refactored". Describe what a rep would notice. `id` is `YYYY-MM-DD-slug`, unique.
Skip only when the session shipped nothing user-visible.

## Step 6 — Memory

Update any `project_*.md` the session changed. **`MEMORY.md` is a durable index — do not put
session status in it.** Add a new memory only for something that will still matter in a month.

## Step 7 — Regenerate + verify

```bash
npm run context:gen && npm run context:lint && npm run context:verify
```

- `context:gen` rebuilds `context/STATE.md` and `Build Log.md` from the repo.
- `context:lint` catches structural drift (it will block the turn otherwise).
- `context:verify` proves no line of text was lost against the `context-backup-2026-07-30` tag.

If any fails, fix it now — the Stop hook will block the turn anyway, and the message names
the fix.

## Step 8 — Commit

```bash
git add -A && git commit -m "chore: session wrap YYYY-MM-DD — <one line>"
```

Then state plainly: what is **committed**, what is **pushed**, what is **merged**, and what is
**deployed**. Four different things; conflating them is how a session ends with everyone
believing work is live when it is sitting on a laptop.

⚠️ **Pushing and merging need Sebastian's explicit approval** (CLAUDE.md rule #0). Recommend,
name the risk, don't run them unasked.

---

## Rules that keep this honest

- **Never `npm run build`** as a check — it overwrites `.next` and kills Sebastian's running
  dev server. Use **`npm run build:verify`**.
- **Never claim a gate passed without running it.** Paste the real numbers.
- **Name what's unverified.**
- If `/wrap` couldn't do a step, **say so in the log** rather than quietly skipping it.
