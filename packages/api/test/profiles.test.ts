import { db } from "@yousiverse/db";
import { users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

describe("profiles", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("requires signing in", async () => {
    await expect(anonymous.profiles.me()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonymous.profiles.save({ username: "ada", name: "Ada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("has no username until one is chosen", async () => {
    const { caller } = await signedInAs("Ada", { username: false });

    expect(await caller.profiles.me()).toEqual({ name: "Ada", username: null });
  });

  it("chooses a username and display name, lowering capitals and trimming spaces", async () => {
    const { caller } = await signedInAs("Ada", { username: false });

    await caller.profiles.save({ username: "  Ada_L ", name: " Ada Lovelace " });

    expect(await caller.profiles.me()).toEqual({ name: "Ada Lovelace", username: "ada_l" });
  });

  it("changes a username and lets the person keep their own", async () => {
    const { caller } = await signedInAs("Ada");

    await caller.profiles.save({ username: "ada", name: "Ada L." });
    await caller.profiles.save({ username: "countess", name: "Ada L." });

    expect(await caller.profiles.me()).toEqual({ name: "Ada L.", username: "countess" });
  });

  it("refuses a username someone else has, whatever its capitals", async () => {
    await signedInAs("Ada");
    const grace = await signedInAs("Grace");

    await expect(
      grace.caller.profiles.save({ username: "ADA", name: "Grace" }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(await grace.caller.profiles.me()).toMatchObject({ username: "grace" });
  });

  it.each(["ab", "a".repeat(21), "ada lovelace", "ada-l", "ada.l", "ädä"])(
    "rejects the username %j",
    async (username) => {
      const { caller } = await signedInAs("Ada", { username: false });

      await expect(caller.profiles.save({ username, name: "Ada" })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    },
  );

  it("rejects an empty display name", async () => {
    const { caller } = await signedInAs("Ada");

    await expect(caller.profiles.save({ username: "ada", name: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});
