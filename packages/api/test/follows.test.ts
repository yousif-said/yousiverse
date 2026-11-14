import { db } from "@yousiverse/db";
import { follows, users } from "@yousiverse/db/schema";
import { beforeEach, describe, expect, it } from "vitest";
import { anonymous, signedInAs } from "./helpers";

describe("follows", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("requires signing in to follow or unfollow", async () => {
    await signedInAs("Ada");

    await expect(anonymous.follows.follow({ username: "ada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(anonymous.follows.unfollow({ username: "ada" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("follows a person once, however many times it is asked", async () => {
    const ada = await signedInAs("Ada");
    await signedInAs("Grace");

    await ada.caller.follows.follow({ username: "grace" });
    await ada.caller.follows.follow({ username: "GRACE" });

    expect(await db.select().from(follows)).toHaveLength(1);
    expect(await ada.caller.profiles.get({ username: "grace" })).toMatchObject({
      followerCount: 1,
      followingCount: 0,
      isFollowing: true,
      followsYou: false,
    });
    expect(await anonymous.profiles.get({ username: "ada" })).toMatchObject({
      followerCount: 0,
      followingCount: 1,
      isFollowing: false,
      followsYou: false,
    });
  });

  it("tells a person who follows them back", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });

    expect(await grace.caller.profiles.get({ username: "ada" })).toMatchObject({
      isFollowing: false,
      followsYou: true,
    });
  });

  it("unfollows, leaving other people's follows alone", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    await signedInAs("Linus");
    await ada.caller.follows.follow({ username: "linus" });
    await grace.caller.follows.follow({ username: "linus" });

    await ada.caller.follows.unfollow({ username: "linus" });
    await ada.caller.follows.unfollow({ username: "linus" });

    expect(await anonymous.follows.followers({ username: "linus" })).toEqual({
      people: [{ username: "grace", name: "Grace" }],
      unnamed: 0,
    });
  });

  it("refuses following yourself or a username nobody has", async () => {
    const ada = await signedInAs("Ada");

    await expect(ada.caller.follows.follow({ username: "ada" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(ada.caller.follows.follow({ username: "nobody" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(anonymous.follows.followers({ username: "nobody" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lists followers and following by username, counting people who have none", async () => {
    const ada = await signedInAs("Ada");
    const grace = await signedInAs("Grace");
    const quiet = await signedInAs("Quiet", { username: false });
    await signedInAs("Linus");
    await grace.caller.follows.follow({ username: "ada" });
    await quiet.caller.follows.follow({ username: "ada" });
    await ada.caller.follows.follow({ username: "linus" });

    expect(await anonymous.follows.followers({ username: "ada" })).toEqual({
      people: [{ username: "grace", name: "Grace" }],
      unnamed: 1,
    });
    expect(await anonymous.follows.following({ username: "ada" })).toEqual({
      people: [{ username: "linus", name: "Linus" }],
      unnamed: 0,
    });
    expect(JSON.stringify(await anonymous.follows.followers({ username: "ada" }))).not.toContain(
      "example.com",
    );
  });

  it("removes a person's follows when their account is deleted", async () => {
    const ada = await signedInAs("Ada");
    await signedInAs("Grace");
    await ada.caller.follows.follow({ username: "grace" });

    await db.delete(users);

    expect(await db.select().from(follows)).toHaveLength(0);
  });
});

describe("profiles.search", () => {
  beforeEach(async () => {
    await db.delete(users);
  });

  it("finds people by part of their username or display name, whatever the capitals", async () => {
    await signedInAs("Ada");
    await signedInAs("Adam");
    await signedInAs("Grace");
    await signedInAs("Hidden", { username: false });

    expect(await anonymous.profiles.search({ query: "AD" })).toEqual([
      { username: "ada", name: "Ada" },
      { username: "adam", name: "Adam" },
    ]);
    expect(await anonymous.profiles.search({ query: "race" })).toEqual([
      { username: "grace", name: "Grace" },
    ]);
    // A person without a username has no profile to find.
    expect(await anonymous.profiles.search({ query: "hidden" })).toEqual([]);
  });

  it("treats % and _ as ordinary characters, not wildcards", async () => {
    await signedInAs("Ada");

    expect(await anonymous.profiles.search({ query: "%" })).toEqual([]);
    expect(await anonymous.profiles.search({ query: "a_a" })).toEqual([]);
  });

  it("never returns an email address", async () => {
    await signedInAs("Ada");

    expect(JSON.stringify(await anonymous.profiles.search({ query: "example" }))).toBe("[]");
    expect(JSON.stringify(await anonymous.profiles.search({ query: "ada" }))).not.toContain("@");
  });
});
