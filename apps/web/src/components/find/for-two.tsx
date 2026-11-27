import Link from "next/link";
import { TitleCard } from "@/components/media/title-card";
import { Avatar } from "@/components/ui/avatar";
import { LinkSegmented } from "@/components/ui/link-tabs";
import { getQueryClient, trpc } from "@/trpc/server";
import { type Budget, forYouPath, togetherLabel } from "./for-you";
import { PanelShelf } from "./panel-shelf";

type Props = {
  /** The people the signed-in person follows. */
  companions: { username: string }[];
  /** The one to find something with: the one named in the address, or else the first. */
  chosen: { username: string } | undefined;
  /** The time chosen above, kept in the address when the person changes. */
  budget: Budget;
};

/** "Something for two": what the signed-in person and someone they follow would both enjoy. */
export async function ForTwo({ companions, chosen, budget }: Props) {
  const picks = chosen
    ? await getQueryClient().fetchQuery(
        trpc.recommendations.forTwo.queryOptions({ username: chosen.username }),
      )
    : [];

  return (
    <section className="section panel" style={{ padding: 26 }} aria-labelledby="blend-h">
      <div className="sh" style={{ alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 className="d3" id="blend-h">
            Something for two
          </h2>
          <p className="sh__sub">
            What you and a friend would both enjoy, from your want list and their favorites.
          </p>
        </div>
        {companions.length > 0 && (
          <LinkSegmented
            label="Friend"
            choices={companions.map(({ username }) => ({
              href: forYouPath({ budget, companion: username }),
              label: (
                <>
                  <Avatar username={username} size={22} />
                  {username}
                </>
              ),
              current: username === chosen?.username,
            }))}
          />
        )}
      </div>
      <PanelShelf>
        {picks.map((pick) => (
          <TitleCard
            key={pick.mediaId}
            title={pick}
            why={chosen && togetherLabel(pick, chosen.username)}
          />
        ))}
        {chosen && picks.length === 0 && (
          <p className="dim">
            Nothing yet that you and {chosen.username} would both enjoy. It fills in as each of you
            adds to a want list and rates what you finish.
          </p>
        )}
        {!chosen && (
          <p className="dim">
            Follow someone and what the two of you would both enjoy shows up here.{" "}
            <Link className="link" href="/search">
              Search for people
            </Link>
          </p>
        )}
      </PanelShelf>
    </section>
  );
}
