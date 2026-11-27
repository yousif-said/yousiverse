import { cn } from "cn";
import type { Metadata } from "next";
import Link from "next/link";
import { Thumb } from "@/components/media/artwork";
import { Medium } from "@/components/media/medium";
import { Score } from "@/components/media/score";
import { MemberName } from "@/components/member-name";
import { getViewer } from "@/components/shell/viewer";
import { CopyLinkButton } from "@/components/together/copy-link-button";
import { ListDialog } from "@/components/together/list-dialog";
import { NoteEditor, RemoveListItemButton } from "@/components/together/list-item-controls";
import { Ambient } from "@/components/ui/ambient";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { Crumb } from "@/components/ui/page-header";
import { VisibilityChip } from "@/components/ui/visibility-chip";
import { pluralize } from "@/lib/format";
import { getMarks } from "@/lib/marks";
import { mediaPath } from "@/lib/media";
import { ambientOf, tonedClass, toneStyle } from "@/lib/titles";
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
  const [list, viewer] = await Promise.all([getList(params), getViewer()]);
  const marks = await getMarks(list.items.map((item) => item.mediaId));
  const lead = list.items[0];

  return (
    <>
      <Ambient src={lead ? ambientOf(lead) : null} />
      <div className={cn("page page--narrow", tonedClass(lead))} style={toneStyle(lead)}>
        {/* The index of lists is a signed-in person's own; a visitor has none to go back to. */}
        {viewer && <Crumb href="/lists">Lists</Crumb>}
        <header className="ph" style={{ marginTop: 14 }}>
          <div className="ph__text">
            <h1 className="d1">{list.name}</h1>
            {list.description && <p className="lede whitespace-pre-line">{list.description}</p>}
            <div className="tile__meta" style={{ marginTop: 4 }}>
              <Avatar username={list.owner} size={26} />
              <span>
                {list.isOwner ? (
                  "Your list"
                ) : (
                  <>
                    By <MemberName username={list.owner} />
                  </>
                )}{" "}
                · {pluralize(list.items.length, "title")}
              </span>
              <VisibilityChip visibility={list.visibility} />
            </div>
          </div>
          {list.isOwner && (
            <div className="ph__actions">
              <CopyLinkButton path={`/lists/${list.id}`}>
                <Icon name="link" />
                Copy link
              </CopyLinkButton>
              <ListDialog
                list={{
                  id: list.id,
                  name: list.name,
                  description: list.description,
                  visibility: list.visibility,
                }}
              />
            </div>
          )}
        </header>

        {list.items.length === 0 ? (
          <div className="empty">
            This list is empty.
            {list.isOwner && " Open any title’s page and choose “Add to a list” to put it here."}
          </div>
        ) : (
          <ol>
            {list.items.map((item, index) => (
              <li key={item.mediaId} className="rank">
                <span className="rank__n">{index + 1}</span>
                <Thumb title={item} decorative />
                <div className="min-w-0">
                  <Link
                    className="row__title block"
                    href={mediaPath(item.type, item.providerId)}
                    style={{ fontSize: 16.5 }}
                  >
                    {item.title}
                  </Link>
                  <div className="row__sub">
                    <Medium type={item.type} />
                    <span>{item.releaseYear ?? ""}</span>
                  </div>
                  {item.note && <p className="rank__note">{item.note}</p>}
                  {list.isOwner && (
                    <NoteEditor
                      listId={list.id}
                      mediaId={item.mediaId}
                      title={item.title}
                      note={item.note}
                    />
                  )}
                </div>
                <div className="row__end">
                  <Score value={marks.rating.get(item.mediaId)} />
                  {list.isOwner && (
                    <RemoveListItemButton
                      listId={list.id}
                      mediaId={item.mediaId}
                      title={item.title}
                    />
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
        {list.isOwner && list.items.length > 0 && (
          <p className="hint" style={{ marginTop: 18 }}>
            Add titles from their own pages. They appear here in the order you add them.
          </p>
        )}
      </div>
    </>
  );
}
