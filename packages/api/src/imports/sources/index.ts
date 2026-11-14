import type { ImportSource } from "@yousiverse/db/schema";
import type { ParsedImport } from "../rows";
import { parseGoodreads, parseStoryGraph } from "./books";
import { parseImdb } from "./imdb";
import { parseLetterboxd } from "./letterboxd";

export type UploadedFile = { name: string; text: string };

/** The services whose exported files can be uploaded. */
export const fileSources = [
  "letterboxd",
  "imdb",
  "goodreads",
  "storygraph",
] as const satisfies ImportSource[];
export type FileSource = (typeof fileSources)[number];

export const fileParsers: Record<FileSource, (files: UploadedFile[]) => ParsedImport> = {
  letterboxd: parseLetterboxd,
  imdb: parseImdb,
  goodreads: parseGoodreads,
  storygraph: parseStoryGraph,
};
