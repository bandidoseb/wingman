"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  readThemePref,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePref,
} from "@/lib/theme";

/**
 * Read/set the dashboard theme.
 *
 * `pref` is what the rep chose ("system" | "light" | "dark"); `resolved` is what
 * is actually on screen right now. The <html> class is set before paint by
 * THEME_INIT_SCRIPT, so this hook only has to keep it in sync afterwards.
 */
export function useTheme() {
  // Start from "system" on the server and correct on mount — reading
  // localStorage during render would break hydration.
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const p = readThemePref();
    setPrefState(p);
    setResolved(resolveTheme(p));
  }, []);

  // While on "system", follow the Mac live — flipping macOS appearance should
  // change the dashboard without a reload.
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = resolveTheme("system");
      setResolved(next);
      applyTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  // Keep other tabs/windows of the dashboard in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const p = readThemePref();
      setPrefState(p);
      const next = resolveTheme(p);
      setResolved(next);
      applyTheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    const r = resolveTheme(next);
    setResolved(r);
    applyTheme(r);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* private mode */ }
  }, []);

  return { pref, resolved, setPref };
}
