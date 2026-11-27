import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NO_DATE, TitlePage } from "@/components/title/title-page";
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
  const length = book.pageCount ? pluralize(book.pageCount, "page") : null;

  return (
    <TitlePage
      title={{ ...book, mediaId: book.id, type: "book", providerId: id }}
      meta={[book.releaseYear ?? NO_DATE, length, book.genres.slice(0, 2).join(", ")]}
      by={book.authors.join(" and ")}
      facts={[
        { label: "Author", value: book.authors.join(", ") },
        { label: "First published", value: book.releaseYear },
        { label: "Length", value: length },
        { label: "Subjects", value: book.genres.join(", ") },
      ]}
    />
  );
}
