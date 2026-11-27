CREATE TABLE "episode_watches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"episode_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "episode_watches_userId_episodeId_unique" UNIQUE("user_id","episode_id")
);
--> statement-breakpoint
CREATE TABLE "universes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "universes_mediaId_unique" UNIQUE("media_id")
);
--> statement-breakpoint
ALTER TABLE "library_entries" ADD COLUMN "pages_read" integer;--> statement-breakpoint
ALTER TABLE "library_entries" ADD COLUMN "minutes_played" integer;--> statement-breakpoint
ALTER TABLE "list_items" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "art_hue" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "art_saturation" integer;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "poster_aspect" integer;--> statement-breakpoint
ALTER TABLE "similar_titles" ADD COLUMN "backdrop_url" text;--> statement-breakpoint
ALTER TABLE "episode_watches" ADD CONSTRAINT "episode_watches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_watches" ADD CONSTRAINT "episode_watches_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "universes" ADD CONSTRAINT "universes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "episode_watches_episode_id_index" ON "episode_watches" USING btree ("episode_id");--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_pages_read_positive" CHECK ("library_entries"."pages_read" >= 0);--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_minutes_played_positive" CHECK ("library_entries"."minutes_played" >= 0);