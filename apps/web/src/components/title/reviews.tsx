import type { RouterOutputs } from "@yousiverse/api";
import { cn } from "cn";
import { MemberName } from "@/components/member-name";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { SectionHead } from "@/components/ui/section-head";
import { agoLabel, dayOf } from "@/lib/days";
import { formatRating, pluralize } from "@/lib/format";
import { getSession } from "@/lib/session";
import type { Target } from "@/lib/targets";
import { getQueryClient, trpc } from "@/trpc/server";
import { MyReview } from "./my-review";
import { ReviewForm } from "./review-form";
import { SignInLink } from "./sign-in-link";

type Review = RouterOutputs["reviews"]["list"]["others"][number];

/** The day a review was posted, as the list shows it: "Yesterday", "Nov 3". */
const postedOn = (createdAt: Review["createdAt"]) => agoLabel(dayOf(new Date(createdAt)));

type Props = {
  target: Target;
  /** The section's heading. Defaults to "Reviews". */
  heading?: string;
  /** A line under the composer, such as "Episode reviews are separate from the show's." */
  hint?: string;
};

/** Reviews of a title or an episode, people the viewer follows first, and the box to write one. */
export async function Reviews({ target, heading = "Reviews", hint }: Props) {
  const queryClient = getQueryClient();
  const session = await getSession();
  const [{ mine, others, count }, me] = await Promise.all([
    queryClient.fetchQuery(trpc.reviews.list.queryOptions({ target })),
    session ? queryClient.fetchQuery(trpc.profiles.me.queryOptions()) : null,
  ]);
  const placeholder =
    "episodeId" in target ? "What did you think of this one?" : "What did you think?";

  return (
    <section aria-labelledby="reviews-h">
      <SectionHead
        title={heading}
        id="reviews-h"
        sub={
          count > 0 && `${pluralize(count, "review")}.${me ? " People you follow come first." : ""}`
        }
      />
      {!me ? (
        <div className="note">
          <Icon name="pencil" />
          <span>
            <SignInLink /> to write a review.
          </span>
        </div>
      ) : (
        !mine && (
          <ReviewForm
            target={target}
            username={me.username}
            placeholder={placeholder}
            hint={
              hint ?? (
                <>
                  <Icon name="globe" size="sm" /> Everyone can read this. Change it after posting.
                </>
              )
            }
          />
        )
      )}
      <ul style={{ marginTop: mine ? 0 : 10 }}>
        {me && mine && (
          <MyReview
            target={target}
            username={me.username}
            review={{ body: mine.body, visibility: mine.visibility, rating: mine.rating }}
            when={postedOn(mine.createdAt)}
            placeholder={placeholder}
          />
        )}
        {others.map((review) => (
          <ReviewItem key={review.id} review={review} />
        ))}
      </ul>
      {count === 0 && (
        <p className="dim" style={{ marginTop: 18 }}>
          Nobody has reviewed this yet.{me && " Yours would be the first."}
        </p>
      )}
    </section>
  );
}

/** One person's review: who, when, what they rated it, and what they wrote. */
function ReviewItem({ review }: { review: Review }) {
  return (
    <li className={cn("review", review.following && "review--friend")}>
      <Avatar username={review.author} size={40} />
      <div>
        <div className="review__who">
          <MemberName username={review.author} />
          {review.following && (
            <>
              {" "}
              <span className="chip" style={{ marginLeft: 6 }}>
                Following
              </span>
            </>
          )}
        </div>
        <div className="review__when">{postedOn(review.createdAt)}</div>
      </div>
      <div className="review__num">
        {review.rating !== null && (
          <>
            <span className="sr-only">Rated </span>
            {formatRating(review.rating)}
            <span className="sr-only"> out of 10</span>
          </>
        )}
      </div>
      <p className="review__body">{review.body}</p>
    </li>
  );
}
