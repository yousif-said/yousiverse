import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/errors";
import { findBySteamIds } from "../src/igdb";
import { getOwnedGames, resolveSteamId } from "../src/steam";

describe("steam.resolveSteamId", () => {
  it("reads an id straight from an address or a bare id, without asking Steam", async () => {
    const id = "76561198000000001";

    expect(await resolveSteamId(id)).toBe(id);
    expect(await resolveSteamId(`https://steamcommunity.com/profiles/${id}/`)).toBe(id);
    expect(await resolveSteamId(`steamcommunity.com/profiles/${id}?l=english`)).toBe(id);
  });

  it("looks up a custom profile name, from an address or by itself", async () => {
    expect(await resolveSteamId("https://steamcommunity.com/id/fixtureplayer/")).toBe(
      "76561198000000001",
    );
    expect(await resolveSteamId("fixtureplayer")).toBe("76561198000000001");
  });

  it("finds nothing for a name nobody has or text that cannot be a profile", async () => {
    expect(await resolveSteamId("nobody-has-this")).toBeNull();
    expect(await resolveSteamId("https://steamcommunity.com/profiles/not-a-number")).toBeNull();
    expect(await resolveSteamId("two words")).toBeNull();
  });
});

describe("steam.getOwnedGames", () => {
  it("lists the games an account owns with time played", async () => {
    expect(await getOwnedGames("76561198000000001")).toEqual([
      { appId: "1145360", name: "Hades", playtimeMinutes: 1234 },
      { appId: "620", name: "Portal 2", playtimeMinutes: 0 },
      { appId: "999999999", name: "Some Tool", playtimeMinutes: 5 },
    ]);
  });

  it("answers null when the account keeps its games private", async () => {
    expect(await getOwnedGames("76561198000000002")).toBeNull();
  });

  it("reports an account that does not exist as not found", async () => {
    const error = await getOwnedGames("76561198000000003").catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ provider: "steam", kind: "not_found" });
  });
});

describe("igdb.findBySteamIds", () => {
  it("finds games by their Steam ids in one request, leaving out ids no game has", async () => {
    const found = await findBySteamIds(["1145360", "620", "999999999"]);

    expect([...found.keys()].sort()).toEqual(["1145360", "620"]);
    expect(found.get("1145360")).toMatchObject({
      type: "game",
      providerId: "113112",
      title: "Hades",
      releaseYear: 2020,
    });
    expect(found.get("620")).toMatchObject({ title: "Portal 2" });
  });

  it("asks nothing when there are no usable ids", async () => {
    expect(await findBySteamIds(["abc"])).toEqual(new Map());
  });
});
