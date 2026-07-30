---
name: project-changelog-page
description: Private owner-only changelog page at /changelog; /wrap auto-appends entries to src/data/changelog.json
metadata: 
  node_type: memory
  type: project
  originSessionId: 066b70ef-35f0-493a-b65e-61a7d74826ba
---

Private, plain-English **changelog page** shipped 2026-07-10 ([PR #42](https://github.com/bandidoseb/wingman/pull/42) → merged to main → Railway). URL: `app.meetwingman.ai/changelog` (dashboard app, not a separate site). Works on iPhone Safari too.

**Purpose:** so Sebastian (non-technical) can skim what's shipped in plain English without reading code. Not public yet ("cool to do later").

**⚠️ It's Sebastian's PERSONAL daily build journal (clarified 2026-07-15).** Append an entry for every session's major changes at wrap — do NOT gate on whether the change has "reached users" / shipped a desktop release. He reads it at end of day to see what he built, regardless of release state. (I wrongly held a 2026-07-15 entry "until the desktop release reaches users" — that norm is for a public what's-new page; this is a private log. Don't do that.) If a change isn't user-reachable yet (e.g. HUD chrome awaiting a desktop release), just SAY so in the entry rather than omit it.

**Files (all new, zero existing files modified):**
- `src/app/changelog/page.tsx` — server page, **email-gated** to `sebmattiasperez@gmail.com`, `sebastian@meetwingman.ai`, `yungseboo@gmail.com` (others redirect to /login). To make public later, remove the ALLOWED_EMAILS gate.
- `src/components/changelog/ChangelogTimeline.tsx` — client component; **Full / Compact toggle** (Compact hides images for quick scroll; loads Full by default). shadcnblocks changelog2 style.
- `src/components/changelog/ChangelogArtwork.tsx` — per-entry **grainy mesh-gradient** (unique hue + rotated soft round blobs from a hash of entry id) with the category mark in white. No image files — pure CSS + inline SVG grain.
- `src/components/changelog/ChangelogMark.tsx` — 8 abstract category marks (speed/fix/feature/ui/ai/security/infra/release).
- `src/lib/changelog/types.ts` — `ChangelogEntry` type + helpers.
- `src/data/changelog.json` — the entries (newest first). Each: id/date/category/title/summary/changes?/details?. `details[]` = the "Read more about this" deep dive.

**How it stays current:** the **`/wrap` skill** (`SKILL.md`, Step 3b — lives in the global plugins dir `~/.claude/plugins/.../wingman-wrap`, NOT in the repo) appends one plain-English entry to `changelog.json` each session. So every wrap updates the page automatically on the next Railway deploy. See [[project-offer-aware-moat]] for other in-flight work.

**Verify visually** (page is gated, so unauthenticated curl always 307s to /login regardless of deploy): temporarily add `/changelog-preview` to `publicPaths` in `src/lib/supabase/middleware.ts` + a throwaway `src/app/changelog-preview/page.tsx`, screenshot, then revert both.
