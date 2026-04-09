# Wrap Skill — Session End Automation

## What It Is

A Claude Code skill that runs at the end of every build session. Triggered by saying "wrap it up", "wrap up", "/wrap", "we're done", or "that's it for today".

## What It Does (in order)

1. Pulls today's git commits — source of truth for what changed
2. Reads Current Sprint and Known Issues for context
3. **Writes a new dated build log** — `Wingman Brain/01 - Build Log/YYYY-MM-DD.md` — one new file per session, never overwritten
4. Updates Known Issues — marks anything fixed as Resolved with today's date
5. Updates Current Sprint — moves done items, clears in-progress, updates what's next
6. Checks Railway deploy status — notes whether commits were pushed or are local only
7. Commits all brain files to git

## File Structure

7 days of work = 7 separate files:
```
Wingman Brain/01 - Build Log/
├── 2026-04-07.md   ← one session
├── 2026-04-08.md   ← next session
├── 2026-04-09.md   ← etc.
```

`Current Sprint.md` and `Known Issues.md` are living documents — updated each session.
Daily logs are write-once snapshots — never modified after they're created.

## Where the Skill Lives

```
~/.claude/plugins/marketplaces/claude-plugins-official/plugins/wingman-wrap/skills/wrap/SKILL.md
```

This is local to Sebastian's Mac. Not in the Wingman GitHub repo.

## How to Edit It

Open the SKILL.md file above in any text editor. It's plain markdown. Change the steps, add new ones, or update the format template inside it.

## How to Use It

Say any of these at the end of a session:
- `/wrap`
- "wrap it up"
- "wrap up"
- "we're done"
- "that's it for today"

Claude will run all 8 steps and print a confirmation checklist when done.
