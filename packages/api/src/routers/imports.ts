import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  type ImportItemState,
  importItemStates,
  importItems,
  imports,
  visibilities,
} from "@yousiverse/db/schema";
import { ProviderError } from "@yousiverse/integrations/errors";
import { getOwnedGames, resolveSteamId } from "@yousiverse/integrations/steam";
import { getTraktHistory, getTraktProfile, traktUsername } from "@yousiverse/integrations/trakt";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { processNextBatch } from "../imports/process";
import { ImportFileError, type ParsedImport } from "../imports/rows";
import { fileParsers, fileSources } from "../imports/sources";
import { traktRows } from "../imports/sources/trakt";
import { protectedProcedure, router } from "../trpc";

const MAX_TITLES = 5000;
const MAX_FILE_CHARACTERS = 3_000_000;
const MAX_UNMATCHED_SHOWN = 200;
const INSERT_CHUNK = 500;

const importId = z.uuid();

async function traktProfileOrNull(username: string) {
  try {
    return await getTraktProfile(username);
  } catch (error) {
    if (error instanceof ProviderError && error.kind === "not_found") return null;
    throw error;
  }
}

/** A Steam account's games, or null when the account does not exist or hides them. */
async function ownedGamesOrNull(steamId: string) {
  try {
    return await getOwnedGames(steamId);
  } catch (error) {
    if (error instanceof ProviderError && error.kind === "not_found") return null;
    throw error;
  }
}

async function requireOwnImport(db: Database, userId: string, id: string) {
  const [job] = await db
    .select()
    .from(imports)
    .where(and(eq(imports.id, id), eq(imports.userId, userId)));
  if (!job) throw new TRPCError({ code: "NOT_FOUND" });
  return job;
}

/** How many of an import's rows are in each state. */
async function progress(db: Database, id: string) {
  const found = await db
    .select({ state: importItems.state, count: count() })
    .from(importItems)
    .where(eq(importItems.importId, id))
    .groupBy(importItems.state);
  const counts = Object.fromEntries(importItemStates.map((state) => [state, 0])) as Record<
    ImportItemState,
    number
  >;
  for (const row of found) counts[row.state] = row.count;
  const total = Object.values(counts).reduce((sum, each) => sum + each, 0);
  return { ...counts, total };
}

/** Stores the titles read from another service as a new import, waiting to be matched. */
export async function createImport(
  db: Database,
  values: typeof imports.$inferInsert,
  parsed: ParsedImport,
): Promise<{ id: string }> {
  if (parsed.rows.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "There were no titles to import." });
  }
  if (parsed.rows.length > MAX_TITLES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `That is more than ${MAX_TITLES.toLocaleString("en-US")} titles. Import fewer at a time.`,
    });
  }

  return db.transaction(async (tx) => {
    const [job] = await tx
      .insert(imports)
      .values({ ...values, skippedCount: parsed.skipped })
      .returning({ id: imports.id });
    if (!job) throw new Error("Creating an import returned no row.");

    const items = parsed.rows.map((row, position) => ({ importId: job.id, position, ...row }));
    for (let start = 0; start < items.length; start += INSERT_CHUNK) {
      await tx.insert(importItems).values(items.slice(start, start + INSERT_CHUNK));
    }
    return job;
  });
}

