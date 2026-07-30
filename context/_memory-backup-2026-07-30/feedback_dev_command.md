---
name: Correct dev command
description: The command to start both Next.js and Electron together in development
type: feedback
---

Always use `npm run electron:dev` to start the app in development — NOT `npm run dev`.

`npm run dev` only starts Next.js (no Electron window). `npm run electron:dev` starts both Next.js and Electron together via concurrently.

**Why:** Sebastian waited 15 minutes using the wrong command. Never suggest `npm run dev` for local Wingman development.

**How to apply:** Any time you tell Sebastian to start, restart, or relaunch the app locally, use exactly:
```bash
cd "/Users/sebastianperez/Desktop/Wingman CC" && npm run electron:dev
```
