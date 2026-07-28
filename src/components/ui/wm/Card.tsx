"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Wingman Card — Design Language §5/§6.
 *
 * Surface + hairline + card radius + soft elevation. That's the whole thing.
 *
 * `interactive` renders a real <button> rather than a clickable <div>. That is
 * deliberate: §6 says "what's interactive looks interactive", and a div with an
 * onClick is invisible to keyboard and screen-reader users. Props are typed as a
 * discriminated union so you get button props (onClick, disabled, type) only on
 * the interactive variant.
 *
 * Not the same component as the legacy `@/components/ui/Card` — that one carries
 * hardcoded iOS colors and is still in use on unmigrated screens. This replaces it
 * screen by screen.
 */

const shell = [
  "bg-surface border border-line rounded-card shadow-raised",
  "transition-[background-color,border-color,box-shadow] duration-2 ease-wm",
].join(" ");

const interactiveShell = [
  "w-full text-left cursor-pointer",
  "hover:border-line-strong hover:shadow-float",
  "outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
  "disabled:pointer-events-none disabled:opacity-50",
].join(" ");

type CardProps =
  | ({ interactive?: false } & React.ComponentProps<"div">)
  | ({ interactive: true } & React.ComponentProps<"button">);

export default function Card(props: CardProps) {
  if (props.interactive) {
    const { interactive: _i, className, children, type, ...rest } = props;
    return (
      <button
        data-slot="card"
        type={type ?? "button"}
        className={cn(shell, interactiveShell, className)}
        {...rest}
      >
        {children}
      </button>
    );
  }

  const { interactive: _i, className, children, ...rest } = props;
  return (
    <div data-slot="card" className={cn(shell, className)} {...rest}>
      {children}
    </div>
  );
}
