import { TRPCError } from "@trpc/server";
import { episodes, libraryEntries, media, mediaTypes, seasons } from "@yousiverse/db/schema";
import { and, asc, between, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { z } from "zod";
import { addDays, usToday } from "../calendar/dates";
import { publicProcedure, router } from "../trpc";

/** How far ahead the calendar looks. */
const DAYS_AHEAD = 90;
const MAX_ENTRIES = 300;

const titleFields = {
  mediaId: media.id,
  type: media.type,
  providerId: media.providerId,
  title: media.title,
};

export const calendarRouter = router({
  /**
   * What comes out in the next 90 days, soonest first: movies and games by release date, and
   * shows by episode, with a show's episodes on one day counted together. `scope` is the whole
   * catalog, or only titles in the signed-in person's library that they have not dropped.
   * Dates are US calendar days.
   */
  upcoming: publicProcedure
    .input(
      z.object({
        scope: z.enum(["library", "catalog"]),
        type: z.enum(mediaTypes).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.user.id;
      if (input.scope === "library" && !userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const today = usToday();
      const until = addDays(today, DAYS_AHEAD);
      const inScope = and(
        isNotNull(media.providerId),
        input.type ? eq(media.type, input.type) : undefined,
        input.scope === "library" && userId
          ? inArray(
              media.id,
              ctx.db
                .select({ mediaId: libraryEntries.mediaId })
                .from(libraryEntries)
                .where(
                  and(eq(libraryEntries.userId, userId), ne(libraryEntries.status, "dropped")),
                ),
            )
          : undefined,
      );

      const [releases, airings] = await Promise.all([
        ctx.db
          .select({ ...titleFields, date: media.releaseDate })
          .from(media)
          .where(and(inScope, ne(media.type, "tv"), between(media.releaseDate, today, until)))
          .orderBy(asc(media.releaseDate), asc(media.title))
          .limit(MAX_ENTRIES),
        ctx.db
          .select({
            ...titleFields,
            date: episodes.airDate,
            seasonNumber: seasons.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeName: episodes.name,
          })
          .from(episodes)
          .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
          .innerJoin(media, eq(media.id, seasons.mediaId))
          .where(and(inScope, between(episodes.airDate, today, until)))
          .orderBy(asc(episodes.airDate), asc(seasons.seasonNumber), asc(episodes.episodeNumber))
          .limit(MAX_ENTRIES * 4),
      ]);

      // A season released all at once would otherwise fill the page: one entry per show per day.
      const showDays = new Map<string, (typeof airings)[number][]>();
      for (const airing of airings) {
        const key = `${airing.mediaId}:${airing.date}`;
        showDays.set(key, [...(showDays.get(key) ?? []), airing]);
      }

      const entries = [
        ...releases.flatMap(({ mediaId, date, providerId, ...title }) =>
          date && providerId
            ? { kind: "release" as const, date, title: { ...title, providerId } }
            : [],
        ),
        ...[...showDays.values()].flatMap((sameDay) => {
          const [first] = sameDay;
          const last = sameDay.at(-1);
          if (!first?.date || !first.providerId || !last) return [];
          return {
            kind: "episodes" as const,
            date: first.date,
            title: { type: first.type, providerId: first.providerId, title: first.title },
            seasonNumber: first.seasonNumber,
            firstEpisode: first.episodeNumber,
            lastEpisode: last.seasonNumber === first.seasonNumber ? last.episodeNumber : null,
            count: sameDay.length,
            /** The episode's name, when a single episode airs that day. */
            episodeName: sameDay.length === 1 ? first.episodeName : null,
          };
        }),
      ];
      entries.sort(
        (a, b) => a.date.localeCompare(b.date) || a.title.title.localeCompare(b.title.title),
      );
      return { today, entries: entries.slice(0, MAX_ENTRIES) };
    }),
});
