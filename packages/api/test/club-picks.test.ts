import { db } from "@yousiverse/db";
import { clubPicks, media, users } from "@yousiverse/db/schema";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

type Member = Awaited<ReturnType<typeof signedInAs>>;

async function addTitles() {
  const [matrix, hades, dune, piranesi] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "book", title: "Dune", provider: "open_library", providerId: "OL893414W" },
      { type: "book", title: "Piranesi", provider: "open_library", providerId: "OL20893680W" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !dune || !piranesi) throw new Error("Titles were not created.");
  return { matrix: matrix.id, hades: hades.id, dune: dune.id, piranesi: piranesi.id };
}

describe("club picks", () => {
  let titles: Awaited<ReturnType<typeof addTitles>>;
  let ada: Member;
  let grace: Member;
  let linus: Member;
  let bookClub: string;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    titles = await addTitles();
    ada = await signedInAs("Ada");
    grace = await signedInAs("Grace");
    linus = await signedInAs("Linus");
    const club = await ada.caller.clubs.create({
      name: "Slow Readers",
      access: "public",
      mediaTypes: ["book"],
    });
    bookClub = club.id;
    await grace.caller.clubs.join({ id: bookClub });
  });

  it("lets any member pick a title of a type the club covers, once", async () => {
    await grace.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });
    await ada.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });

    expect(await anonymous.clubs.picks({ id: bookClub })).toEqual([
      {
        mediaId: titles.dune,
        type: "book",
        title: "Dune",
        releaseYear: null,
        posterUrl: null,
        providerId: "OL893414W",
        addedBy: "grace",
        clubRating: null,
        canRemove: false,
      },
    ]);
  });

  it("refuses a title of a type the club does not cover", async () => {
    for (const mediaId of [titles.matrix, titles.hades]) {
      await expect(ada.caller.clubs.addPick({ id: bookClub, mediaId })).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "This club does not cover that kind of title.",
      });
    }
    expect(await db.select().from(clubPicks)).toHaveLength(0);
  });

  it("refuses picks from people who are not members, signed in or not", async () => {
    const pick = { id: bookClub, mediaId: titles.dune };

    await expect(anonymous.clubs.addPick(pick)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(linus.caller.clubs.addPick(pick)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(linus.caller.clubs.removePick(pick)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stops showing picks of a type the club no longer covers", async () => {
    const club = await ada.caller.clubs.create({
      name: "Everything",
      access: "public",
      mediaTypes: ["movie", "book"],
    });
    await ada.caller.clubs.addPick({ id: club.id, mediaId: titles.matrix });
    await ada.caller.clubs.addPick({ id: club.id, mediaId: titles.dune });

    await ada.caller.clubs.update({
      id: club.id,
      name: "Everything",
      access: "public",
      mediaTypes: ["book"],
    });

    const picks = await anonymous.clubs.picks({ id: club.id });
    expect(picks.map((pick) => pick.title)).toEqual(["Dune"]);
  });

  it("averages only current members' ratings of the whole title", async () => {
    await ada.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });
    await ada.caller.ratings.save({ target: { mediaId: titles.dune }, value: 40 });
    await grace.caller.ratings.save({ target: { mediaId: titles.dune }, value: 30 });
    // Linus is not a member, so his rating does not count.
    await linus.caller.ratings.save({ target: { mediaId: titles.dune }, value: 0 });

    expect(await anonymous.clubs.picks({ id: bookClub })).toMatchObject([
      { title: "Dune", clubRating: { average: 35, count: 2 } },
    ]);

    await grace.caller.clubs.leave({ id: bookClub });
    expect(await anonymous.clubs.picks({ id: bookClub })).toMatchObject([
      { clubRating: { average: 40, count: 1 } },
    ]);
  });

  it("lets a member remove their own pick and the owner remove any", async () => {
    await grace.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });
    await ada.caller.clubs.addPick({ id: bookClub, mediaId: titles.piranesi });
    const canRemove = async (member: Member) =>
      Object.fromEntries(
        (await member.caller.clubs.picks({ id: bookClub })).map((pick) => [
          pick.title,
          pick.canRemove,
        ]),
      );

    expect(await canRemove(grace)).toEqual({ Dune: true, Piranesi: false });
    expect(await canRemove(ada)).toEqual({ Dune: true, Piranesi: true });
    await expect(
      grace.caller.clubs.removePick({ id: bookClub, mediaId: titles.piranesi }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await grace.caller.clubs.removePick({ id: bookClub, mediaId: titles.dune });
    await ada.caller.clubs.removePick({ id: bookClub, mediaId: titles.piranesi });
    await ada.caller.clubs.removePick({ id: bookClub, mediaId: titles.piranesi });

    expect(await anonymous.clubs.picks({ id: bookClub })).toEqual([]);
  });

  it("keeps an invite-only club's picks from everyone outside it", async () => {
    const club = await ada.caller.clubs.create({
      name: "Quiet Readers",
      access: "invite_only",
      mediaTypes: ["book"],
    });
    await ada.caller.clubs.addPick({ id: club.id, mediaId: titles.dune });
    const { inviteCode } = await ada.caller.clubs.get({ id: club.id });

    for (const caller of [anonymous, linus.caller]) {
      await expect(caller.clubs.picks({ id: club.id })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(
      linus.caller.clubs.addPick({ id: club.id, mediaId: titles.piranesi }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await linus.caller.clubs.join({ id: club.id, invite: inviteCode ?? "" });
    expect(await linus.caller.clubs.picks({ id: club.id })).toMatchObject([{ title: "Dune" }]);
  });

  it("offers a title only to the person's clubs that cover its type", async () => {
    const films = await grace.caller.clubs.create({
      name: "Friday Films",
      access: "public",
      mediaTypes: ["movie", "tv"],
    });
    await grace.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });

    expect(await grace.caller.clubs.forTitle({ mediaId: titles.dune })).toEqual([
      { id: bookClub, name: "Slow Readers", picked: true },
    ]);
    expect(await grace.caller.clubs.forTitle({ mediaId: titles.piranesi })).toEqual([
      { id: bookClub, name: "Slow Readers", picked: false },
    ]);
    expect(await grace.caller.clubs.forTitle({ mediaId: titles.matrix })).toEqual([
      { id: films.id, name: "Friday Films", picked: false },
    ]);
    expect(await grace.caller.clubs.forTitle({ mediaId: titles.hades })).toEqual([]);
    // Linus is in no clubs.
    expect(await linus.caller.clubs.forTitle({ mediaId: titles.dune })).toEqual([]);
    await expect(anonymous.clubs.forTitle({ mediaId: titles.dune })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("keeps a pick, without a name on it, when the member who picked it deletes their account", async () => {
    await grace.caller.clubs.addPick({ id: bookClub, mediaId: titles.dune });

    await db.delete(users).where(eq(users.id, grace.user.id));

    expect(await anonymous.clubs.picks({ id: bookClub })).toMatchObject([
      { title: "Dune", addedBy: null },
    ]);
  });
});
