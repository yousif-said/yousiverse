import { formatAverageRating, pluralize } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { RatingControl } from "./rating-control";

type Props = { target: { mediaId: string } | { episodeId: string }; accent: string };

/** Everyone's average rating of a title or episode, with the rating slider for people signed in. */
export async function RatingPanel({ target, accent }: Props) {
  const [session, rating] = await Promise.all([
    getSession(),
    getQueryClient().fetchQuery(trpc.ratings.summary.queryOptions({ target })),
  ]);

  return (
    <div className="space-y-3">
      {session && <RatingControl target={target} initialValue={rating.mine} accent={accent} />}
      <p className="text-sm text-muted-foreground">
        {rating.average === null
          ? "No ratings yet."
          : `Average ${formatAverageRating(rating.average)} out of 10 from ${pluralize(rating.count, "rating")}.`}
      </p>
    </div>
  );
}
