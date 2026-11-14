import type { RouterOutputs } from "@yousiverse/api";

export type ImportSource = RouterOutputs["imports"]["get"]["source"];

export const SOURCE_LABELS: Record<ImportSource, string> = {
  letterboxd: "Letterboxd",
  imdb: "IMDb",
  goodreads: "Goodreads",
  storygraph: "StoryGraph",
  steam: "Steam",
  trakt: "Trakt",
};

/** The services whose exported files can be uploaded, with how to get the files. */
export const FILE_SOURCES = [
  {
    source: "letterboxd",
    help: "In Letterboxd, open Settings, then Data, and choose Export your data. Unzip the download and pick watched.csv, ratings.csv, reviews.csv, and watchlist.csv. Keep the file names as they are: the watchlist is recognized by its name.",
  },
  {
    source: "imdb",
    help: "In IMDb, open Your ratings and choose Export from the menu, then do the same on Your watchlist. Pick the files IMDb gives you. Ratings of single episodes and of games are left out.",
  },
] as const satisfies { source: ImportSource; help: string }[];

export type FileSource = (typeof FILE_SOURCES)[number]["source"];
