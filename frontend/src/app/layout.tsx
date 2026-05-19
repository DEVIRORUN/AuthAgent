import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AuthAgent — Approval Intelligence",
  description: "The translation layer between you and every bureaucratic wall. Multi-agent AI that fights for your approval.",
  keywords: ["AI agent", "prior authorization", "approval", "healthcare", "visa", "loan"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
