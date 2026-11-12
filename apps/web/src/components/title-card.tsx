import Link from "next/link";
import { MEDIA, type MediaType, mediaPath } from "@/lib/media";
import { Cover } from "./cover";

type Props = {
  type: MediaType;
  providerId: string;
  title: string;
  posterUrl: string | null;
  releaseYear: number | null;
  /** A second line under the title, such as a library status. */
  note?: string;
};

export const titleGridClasses = "grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6";

/** A title in a grid: its cover, name, type, and year, linking to its page. */
export function TitleCard({ type, providerId, title, posterUrl, releaseYear, note }: Props) {
  return (
    <Link
      href={mediaPath(type, providerId)}
      className="group block rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Cover
        type={type}
        title={title}
        posterUrl={posterUrl}
        className="transition-transform duration-200 group-hover:-translate-y-1 motion-reduce:transition-none"
      />
      <span className="mt-3 block leading-snug font-medium group-hover:underline">{title}</span>
      <span className="block text-sm text-muted-foreground">
        {MEDIA[type].singular}
        {releaseYear && `, ${releaseYear}`}
      </span>
      {note && <span className="mt-1 block text-sm font-medium">{note}</span>}
    </Link>
  );
}
