import type { Metadata } from "next";
import { Suspense } from "react";
import { BecauseRows, BecauseRowsPlaceholder } from "@/components/find/because-rows";
import { ForTwo } from "@/components/find/for-two";
import { DEFAULT_BUDGET, isBudget } from "@/components/find/for-you";
import { TimeBudget } from "@/components/find/time-budget";
import { PageHeader } from "@/components/ui/page-header";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "For you" };

export default async function RecommendationsPage({ searchParams }: PageProps<"/recommendations">) {
  await requireSession("/recommendations");
  const [params, companions] = await Promise.all([
    searchParams,
    getQueryClient().fetchQuery(trpc.recommendations.companions.queryOptions()),
  ]);
  const budget = isBudget(params.budget) ? params.budget : DEFAULT_BUDGET;
  // Anyone named in the address whom the person does not follow is passed over.
  const named = companions.find(({ username }) => username === params.with);

  return (
    <div className="page">
      <PageHeader
        title="For you"
        lede="Picked from what you rated 7 or higher. Each suggestion appears once."
      />
      <TimeBudget budget={budget} companion={named?.username} />
      <Suspense fallback={<BecauseRowsPlaceholder />}>
        <BecauseRows />
      </Suspense>
      <ForTwo companions={companions} chosen={named ?? companions[0]} budget={budget} />
    </div>
  );
}
