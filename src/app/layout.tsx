import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
