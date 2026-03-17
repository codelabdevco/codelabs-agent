import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Codelabs Tech",
  description: "AI Agent Dashboard — Codelabs Tech",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
