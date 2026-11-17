import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReplyForm } from "@/components/discussion-form";
import { MemberName } from "@/components/member-name";
import { RemovePostButton } from "@/components/remove-post-button";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { clubPath, discussionPath } from "@/lib/clubs";
import { formatDay, pluralize } from "@/lib/format";
import { getSession } from "@/lib/session";
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

const postBody = "mt-3 max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line";

function Byline({ author, at }: { author: string | null; at: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      {author ? <MemberName username={author} /> : "A former member"}, {formatDay(new Date(at))}
    </p>
  );
}

export default async function DiscussionPage({ params }: Props) {
  const [thread, session] = await Promise.all([getThread(params), getSession()]);

  return (
    <div className="max-w-3xl pt-10 sm:pt-16">
      <p className="text-sm">
        <Link
          href={clubPath(thread.club.id)}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {thread.club.name}
        </Link>
      </p>
      <h1 className="mt-2 text-balance font-display text-4xl leading-none font-extrabold tracking-tight">
        {thread.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <Byline author={thread.author} at={thread.createdAt} />
        {thread.canRemove && (
          <RemovePostButton kind="discussion" id={thread.id} clubId={thread.club.id} />
        )}
      </div>
      <p className={postBody}>{thread.body}</p>

      <section aria-labelledby="replies-heading" className="mt-12">
        <h2 id="replies-heading" className="font-display text-2xl font-bold tracking-tight">
          {thread.replies.length === 0
            ? "No replies yet"
            : pluralize(thread.replies.length, "reply", "replies")}
        </h2>
        {thread.replies.length > 0 && (
          <ol className="mt-4 divide-y border-y">
            {thread.replies.map((reply) => (
              <li key={reply.id} className="py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                  <Byline author={reply.author} at={reply.createdAt} />
                  {reply.canRemove && (
                    <RemovePostButton kind="reply" id={reply.id} author={reply.author} />
                  )}
                </div>
                <p className={postBody}>{reply.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="mt-8">
        {thread.isMember ? (
          <ReplyForm threadId={thread.id} />
        ) : session ? (
          <p className="text-muted-foreground">
            <Link
              href={clubPath(thread.club.id)}
              className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Join {thread.club.name}
            </Link>{" "}
            to reply.
          </p>
        ) : (
          <SignInPrompt returnTo={discussionPath(thread.club.id, thread.id)}>
            and join the club to reply.
          </SignInPrompt>
        )}
      </div>
    </div>
  );
}
