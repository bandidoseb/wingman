# tasks/ — what lives here

Working plans and their artifacts. This directory had grown to 43 items with no convention for
what was live and what was finished, so April plans sat alphabetically beside current ones.

## The rule

**A plan stays here while it is live. When it ships or is abandoned, it moves to `_archive/` —
never deleted.** That's the whole convention. `/wrap` does the move.

## What must NOT move

Three classes of file are pinned in place, and two of them are protected by a hook
(`.claude/hooks/write-guard.sh`):

**1. Hand-graded artifacts — irreplaceable.**
`*.MARKED.md` and `*.gradesheet.html` carry Sebastian's own ✓/✗/rewrite marks on card voice.
They are the human reward signal for the entire voice track and **cannot be regenerated at any
price**. `scripts/voice-batch.mjs` writes into this directory by absolute path, so one careless
regeneration could erase months of judgement. Writes to them are blocked by a hook. Some have
zero inbound references and were still kept during the 2026-07-30 cleanup for exactly this reason.

**2. Files cited by shipped source code.** Moving these silently breaks a comment trail that a
future session will follow:

| File | Cited by |
|---|---|
| `plan-flight-recorder.md` | `devlog.ts`, `devlog-client.ts`, `electron/measurement-log.ts` |
| `card-voice-spec.md` | `scripts/tic-gate.mjs` (ban-list source of truth) |
| `todo-archive-2026-07-09.md` | `objection-prompt.mjs:150`, `live-tail.ts:18`, `kb-memory.ts` ×3, `kb-signal/route.ts`, `pipeline-warmup.ts` — all cite `tasks/todo.md` for invariants that live in **this archived copy**, not in the current `todo.md` |
| `kb-ab-test/` | written to by `scripts/kb-ab-*.mjs` |
| `voice-batch.md`, `voice-flow-batch.md`, `confrontation-*.md` | written to by their eval scripts |

**3. `launch-plan.md` — the cutline.** Read before proposing any work. It is the only thing in
the repo that says *no*.

## ⚠️ `todo.md` is a reused filename

It has been fully rewritten many times, and each rewrite overwrote the last without archiving.
The 2026-07-09 contents survived only as an *uncommitted* change inside a throwaway git worktree
and were recovered on 2026-07-30 — one `git worktree remove` from being gone permanently.

**Before overwriting `todo.md`, copy the old contents to `_archive/todo-<date>.md`.** Better:
give new plans their own `plan-<thing>.md` name and leave `todo.md` alone.
