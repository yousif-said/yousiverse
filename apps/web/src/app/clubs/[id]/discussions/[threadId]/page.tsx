import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberName } from "@/components/member-name";
import { getViewer } from "@/components/shell/viewer";
import { DeletePostButton } from "@/components/together/delete-post-button";
import { ReplyComposer } from "@/components/together/reply-composer";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Crumb, PageHeader } from "@/components/ui/page-header";
import { clubPath, discussionPath } from "@/lib/clubs";
import { agoLabel, dayOf, midSentence } from "@/lib/days";
import { pluralize } from "@/lib/format";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/clubs/[id]/discussions/[threadId]">;

async function getThread(params: Props["params"]) {
  const { id, threadId } = await params;
  const thread = await orNotFound(
    getQueryClient().fetchQuery(trpc.discussions.get.queryOptions({ id: threadId })),
  );
  // A discussion only has a page under its own club.
  if (thread.club.id !== id) notFound();
  return thread;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const thread = await getThread(params);
  return { title: `${thread.title} · ${thread.club.name}` };
}

type MessageProps = {
  author: string | null;
  /** When it was posted. */
  at: string | Date;
  body: string;
  /** The opening post reads a little larger than the replies to it. */
  first?: boolean;
  /** The delete button, for someone allowed to delete this post. */
  children?: React.ReactNode;
};

function Message({ author, at, body, first, children }: MessageProps) {
  return (
    <li className={first ? "msg msg--first" : "msg"}>
      <Avatar username={author} size={44} />
      <div>
        <div className="flex items-baseline gap-2.5">
          <b>{author ? <MemberName username={author} /> : "A former member"}</b>
          <span className="hint">{agoLabel(dayOf(new Date(at)))}</span>
          {children}
        </div>
        <p className="msg__body">{body}</p>
      </div>
    </li>
  );
}

export default async function DiscussionPage({ params }: Props) {
  const [thread, viewer] = await Promise.all([getThread(params), getViewer()]);
  const started = midSentence(agoLabel(dayOf(new Date(thread.createdAt))));

  return (
    <div className="page page--narrow">
      <Crumb href={clubPath(thread.club.id)}>{thread.club.name}</Crumb>
      <PageHeader title={thread.title} className="mt-3.5">
        <p className="dim">
          {pluralize(thread.replies.length, "reply", "replies")} · started {started}
        </p>
      </PageHeader>
      <ol>
        <Message author={thread.author} at={thread.createdAt} body={thread.body} first>
          {thread.canRemove && (
            <DeletePostButton kind="discussion" id={thread.id} clubId={thread.club.id} />
          )}
        </Message>
        {thread.replies.map((reply) => (
          <Message key={reply.id} author={reply.author} at={reply.createdAt} body={reply.body}>
            {reply.canRemove && (
              <DeletePostButton kind="reply" id={reply.id} author={reply.author} />
            )}
          </Message>
        ))}
      </ol>
      {thread.isMember ? (
        <ReplyComposer threadId={thread.id} username={viewer?.username ?? null} />
      ) : (
        <div className="note" style={{ marginTop: 20 }}>
          <Icon name="info" />
          {viewer ? (
            <span>
              <Link className="link" href={clubPath(thread.club.id)}>
                Join {thread.club.name}
              </Link>{" "}
              to reply.
            </span>
          ) : (
            <span>
              <Link
                className="link"
                href={`/sign-in?next=${encodeURIComponent(discussionPath(thread.club.id, thread.id))}`}
              >
                Sign in
              </Link>{" "}
              and join {thread.club.name} to reply.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
