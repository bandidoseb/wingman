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
        "text-[11px] text-[#aeaeb2] dark:text-[#636366] font-semibold tracking-[0.06em] uppercase mb-3.5",
        className
      )}
    >
      {children}
    </div>
  );
}
