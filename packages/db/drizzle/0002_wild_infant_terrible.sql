ALTER TYPE "public"."provider" ADD VALUE 'igdb';--> statement-breakpoint
CREATE TABLE "games" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"developers" text[] DEFAULT '{}' NOT NULL,
	"publishers" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;