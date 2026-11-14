import { MEDIA, type MediaType } from "@/lib/media";
import { getSession } from "@/lib/session";
import { getQueryClient, trpc } from "@/trpc/server";
import { ClubControl } from "./club-control";
import { LibraryControl } from "./library-control";
import { ListControl } from "./list-control";
import { RatingPanel } from "./rating-panel";
import { SignInPrompt } from "./sign-in-prompt";

type Props = { mediaId: string; type: MediaType; path: string };

/** What a person can do with a title. Signed-out visitors are pointed to sign in instead. */
export async function TitleActions({ mediaId, type, path }: Props) {
  const rating = <RatingPanel target={{ mediaId }} accent={MEDIA[type].accent} />;

  if (!(await getSession())) {
    return (
      <div className="space-y-2">
        {rating}
        <SignInPrompt returnTo={path}>
          to add this to your library or a list, and rate it.
        </SignInPrompt>
      </div>
    );
  }

  const queryClient = getQueryClient();
  const [entry, lists, clubs] = await Promise.all([
    queryClient.fetchQuery(trpc.library.entry.queryOptions({ mediaId })),
    queryClient.fetchQuery(trpc.lists.forTitle.queryOptions({ mediaId })),
    queryClient.fetchQuery(trpc.clubs.forTitle.queryOptions({ mediaId })),
  ]);
  return (
    <div className="space-y-8">
      <LibraryControl mediaId={mediaId} type={type} initialEntry={entry} />
      {rating}
      <div className="space-y-3">
        <ListControl mediaId={mediaId} initialLists={lists} />
        {/* Shown only to someone in a club that covers this kind of title. */}
        {clubs.length > 0 && <ClubControl mediaId={mediaId} initialClubs={clubs} />}
      </div>
    </div>
  );
}
