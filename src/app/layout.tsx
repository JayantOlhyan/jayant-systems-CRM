import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JAYANT CRM — Personal Lead Intelligence & Relationship Management Workspace",
  description:
    "Private, customizable CRM and Lead Intelligence Workspace for Jayant Web & AI Systems",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
