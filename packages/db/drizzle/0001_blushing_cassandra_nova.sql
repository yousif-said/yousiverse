CREATE TYPE "public"."provider" AS ENUM('tmdb');--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"episode_number" integer NOT NULL,
	"name" text NOT NULL,
	"overview" text,
	"air_date" date,
	"runtime_minutes" integer,
	"still_url" text,
	CONSTRAINT "episodes_seasonId_episodeNumber_unique" UNIQUE("season_id","episode_number")
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"tagline" text,
	"runtime_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"season_number" integer NOT NULL,
	"name" text NOT NULL,
	"overview" text,
	"air_date" date,
	"poster_url" text,
	CONSTRAINT "seasons_mediaId_seasonNumber_unique" UNIQUE("media_id","season_number")
);
--> statement-breakpoint
CREATE TABLE "tv_shows" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"tagline" text,
	"status" text
);
--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "overview" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "release_date" date;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "poster_url" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "backdrop_url" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "genres" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "provider" "provider";--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tv_shows" ADD CONSTRAINT "tv_shows_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_provider_type_providerId_unique" UNIQUE("provider","type","provider_id");