import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Hanken_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";

// Serif for stories, sans for the interface, mono for measurements.
const displayFont = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const bodyFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

const monoFont = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: { default: "Yousiverse", template: "%s · Yousiverse" },
  description: "Your movies, shows, games, and books in one place.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f3f2ee" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>
          <a href="#main" className="skip">
            Skip to content
          </a>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
