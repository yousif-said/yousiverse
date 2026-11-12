import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MediaHeader } from "@/components/media-header";
import { pluralize } from "@/lib/format";
import { mediaPath } from "@/lib/media";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

async function getBook(providerId: string) {
  const book = await orNotFound(
    getQueryClient().fetchQuery(trpc.media.book.queryOptions({ providerId })),
  );
  // Open Library merges duplicate works; keep one address per book.
  if (book.providerId && book.providerId !== providerId) {
    redirect(mediaPath("book", book.providerId));
  }
  return book;
}

export async function generateMetadata({ params }: PageProps<"/books/[id]">): Promise<Metadata> {
  const book = await getBook((await params).id);
  return { title: book.title, description: book.overview };
}

export default async function BookPage({ params }: PageProps<"/books/[id]">) {
  const { id } = await params;
  const book = await getBook(id);

  return (
    <MediaHeader
      mediaId={book.id}
      providerId={id}
      type="book"
      title={book.title}
      tagline={book.authors.length > 0 ? `by ${book.authors.join(", ")}` : null}
      overview={book.overview}
      posterUrl={book.posterUrl}
      facts={[
        { label: "First published", value: book.releaseYear ? String(book.releaseYear) : null },
        { label: "Length", value: book.pageCount ? pluralize(book.pageCount, "page") : null },
        { label: "Subjects", value: book.genres.join(", ") },
      ]}
    />
  );
}
