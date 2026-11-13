CREATE TABLE "game_deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"shop" text NOT NULL,
	"price_cents" integer NOT NULL,
	"regular_price_cents" integer NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "game_deals_mediaId_shop_unique" UNIQUE("media_id","shop")
);
--> statement-breakpoint
ALTER TABLE "availability_checks" ADD COLUMN "lowest_price_cents" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "steam_app_id" text;--> statement-breakpoint
ALTER TABLE "game_deals" ADD CONSTRAINT "game_deals_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Games imported before this column existed have no Steam id. Marking them as long out of date
-- makes each one refresh from the provider the next time its page is opened.
UPDATE "media" SET "synced_at" = '2000-01-01T00:00:00Z' WHERE "type" = 'game' AND "synced_at" IS NOT NULL;
