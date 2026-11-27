import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/alerts/unsubscribe-button";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Stop alert emails", robots: { index: false } };

export default async function UnsubscribePage({ searchParams }: PageProps<"/alerts/unsubscribe">) {
  const { token } = await searchParams;
  const hasToken = typeof token === "string" && token !== "";

  return (
    <div className="page page--narrow">
      <PageHeader
        title="Stop alert emails"
        lede={
          hasToken
            ? "This stops Yousiverse emailing you when an alert comes through. Sign-in links are not affected."
            : "This link is missing its code. Open the unsubscribe link from an alert email again, or sign in and turn the emails off on your alerts page."
        }
      />
      {hasToken && <UnsubscribeButton token={token} />}
    </div>
  );
}
