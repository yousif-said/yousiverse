import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkForm } from "@/components/review/link-form";
import { PairTitle } from "@/components/review/pair-title";
import { RemoveLinkButton } from "@/components/review/remove-link-button";
import { ReviewKeys } from "@/components/review/review-keys";
import { QUEUE_RELATIONS, queueOrder, type Side, sideLabel } from "@/components/review/sides";
import { SuggestionCard } from "@/components/review/suggestion-card";
import { SuggestionFinder } from "@/components/review/suggestion-finder";
import { Icon } from "@/components/ui/icon";
import { Crumb } from "@/components/ui/page-header";
import { pluralize } from "@/lib/format";
import { LINK_PHRASES } from "@/lib/links";
import { mediaPath } from "@/lib/media";
import { requireSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = { title: "Franchise links" };

function TitleLink({ side }: { side: Side }) {
  return (
    <Link className="link" href={mediaPath(side.type, side.providerId)}>
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
    <div className="page page--narrow">
      <Crumb href="/account">Account</Crumb>
      <header className="ph" style={{ marginTop: 14 }}>
        <div className="ph__text">
          <span className="label">
            <Icon name="shield" size="sm" /> Reviewers only
          </span>
          <h1 className="d2">Franchise links</h1>
          <p className="lede">
            Suggestions come from Wikidata and stay hidden until one of you approves them. A
            rejected suggestion is not raised again.
          </p>
        </div>
        <div className="ph__actions">
          <a className="btn btn--soft" href="#by-hand">
            <Icon name="link" />
            Link two titles
          </a>
        </div>
      </header>

      <section aria-labelledby="queue-h">
        <div className="sh">
          <h2 className="d3" id="queue-h">
            {pluralize(pendingCount, "suggestion")} waiting
          </h2>
          <span className="hint">
            <span className="kbd">A</span> approve &nbsp; <span className="kbd">R</span> reject
          </span>
        </div>
        {pending.length > 0 ? (
          <ReviewKeys>
            {pending.map((suggestion) => {
              const [first, second] = queueOrder(suggestion);
              const relation = QUEUE_RELATIONS[suggestion.kind];
              return (
                <SuggestionCard
                  key={suggestion.id}
                  suggestionId={suggestion.id}
                  summary={`${sideLabel(first)} ${relation} ${sideLabel(second)}`}
                >
                  <PairTitle side={first} />
                  <div className="pair__rel">
                    <Icon name="arrow-r" />
                    <span>{relation}</span>
                  </div>
                  <PairTitle side={second} />
                </SuggestionCard>
              );
            })}
          </ReviewKeys>
        ) : (
          <div className="empty">
            Nothing waiting. New suggestions arrive as titles are looked up.
          </div>
        )}
        {pendingCount > pending.length && (
          <p className="hint mt-4">
            Showing the first {pending.length}. The rest follow as these are settled.
          </p>
        )}
      </section>

      <section className="section" aria-labelledby="find-h">
        <div className="sh">
          <div>
            <h2 className="d3" id="find-h">
              Find suggestions
            </h2>
            <p className="sh__sub">
              Wikidata is edited by volunteers and is sometimes wrong. Open a title to check it
              before approving.
            </p>
          </div>
        </div>
        <SuggestionFinder uncheckedTitles={uncheckedTitles} />
      </section>

      <section className="section" id="by-hand" aria-labelledby="by-hand-h">
        <div className="sh">
          <div>
            <h2 className="d3" id="by-hand-h">
              Link two titles yourself
            </h2>
            <p className="sh__sub">
              Open each title&apos;s page and copy its address from the browser.
            </p>
          </div>
        </div>
        <LinkForm />
      </section>

      <section className="section" aria-labelledby="verified-h">
        <div className="sh">
          <div>
            <h2 className="d3" id="verified-h">
              Recently verified
            </h2>
            <p className="sh__sub">Removing a link takes it off both titles&apos; pages.</p>
          </div>
        </div>
        {verified.length > 0 ? (
          <ul>
            {verified.map((link) => {
              const phrase = LINK_PHRASES[link.kind];
              return (
                <li key={link.id} className="kv">
                  <div className="min-w-0">
                    <TitleLink side={link.from} /> {phrase} <TitleLink side={link.to} />
                  </div>
                  <RemoveLinkButton
                    linkId={link.id}
                    summary={`${sideLabel(link.from)} ${phrase} ${sideLabel(link.to)}`}
                  />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty">No links have been verified yet.</div>
        )}
      </section>
    </div>
  );
}
