# Wingman Brain

This is the Wingman Brain — a persistent Obsidian second brain for building and operating Wingman, an AI-powered real-time sales call copilot for high-ticket phone closers.

This vault lives inside the Wingman CC project folder at `/Users/sebastianperez/Desktop/Wingman CC/Wingman Brain/`.

---

## How to Use This Vault

- Before starting any build session, read `01 - Build Log/NOW.md` — what's true right now. Everything older is on-demand.
- After completing any build task, log it in today's `01 - Build Log/YYYY-MM-DD.md` file
- Any quick thought or idea goes in `_Inbox/` first — sort it later
- Major decisions go in `01 - Build Log/Decisions Log.md`
- Things considered and rejected go in `00 - Product/Why We Didn't.md`
- **Never delete — relocate.** Nothing is ever deleted from a log. When an entry is finished,
  superseded, or stale, it MOVES, verbatim, to its named home:

  | When this is done… | It moves here |
  |---|---|
  | A `NOW.md` item is finished | today's `YYYY-MM-DD.md`, then down to `Sprint Archive.md` |
  | A Known Issues row is fully resolved | `Known Issues Archive.md` (full Notes column intact) |
  | A decision is reversed | **stays put** — stamp `> ⚠️ **SUPERSEDED <date> → <new truth>**` |
  | An `_Inbox` note ships | `_Inbox/_Shipped/` |
  | A `tasks/` plan is executed or abandoned | `tasks/_archive/` |

---

## Folder Index

| Folder | Purpose |
|--------|---------|
| `_Inbox` | Unsorted captures — quick thoughts, links, fragments |
| `_Templates` | Reusable note formats for logs, interviews, experiments |
| `00 - Product` | Architecture, decisions, philosophy, signal card rules |
| `01 - Build Log` | Daily logs, decisions made, known issues |
| `02 - Market` | User research, competitors, interviews |
| `03 - GTM` | Distribution, messaging, experiments, iMessage funnel |
| `04 - Sales KB Meta` | Knowledge base ingestion queue and quality notes |
| `05 - Operations` | Stack reference, API contracts, deployment runbook |
| `06 - Finance` | Unit economics, financial model |
| `07 - North Star` | Vision, milestones, moat map |
| `08 - People` | Beta users, affiliates, advisors |

---

## Rules

1. **Append to logs; relocate when done.** The live top of a file is for what is still true —
   history lives in its archive, never above it. *(Rewritten 2026-07-30. This rule used to read
   "Always append, never overwrite log files." It was followed perfectly for 34 sessions, which is
   exactly how `Current Sprint.md` reached 755 lines with 470 of them duplicating the dated logs.
   The protection was right; it just never named a destination.)*
2. **Verbatim quotes** in `02 - Market/User Voice Verbatim.md` only — never paraphrase
3. **Keep Known Issues.md current** after every session — and move fully-resolved rows to
   `Known Issues Archive.md`. A row stays open while ANY verification is outstanding.
4. **Update Assumptions Ledger.md** when real data contradicts an assumption
5. **Date every entry** in every log file — use YYYY-MM-DD format
6. **One decision per entry** in Decisions Log — don't batch multiple decisions into one entry
