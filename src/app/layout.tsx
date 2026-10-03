import type { Metadata } from "next";
import type { ReactNode } from "react";
/* fonts are self-hosted (bundled from npm via @fontsource-variable) so the
 * app builds and renders identically with or without internet access —
 * no Google-Fonts download required at build or runtime */
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRAMAAN — AI Assistant for Indian Standards & BIS Services | SIH26107",
  description:
    "AI-powered intelligent assistant for Indian Standards and BIS services — find applicable standards, certification schemes, hallmarking guidance, testing labs and consumer verification. Smart India Hackathon 2026 · SIH26107.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink-950 font-ui text-slate-200 antialiased">{children}</body>
    </html>
  );
}
