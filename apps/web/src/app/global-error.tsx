"use client";

import "./globals.css";
import type { ErrorInfo } from "next/error";
import { useEffect } from "react";
import { NOT_LOADED, Notice } from "@/components/states/notice";

/**
 * Shown when the layout around every page fails, so it stands in for that layout: its own
 * document and styles, and no sidebar. It uses nothing the layout uses, the theme provider
 * included, because any of those may be what failed. It is always the night look.
 */
export default function GlobalError({ error, retry }: ErrorInfo) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body>
        <title>Something went wrong · Yousiverse</title>
        <main>
          <Notice {...NOT_LOADED}>
            <div className="notice__actions">
              <button type="button" className="btn btn--primary" onClick={retry}>
                Try again
              </button>
              {/* A plain link: it loads the app afresh, which is what a broken layout needs. */}
              <a className="btn btn--soft" href="/">
                Back to Home
              </a>
            </div>
          </Notice>
        </main>
      </body>
    </html>
  );
}
