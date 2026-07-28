"use client";
import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export default function Card({ children, className, style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-[#1c1c1e] rounded-[18px] border border-black/6 dark:border-white/8 p-6 transition-[background,border] duration-300",
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
