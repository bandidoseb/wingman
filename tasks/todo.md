# Task: Fix the macOS auto-updater once and for all (Issue #45)

## Diagnosis (verified 2026-07-01)

Client code is fine (`electron/main.ts:743–790`): `checkForUpdatesAndNotify()` when packaged →
`update-downloaded` → dialog → `quitAndInstall()`. The failure is in release config/artifacts.

**Three real defects:**

1. **Releases publish as GitHub DRAFTS.** electron-builder's GitHub publisher defaults `releaseType`
   to `draft`. electron-updater cannot see draft releases → every install has been stuck. v0.1.22 only
   "works" because it was manually un-drafted (`gh release edit --draft=false`).
   → FIX: `publish.releaseType: release` in electron-builder.yml. No more manual un-drafting.

2. **No macOS `zip` artifact — the deeper break.** Auto-update on macOS uses Squirrel.Mac, which can
   ONLY apply a `.zip`. The build only makes `.dmg`, so `latest-mac.yml` lists dmgs → the update
   downloads then silently fails to install. This breaks auto-update even on a PUBLISHED release.
   → FIX: add `zip` to `mac.target` (keep `dmg` for first manual download).

3. **Notarization disabled** (`notarize: false`) though all Apple secrets exist (APPLE_ID,
   APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID, CSC_LINK, CSC_KEY_PASSWORD all set in repo). CI already
   Developer-ID-SIGNS (Squirrel.Mac needs that), but un-notarized updates can trip Gatekeeper on
   relaunch + the first .dmg shows the "unidentified developer" warning (hence the `xattr` workaround).
   → FIX: `notarize: true`. hardenedRuntime already true; entitlements present. Also lets us delete the
   quarantine workaround from the beta email.

**Two simplifications (fold in):**

4. **Drop the x64 (Intel) target.** Wingman is Apple-Silicon-only (Recall SDK has no Intel binary), so
   the x64 dmg is a broken artifact that can't even run — and `latest-mac.yml`'s top-level `path:`
   currently points at it. Build arm64 only → halves build + notarization time, fixes the manifest.

5. **Add `autoUpdater.on("error")` handler** (main.ts) — currently silent. A non-technical founder
   can't debug a silent failure; log it so future breakage is visible.

## Files touched
- `electron-builder.yml` — releaseType: release · add zip target · notarize: true · arm64-only
- `electron/main.ts` — add `autoUpdater.on("error", …)` logging handler (~4 lines)

## Steps
1. Edit electron-builder.yml (defects 1, 2, 3, simplification 4).
2. Edit main.ts (simplification 5) — error handler only, no logic change.
3. wingman-reviewer on the diff.
4. Present to Sebastian → on yes, cut a release via the PR-then-tag flow (CLAUDE.md release section).
5. **The real gate:** install the new signed+notarized dmg → cut the NEXT patch → confirm the installed
   app auto-updates to it. #45 is not "done" until this two-release test passes on a real machine.

## Risks / unknowns
- **Notarization is unproven** — it's been off, so CI has never hit Apple's notary service. If CSC_LINK
  is an "Apple Development" cert rather than "Developer ID Application", signing passes but notarization
  fails. This is the #1 thing that could fail in CI. Verifiable only by running the release.
- Notarization adds ~5–15 min to the release Action (Apple notary latency).
- Cannot be verified from the dev machine — requires two real releases.