/** A signed-in person's imports from other services. Nothing here touches anyone else's. */
export const importsRouter = router({
  /** Reads uploaded export files and stores their titles, ready to be matched. */
  createFromFiles: protectedProcedure
    .input(
      z.object({
        source: z.enum(fileSources),
        visibility: z.enum(visibilities),
        files: z
          .array(
            z.object({
              name: z.string().max(200),
              text: z.string().min(1).max(MAX_FILE_CHARACTERS),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let parsed: ParsedImport;
      try {
        parsed = fileParsers[input.source](input.files);
      } catch (error) {
        if (error instanceof ImportFileError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
      return createImport(
        ctx.db,
        { userId: ctx.session.user.id, source: input.source, visibility: input.visibility },
        parsed,
      );
    }),

  /**
   * Reads the games on a person's Steam account. Games never played go in as wanted, and
   * played games as the status the person chooses, since Steam cannot tell finished from not.
   */
  createFromSteam: protectedProcedure
    .input(
      z.object({
        profile: z.string().trim().min(2).max(200),
        visibility: z.enum(visibilities),
        playedStatus: z.enum(["in_progress", "finished", "dropped"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const steamId = await resolveSteamId(input.profile);
      const games = steamId ? await ownedGamesOrNull(steamId) : null;
      if (!steamId || games === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: steamId
            ? "Steam would not show that account's games. In Steam, open your profile's privacy settings and set Game details to Public, then try again."
            : "No Steam profile matches that. Paste your profile's address or your 17-digit Steam ID.",
        });
      }

      return createImport(
        ctx.db,
        { userId: ctx.session.user.id, source: "steam", visibility: input.visibility },
        {
          skipped: 0,
          rows: games.map((game) => ({
            type: "game",
            title: game.name,
            year: null,
            creator: null,
            externalId: game.appId,
            externalKind: "steam",
            status: game.playtimeMinutes > 0 ? input.playedStatus : "want",
            rating: null,
            review: null,
            minutesPlayed: game.playtimeMinutes > 0 ? game.playtimeMinutes : null,
          })),
        },
      );
    }),

  /**
   * Reads a public Trakt profile: what the person watched, rated, and put on their watchlist.
   * A show counts as finished once every aired episode has been played.
   */
  createFromTrakt: protectedProcedure
    .input(
      z.object({ profile: z.string().trim().min(1).max(200), visibility: z.enum(visibilities) }),
    )
    .mutation(async ({ ctx, input }) => {
      const username = traktUsername(input.profile);
      const profile = username ? await traktProfileOrNull(username) : null;
      if (!username || !profile) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Trakt profile matches that. Enter your Trakt username.",
        });
      }
      if (profile.private) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "That Trakt profile is private. In Trakt's settings, turn off Private under Privacy, then try again. You can turn it back on afterwards.",
        });
      }

      const history = await getTraktHistory(username);
      return createImport(
        ctx.db,
        { userId: ctx.session.user.id, source: "trakt", visibility: input.visibility },
        traktRows(history),
      );
    }),

  /** Matches the next few waiting titles of an import, and says how far along it is. */
  process: protectedProcedure.input(z.object({ id: importId })).mutation(async ({ ctx, input }) => {
    const job = await requireOwnImport(ctx.db, ctx.session.user.id, input.id);
    const { paused } = await processNextBatch(ctx.db, job);
    return { paused, progress: await progress(ctx.db, job.id) };
  }),

  /** An import, how far along it is, and the titles that could not be matched. */
  get: protectedProcedure.input(z.object({ id: importId })).query(async ({ ctx, input }) => {
    const job = await requireOwnImport(ctx.db, ctx.session.user.id, input.id);
    const [counts, unmatched] = await Promise.all([
      progress(ctx.db, job.id),
      ctx.db
        .select({
          id: importItems.id,
          title: importItems.title,
          year: importItems.year,
          creator: importItems.creator,
        })
        .from(importItems)
        .where(
          and(
            eq(importItems.importId, job.id),
            inArray(importItems.state, ["not_found", "failed"]),
          ),
        )
        .orderBy(asc(importItems.position))
        .limit(MAX_UNMATCHED_SHOWN),
    ]);
    return {
      id: job.id,
      source: job.source,
      visibility: job.visibility,
      skippedCount: job.skippedCount,
      createdAt: job.createdAt,
      progress: counts,
      unmatched,
    };
  }),

  /** The signed-in person's imports, newest first, with how many titles each has left to match. */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: imports.id,
        source: imports.source,
        createdAt: imports.createdAt,
        total: count(importItems.id),
        pending: sql<number>`cast(count(${importItems.id}) filter (where ${importItems.state} = 'pending') as int)`,
      })
      .from(imports)
      .leftJoin(importItems, eq(importItems.importId, imports.id))
      .where(eq(imports.userId, ctx.session.user.id))
      .groupBy(imports.id)
      .orderBy(desc(imports.createdAt)),
  ),
});
