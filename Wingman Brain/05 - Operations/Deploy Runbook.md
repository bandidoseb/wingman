# Deploy Runbook

Last updated: 2026-04-02

Exact step-by-step commands to ship any type of change to Wingman. Copy-paste ready. Never summarize — always give the exact command.

---

## ⚠️ Pre-Deploy Checklist (Always)

Before running any deploy command:

- [ ] Changes have been reviewed and tested locally
- [ ] No API keys, secrets, or `.env.local` contents are in any committed file
- [ ] Sebastian has explicitly approved the deploy ("yes, push it")
- [ ] `git status` shows only the files you intended to change

**NEVER push without Sebastian's explicit approval.** Show the diff first. Wait for a yes.

---

## Deploy Type 1: Web / Backend Change

Any change to `src/` (Next.js pages, API routes, components) or any backend logic.

**When it takes effect:** Immediately after git push. Railway auto-deploys on push to main. Takes ~2-3 minutes to build and go live.

**Commands (run in order):**

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC"
git add [specific files changed]
git commit -m "describe what changed"
git push
```

**To verify the deploy:**
1. Watch Railway dashboard — build should appear within 30 seconds
2. Build takes ~2-3 minutes
3. Visit https://app.meetwingman.ai to confirm the change is live

**Example for a component change:**
```bash
git add src/components/dashboard/FlightLogTab.tsx
git commit -m "Fix: show call outcome label in flight log entry header"
git push
```

---

## Deploy Type 2: Desktop App Update

Any change to `electron/` (main process, recall.ts, preload, HUD, tray UI).

**When it takes effect:** After the full release build completes. GitHub Actions builds the .dmg and uploads to GitHub Releases. Existing installs auto-update within ~24 hours (or immediately if the user checks for updates).

**Commands (run in order):**

```bash
cd "/Users/sebastianperez/Desktop/Wingman CC"
npm version patch
git push && git push --tags
```

**What each command does:**
- `npm version patch` — bumps version in `package.json` (e.g., 0.1.19 → 0.1.20) and creates a git tag
- `git push` — pushes the version bump commit
- `git push --tags` — pushes the new tag, which triggers GitHub Actions

**What GitHub Actions does automatically:**
1. Detects the new tag
2. Builds the Electron app with `electron-builder`
3. Signs and packages into a .dmg
4. Uploads the .dmg to GitHub Releases
5. Existing installs detect the new version and show an "Update Available" prompt

**To verify the build:**
1. Go to `github.com/bandidoseb/wingman/actions`
2. Find the workflow triggered by your tag push
3. Watch for green checkmarks on all steps
4. Go to GitHub Releases to confirm the .dmg appears

**⚠️ Version bump options:**
- `npm version patch` — for bug fixes (0.1.19 → 0.1.20)
- `npm version minor` — for new features (0.1.19 → 0.2.0)
- `npm version major` — for breaking changes (0.1.19 → 1.0.0)

---

## Deploy Type 3: Both Web + Desktop Together

When a change requires updating both the web app and the desktop app in the same release:

1. Make all changes first
2. Do the web deploy first (git add / commit / push)
3. Wait for Railway build to confirm
4. Then do the desktop deploy (npm version patch, git push --tags)

Never do them simultaneously. Confirm the web is working before cutting a desktop release.

---

## Database Change (Supabase)

Changes to the database schema (new tables, columns, indexes, RLS policies).

**Never run database changes without explicit approval.** Tell Sebastian exactly what will change before running.

**Steps:**
1. Write the SQL migration
2. Show Sebastian the exact SQL
3. Wait for "yes"
4. Go to Supabase dashboard → SQL Editor
5. Paste the SQL
6. Click Run
7. Verify the change in Supabase Table Editor

**No code push needed for database changes.** The Next.js app reads the database — it doesn't control the schema.

**Migration files:** Save a copy of every migration SQL in `supabase/migrations/` with a sequential filename like `006_description.sql`.

---

## Rollback Procedures

### Web / Backend Rollback
If a Railway deploy breaks the web app:
```bash
# Find the previous working commit
git log --oneline -10

# Revert to previous commit
git revert HEAD
git push
```
Railway will re-deploy with the reverted commit.

### Desktop App Rollback
If a new desktop version has a critical bug:
- Users can't easily downgrade themselves
- The fix is to push a new patch version immediately with the bug fixed
- If the bug is severe: go to GitHub Releases, edit the release, and delete the .dmg to prevent new downloads (doesn't affect already-downloaded installs)

### Database Rollback
If a database migration breaks something:
- Write a reverse migration SQL
- Run it in Supabase SQL Editor
- This is why you never run migrations without approval — reverting schema changes is riskier than reverting code

---

## Environment Variables

If a new environment variable is needed for a feature:

1. Add it to `.env.local` for local development
2. Add it to Railway dashboard (Settings → Variables) for production
3. NEVER commit `.env.local` to git
4. NEVER hardcode the value in any code file

**Current required env vars:** See `CLAUDE.md` Environment Variables section for the full list.
