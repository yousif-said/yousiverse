import { db } from "@yousiverse/db";
import { clubMembers, clubs, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

type Caller = Awaited<ReturnType<typeof signedInAs>>["caller"];

type NewClub = Parameters<Caller["clubs"]["create"]>[0];

const BOOK_CLUB: NewClub = { name: "Slow Readers", access: "public", mediaTypes: ["book"] };
const FILM_CLUB: NewClub = {
  name: "Friday Films",
  description: "One film a week.",
  access: "invite_only",
  mediaTypes: ["tv", "movie"],
};

async function inviteCodeOf(owner: Caller, id: string) {
  const { inviteCode } = await owner.clubs.get({ id });
  if (!inviteCode) throw new Error("The owner was not given an invite code.");
  return inviteCode;
}

describe("clubs", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("requires signing in, and a username, to start a club", async () => {
    const quiet = await signedInAs("Quiet", { username: false });

    await expect(anonymous.clubs.create(BOOK_CLUB)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(quiet.caller.clubs.create(BOOK_CLUB)).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(await db.select().from(clubs)).toHaveLength(0);
  });

  it("makes the creator the owner and first member, with media types in a fixed order", async () => {
    const ada = await signedInAs("Ada");

    const { id } = await ada.caller.clubs.create(FILM_CLUB);

    expect(await ada.caller.clubs.get({ id })).toMatchObject({
      name: "Friday Films",
      description: "One film a week.",
      access: "invite_only",
      mediaTypes: ["movie", "tv"],
      owner: "ada",
      memberCount: 1,
      members: [{ username: "ada", name: "Ada" }],
      isMember: true,
      isOwner: true,
      canJoin: false,
      inviteCode: expect.stringMatching(/^[\w-]{20,}$/),
    });
    expect(await ada.caller.clubs.mine()).toMatchObject([{ id, memberCount: 1 }]);
  });

  it("refuses a club that covers no media types", async () => {
    const ada = await signedInAs("Ada");

    await expect(ada.caller.clubs.create({ ...BOOK_CLUB, mediaTypes: [] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("lets anyone see and join a public club, and lists it for discovery", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.clubs.create(BOOK_CLUB);

    expect(await anonymous.clubs.get({ id })).toMatchObject({
      name: "Slow Readers",
      isMember: false,
      canJoin: true,
      inviteCode: null,
      members: [{ username: "ada" }],
    });
    expect(await anonymous.clubs.discover()).toMatchObject([{ id, memberCount: 1 }]);

    await grace.caller.clubs.join({ id });
    await grace.caller.clubs.join({ id });

    expect(await grace.caller.clubs.get({ id })).toMatchObject({
      memberCount: 2,
      isMember: true,
      isOwner: false,
      canJoin: false,
      inviteCode: null,
    });
    expect(await grace.caller.clubs.mine()).toMatchObject([{ id }]);
  });

  it("lists public clubs largest first, and newest first among clubs of the same size", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const first = await ada.caller.clubs.create({ ...BOOK_CLUB, name: "First" });
    const second = await ada.caller.clubs.create({ ...BOOK_CLUB, name: "Second" });
    const third = await ada.caller.clubs.create({ ...BOOK_CLUB, name: "Third" });
    await db
      .update(clubs)
      .set({ createdAt: new Date("2020-01-01T00:00:00Z") })
      .where(eq(clubs.id, first.id));
    await db
      .update(clubs)
      .set({ createdAt: new Date("2021-01-01T00:00:00Z") })
      .where(eq(clubs.id, second.id));
    await grace.caller.clubs.join({ id: first.id });

    const listed = await anonymous.clubs.discover();

    expect(listed.map((club) => club.name)).toEqual(["First", "Third", "Second"]);
    expect(listed.map((club) => club.id)).toContain(third.id);
  });

  it("hides an invite-only club from everyone without its invite code", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.clubs.create(FILM_CLUB);

    for (const caller of [anonymous, grace.caller]) {
      await expect(caller.clubs.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(caller.clubs.get({ id, invite: "wrong" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(grace.caller.clubs.join({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(grace.caller.clubs.join({ id, invite: "wrong" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await anonymous.clubs.discover()).toEqual([]);
    expect(await db.select().from(clubMembers)).toHaveLength(1);
  });

  it("shows an invited person the club but not its members, and lets them join", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.clubs.create(FILM_CLUB);
    const invite = await inviteCodeOf(ada.caller, id);

    expect(await grace.caller.clubs.get({ id, invite })).toMatchObject({
      name: "Friday Films",
      memberCount: 1,
      members: [],
      isMember: false,
      canJoin: true,
      inviteCode: null,
    });

    await grace.caller.clubs.join({ id, invite });

    expect(await grace.caller.clubs.get({ id })).toMatchObject({
      isMember: true,
      members: [{ username: "ada" }, { username: "grace" }],
      inviteCode: null,
    });
  });

  it("stops an old invite link working once the owner resets it", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.clubs.create(FILM_CLUB);
    const oldInvite = await inviteCodeOf(ada.caller, id);

    await expect(grace.caller.clubs.resetInvite({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const { inviteCode } = await ada.caller.clubs.resetInvite({ id });

    expect(inviteCode).not.toBe(oldInvite);
    await expect(grace.caller.clubs.join({ id, invite: oldInvite })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await grace.caller.clubs.join({ id, invite: inviteCode });
    expect(await grace.caller.clubs.get({ id })).toMatchObject({ isMember: true });
  });

  it("requires a username to join", async () => {
    const ada = await signedInAs("Ada");
    const quiet = await signedInAs("Quiet", { username: false });
    const { id } = await ada.caller.clubs.create(BOOK_CLUB);

    await expect(quiet.caller.clubs.join({ id })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
  });

  it("lets a member leave, but not the owner", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const { id } = await ada.caller.clubs.create(FILM_CLUB);
    await grace.caller.clubs.join({ id, invite: await inviteCodeOf(ada.caller, id) });

    await expect(ada.caller.clubs.leave({ id })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await grace.caller.clubs.leave({ id });

    expect(await ada.caller.clubs.get({ id })).toMatchObject({ memberCount: 1 });
    // Having left an invite-only club, she can no longer see it.
    await expect(grace.caller.clubs.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("lets only the owner change the club, remove a member, or delete it", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    const { id } = await ada.caller.clubs.create(BOOK_CLUB);
    await grace.caller.clubs.join({ id });
    await linus.caller.clubs.join({ id });

    await expect(
      grace.caller.clubs.update({ id, ...BOOK_CLUB, name: "Taken over" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(grace.caller.clubs.removeMember({ id, username: "linus" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await grace.caller.clubs.remove({ id });
    expect(await anonymous.clubs.get({ id })).toMatchObject({
      name: "Slow Readers",
      memberCount: 3,
    });

    await ada.caller.clubs.update({
      id,
      name: "Slower Readers",
      access: "public",
      mediaTypes: ["book", "movie"],
    });
    await ada.caller.clubs.removeMember({ id, username: "linus" });
    await expect(ada.caller.clubs.removeMember({ id, username: "ada" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await anonymous.clubs.get({ id })).toMatchObject({
      name: "Slower Readers",
      description: null,
      mediaTypes: ["movie", "book"],
      members: [{ username: "ada" }, { username: "grace" }],
    });

    await ada.caller.clubs.remove({ id });
    await expect(anonymous.clubs.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await db.select().from(clubMembers)).toHaveLength(0);
  });

  it("never returns an email address", async () => {
    const ada = await signedInAs("Ada");
    const { id } = await ada.caller.clubs.create(BOOK_CLUB);

    expect(JSON.stringify(await anonymous.clubs.get({ id }))).not.toContain("example.com");
  });
});
