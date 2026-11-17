import type { Metadata } from "next";
import Link from "next/link";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import { formatRating } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "For you" };

const textLink =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

export default async function RecommendationsPage() {
  await requireSession("/recommendations");
  const { rows, hasLikedTitles, incomplete } = await getQueryClient().fetchQuery(
    trpc.recommendations.forYou.queryOptions(),
  );

  return (
    <div className="pt-10 sm:pt-16">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">For you</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        Titles like the ones you rated 7 or higher, leaving out what is already in your library.
      </p>

      {incomplete && (
        <p role="status" className="mt-6 max-w-[65ch] rounded-lg border bg-card p-4 text-sm">
          Some suggestions could not be loaded right now. Try again in a little while.
        </p>
      )}

      {rows.length === 0 && !incomplete && (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          {hasLikedTitles ? (
            "Nothing new to suggest yet. Rate a few more titles and check back."
          ) : (
            <>
              Rate a title 7 or higher and suggestions will appear here.{" "}
              <Link href="/search" className={textLink}>
                Search for something you love
              </Link>{" "}
              to start.
            </>
          )}
        </p>
      )}

      {rows.map(({ seed, titles }) => {
        const headingId = `because-${seed.type}-${seed.providerId}`;
        return (
          <section key={headingId} aria-labelledby={headingId} className="mt-12">
            <h2 id={headingId} className="font-display text-2xl font-bold tracking-tight">
              Because you rated{" "}
              <Link
                href={mediaPath(seed.type, seed.providerId)}
                className="rounded-sm underline decoration-2 underline-offset-4 outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {seed.title}
              </Link>{" "}
              {formatRating(seed.rating)}
            </h2>
            <ul className={`mt-6 ${titleGridClasses}`}>
              {titles.map((title) => (
                <li key={`${title.type}-${title.providerId}`}>
                  <TitleCard {...title} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
