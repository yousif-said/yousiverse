import { db } from "@yousiverse/db";
import { profiles, users } from "@yousiverse/db/schema";
import { appRouter } from "../src/root";
import type { Context } from "../src/trpc";

export const anonymous = appRouter.createCaller({ db, session: null });

/**
 * Creates a user and returns an API caller signed in as them. Their username is their name in
 * lowercase, unless `username: false` leaves them without a profile.
 */
export async function signedInAs(name: string, options: { username?: false } = {}) {
  const id = `user-${name.toLowerCase()}`;
  const email = `${name.toLowerCase()}@example.com`;
  const [user] = await db.insert(users).values({ id, name, email }).returning();
  if (options.username !== false) {
    await db.insert(profiles).values({ userId: id, username: name.toLowerCase() });
  }
  // The API reads only `session.user`; the rest of Better Auth's session is not needed here.
  const session = { user } as NonNullable<Context["session"]>;
  return { user: { id, name }, caller: appRouter.createCaller({ db, session }) };
}
