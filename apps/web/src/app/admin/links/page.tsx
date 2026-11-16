import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkForm } from "@/components/link-form";
import { RemoveLinkButton } from "@/components/remove-link-button";
import { SuggestionFinder } from "@/components/suggestion-finder";
import { SuggestionReview } from "@/components/suggestion-review";
import { pluralize } from "@/lib/format";
import { LINK_PHRASES, suggestionSides } from "@/lib/links";
import { MEDIA, type MediaType, mediaPath } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Franchise links" };

const sectionHeading = "font-display text-2xl font-bold tracking-tight";

type Side = { type: MediaType; providerId: string; title: string; releaseYear?: number | null };

/** "The Matrix (movie, 1999)", for telling apart titles that share a name. */
function sideLabel(side: Side): string {
  const kind = side.type === "tv" ? MEDIA.tv.singular : MEDIA[side.type].singular.toLowerCase();
  return `${side.title} (${kind}${side.releaseYear ? `, ${side.releaseYear}` : ""})`;
}

function TitleLink({ side }: { side: Side }) {
  return (
    <Link
      href={mediaPath(side.type, side.providerId)}
      className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {sideLabel(side)}
    </Link>
  );
}

export default async function FranchiseLinksPage() {
  await requireSession("/admin/links");
  const queryClient = getQueryClient();
  // The page does not exist for anyone who is not a reviewer.
  if (!(await queryClient.fetchQuery(trpc.links.canReview.queryOptions()))) notFound();

  const [{ pending, pendingCount, uncheckedTitles }, verified] = await Promise.all([
    queryClient.fetchQuery(trpc.links.suggestions.queryOptions()),
    queryClient.fetchQuery(trpc.links.verified.queryOptions()),
  ]);

  return (
    <div className="max-w-3xl pt-14 sm:pt-20">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Franchise links</h1>
      <p className="mt-3 max-w-[65ch] text-muted-foreground">
        Links connect a title to its source, its adaptations, its sequels, and the rest of its
        franchise. Nothing here appears on a title&apos;s page until you approve it.
      </p>

      <section aria-labelledby="find-heading" className="mt-12">
        <h2 id="find-heading" className={sectionHeading}>
          Find suggestions
        </h2>
        <p className="mt-2 mb-4 max-w-[65ch] text-sm text-muted-foreground">
          Suggestions come from Wikidata, which is edited by volunteers and is sometimes wrong.
        </p>
        <SuggestionFinder uncheckedTitles={uncheckedTitles} />
      </section>

      <section aria-labelledby="review-heading" className="mt-12">
        <h2 id="review-heading" className={sectionHeading}>
          Waiting for review
        </h2>
        {pending.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No suggestions are waiting.</p>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              {pluralize(pendingCount, "suggestion")} waiting
              {pendingCount > pending.length && `, showing the first ${pending.length}`}. Open a
              title to check it before approving.
            </p>
            <ul className="mt-4 divide-y border-y">
              {pending.map((suggestion) => {
                const [first, second] = suggestionSides(suggestion);
                const phrase = LINK_PHRASES[suggestion.kind];
                return (
                  <li
                    key={suggestion.id}
                    className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4"
                  >
                    <p className="max-w-[55ch]">
                      <TitleLink side={first} /> {phrase} <TitleLink side={second} />
                    </p>
                    <SuggestionReview
                      suggestionId={suggestion.id}
                      summary={`${sideLabel(first)} ${phrase} ${sideLabel(second)}`}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="add-heading" className="mt-12">
        <h2 id="add-heading" className={sectionHeading}>
          Link two titles yourself
        </h2>
        <p className="mt-2 mb-4 max-w-[65ch] text-sm text-muted-foreground">
          Open each title&apos;s page and copy its address from the browser.
        </p>
        <LinkForm />
      </section>

      <section aria-labelledby="verified-heading" className="mt-12">
        <h2 id="verified-heading" className={sectionHeading}>
          Recently verified
        </h2>
        {verified.length === 0 ? (
          <p className="mt-4 text-muted-foreground">No links have been verified yet.</p>
        ) : (
          <ul className="mt-4 divide-y border-y">
            {verified.map((link) => {
              const phrase = LINK_PHRASES[link.kind];
              return (
                <li
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-4"
                >
                  <p className="max-w-[55ch]">
                    <TitleLink side={link.from} /> {phrase} <TitleLink side={link.to} />
                  </p>
                  <RemoveLinkButton
                    linkId={link.id}
                    summary={`${sideLabel(link.from)} ${phrase} ${sideLabel(link.to)}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
