import type { Database } from "@yousiverse/db";
import { follows, type Visibility } from "@yousiverse/db/schema";
import { and, count, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

/** Two people are friends when each follows the other. */
export async function areFriends(db: Database, a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const [found] = await db
    .select({ count: count() })
    .from(follows)
    .where(
      or(
        and(eq(follows.followerId, a), eq(follows.followedId, b)),
        and(eq(follows.followerId, b), eq(follows.followedId, a)),
      ),
    );
  return found?.count === 2;
}

/**
 * What one known person's content a viewer may see, leaving out what is private: everything
 * public, plus what is for friends when the viewer is one. The owner, looking at their own
 * content this way, sees what the public sees.
 */
export async function visibleFrom(
  db: Database,
  viewerId: string | undefined,
  ownerId: string,
  visibility: AnyPgColumn,
): Promise<SQL> {
  const levels: Visibility[] =
    viewerId && (await areFriends(db, viewerId, ownerId)) ? ["public", "friends"] : ["public"];
  return inArray(visibility, levels);
}

/**
 * The same rule for a query across many owners: a row is visible when it is public, or when it
 * is for friends and its owner and the viewer follow each other. The query this is used in must
 * not itself select from `follows`.
 */
export function visibleToOthers(
  viewerId: string | undefined,
  owner: AnyPgColumn,
  visibility: AnyPgColumn,
): SQL {
  const isPublic = eq(visibility, "public");
  if (!viewerId) return isPublic;
  const follow = (follower: SQL | AnyPgColumn, followed: SQL | AnyPgColumn) =>
    sql`exists (select 1 from ${follows} where ${follows.followerId} = ${follower} and ${follows.followedId} = ${followed})`;
  const viewer = sql`${viewerId}`;
  return sql`(${isPublic} or (${eq(visibility, "friends")} and ${follow(viewer, owner)} and ${follow(owner, viewer)}))`;
}
