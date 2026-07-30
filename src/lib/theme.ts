/**
 * Dashboard theme (light / dark).
 *
 * The palette itself already exists — globals.css defines a full dark token set
 * that the `.dark` class swaps in. This module is only the switch: which class is
 * on <html>, and what the rep chose.
 *
 * SCOPE: the dashboard only. The HUD is deliberately excluded — Design Language
 * §2 makes its dark, glassy spec load-bearing (it has to recede against live
 * video), and it must never be re-skinned to follow the dashboard.
 *
 * "system" is the default and follows the Mac's appearance live.
 */

export type ThemePref = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

/** localStorage, not the database — no schema change, and it's a per-device choice. */
export const THEME_STORAGE_KEY = "wm.theme";

export function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

export function systemTheme(): ResolvedTheme {
  return typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePref(v) ? v : "system";
  } catch {
    return "system"; // private mode / storage blocked
  }
}

export function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  // Tells the browser to render native widgets (scrollbars, form controls,
  // autofill) in the matching scheme. Without it a dark page keeps white
  // scrollbars and blindingly light autofill boxes.
  root.style.colorScheme = resolved;
}

/**
 * Runs BEFORE first paint, injected inline in the document head.
 *
 * Without this the page always renders light for one frame and then snaps to
 * dark — the "flash of wrong theme". It has to be a blocking inline script;
 * doing it in a React effect is already too late.
 *
 * Kept dependency-free and self-contained because it is stringified into the
 * document, not bundled.
 */
export const THEME_INIT_SCRIPT = `
(function(){
  try {
    var p = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (p !== "light" && p !== "dark" && p !== "system") p = "system";
    var d = p === "dark" || (p === "system" &&
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    if (d) r.classList.add("dark");
    r.style.colorScheme = d ? "dark" : "light";
  } catch (e) {}
})();
`.trim();
