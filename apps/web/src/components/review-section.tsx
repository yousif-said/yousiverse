import { formatDay, formatRating } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { MemberName } from "./member-name";
import { ReviewEditor } from "./review-editor";
import { SignInPrompt } from "./sign-in-prompt";

type Props = {
  target: { mediaId: string } | { episodeId: string };
  /** The page this section is on, to return to after signing in. */
  path: string;
};

/** Reviews of a title or an episode: the visitor's own first, then everyone else's. */
export async function ReviewSection({ target, path }: Props) {
  const [session, reviews] = await Promise.all([
    getSession(),
    getQueryClient().fetchQuery(trpc.reviews.list.queryOptions({ target })),
  ]);

  return (
    <section aria-labelledby="reviews-heading" className="mt-16 max-w-3xl">
      <h2 id="reviews-heading" className="font-display text-2xl font-bold tracking-tight">
        Reviews
      </h2>
      <div className="mt-5">
        {session ? (
          <ReviewEditor target={target} initialReview={reviews.mine} />
        ) : (
          <SignInPrompt returnTo={path}>to write a review.</SignInPrompt>
        )}
      </div>

      {reviews.others.length === 0 ? (
        <p className="mt-8 text-muted-foreground">
          {reviews.mine ? "No one else has reviewed this yet." : "No reviews yet."}
        </p>
      ) : (
        <ul className="mt-8 divide-y border-y">
          {reviews.others.map((review) => (
            <li key={review.id} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 py-6">
              <div>
                <p className="font-medium">
                  <MemberName username={review.author} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {formatDay(new Date(review.createdAt))}
                </p>
              </div>
              {review.rating !== null && (
                <p className="font-display text-3xl leading-none font-extrabold tabular-nums">
                  <span className="sr-only">Rated </span>
                  {formatRating(review.rating)}
                  <span className="sr-only"> out of 10</span>
                </p>
              )}
              <p className="col-span-full max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
                {review.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
