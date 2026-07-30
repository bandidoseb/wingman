"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const base = [
  "w-full bg-surface text-ink-1 placeholder:text-ink-3",
  "border border-line-strong rounded-control",
  "transition-colors duration-2 ease-wm",
  "outline-hidden focus-visible:border-signal focus-visible:ring-2 focus-visible:ring-signal/25",
  "disabled:opacity-50 disabled:cursor-not-allowed",
  "aria-invalid:border-critical aria-invalid:ring-2 aria-invalid:ring-critical/20",
].join(" ");

/** Wingman text input — Design Language §6. All tokens, visible focus state. */
export default function Input({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input"
      className={cn(base, "h-9 px-3 text-body", className)}
      {...props}
    />
  );
}

/** Multi-line sibling of Input — same chrome, same focus behavior. */
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(base, "px-3 py-2 text-body resize-y min-h-20", className)}
      {...props}
    />
  );
}
