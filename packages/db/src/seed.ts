import { db } from "./index";
import { media } from "./schema";

const sampleMedia: (typeof media.$inferInsert)[] = [
  { type: "movie", title: "Spirited Away", releaseYear: 2001 },
  { type: "movie", title: "Mad Max: Fury Road", releaseYear: 2015 },
  { type: "movie", title: "Parasite", releaseYear: 2019 },
  { type: "movie", title: "Dune: Part Two", releaseYear: 2024 },
  { type: "movie", title: "The Lord of the Rings: The Fellowship of the Ring", releaseYear: 2001 },
  { type: "tv", title: "Severance", releaseYear: 2022 },
  { type: "tv", title: "The Wire", releaseYear: 2002 },
  { type: "tv", title: "Arcane", releaseYear: 2021 },
  { type: "tv", title: "The Last of Us", releaseYear: 2023 },
  { type: "tv", title: "Avatar: The Last Airbender", releaseYear: 2005 },
  { type: "game", title: "Hades", releaseYear: 2020 },
  { type: "game", title: "Elden Ring", releaseYear: 2022 },
  { type: "game", title: "The Legend of Zelda: Breath of the Wild", releaseYear: 2017 },
  { type: "game", title: "Disco Elysium", releaseYear: 2019 },
  { type: "game", title: "The Last of Us Part II", releaseYear: 2020 },
  { type: "game", title: "The Witcher 3: Wild Hunt", releaseYear: 2015 },
  { type: "book", title: "Dune", releaseYear: 1965 },
  { type: "book", title: "The Left Hand of Darkness", releaseYear: 1969 },
  { type: "book", title: "Piranesi", releaseYear: 2020 },
  { type: "book", title: "The Fellowship of the Ring", releaseYear: 1954 },
  { type: "book", title: "Project Hail Mary", releaseYear: 2021 },
  { type: "book", title: "The Last Wish", releaseYear: 1993 },
];

const existing = await db.$count(media);
if (existing > 0) {
  console.info(`Skipped seeding: media already has ${existing} rows.`);
} else {
  await db.insert(media).values(sampleMedia);
  console.info(`Seeded ${sampleMedia.length} media items.`);
}

await db.$client.end();
