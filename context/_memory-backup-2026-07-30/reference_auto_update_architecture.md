---
name: reference-auto-update-architecture
description: "How Wingman's macOS auto-update + release publishing works (public releases repo, PAT, notarization)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5aa2c6b6-3cf2-4571-9101-4ba5a3b189bb
---

Wingman's desktop auto-updater (electron-updater) — fixed + verified 2026-07-01 (Issue #45). Non-obvious pieces:

- **Releases publish to a SEPARATE PUBLIC repo `bandidoseb/wingman-releases`** (binaries only), NOT the private `bandidoseb/wingman` code repo. Why: electron-updater reads a repo's public `releases.atom` feed; a private repo returns 404 → auto-update silently fails. `electron-builder.yml` → `publish.repo: wingman-releases`, `releaseType: release`.
- **Auth:** CI publishes cross-repo using a fine-grained PAT (Contents:write on wingman-releases only), stored as the Actions secret `WINGMAN_RELEASES_TOKEN` in the private repo. The built-in `GITHUB_TOKEN` can't write cross-repo. No expiration (Sebastian's call; rotate when a dev joins).
- **macOS specifics:** must ship a `zip` target (Squirrel.Mac can only apply a `.zip`, never a `.dmg`); `mac.notarize: true` (Developer ID cert + Apple secrets already in CI); arm64-only (Recall SDK has no Intel binary).
- **Auto-relaunch gotcha:** the main-window `close` handler hides unless `isQuitting` is set, so `quitAndInstall()` must be preceded by `isQuitting = true` or the app won't terminate/relaunch. Handler is in `electron/main.ts`.
- **New-version bootstrap:** the FIRST build pointing at the correct feed must be hand-installed once (an old build's feed URL is baked in); auto-update carries forward after. Beta users install once from https://github.com/bandidoseb/wingman-releases/releases/latest.
- **Only proven by shipping** — auto-update can't be verified locally; needs a two-release live test (install vX, cut vX+1, watch it update). Six-release gauntlet on 2026-07-01 found: drafts, no-zip, notarization-off, private-repo-404, empty-repo-422, no-relaunch.
- **At-scale upgrade:** move to a self-hosted Railway feed (gating + staged rollouts) — [[Future Build - Self-Hosted Update Feed (Option 3)]] in the brain `_Inbox`. Related: [[feedback-status-lives-in-git]].
