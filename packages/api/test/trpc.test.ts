import { db } from "@yousiverse/db";
import { describe, expect, it } from "vitest";
import { type Context, protectedProcedure, router } from "../src/trpc";

const testRouter = router({
  whoAmI: protectedProcedure.query(({ ctx }) => ctx.session.user.email),
});

const session = {
  user: { email: "reader@example.com" },
} as NonNullable<Context["session"]>;

describe("protectedProcedure", () => {
  it("rejects callers without a session", async () => {
    const caller = testRouter.createCaller({ db, session: null });
    await expect(caller.whoAmI()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("passes the session through to signed-in callers", async () => {
    const caller = testRouter.createCaller({ db, session });
    expect(await caller.whoAmI()).toBe("reader@example.com");
  });
});
