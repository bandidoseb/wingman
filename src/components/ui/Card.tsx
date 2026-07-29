"use client";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

/**
 * LEGACY Card — still used by the unmigrated tabs (Sales DNA, Flight Log, Intel,
 * Settings, Objection Vault). `@/components/ui/wm/Card` replaces it screen by screen.
 *
 * 2026-07-29: its dark background was hardcoded to an iOS system gray, which measures
 * R−B = −2 (cool/bluish) against the Wingman `--surface` at R−B = +5 (warm/brownish).
 * That is exactly the *"bluish gray … versus brownish gray on the homepage"* Sebastian
 * reported, on all five screens at once. Colors now come from tokens so this card
 * matches Home in both themes.
 * (Hex values omitted deliberately — `token-lint` scans comments, and quoting the old
 * literals here would keep the debt counter high and blind the ratchet on this file.)
 *
 * Geometry (18px radius) and the shadow are deliberately left alone: swapping them
 * to `rounded-card`/`shadow-raised` would restyle five screens in LIGHT mode too,
 * which nobody asked for. They go when each screen is properly migrated to wm/Card.
 */
export default function Card({ children, className, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        // Colors are tokens, geometry is not — see the note above the component.
        "bg-surface rounded-[18px] border border-line p-6 transition-[background,border] duration-300",
        "shadow-[0_1px_4px_rgba(0,0,0,0.07)] dark:shadow-[0_1px_4px_rgba(0,0,0,0.4)]",
        onClick && "cursor-pointer",
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
