import Link from "next/link";
import type { MediaType } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { LibraryControl } from "./library-control";

type Props = { mediaId: string; type: MediaType; path: string };

/** What a person can do with a title. Signed-out visitors are pointed to sign in instead. */
export async function TitleActions({ mediaId, type, path }: Props) {
  if (!(await getSession())) {
    return (
      <p className="text-sm text-muted-foreground">
        <Link
          href={`/sign-in?next=${encodeURIComponent(path)}`}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Sign in
        </Link>{" "}
        to add this to your library.
      </p>
    );
  }

  const entry = await getQueryClient().fetchQuery(trpc.library.entry.queryOptions({ mediaId }));
  return <LibraryControl mediaId={mediaId} type={type} initialEntry={entry} />;
}
