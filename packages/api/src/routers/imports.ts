import { TRPCError } from "@trpc/server";
import type { Database } from "@yousiverse/db";
import {
  type ImportItemState,
  importItemStates,
  importItems,
  imports,
  visibilities,
} from "@yousiverse/db/schema";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { processNextBatch } from "../imports/process";
import { ImportFileError, type ParsedImport } from "../imports/rows";
import { fileParsers, fileSources } from "../imports/sources";
import { protectedProcedure, router } from "../trpc";

const MAX_TITLES = 5000;
const MAX_FILE_CHARACTERS = 3_000_000;
const MAX_UNMATCHED_SHOWN = 200;
const INSERT_CHUNK = 500;

const importId = z.uuid();

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

  /** The signed-in person's imports, newest first. */
  mine: protectedProcedure.query(({ ctx }) =>
    ctx.db
      .select({
        id: imports.id,
        source: imports.source,
        createdAt: imports.createdAt,
        total: count(importItems.id),
      })
      .from(imports)
      .leftJoin(importItems, eq(importItems.importId, imports.id))
      .where(eq(imports.userId, ctx.session.user.id))
      .groupBy(imports.id)
      .orderBy(desc(imports.createdAt)),
  ),
});
