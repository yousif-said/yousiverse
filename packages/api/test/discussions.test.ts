import { db } from "@yousiverse/db";
import { clubReplies, clubThreads, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

type Person = Awaited<ReturnType<typeof signedInAs>>;

const OPENING = { title: "Chapter one", body: "What did everyone make of the house?" };

async function startClub(owner: Person, access: "public" | "invite_only" = "public") {
  const { id } = await owner.caller.clubs.create({
    name: "Slow Readers",
    access,
    mediaTypes: ["book"],
  });
  const { inviteCode } = await owner.caller.clubs.get({ id });
  return { id, invite: inviteCode ?? undefined };
}

describe("discussions", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("lets a member start a discussion, which the club then lists", async () => {
    const ada = await signedInAs("Ada");
    const club = await startClub(ada);

    const { id } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });

    expect(await anonymous.discussions.list({ clubId: club.id })).toEqual([
      {
        id,
        title: "Chapter one",
        author: "ada",
        activeAt: expect.any(Date),
        replyCount: 0,
      },
    ]);
  });

  it("refuses to let anyone but a member start a discussion or reply", async () => {
    const ada = await signedInAs("Ada");
    const visitor = await signedInAs("Visitor");
    const club = await startClub(ada);
    const { id: threadId } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });

    await expect(
      anonymous.discussions.start({ clubId: club.id, ...OPENING }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      visitor.caller.discussions.start({ clubId: club.id, ...OPENING }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      visitor.caller.discussions.reply({ threadId, body: "Me too." }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(anonymous.discussions.reply({ threadId, body: "Hi." })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await db.select().from(clubThreads)).toHaveLength(1);
    expect(await db.select().from(clubReplies)).toHaveLength(0);
  });

  it("shows a discussion with its replies oldest first, to anyone for a public club", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const club = await startClub(ada);
    await grace.caller.clubs.join({ id: club.id });
    const { id } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });
    await grace.caller.discussions.reply({ threadId: id, body: "  Unsettling.  " });
    await ada.caller.discussions.reply({ threadId: id, body: "Agreed." });

    const thread = await anonymous.discussions.get({ id });

    expect(thread).toMatchObject({
      id,
      club: { id: club.id, name: "Slow Readers" },
      title: "Chapter one",
      body: "What did everyone make of the house?",
      author: "ada",
      canRemove: false,
      isMember: false,
    });
    expect(thread.replies).toMatchObject([
      { body: "Unsettling.", author: "grace", canRemove: false },
      { body: "Agreed.", author: "ada", canRemove: false },
    ]);
    expect((await anonymous.discussions.list({ clubId: club.id }))[0]?.replyCount).toBe(2);
  });

  it("hides an invite-only club's discussions from everyone but its members", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const visitor = await signedInAs("Visitor");
    const club = await startClub(ada, "invite_only");
    await grace.caller.clubs.join({ id: club.id, invite: club.invite });
    const { id } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });

    for (const outsider of [anonymous, visitor.caller]) {
      await expect(outsider.discussions.list({ clubId: club.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      await expect(outsider.discussions.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    // Trying to post does not reveal that the club exists either.
    await expect(
      visitor.caller.discussions.start({ clubId: club.id, ...OPENING }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      visitor.caller.discussions.reply({ threadId: id, body: "Hello?" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(await grace.caller.discussions.get({ id })).toMatchObject({ isMember: true });
    expect(await grace.caller.discussions.list({ clubId: club.id })).toHaveLength(1);
  });

  it("stops showing an invite-only club's discussions to someone who leaves", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const club = await startClub(ada, "invite_only");
    await grace.caller.clubs.join({ id: club.id, invite: club.invite });
    const { id } = await grace.caller.discussions.start({ clubId: club.id, ...OPENING });

    await grace.caller.clubs.leave({ id: club.id });

    await expect(grace.caller.discussions.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // What they wrote stays for the members.
    expect(await ada.caller.discussions.get({ id })).toMatchObject({ author: "grace" });
  });

  it("lists the most recently active discussion first", async () => {
    const ada = await signedInAs("Ada");
    const club = await startClub(ada);
    const older = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });
    const newer = await ada.caller.discussions.start({
      clubId: club.id,
      title: "Chapter two",
      body: "The statues.",
    });
    await db
      .update(clubThreads)
      .set({ activeAt: new Date("2026-01-01") })
      .where(eq(clubThreads.id, older.id));
    await db
      .update(clubThreads)
      .set({ activeAt: new Date("2026-01-02") })
      .where(eq(clubThreads.id, newer.id));
    const titles = async () =>
      (await ada.caller.discussions.list({ clubId: club.id })).map((thread) => thread.title);
    expect(await titles()).toEqual(["Chapter two", "Chapter one"]);

    await ada.caller.discussions.reply({ threadId: older.id, body: "Back to this." });

    expect(await titles()).toEqual(["Chapter one", "Chapter two"]);
  });

  it("lets a reply be deleted by its author or the club's owner, and nobody else", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    const club = await startClub(ada);
    await grace.caller.clubs.join({ id: club.id });
    await linus.caller.clubs.join({ id: club.id });
    const { id: threadId } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });
    const first = await grace.caller.discussions.reply({ threadId, body: "One." });
    const second = await grace.caller.discussions.reply({ threadId, body: "Two." });

    const seenBy = async (person: Person) =>
      (await person.caller.discussions.get({ id: threadId })).replies.map(
        (reply) => reply.canRemove,
      );
    expect(await seenBy(grace)).toEqual([true, true]);
    expect(await seenBy(ada)).toEqual([true, true]);
    expect(await seenBy(linus)).toEqual([false, false]);

    await expect(linus.caller.discussions.removeReply({ id: first.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await grace.caller.discussions.removeReply({ id: first.id });
    await ada.caller.discussions.removeReply({ id: second.id });

    expect((await ada.caller.discussions.get({ id: threadId })).replies).toEqual([]);
    await expect(ada.caller.discussions.removeReply({ id: second.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lets a discussion be deleted, with its replies, by its author or the owner only", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const linus = await signedInAs("Linus");
    const club = await startClub(ada);
    await grace.caller.clubs.join({ id: club.id });
    await linus.caller.clubs.join({ id: club.id });
    const mine = await grace.caller.discussions.start({ clubId: club.id, ...OPENING });
    const other = await grace.caller.discussions.start({ clubId: club.id, ...OPENING });
    await linus.caller.discussions.reply({ threadId: mine.id, body: "Reply." });

    await expect(linus.caller.discussions.remove({ id: mine.id })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(await grace.caller.discussions.remove({ id: mine.id })).toEqual({ clubId: club.id });
    await ada.caller.discussions.remove({ id: other.id });

    expect(await db.select().from(clubThreads)).toHaveLength(0);
    expect(await db.select().from(clubReplies)).toHaveLength(0);
  });

  it("keeps a discussion when its author's account is deleted, with no name on it", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const club = await startClub(ada);
    await grace.caller.clubs.join({ id: club.id });
    const { id } = await grace.caller.discussions.start({ clubId: club.id, ...OPENING });
    await grace.caller.discussions.reply({ threadId: id, body: "Mine too." });

    await db.delete(users).where(eq(users.id, grace.user.id));

    const thread = await ada.caller.discussions.get({ id });
    expect(thread).toMatchObject({ title: "Chapter one", author: null, canRemove: true });
    expect(thread.replies).toMatchObject([{ body: "Mine too.", author: null }]);
  });

  it("deletes a club's discussions with the club", async () => {
    const ada = await signedInAs("Ada");
    const club = await startClub(ada);
    const { id } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });
    await ada.caller.discussions.reply({ threadId: id, body: "Anyone?" });

    await ada.caller.clubs.remove({ id: club.id });

    expect(await db.select().from(clubThreads)).toHaveLength(0);
    expect(await db.select().from(clubReplies)).toHaveLength(0);
  });

  it("refuses an empty or overlong post", async () => {
    const ada = await signedInAs("Ada");
    const club = await startClub(ada);
    const { id: threadId } = await ada.caller.discussions.start({ clubId: club.id, ...OPENING });

    await expect(
      ada.caller.discussions.start({ clubId: club.id, title: "   ", body: "Text" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      ada.caller.discussions.start({ clubId: club.id, title: "x".repeat(121), body: "Text" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(ada.caller.discussions.reply({ threadId, body: "  " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      ada.caller.discussions.reply({ threadId, body: "x".repeat(5001) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("answers not found for a discussion that does not exist", async () => {
    const id = crypto.randomUUID();
    const ada = await signedInAs("Ada");

    await expect(anonymous.discussions.get({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(ada.caller.discussions.reply({ threadId: id, body: "?" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(ada.caller.discussions.remove({ id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
