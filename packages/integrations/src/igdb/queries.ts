/** IGDB is queried with its own text language (Apicalypse), sent as the request body. */

// Main games, remakes, remasters, expanded games, and ports. Leaves out DLC, bundles, and mods.
const SEARCHABLE_GAME_TYPES = "(0,8,9,10,11)";

export function searchQuery(query: string): string {
  const escaped = query.replace(/[\\"]/g, "\\$&");
  return `search "${escaped}"; fields name,first_release_date,cover.image_id; where game_type = ${SEARCHABLE_GAME_TYPES}; limit 20;`;
}

export function gameQuery(providerId: string): string {
  if (!/^\d+$/.test(providerId)) throw new Error(`Not an IGDB game id: ${providerId}`);
  return `fields name,summary,first_release_date,cover.image_id,artworks.image_id,genres.name,platforms.name,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,external_games.uid,external_games.external_game_source; where id = ${providerId};`;
}

/** Looks games up by their Steam ids. Asked of IGDB's `external_games`, not `games`. */
export function steamGamesQuery(steamAppIds: string[]): string {
  const ids = steamAppIds.filter((id) => /^\d+$/.test(id));
  if (ids.length === 0) throw new Error("No Steam ids to look up.");
  const list = ids.map((id) => `"${id}"`).join(",");
  return `fields uid,game.name,game.first_release_date,game.cover.image_id,game.game_type; where external_game_source = 1 & uid = (${list}); limit 500;`;
}

/** Asks for the name IGDB uses for a game in its own addresses. */
export function slugQuery(providerId: string): string {
  if (!/^\d+$/.test(providerId)) throw new Error(`Not an IGDB game id: ${providerId}`);
  return `fields slug; where id = ${providerId};`;
}

/** Looks games up by the names IGDB uses in its own addresses. */
export function gamesBySlugQuery(slugs: string[]): string {
  const valid = slugs.filter((slug) => /^[a-z0-9-]+$/.test(slug));
  if (valid.length === 0) throw new Error("No IGDB slugs to look up.");
  const list = valid.map((slug) => `"${slug}"`).join(",");
  return `fields name,slug,first_release_date,cover.image_id; where slug = (${list}); limit 500;`;
}
