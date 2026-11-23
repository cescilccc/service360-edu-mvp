import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Service360 (Academic Demo) — AV Support",
  description: "Academic demo AV service desk: scan, report, triage, resolve.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
