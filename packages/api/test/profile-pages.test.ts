import { db } from "@yousiverse/db";
import { episodes, media, seasons, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

async function addTitles() {
  const [matrix, hades, show] = await db
    .insert(media)
    .values([
      { type: "movie", title: "The Matrix", provider: "tmdb", providerId: "603" },
      { type: "game", title: "Hades", provider: "igdb", providerId: "113112" },
      { type: "tv", title: "Severance", provider: "tmdb", providerId: "95396" },
    ])
    .returning({ id: media.id });
  if (!matrix || !hades || !show) throw new Error("Titles were not created.");
  const [season] = await db
    .insert(seasons)
    .values({ mediaId: show.id, seasonNumber: 1, name: "Season 1" })
    .returning({ id: seasons.id });
  if (!season) throw new Error("Season was not created.");
  const [episode] = await db
    .insert(episodes)
    .values({ seasonId: season.id, episodeNumber: 2, name: "Half Loop" })
    .returning({ id: episodes.id });
  if (!episode) throw new Error("Episode was not created.");
  return { matrix: matrix.id, hades: hades.id, show: show.id, episode: episode.id };
}

describe("public profiles", () => {
  let ids: Awaited<ReturnType<typeof addTitles>>;

  beforeEach(async () => {
    await db.delete(users);
    await db.delete(media);
    ids = await addTitles();
  });

  it("shows a profile to anyone, whatever capitals the address uses", async () => {
    const ada = await signedInAs("Ada");

    expect(await anonymous.profiles.get({ username: "ADA" })).toMatchObject({
      username: "ada",
      name: "Ada",
      isOwner: false,
    });
    expect(await ada.caller.profiles.get({ username: "ada" })).toMatchObject({ isOwner: true });
  });

  it("answers NOT_FOUND for a username nobody has", async () => {
    await signedInAs("Ada", { username: false });

    for (const username of ["ada", "no such person", ""]) {
      await expect(anonymous.profiles.get({ username })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    }
    await expect(anonymous.profiles.library({ username: "ada" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("never exposes an email address", async () => {
    await signedInAs("Ada");

    const profile = await anonymous.profiles.get({ username: "ada" });

    expect(JSON.stringify(profile)).not.toContain("@example.com");
  });

  it("shows only the public part of a library, even to its owner", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await ada.caller.library.save({ mediaId: ids.hades, status: "want", visibility: "private" });

    for (const reader of [anonymous, ada.caller]) {
      const entries = await reader.profiles.library({ username: "ada" });
      expect(entries.map(({ title, status }) => ({ title, status }))).toEqual([
        { title: "The Matrix", status: "finished" },
      ]);
    }
  });

  it("filters a public library by type and status", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });
    await ada.caller.library.save({ mediaId: ids.hades, status: "in_progress" });

    const titlesOf = async (filter: Parameters<typeof anonymous.profiles.library>[0]) =>
      (await anonymous.profiles.library(filter)).map((entry) => entry.title);
    expect(await titlesOf({ username: "ada", type: "game" })).toEqual(["Hades"]);
    expect(await titlesOf({ username: "ada", status: "finished" })).toEqual(["The Matrix"]);
    expect(await titlesOf({ username: "ada", type: "game", status: "finished" })).toEqual([]);
  });

  it("keeps one person's library off another person's profile", async () => {
    const ada = await signedInAs("Ada");
    await signedInAs("Grace");
    await ada.caller.library.save({ mediaId: ids.matrix, status: "finished" });

    expect(await anonymous.profiles.library({ username: "grace" })).toEqual([]);
  });

  it("lists public lists with their sizes and leaves private ones out", async () => {
    const ada = await signedInAs("Ada");
    const favorites = await ada.caller.lists.create({ name: "Favorites" });
    await ada.caller.lists.addItem({ listId: favorites.id, mediaId: ids.matrix });
    await ada.caller.lists.create({ name: "Secret", visibility: "private" });

    expect(await anonymous.profiles.lists({ username: "ada" })).toEqual([
      { id: favorites.id, name: "Favorites", itemCount: 1 },
    ]);
  });

  it("shows public reviews with what they are about and leaves private ones out", async () => {
    const ada = await signedInAs("Ada");
    await ada.caller.ratings.save({ target: { mediaId: ids.matrix }, value: 38 });
    await ada.caller.reviews.save({ target: { mediaId: ids.matrix }, body: "Still holds up." });
    await ada.caller.reviews.save({ target: { episodeId: ids.episode }, body: "Defiant jazz." });
    await ada.caller.reviews.save({
      target: { mediaId: ids.hades },
      body: "Private notes.",
      visibility: "private",
    });

    const found = await anonymous.profiles.reviews({ username: "ada" });

    expect(found).toHaveLength(2);
    expect(found).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: "Still holds up.",
          rating: 38,
          type: "movie",
          title: "The Matrix",
          providerId: "603",
          episode: null,
        }),
        expect.objectContaining({
          body: "Defiant jazz.",
          rating: null,
          title: "Severance",
          episode: { name: "Half Loop", episodeNumber: 2, seasonNumber: 1 },
        }),
      ]),
    );
  });
});
