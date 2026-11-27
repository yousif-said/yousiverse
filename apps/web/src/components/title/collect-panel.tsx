import Link from "next/link";
import { Average } from "@/components/media/score";
import { Icon } from "@/components/ui/icon";
import type { MediaType } from "@/lib/media";
import { getQueryClient, trpc } from "@/trpc/server";
import { AddToList } from "./add-to-list";
import { PickForClub } from "./pick-for-club";

const ROW = { padding: "7px 8px", margin: "0 -8px" };

type Props = {
  title: { mediaId: string; type: MediaType; title: string };
  /** Where a visitor signs in to come back here. Null for someone who is signed in. */
  signInHref: string | null;
};

/**
 * The viewer's lists that hold this title and their clubs that picked it, with the ways to add
 * it to more. A visitor is shown the way in instead.
 */
export async function CollectPanel({ title, signInHref }: Props) {
  if (signInHref) {
    return (
      <Panel>
        <div className="flex flex-wrap gap-2">
          <Link className="btn btn--sm btn--soft" href={signInHref}>
            <Icon name="plus" size="sm" />
            Add to a list
          </Link>
        </div>
      </Panel>
    );
  }

  const { mediaId } = title;
  const queryClient = getQueryClient();
  const [holding, ownLists, covering, ownClubs] = await Promise.all([
    queryClient.fetchQuery(trpc.lists.forTitle.queryOptions({ mediaId })),
    queryClient.fetchQuery(trpc.lists.mine.queryOptions()),
    queryClient.fetchQuery(trpc.clubs.forTitle.queryOptions({ mediaId })),
    queryClient.fetchQuery(trpc.clubs.mine.queryOptions()),
  ]);
  const lists = holding.flatMap(({ id, name, contains }) => {
    const list = ownLists.find((own) => own.id === id);
    return list
      ? { id, name, contains, visibility: list.visibility, itemCount: list.itemCount }
      : [];
  });
  const clubs = covering.map((club) => ({
    ...club,
    memberCount: ownClubs.find((own) => own.id === club.id)?.memberCount ?? 0,
  }));
  const on = lists.filter((list) => list.contains);
  const pickedBy = await Promise.all(
    clubs
      .filter((club) => club.picked)
      .map(async (club) => {
        const picks = await queryClient.fetchQuery(trpc.clubs.picks.queryOptions({ id: club.id }));
        const rating = picks.find((pick) => pick.mediaId === mediaId)?.clubRating;
        return { ...club, average: rating?.average ?? null };
      }),
  );

  return (
    <Panel>
      {on.map((list) => (
        <Link
          key={list.id}
          className="row"
          href={`/lists/${list.id}`}
          style={{ ...ROW, gridTemplateColumns: "auto minmax(0, 1fr)" }}
        >
          <Icon name="list" />
          <span className="row__title">{list.name}</span>
        </Link>
      ))}
      {pickedBy.map((club) => (
        <Link
          key={club.id}
          className="row"
          href={`/clubs/${club.id}`}
          style={{ ...ROW, gridTemplateColumns: "auto minmax(0, 1fr) auto" }}
        >
          <Icon name="clubs" />
          <span className="row__title">{club.name}</span>
          <Average value={club.average} />
        </Link>
      ))}
      <div
        className="flex flex-wrap gap-2"
        style={{ marginTop: on.length > 0 || pickedBy.length > 0 ? 8 : 0 }}
      >
        <AddToList mediaId={mediaId} title={title.title} lists={lists} />
        {clubs.length > 0 && <PickForClub mediaId={mediaId} type={title.type} clubs={clubs} />}
      </div>
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel__head">
        <h3 className="label">Lists and clubs</h3>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}
