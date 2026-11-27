import { TRPCError } from "@trpc/server";
import { episodes, games, libraryEntries, media, mediaTypes, seasons } from "@yousiverse/db/schema";
import { and, asc, between, count, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { addDays, usToday } from "../calendar/dates";
import { titleSummary } from "../titles";
import { publicProcedure, router } from "../trpc";

/** How far ahead the calendar looks. */
const DAYS_AHEAD = 90;
const MAX_ENTRIES = 300;

export const calendarRouter = router({
  /**
   * What comes out in the next 90 days, soonest first: movies and games by release date, and
   * shows by episode, with a show's episodes on one day counted together. `scope` is the whole
   * catalog, or only titles in the signed-in person's library that they have not dropped.
   * `counts` says how many entries each medium has in that scope whatever `type` asks for, for
   * labeling the choices. Dates are US calendar days; `today` and `until` are the first and
   * last of them.
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
      const ofType = input.type ? eq(media.type, input.type) : undefined;
      const comingOut = and(
        inScope,
        ne(media.type, "tv"),
        between(media.releaseDate, today, until),
      );
      const onAir = and(inScope, between(episodes.airDate, today, until));

      const [releases, airings, releaseCounts, [showDayCount]] = await Promise.all([
        ctx.db
          .select({ ...titleSummary, date: media.releaseDate, platforms: games.platforms })
          .from(media)
          .leftJoin(games, eq(games.mediaId, media.id))
          .where(and(comingOut, ofType))
          .orderBy(asc(media.releaseDate), asc(media.title))
          .limit(MAX_ENTRIES),
        ctx.db
          .select({
            ...titleSummary,
            date: episodes.airDate,
            seasonNumber: seasons.seasonNumber,
            episodeNumber: episodes.episodeNumber,
            episodeName: episodes.name,
          })
          .from(episodes)
          .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
          .innerJoin(media, eq(media.id, seasons.mediaId))
          .where(and(onAir, ofType))
          .orderBy(asc(episodes.airDate), asc(seasons.seasonNumber), asc(episodes.episodeNumber))
          .limit(MAX_ENTRIES * 4),
        ctx.db
          .select({ type: media.type, count: count() })
          .from(media)
          .where(comingOut)
          .groupBy(media.type),
        // One entry per show per day, however many episodes air.
        ctx.db
          .select({
            count: sql<number>`count(distinct (${seasons.mediaId}, ${episodes.airDate}))::int`,
          })
          .from(episodes)
          .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
          .innerJoin(media, eq(media.id, seasons.mediaId))
          .where(onAir),
      ]);
      const releasesOf = (type: "movie" | "game") =>
        releaseCounts.find((row) => row.type === type)?.count ?? 0;
      const counts = {
        movie: releasesOf("movie"),
        tv: showDayCount?.count ?? 0,
        game: releasesOf("game"),
      };

      // A season released all at once would otherwise fill the page: one entry per show per day.
      const showDays = new Map<string, (typeof airings)[number][]>();
      for (const airing of airings) {
        const key = `${airing.mediaId}:${airing.date}`;
        showDays.set(key, [...(showDays.get(key) ?? []), airing]);
      }

      const entries = [
        ...releases.flatMap(({ date, platforms, providerId, ...title }) =>
          date && providerId
            ? {
                kind: "release" as const,
                date,
                title: { ...title, providerId },
                /** Where a game comes out. Empty for a movie, or when its source does not say. */
                platforms: platforms ?? [],
              }
            : [],
        ),
        ...[...showDays.values()].flatMap((sameDay) => {
          const [first] = sameDay;
          const last = sameDay.at(-1);
          if (!first?.date || !first.providerId || !last) return [];
          const { date, seasonNumber, episodeNumber, episodeName, providerId, ...title } = first;
          return {
            kind: "episodes" as const,
            date,
            title: { ...title, providerId },
            seasonNumber,
            firstEpisode: episodeNumber,
            lastEpisode: last.seasonNumber === seasonNumber ? last.episodeNumber : null,
            count: sameDay.length,
            /** The episode's name, when a single episode airs that day. */
            episodeName: sameDay.length === 1 ? episodeName : null,
          };
        }),
      ];
      entries.sort(
        (a, b) => a.date.localeCompare(b.date) || a.title.title.localeCompare(b.title.title),
      );
      return { today, until, entries: entries.slice(0, MAX_ENTRIES), counts };
    }),
});
