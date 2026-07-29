/**
 * Unit tests — dashboard theme preference.
 *
 * The risky part isn't the palette (that's CSS), it's the preference logic:
 * an unrecognised stored value must not leave the app themeless, and "system"
 * must actually consult the OS rather than defaulting to light.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { isThemePref, resolveTheme, THEME_INIT_SCRIPT } from "../../src/lib/theme";

function stubMatchMedia(prefersDark: boolean) {
  vi.stubGlobal("window", {
    matchMedia: (q: string) => ({ matches: prefersDark && q.includes("dark") }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("isThemePref", () => {
  it("accepts only the three known values", () => {
    expect(isThemePref("system")).toBe(true);
    expect(isThemePref("light")).toBe(true);
    expect(isThemePref("dark")).toBe(true);
  });

  it("rejects junk, so a corrupted localStorage value can't wedge the theme", () => {
    for (const v of ["", "DARK", "auto", null, undefined, 1, {}]) {
      expect(isThemePref(v)).toBe(false);
    }
  });
});

describe("resolveTheme", () => {
  it("passes explicit choices straight through, ignoring the OS", () => {
    stubMatchMedia(true);
    expect(resolveTheme("light")).toBe("light");
    stubMatchMedia(false);
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("follows the OS when set to system", () => {
    stubMatchMedia(true);
    expect(resolveTheme("system")).toBe("dark");
    stubMatchMedia(false);
    expect(resolveTheme("system")).toBe("light");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("is self-contained and swallows errors", () => {
    // It runs inline in <head> before any bundle exists, so it cannot reference
    // imports, and a storage exception must never block first paint.
    expect(THEME_INIT_SCRIPT).toMatch(/try\s*\{/);
    expect(THEME_INIT_SCRIPT).toMatch(/catch/);
    expect(THEME_INIT_SCRIPT).not.toMatch(/\bimport\b|\brequire\(/);
  });

  it("sets colorScheme as well as the class", () => {
    // Without colorScheme the browser keeps white scrollbars and blinding
    // autofill boxes on a dark page.
    expect(THEME_INIT_SCRIPT).toMatch(/colorScheme/);
    expect(THEME_INIT_SCRIPT).toMatch(/classList\.add\("dark"\)/);
  });

  it("defaults to system for an unrecognised stored value", () => {
    // [\s\S] instead of the /s flag — the repo targets pre-ES2018.
    expect(THEME_INIT_SCRIPT).toMatch(/!==\s*"light"[\s\S]*!==\s*"dark"[\s\S]*!==\s*"system"/);
  });
});
