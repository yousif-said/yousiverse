import type { Database } from "@yousiverse/db";
import { type LinkKind, media, mediaLinks, universes } from "@yousiverse/db/schema";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { titleSummary, withPages } from "../titles";

/**
 * The most titles one universe is given. `library.statuses` and `ratings.averages` answer about
 * this many titles at once, so a page can always mark every title of the universe it shows.
 */
const MAX_UNIVERSE_TITLES = 300;

/** The most verified links the index reads. Reviewers approve them one at a time, so few exist. */
const MAX_LINKS = 5_000;

const linkFields = {
  fromMediaId: mediaLinks.fromMediaId,
  toMediaId: mediaLinks.toMediaId,
  kind: mediaLinks.kind,
};
const namingFields = {
  mediaId: universes.mediaId,
  name: universes.name,
  description: universes.description,
};

type Link = { fromMediaId: string; toMediaId: string; kind: LinkKind };
type Naming = { mediaId: string; name: string; description: string | null };
type Title = Awaited<ReturnType<typeof titlesOf>>[number];

/**
 * A story universe: every title joined to another through verified links, directly or by way of
 * other titles. It is worked out from `media_links` each time, never stored, so a suggestion
 * that nobody has approved can not be part of one.
 */
export type Universe = {
  /** The media id of its oldest title. Any member's id finds it, so old addresses keep working. */
  id: string;
  /** What a reviewer called it, or else the name of its oldest title. */
  name: string;
  description: string | null;
  /** Whether a reviewer has named it. */
  named: boolean;
  /** In release order. */
  titles: Title[];
  /** Each reads from the later title to the one it is based on or follows. */
  links: Link[];
};

async function titlesOf(db: Database, mediaIds: string[]) {
  const titles = await db
    .select({ ...titleSummary, releaseDate: media.releaseDate })
    .from(media)
    .where(inArray(media.id, mediaIds));
  return withPages(titles);
}

/** Names in the order they win: when linked universes each had a name, the oldest row is used. */
function namingsOf(db: Database, mediaIds?: string[]) {
  return db
    .select(namingFields)
    .from(universes)
    .where(mediaIds && inArray(universes.mediaId, mediaIds))
    .orderBy(asc(universes.updatedAt), asc(universes.id));
}

const yearOf = (title: Title) =>
  title.releaseYear ?? (title.releaseDate ? Number(title.releaseDate.slice(0, 4)) : null);

/**
 * Release order. Years are compared before dates because books carry only a year: by date alone
 * a 1965 novel would come after its 2021 film. For the same reason a title with only a year
 * opens that year, since it is most often the book the others are based on. Titles with no year
 * at all go last.
 */
function byRelease(a: Title, b: Title): number {
  const [yearA, yearB] = [yearOf(a), yearOf(b)];
  if (yearA !== yearB) return (yearA ?? Infinity) - (yearB ?? Infinity);
  if (a.releaseDate !== b.releaseDate) {
    if (!a.releaseDate) return -1;
    if (!b.releaseDate) return 1;
    return a.releaseDate < b.releaseDate ? -1 : 1;
  }
  return a.title.localeCompare(b.title, "en") || (a.mediaId < b.mediaId ? -1 : 1);
}

/**
 * Puts a universe together from the titles its links join. Null when fewer than two of them have
 * a page: a title on its own is not a universe.
 */
function assemble(titles: Title[], links: Link[], namings: Naming[]): Universe | null {
  if (titles.length > MAX_UNIVERSE_TITLES) {
    console.error(`A universe has more than ${MAX_UNIVERSE_TITLES} titles; the rest are left out.`);
  }
  const inOrder = [...titles].sort(byRelease).slice(0, MAX_UNIVERSE_TITLES);
  const [oldest] = inOrder;
  if (!oldest || inOrder.length < 2) return null;

  const members = new Set(inOrder.map((title) => title.mediaId));
  const naming = namings.find((candidate) => members.has(candidate.mediaId));
  return {
    id: oldest.mediaId,
    name: naming?.name ?? oldest.title,
    description: naming?.description ?? null,
    named: Boolean(naming),
    titles: inOrder,
    links: links.filter((link) => members.has(link.fromMediaId) && members.has(link.toMediaId)),
  };
}

/**
 * Every title joined to this one through verified links, itself included, nearest first. One
 * recursive query, so a title's page reads only its own universe instead of every link there is.
 * `union` drops titles already found, which is what ends the walk when links form a loop.
 */
