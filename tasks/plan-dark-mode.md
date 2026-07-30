# Dark Mode — Session Brief (open this cold)

*Written 2026-07-29 at Sebastian's request, to carry his feedback into a fresh session.*
**Start this session with RESEARCH, not code.** See §4.

---

## 1. Sebastian's feedback, verbatim (2026-07-29)

> "The only page that looks good to me is the homepage. I like the color that you chose for the
> components… It's like a bluish gray, and then on the homepage it's like a brownish gray. **I want the
> homepage to be the example for the dark mode.** Does that make sense? On the Sales DNA page, where a
> user goes in to input their answers, **it's a completely different dark black color.** When you go to
> the home page and you see the 'Ask Wingman about your calls,' that's also a text box. **That text box
> is that light color that I like, versus in the Sales DNA page, it's black.**"
>
> "If you need to go do research on how to properly set up dark mode, go ahead and do that. **What's the
> rule of thumb for the difference in color for the text box, etc.?**"

**HOME IS THE REFERENCE.** Every other screen's dark mode gets judged against it.

---

## 2. The diagnosis (already established — don't re-derive)

The inconsistency is ONE token, not a per-screen problem.

| Surface | Token used | Dark value | vs. its parent |
|---|---|---|---|
| Home — Coach input ✅ he likes | `--surface` | `#201F1B` | **lighter** than `--paper` |
| Sales DNA — input fields ❌ he dislikes | `--surface-sunken` | `#100F0D` | **darker** than `--surface` |

**The rule I got wrong:** in LIGHT mode, recessed/inset surfaces go *darker* than the card. In DARK
mode that **inverts** — elevation is expressed as *lighter*, because on a dark ground lighter reads as
nearer the viewer. Material's dark-theme guidance is explicit: higher elevation → lighter surface, and
pure black is avoided because it kills depth cues and raises contrast fatigue.

Our dark `--surface-sunken` (`#100F0D`) is DARKER than `--surface` (`#201F1B`), i.e. backwards. That
single value explains every "black box" Sebastian is pointing at, because `--surface-sunken` is also
used for hover fills, tab tracks, keycaps and progress tracks.

⚠️ Do NOT fix this by editing screens one at a time. Fix the token; every screen follows.

---

## 3. What is already true (don't redo)

- Full dark token set exists in `src/app/globals.css` (`@theme inline` — the `inline` is load-bearing,
  see the comment there; without it dark mode silently only works when `.dark` is on `<html>`).
- Theme switch shipped: `src/lib/theme.ts`, `src/hooks/useTheme.ts`, blocking init script in
  `src/app/layout.tsx` (prevents the white flash). Follows macOS live; localStorage-backed.
- **No toggle UI yet** — it belongs in Settings, which isn't migrated. Today you switch with
  `localStorage.setItem('wm.theme','dark')` + reload.
- Migrated to tokens (dark-ready, 0 literals): **Home + Coach, Sidebar, DashboardClient shell,
  FlightLogTab, PersonalizeTab (Sales DNA)**, `ui/wm/*`.
- `--scrim` token added for modal overlays (must darken in BOTH themes; can't derive from `--ink-1`,
  which flips to near-white).
- One filled `OutcomePill` now used everywhere; `OutcomeBadge` deleted.
- `scripts/migrate-colors.mjs` does the mechanical hex→token pass. rgba() is deliberately excluded —
  hairlines and shadows need context and are mapped by hand per file.
- token-lint baseline: **286** literals left (was 590).

---

## 4. Start here — research first

Answer these BEFORE touching code, then write the answers into
`Wingman Brain/00 - Product/Wingman Design Language.md` as a new dark-mode section:

1. **Elevation direction.** Confirm the "lighter = higher" rule and how many steps a dark palette
   actually needs (page → card → input/hover → popover). Material 3 surface tones and Apple HIG dark
   guidance are the two references worth reading.
2. **Why not pure black.** #000 backgrounds cause halation on OLED and remove elevation headroom.
   What's the right darkest value? (Ours is `#171613` — validate it.)
3. **Input/field treatment specifically** — Sebastian's actual question. Is a dark-mode field lighter
   than its card, or same-tone with a border? What do Linear / Granola / Vercel do?
4. **Contrast targets.** Body text on each surface should hit WCAG AA (4.5:1); large/secondary text
   3:1. Verify our `--ink-2` / `--ink-3` against the dark surfaces — muted greys often fail in dark.
5. **Desaturation.** Saturated accents vibrate on dark backgrounds. Confirm our dark `--signal`
   (`#7E9BFF`) and the state colors are correctly lightened AND desaturated.

**Then:** fix the dark `--surface-sunken` value (and add more elevation steps if research says so),
re-check Home still looks right (it's the reference — if the fix changes Home, the fix is wrong), then
sweep the already-migrated screens.

---

## 5. Then continue the migration

Remaining literals (286): **SettingsTab 75** · IntelTab 53 · FlightPlanTab 51 · SignalVaultTab 40 ·
ObjectionVaultTab 34 · PaywallModal 15 · OnboardingClient 8 · Toggle 6 · SectionLabel 2 · WIcon 1 ·
Card 1.

- **Settings is next** regardless — it's the biggest, and the light/dark toggle UI belongs there so
  Sebastian stops editing localStorage by hand.
- **Flight Plan, Objection Vault, Signal Vault (125 literals) may be DELETED** — Sebastian, 2026-07-29:
  *"I don't know if we're going to keep the Flight Plan page. We're probably going to get rid of the
  Objection Vault and the Signal Vault page."* **Confirm before spending any time on them.**

---

## 6. Process notes for whoever picks this up

- **Measure, don't trust a screenshot after a theme toggle.** The browser tool returns stale frames;
  it cost two false "regression" calls in this session. Read computed styles instead.
- **Never run `npm run build` while the dev server is running** — it overwrites `.next` and the running
  server serves a stylesheet-less page that looks catastrophically broken. Stop → build → clear → start.
- The HUD is **out of scope** and must not follow the dashboard theme. Design Language §2: its dark
  glassy spec is research-backed and load-bearing against live video.
