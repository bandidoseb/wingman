"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Wingman Button — Design Language §6.
 *
 * Variants are the four the spec names, no more:
 *   primary   — accent fill, the one confident action on a screen
 *   secondary — surface + line-strong border
 *   ghost     — no chrome until hover
 *   danger    — critical-weak → critical on hover
 *
 * Every value is a token. No hex, no arbitrary sizes.
 */
const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap",
    "rounded-control font-medium",
    "transition-colors duration-2 ease-wm",
    "outline-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-signal text-signal-on hover:bg-signal-hover",
        secondary:
          "bg-surface text-ink-1 border border-line-strong hover:bg-surface-sunken",
        ghost: "text-ink-2 hover:bg-surface-sunken hover:text-ink-1",
        danger: "bg-critical-weak text-critical hover:bg-critical hover:text-white",
      },
      size: {
        sm: "h-8 px-3 text-small [&_svg]:size-3.5",
        md: "h-9 px-4 text-body [&_svg]:size-4",
        lg: "h-11 px-5 text-body [&_svg]:size-4",
        icon: "h-9 w-9 [&_svg]:size-4",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export default function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
