import Link from "next/link";
import { formatAverageRating, pluralize } from "@/lib/format";
import { MEDIA, type MediaType } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { LibraryControl } from "./library-control";
import { RatingControl } from "./rating-control";

type Props = { mediaId: string; type: MediaType; path: string };

/** What a person can do with a title. Signed-out visitors are pointed to sign in instead. */
export async function TitleActions({ mediaId, type, path }: Props) {
  const queryClient = getQueryClient();
  const [session, rating] = await Promise.all([
    getSession(),
    queryClient.fetchQuery(trpc.ratings.summary.queryOptions({ target: { mediaId } })),
  ]);

  const average = (
    <p className="text-sm text-muted-foreground">
      {rating.average === null
        ? "No ratings yet."
        : `Average ${formatAverageRating(rating.average)} out of 10 from ${pluralize(rating.count, "rating")}.`}
    </p>
  );

  if (!session) {
    return (
      <div className="space-y-2">
        {average}
        <p className="text-sm text-muted-foreground">
          <Link
            href={`/sign-in?next=${encodeURIComponent(path)}`}
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Sign in
          </Link>{" "}
          to add this to your library and rate it.
        </p>
      </div>
    );
  }

  const entry = await queryClient.fetchQuery(trpc.library.entry.queryOptions({ mediaId }));
  return (
    <div className="space-y-8">
      <LibraryControl mediaId={mediaId} type={type} initialEntry={entry} />
      <div className="space-y-3">
        <RatingControl
          target={{ mediaId }}
          initialValue={rating.mine}
          accent={MEDIA[type].accent}
        />
        {average}
      </div>
    </div>
  );
}
