import type { Metadata } from "next";
import { ListSettings } from "@/components/list-settings";
import { RemoveListItemButton } from "@/components/remove-list-item-button";
import { TitleCard, titleGridClasses } from "@/components/title-card";
import { getQueryClient, orNotFound, trpc } from "@/trpc/server";

type Props = PageProps<"/lists/[id]">;

async function getList(params: Props["params"]) {
  const { id } = await params;
  return orNotFound(getQueryClient().fetchQuery(trpc.lists.get.queryOptions({ id })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const list = await getList(params);
  return { title: list.name, description: list.description };
}

export default async function ListPage({ params }: Props) {
  const list = await getList(params);

  return (
    <section className="pt-10 sm:pt-16">
      <h1 className="max-w-3xl text-balance font-display text-4xl leading-[0.95] font-extrabold tracking-tight sm:text-6xl">
        {list.name}
      </h1>
      <p className="mt-4 text-muted-foreground">
        {list.isOwner ? "Your list" : `A list by ${list.owner || "a Yousiverse member"}`}
        {list.visibility === "private" && ", visible only to you"}
      </p>
      {list.description && (
        <p className="mt-6 max-w-[65ch] text-pretty leading-relaxed whitespace-pre-line">
          {list.description}
        </p>
      )}
      {list.isOwner && <ListSettings list={list} />}

      {list.items.length === 0 ? (
        <p className="mt-10 max-w-[65ch] text-muted-foreground">
          {list.isOwner
            ? "This list is empty. Open any title’s page and choose “Add to a list” to put it here."
            : "This list is empty."}
        </p>
      ) : (
        <ol className={`mt-10 ${titleGridClasses}`}>
          {list.items.map((item) => (
            <li key={item.mediaId}>
              <TitleCard {...item} />
              {list.isOwner && (
                <RemoveListItemButton listId={list.id} mediaId={item.mediaId} title={item.title} />
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
