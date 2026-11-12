import { type MediaType, mediaPath } from "@/lib/media";
import { Cover } from "./cover";
import { TitleActions } from "./title-actions";

type Props = {
  mediaId: string;
  providerId: string;
  type: MediaType;
  title: string;
  tagline: string | null;
  overview: string | null;
  posterUrl: string | null;
  facts: { label: string; value: string | null }[];
};

/** The top of every title's page: cover, title, overview, and a short list of facts. */
export function MediaHeader({
  mediaId,
  providerId,
  type,
  title,
  tagline,
  overview,
  posterUrl,
  facts,
}: Props) {
  const knownFacts = facts.filter((fact) => fact.value);

  return (
    <header className="grid gap-8 pt-10 sm:grid-cols-[13rem_1fr] sm:gap-12 sm:pt-16 lg:grid-cols-[16rem_1fr]">
      <Cover
        type={type}
        title={title}
        posterUrl={posterUrl}
        priority
        className="w-40 shadow-lg sm:w-full"
      />
      <div className="min-w-0">
        <h1 className="text-balance font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
          {title}
        </h1>
        {tagline && <p className="mt-4 text-lg text-muted-foreground">{tagline}</p>}
        <p className="mt-6 max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
          {overview ?? "No description yet."}
        </p>
        {knownFacts.length > 0 && (
          <dl className="mt-8 grid max-w-xl grid-cols-[auto_1fr] gap-x-8 gap-y-2 border-t pt-6 text-sm">
            {knownFacts.map(({ label, value }) => (
              <div key={label} className="col-span-2 grid grid-cols-subgrid">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-8 max-w-xl border-t pt-6">
          <TitleActions mediaId={mediaId} type={type} path={mediaPath(type, providerId)} />
        </div>
      </div>
    </header>
  );
}
