import { db } from "@yousiverse/db";
import { users } from "@yousiverse/db/schema";
import { appRouter } from "../src/root";
import type { Context } from "../src/trpc";

export const anonymous = appRouter.createCaller({ db, session: null });

/** Creates a user and returns an API caller signed in as them. */
export async function signedInAs(name: string) {
  const id = `user-${name.toLowerCase()}`;
  const email = `${name.toLowerCase()}@example.com`;
  const [user] = await db.insert(users).values({ id, name, email }).returning();
  // The API reads only `session.user`; the rest of Better Auth's session is not needed here.
  const session = { user } as NonNullable<Context["session"]>;
  return { user: { id, name }, caller: appRouter.createCaller({ db, session }) };
}
