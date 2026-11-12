"use client";

import { Button } from "@yousiverse/ui/components/button";
import { useEffect } from "react";

type Props = { error: Error & { digest?: string }; reset: () => void };

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="max-w-xl pt-16 sm:pt-24">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">
        This page didn&apos;t load
      </h1>
      <p className="mt-4 text-muted-foreground">
        Something went wrong while fetching it. Your data is unaffected.
      </p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
