import "./globals.css";
import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-bricolage",
});

const bodyFont = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
});

export const metadata: Metadata = {
  title: { default: "Yousiverse", template: "%s | Yousiverse" },
  description: "Your movies, shows, games, and books on one shelf.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable}`}
      suppressHydrationWarning
    >
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-24 sm:px-8">
            {children}
          </main>
          <footer className="border-t">
            <p className="mx-auto max-w-6xl px-5 py-6 text-sm text-muted-foreground sm:px-8">
              Movie and TV data and images come from{" "}
              <a
                href="https://www.themoviedb.org"
                className="underline underline-offset-4 hover:text-foreground"
              >
                TMDB
              </a>
              . This product uses the TMDB API but is not endorsed or certified by TMDB. Game data
              and images come from{" "}
              <a
                href="https://www.igdb.com"
                className="underline underline-offset-4 hover:text-foreground"
              >
                IGDB
              </a>
              . Streaming availability comes from{" "}
              <a
                href="https://www.watchmode.com"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Watchmode
              </a>
              . PC game prices come from{" "}
              <a
                href="https://isthereanydeal.com"
                className="underline underline-offset-4 hover:text-foreground"
              >
                IsThereAnyDeal
              </a>
              . Book data and covers come from{" "}
              <a
                href="https://openlibrary.org"
                className="underline underline-offset-4 hover:text-foreground"
              >
                Open Library
              </a>
              .
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
