# Future Build — Self-Hosted Update Feed (Option 3)

**Status:** DEFERRED to scale / when Sebastian has a developer to help. Decided 2026-07-01.
**Trigger to revisit:** paying users + wanting control over update distribution, OR a hire who can own infra.

## Context
Auto-updater (#45) was fixed 2026-07-01 using **Option 1: a public `wingman-releases` repo**
(code stays private; only the signed/notarized installers are public; app reads updates from there).
That's the correct pattern for beta and thousands of real apps ship this way.

## What Option 3 is (the at-scale upgrade)
Serve the update feed from **our own Railway backend** instead of GitHub — exactly the pattern we
already use for the Recall token (secrets on Railway, app fetches via the user's Supabase session).

```
App → GET https://app.meetwingman.ai/api/updates/latest-mac.yml   (auth: Supabase session)
     → serves the manifest + signed/short-lived asset URLs
```

## Why upgrade (what Option 1 can't do)
- **Gate updates to paying users** (Free/Core/Pro) — GitHub public releases can't gate.
- **Staged rollouts** — ship to 5% first, watch for crashes, then 100% (what Slack/VS Code/1Password do).
- **No public binaries** — installers no longer downloadable by anyone.
- **Own analytics** on update adoption; not dependent on GitHub uptime.

## Why NOT now
- Real work (auth'd endpoint that serves manifest + streams the zip w/ range requests), its own session.
- Premature before beta — would spend a session on distribution infra instead of getting testers on the app.
- Big companies do this for **control**, not code safety — our code is equally private under Option 1.

## Rough shape when we build it
- electron-builder `publish.provider: generic`, `url: https://app.meetwingman.ai/api/updates`.
- New API route serves `latest-mac.yml` + redirects/streams the `.zip` (Supabase-auth gated).
- Store binaries in Supabase Storage or S3; keep signing+notarization in CI unchanged.
- Migrate off the public `wingman-releases` repo (can archive it).

## For the future dev (token hygiene — noted 2026-07-01)
The release pipeline authenticates to the public `wingman-releases` repo with a **fine-grained PAT**
stored as the GitHub Actions secret `WINGMAN_RELEASES_TOKEN` (repo: bandidoseb/wingman, Actions secrets).
Sebastian set it to **no expiration** deliberately (solo founder, doesn't want it silently breaking).
**When a dev joins:** rotate this token, set a real expiration (e.g. 90 days), and put rotation on a
calendar. Also review the old broad classic PAT "Wingman releases" (repo, workflow, no expiry) — likely
deletable once nothing depends on it. Migrating to Option 3 (self-hosted feed) removes this token need.
