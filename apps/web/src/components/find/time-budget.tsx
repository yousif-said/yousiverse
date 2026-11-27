import { Medium } from "@/components/media/medium";
import { TitleCard } from "@/components/media/title-card";
import { LinkSegmented } from "@/components/ui/link-tabs";
import { getQueryClient, trpc } from "@/trpc/server";
import { BUDGET_CHOICES, BUDGETS, type Budget, fitLabel, forYouPath } from "./for-you";
import { PanelShelf } from "./panel-shelf";

type Props = {
  budget: Budget;
  /** The person chosen for "Something for two", kept in the address when the time changes. */
  companion?: string;
};

/** "How long have you got?": what the person wants or has under way that fits a stretch of time. */
export async function TimeBudget({ budget, companion }: Props) {
  const { picks, pagesPerHour } = await getQueryClient().fetchQuery(
    trpc.recommendations.forTime.queryOptions({ budget }),
  );
  const choices = BUDGET_CHOICES.map((choice) => ({
    href: forYouPath({ budget: choice, companion }),
    label: BUDGETS[choice],
    current: choice === budget,
  }));

  return (
    <section className="panel" style={{ padding: 26 }} aria-labelledby="budget-h">
      <div className="sh" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 className="d3" id="budget-h">
            How long have you got?
          </h2>
          <p className="sh__sub">From your own library, sized to the time you have.</p>
        </div>
        <LinkSegmented label="Time you have" choices={choices} />
      </div>
      <PanelShelf>
        {picks.length > 0 ? (
          picks.map((pick) => (
            <TitleCard
              key={pick.mediaId}
              title={pick}
              meta={
                <>
                  <Medium type={pick.type} label={false} />
                  <span>{fitLabel(pick.fit)}</span>
                </>
              }
            />
          ))
        ) : (
          <p className="dim">
            Nothing in your library fits. Try a {budget === "weekend" ? "shorter" : "longer"}{" "}
            stretch.
          </p>
        )}
      </PanelShelf>
      <p className="hint" style={{ marginTop: 14 }}>
        A book is sized at {pagesPerHour} pages an hour. Games are left out: nothing says how long
        one takes.
      </p>
    </section>
  );
}
