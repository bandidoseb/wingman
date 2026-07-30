import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { THEME_INIT_SCRIPT } from "@/lib/theme";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Wingman — AI Sales Copilot",
  description: "The best salespeople see patterns others miss. Wingman helps you spot them in real time.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the script below mutates <html>'s class and
    // colorScheme before React hydrates, so server and client markup differ by
    // design. Scoped to this element only.
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        {/* Blocking + inline on purpose: sets the theme BEFORE first paint.
            In a React effect it would already be too late and every dark-mode
            user would see a white flash on every page load. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
