import { Suspense } from "react";
import { Ambient } from "@/components/ui/ambient";
import { ambientOf } from "@/lib/titles";
import { getQueryClient, trpc } from "@/trpc/server";
import { BecauseYouRated } from "./because-you-rated";
import { ComingUp } from "./coming-up";
import { FirstRun } from "./first-run";
import { Hello } from "./hello";
import { Ready } from "./ready";
import { Resume } from "./resume";
import { Together } from "./together";

/**
 * Home for a signed-in person. It leads with what to pick back up; every section after that
 * appears only when it has something in it.
 */
export async function Dashboard({ name }: { name: string }) {
  const summary = await getQueryClient().fetchQuery(trpc.home.summary.queryOptions());
  if (summary.librarySize === 0) return <FirstRun name={name} summary={summary} />;

  const { today, inProgress, comingUp, ready } = summary;
  return (
    <>
      <Ambient src={inProgress.lead && ambientOf(inProgress.lead)} />
      <div className="page">
        <Hello name={name} summary={summary} />
        <Resume inProgress={inProgress} today={today} />
        {comingUp.length > 0 && <ComingUp entries={comingUp} today={today} />}
        {ready.length > 0 && <Ready titles={ready} />}
        <Together summary={summary} />
        <Suspense fallback={null}>
          <BecauseYouRated />
        </Suspense>
      </div>
    </>
  );
}
