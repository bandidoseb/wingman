"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Wingman status pill — Design Language §6:
 * "Status pills carry state color + a dot."
 *
 * `tone` maps to the STATE system (§3d), which is for OUTCOME only — never
 * decoration. If you're reaching for a pill to add visual interest, don't.
 *
 * `neutral` is the default so an unknown/absent state reads as information,
 * not as a judgment.
 */
const pillVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill font-semibold whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-surface-sunken text-ink-2",
        positive: "bg-positive-weak text-positive",
        warning: "bg-warning-weak text-warning",
        critical: "bg-critical-weak text-critical",
        signal: "bg-signal-weak text-signal",
      },
      size: {
        sm: "h-5 px-2 text-[11px]",
        md: "h-6 px-2.5 text-small",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  }
);

const dotTone: Record<string, string> = {
  neutral: "bg-ink-3",
  positive: "bg-positive",
  warning: "bg-warning",
  critical: "bg-critical",
  signal: "bg-signal",
};

export default function Pill({
  children,
  className,
  tone = "neutral",
  size,
  dot = true,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof pillVariants> & { dot?: boolean }) {
  return (
    <span
      data-slot="pill"
      className={cn(pillVariants({ tone, size }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-pill shrink-0", dotTone[tone ?? "neutral"])}
        />
      )}
      {children}
    </span>
  );
}

export { pillVariants };
