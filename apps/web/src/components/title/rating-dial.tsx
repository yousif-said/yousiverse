import { getSession } from "@/lib/session";
import type { Target } from "@/lib/targets";
import { getQueryClient, trpc } from "@/trpc/server";
import { RatingDialControl } from "./rating-dial-control";

type Props = {
  target: Target;
  /** Mark the ratings of people the viewer follows along the scale. Off for episodes. */
  friends?: boolean;
};

/** The rating instrument: your rating on a ruler laid over how everyone else rated. */
export async function RatingDial({ target, friends = true }: Props) {
  const queryClient = getQueryClient();
  const [session, summary, bars, following] = await Promise.all([
    getSession(),
    queryClient.fetchQuery(trpc.ratings.summary.queryOptions({ target })),
    queryClient.fetchQuery(trpc.ratings.distribution.queryOptions({ target })),
    friends ? queryClient.fetchQuery(trpc.ratings.fromFollowing.queryOptions({ target })) : [],
  ]);

  return (
    <RatingDialControl
      target={target}
      initialValue={summary.mine}
      bars={bars}
      following={following}
      average={summary.average}
      count={summary.count}
      signedIn={session !== null}
    />
  );
}
