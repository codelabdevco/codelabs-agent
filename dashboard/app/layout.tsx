import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Fleet Control",
  description: "Unified dashboard for OpenClaw + n8n agent fleet",
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
