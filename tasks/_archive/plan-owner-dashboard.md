# Owner Dashboard — scope (Phase 5 reframed)

Status: SCOPE for approval → then build. Reframes the Flight Recorder's `/devlog` page as the first
tab of an owner-gated founder cockpit. Related: `tasks/plan-flight-recorder.md`, memory
`project_owner_dashboard`, `project_flight_recorder`.

## Goal
An owner-gated `/owner` cockpit. First resident = the **Flight Recorder** (dev-only). Shell + tab
structure ready for **production** business tabs (Users / Revenue / Cost) built in follow-on sessions.

## The load-bearing distinction (two gates)
- **Shell + business tabs** → OWNER-gated, work in PRODUCTION (read Supabase + Stripe).
- **Flight Recorder tab DATA** → DEV-ONLY (`devlogEnabled()`) on top of owner-gating — it reads local
  `dev-logs/` files that only exist when running locally. In prod that tab shows "local dev only."

## Architecture / pieces

1. **Owner identity** — extract the `ALLOWED_EMAILS` allowlist (currently inline in
   `src/app/changelog/page.tsx`) into `src/lib/owner.ts` (`isOwnerEmail(email)`). Repoint changelog at
   it. Single source of truth for "who is an owner."
2. **Shell** — `src/app/(dashboard)/owner/page.tsx` (or `/owner`): owner-gated server component
   (redirect non-owners, mirroring changelog). A tabbed client layout: **Flight Recorder** (built now)
   · Users · Revenue · Cost (stubs now). Never linked in the normal user sidebar.
3. **Flight Recorder tab (the actual Phase-5 build):**
   a. Extract the analyzer core from `scripts/flight-recorder.mjs` → `src/lib/wingman/
      flight-recorder-core.mjs` (pure: `listCalls(dir)`, `buildReport(callId, dir)`). The CLI script
      becomes a thin wrapper — ONE source of truth so the page + CLI never disagree.
   b. Dev-only API `src/app/api/wingman/devlog/report/route.ts` (GET; `?list` + `?callId=`), 404 via
      `devlogEnabled()`, AND owner-gated. Reads `dev-logs/` server-side.
   c. Tab UI (client): call picker → terminal-styled **call film** + derived sections (adoption,
      hallucination, trajectory, cost) + **"Copy everything"** button + a **per-card note** field
      (localStorage; notes ride along in the copied text). In prod (gate off): "Local dev only — run a
      call locally."
4. **Business tabs (Users / Revenue / Cost)** — STUBBED now (labeled placeholders + a one-line note on
   what each needs). Built later:
   - Users: Supabase aggregates (total / active-30d / new / churned).
   - Revenue: Stripe (MRR, subs by plan, new vs churned MRR).
   - Cost: needs a **production cost-log** (below) → summed Anthropic/OpenAI/Recall/Railway/Supabase →
     unit economics (cost per call, margin per user).
5. **Production cost-log (follow-on, NOT now)** — a lightweight per-call token/cost record written to
   Supabase in prod (the Flight Recorder tracks cost only LOCALLY). Unlocks real aggregate cost +
   dovetails with the Phase-6 adoption dataset. Its own session (Supabase schema → tell Sebastian).

## Gating summary
| Surface | Gate |
|---|---|
| `/owner` shell + business tabs | owner allowlist (prod-capable) |
| Flight Recorder tab data + `/devlog/report` API | owner allowlist AND `devlogEnabled()` (dev-only) |

## Risk
Low for THIS build: the Flight Recorder tab is read-only over local files; owner-gating reuses the
proven changelog pattern; business tabs are inert stubs. The one new prod surface is the owner-gated
shell page. wingman-review at the end. The **business tabs + cost-log** (Stripe/Supabase/billing) are
the parts that will warrant plan-review — deferred to their own sessions.

## Build order (this session)
1. `src/lib/owner.ts` (extract owner check) + repoint changelog.
2. Extract `flight-recorder-core.mjs` + repoint the CLI script (verify CLI still works).
3. Dev-only + owner-gated `/api/wingman/devlog/report` route.
4. `/owner` shell + tab nav + Flight Recorder tab UI (picker / film / copy / notes).
5. Stub Users/Revenue/Cost tabs.
6. typecheck + wingman-review.
