# Dashboard "Relaunch to update" chip (idea — 2026-07-01)

Sebastian saw a "Relaunch to update / vX.Y.Z →" chip (Claude's own updater) and wants the
same on the Wingman dashboard so users know an update is ready + can trigger it.

**Feasibility: easy — plumbing already exists.** `electron/main.ts` already handles
`autoUpdater.on("update-downloaded")` (currently → a dialog + quitAndInstall on "Restart Now").
Add: on `update-downloaded`, also send an IPC message (version) to the dashboard renderer →
render a dismissible, non-blocking chip that calls `quitAndInstall()` on click. Keep the dialog
or replace it with the chip (decide later). Self-contained; no release-pipeline change.

Do NOT build yet — captured per Sebastian. Pairs with #45 (auto-updater), now working.
