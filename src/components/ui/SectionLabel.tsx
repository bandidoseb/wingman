"use client";
import { cn } from "@/lib/utils";

export default function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Color is a token. It used to be a hardcoded iOS gray whose dark value
        // measured 2.37–2.75:1 against our dark surfaces — effectively invisible
        // (AA-large needs 3:1). --ink-3 is 3.9–5.0:1 dark, 3.6:1 light. Size and
        // tracking stay as-is; they move to `text-label` when each screen migrates.
        "text-[11px] text-ink-3 font-semibold tracking-[0.06em] uppercase mb-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}
