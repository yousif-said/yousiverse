"use client";

import type { ErrorInfo } from "next/error";
import Link from "next/link";
import { useEffect } from "react";
import { NOT_LOADED, Notice } from "@/components/states/notice";

export default function ErrorPage({ error, retry }: ErrorInfo) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Notice {...NOT_LOADED}>
      <title>Something went wrong · Yousiverse</title>
      <div className="notice__actions">
        {/* `retry` asks the server for the page again; `reset` would only redraw what failed. */}
        <button type="button" className="btn btn--primary" onClick={retry}>
          Try again
        </button>
        <Link className="btn btn--soft" href="/">
          Back to Home
        </Link>
      </div>
    </Notice>
  );
}
