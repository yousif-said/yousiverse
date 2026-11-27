import type { RouterOutputs } from "@yousiverse/api";

export type ImportSource = RouterOutputs["imports"]["get"]["source"];
export type ImportProgress = RouterOutputs["imports"]["get"]["progress"];

type SourceInfo = {
  name: string;
  /** What comes across, on the source's card. */
  brings: string;
  /** Step one: how to get the data out of the service, and what it will do with it. */
  how: string;
};

/** Every service an import can come from, in the order they are offered. */
export const SOURCES: Record<ImportSource, SourceInfo> = {
  letterboxd: {
    name: "Letterboxd",
    brings: "Films you watched, ratings, reviews, and your watchlist",
    how: "In Letterboxd, open Settings, then Data, and choose Export your data. Unzip the download and pick watched.csv, ratings.csv, reviews.csv, and watchlist.csv. Keep the file names as they are: the watchlist is recognized by its name.",
  },
  imdb: {
    name: "IMDb",
    brings: "Rated films and shows, and your watchlist",
    how: "In IMDb, open Your ratings or Your watchlist, and choose Export from the menu. Pick the CSV files it downloads. Ratings of single episodes and of games are left out.",
  },
  goodreads: {
    name: "Goodreads",
    brings: "Shelves, ratings, and reviews",
    how: "In Goodreads, open My Books, then Import and export, and choose Export library. Pick the goodreads_library_export.csv file it makes.",
  },
  storygraph: {
    name: "StoryGraph",
    brings: "Books read, ratings, and reviews",
    how: "In StoryGraph, open Manage account, then Manage your data, and choose Export StoryGraph library. Pick the file from the download link it gives you.",
  },
  steam: {
    name: "Steam",
    brings: "Every game on your account",
    how: "Your profile's game details must be public. Games you never played go in as wanted; you choose a status for the rest.",
  },
  trakt: {
    name: "Trakt",
    brings: "Watched history, ratings, and watchlist",
    how: "Your Trakt profile must be public. A show counts as finished once every aired episode has been played; until then it goes in as Watching.",
  },
};

export const IMPORT_SOURCES = Object.keys(SOURCES) as ImportSource[];

type ProfileField = { label: string; placeholder: string; hint?: string };

/** The services read from a public profile instead of exported files, and how to name it. */
export const PROFILE_FIELDS: Record<"steam" | "trakt", ProfileField> = {
  steam: {
    label: "Steam profile address or ID",
    placeholder: "steamcommunity.com/id/yourname",
    hint: "Paste your profile's address or your 17-digit Steam ID.",
  },
  trakt: { label: "Trakt username", placeholder: "yourname" },
};

export type ProfileSource = keyof typeof PROFILE_FIELDS;
export type FileSource = Exclude<ImportSource, ProfileSource>;

export function isFileSource(source: ImportSource): source is FileSource {
  return !(source in PROFILE_FIELDS);
}

/** Titles an import could not add: nothing in the catalog matched with confidence. */
export function unmatchedCount(progress: ImportProgress): number {
  return progress.not_found + progress.failed;
}
