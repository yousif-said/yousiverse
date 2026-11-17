import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/alert-settings";

export const metadata: Metadata = { title: "Stop alert emails", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: PageProps<"/alerts/unsubscribe">) {
  const { token } = await searchParams;

  return (
    <section className="mx-auto max-w-xl pt-16 sm:pt-24">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Stop alert emails</h1>
      {typeof token === "string" && token ? (
        <>
          <p className="mt-3 max-w-[65ch] text-muted-foreground">
            This stops Yousiverse emailing you when an alert comes through. Sign-in links are not
            affected.
          </p>
          <UnsubscribeButton token={token} />
        </>
      ) : (
        <p className="mt-3 max-w-[65ch] text-muted-foreground">
          This link is missing its code. Open the unsubscribe link from an alert email again, or
          sign in and turn the emails off on your alerts page.
        </p>
      )}
    </section>
  );
}
