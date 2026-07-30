"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function IconCopy() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2.5" />
      <path d="M5.5 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v.5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

/**
 * Copy-to-clipboard affordance. Sits in the top-right of the card whose content
 * it copies.
 *
 * `getText` is a function, not a string: the transcript can be thousands of lines
 * and there is no reason to build that string on every render of the page — only
 * when the rep actually clicks.
 *
 * Failure is surfaced, not swallowed. `navigator.clipboard` is undefined outside a
 * secure context and can be rejected by permissions; silently doing nothing would
 * look like a dead button.
 */
export default function CopyButton({
  getText,
  label = "Copy",
  className,
}: {
  getText: () => string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = React.useState<"idle" | "copied" | "failed">("idle");
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any pending reset must be cancelled if the card unmounts (switching tabs or
  // going back to the call list), or React warns about setting state on an
  // unmounted component and the next mount can flash a stale "Copied".
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (next: "copied" | "failed") => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  };

  /**
   * Fallback for when the async Clipboard API is unavailable or rejects.
   * `navigator.clipboard` needs a secure context AND a focused document, and it
   * throws rather than no-ops when either is missing — which would leave the rep
   * with a button that looks broken. The hidden-textarea + execCommand route has
   * no such requirements. Deprecated, but it is the only thing that works in the
   * cases the modern API refuses.
   */
  function legacyCopy(text: string): boolean {
    const ta = document.createElement("textarea");
    ta.value = text;
    // Keep it off-screen but still selectable — display:none is not.
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    try {
      ta.select();
      ta.setSelectionRange(0, text.length);
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }

  async function onCopy(e: React.MouseEvent) {
    e.stopPropagation();
    const text = getText();
    if (!text) return;

    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      flash("copied");
      return;
    } catch {
      // fall through to the legacy path
    }
    flash(legacyCopy(text) ? "copied" : "failed");
  }

  const text = state === "copied" ? "Copied" : state === "failed" ? "Press ⌘C" : label;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onCopy}
            aria-label={label}
            className={cn(
              "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-control shrink-0",
              "text-[11px] font-semibold cursor-pointer",
              "border border-line-strong bg-surface",
              "transition-colors duration-2 ease-wm",
              "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
              state === "copied" ? "text-positive border-positive/40" : "text-ink-2 hover:text-ink-1",
              className
            )}
          >
            {state === "copied" ? <IconCheck /> : <IconCopy />}
            {text}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {state === "failed" ? "Couldn't reach the clipboard" : "Copy the full transcript"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
