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
