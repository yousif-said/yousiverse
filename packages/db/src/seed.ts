import { db } from "./index";
import { media, type Provider } from "./schema";

type StarterTitle = Pick<typeof media.$inferInsert, "type" | "title" | "releaseYear"> & {
  provider: Provider;
  providerId: string;
};

// Real provider ids with only a title and year. The app fetches the full details from the
// provider the first time each page is opened, so seeding needs no API keys or network.
const starterTitles: StarterTitle[] = [
  { type: "movie", title: "Spirited Away", releaseYear: 2001, provider: "tmdb", providerId: "129" },
  {
    type: "movie",
    title: "Mad Max: Fury Road",
    releaseYear: 2015,
    provider: "tmdb",
    providerId: "76341",
  },
  { type: "movie", title: "Parasite", releaseYear: 2019, provider: "tmdb", providerId: "496243" },
  {
    type: "movie",
    title: "Dune: Part Two",
    releaseYear: 2024,
    provider: "tmdb",
    providerId: "693134",
  },
  {
    type: "movie",
    title: "The Lord of the Rings: The Fellowship of the Ring",
    releaseYear: 2001,
    provider: "tmdb",
    providerId: "120",
  },
  { type: "tv", title: "Severance", releaseYear: 2022, provider: "tmdb", providerId: "95396" },
  { type: "tv", title: "The Wire", releaseYear: 2002, provider: "tmdb", providerId: "1438" },
  { type: "tv", title: "Arcane", releaseYear: 2021, provider: "tmdb", providerId: "94605" },
  {
    type: "tv",
    title: "The Last of Us",
    releaseYear: 2023,
    provider: "tmdb",
    providerId: "100088",
  },
  {
    type: "tv",
    title: "Avatar: The Last Airbender",
    releaseYear: 2005,
    provider: "tmdb",
    providerId: "246",
  },
  { type: "game", title: "Hades", releaseYear: 2020, provider: "igdb", providerId: "113112" },
  { type: "game", title: "Elden Ring", releaseYear: 2022, provider: "igdb", providerId: "119133" },
  {
    type: "game",
    title: "The Legend of Zelda: Breath of the Wild",
    releaseYear: 2017,
    provider: "igdb",
    providerId: "7346",
  },
  {
    type: "game",
    title: "Disco Elysium",
    releaseYear: 2019,
    provider: "igdb",
    providerId: "26472",
  },
  {
    type: "game",
    title: "The Last of Us Part II",
    releaseYear: 2020,
    provider: "igdb",
    providerId: "26192",
  },
  {
    type: "game",
    title: "The Witcher 3: Wild Hunt",
    releaseYear: 2015,
    provider: "igdb",
    providerId: "1942",
  },
  {
    type: "book",
    title: "Dune",
    releaseYear: 1965,
    provider: "open_library",
    providerId: "OL893414W",
  },
  {
    type: "book",
    title: "The Left Hand of Darkness",
    releaseYear: 1969,
    provider: "open_library",
    providerId: "OL59800W",
  },
  {
    type: "book",
    title: "Piranesi",
    releaseYear: 2020,
    provider: "open_library",
    providerId: "OL20893680W",
  },
  {
    type: "book",
    title: "The Fellowship of the Ring",
    releaseYear: 1954,
    provider: "open_library",
    providerId: "OL27513W",
  },
  {
    type: "book",
    title: "Project Hail Mary",
    releaseYear: 2021,
    provider: "open_library",
    providerId: "OL21745884W",
  },
  {
    type: "book",
    title: "The Last Wish",
    releaseYear: 1993,
    provider: "open_library",
    providerId: "OL16564994W",
  },
];

// Safe to run again: titles already in the catalog are left as they are.
const added = await db
  .insert(media)
  .values(starterTitles)
  .onConflictDoNothing({ target: [media.provider, media.type, media.providerId] })
  .returning({ id: media.id });
console.info(`Seeded ${added.length} of ${starterTitles.length} starter titles.`);

await db.$client.end();