async function membersOf(db: Database, mediaId: string): Promise<string[]> {
  const rows = await db.execute<{ id: string }>(sql`
    with recursive members(id) as (
      select ${mediaId}::uuid
      union
      select case when ${mediaLinks.fromMediaId} = members.id
        then ${mediaLinks.toMediaId} else ${mediaLinks.fromMediaId} end
      from members
      join ${mediaLinks} on members.id in (${mediaLinks.fromMediaId}, ${mediaLinks.toMediaId})
    )
    select id from members limit ${MAX_UNIVERSE_TITLES + 1}
  `);
  return rows.map((row) => row.id);
}

/** The universe a title belongs to. Null for a title that stands alone, or an id that is no title. */
export async function findUniverse(db: Database, mediaId: string): Promise<Universe | null> {
  const memberIds = await membersOf(db, mediaId);
  if (memberIds.length < 2) return null;

  const [titles, links, namings] = await Promise.all([
    titlesOf(db, memberIds),
    // A member's links only ever lead to other members, so looking from one end finds them all.
    db.select(linkFields).from(mediaLinks).where(inArray(mediaLinks.fromMediaId, memberIds)),
    namingsOf(db, memberIds),
  ]);
  return assemble(titles, links, namings);
}

/** Sorts links into groups that hang together: each group is one universe's titles and links. */
function connectedGroups(links: Link[]): { mediaIds: string[]; links: Link[] }[] {
  const linksAt = new Map<string, Link[]>();
  for (const link of links) {
    for (const end of [link.fromMediaId, link.toMediaId]) {
      const known = linksAt.get(end);
      if (known) known.push(link);
      else linksAt.set(end, [link]);
    }
  }

  const seen = new Set<string>();
  const groups: { mediaIds: string[]; links: Link[] }[] = [];
  for (const start of linksAt.keys()) {
    if (seen.has(start)) continue;
    seen.add(start);
    const group = { mediaIds: [start], links: [] as Link[] };
    // The list grows while it is walked: each title reached adds the titles it is linked to.
    for (const mediaId of group.mediaIds) {
      for (const link of linksAt.get(mediaId) ?? []) {
        const outgoing = link.fromMediaId === mediaId;
        if (outgoing) group.links.push(link);
        const other = outgoing ? link.toMediaId : link.fromMediaId;
        if (seen.has(other)) continue;
        seen.add(other);
        group.mediaIds.push(other);
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Every universe, largest first and then by name. The index needs every verified link anyway,
 * so it reads them once and walks them in memory, where telling the groups apart in SQL would
 * mean walking from every title.
 */
export async function listUniverses(db: Database): Promise<Universe[]> {
  const links = await db
    .select(linkFields)
    .from(mediaLinks)
    .orderBy(asc(mediaLinks.createdAt), asc(mediaLinks.id))
    .limit(MAX_LINKS);
  if (links.length === 0) return [];
  if (links.length === MAX_LINKS) {
    console.error(`The index reads ${MAX_LINKS} verified links; any newer ones are left out.`);
  }

  const groups = connectedGroups(links);
  const linkedIds = groups.flatMap((group) => group.mediaIds);
  const [titles, namings] = await Promise.all([titlesOf(db, linkedIds), namingsOf(db)]);
  const titleOf = new Map(titles.map((title) => [title.mediaId, title]));

  return groups
    .flatMap((group) => {
      const members = group.mediaIds.flatMap((mediaId) => titleOf.get(mediaId) ?? []);
      return assemble(members, group.links, namings) ?? [];
    })
    .sort((a, b) => b.titles.length - a.titles.length || a.name.localeCompare(b.name, "en"));
}

/**
 * Names a universe. Its one row is kept: the row a member already has is rewritten, and a
 * universe that has none gets one under its oldest title. Rows left over from universes that
 * were named apart and linked later are removed, so the name just given is the one shown.
 */
export async function nameUniverse(
  db: Database,
  universe: Universe,
  naming: { name: string; description: string | null },
  updatedBy: string,
): Promise<void> {
  const memberIds = universe.titles.map((title) => title.mediaId);
  await db.transaction(async (tx) => {
    const [kept, ...spare] = await tx
      .select({ id: universes.id })
      .from(universes)
      .where(inArray(universes.mediaId, memberIds))
      .orderBy(asc(universes.updatedAt), asc(universes.id));
    if (!kept) {
      const changes = { ...naming, updatedBy, updatedAt: new Date() };
      await tx
        .insert(universes)
        .values({ mediaId: universe.id, ...changes })
        .onConflictDoUpdate({ target: universes.mediaId, set: changes });
      return;
    }
    await tx
      .update(universes)
      .set({ ...naming, updatedBy })
      .where(eq(universes.id, kept.id));
    const spareIds = spare.map((row) => row.id);
    if (spareIds.length > 0) await tx.delete(universes).where(inArray(universes.id, spareIds));
  });
}
