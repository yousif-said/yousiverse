CREATE TABLE "similar_checks" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "similar_titles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" "media_type" NOT NULL,
	"provider_id" text NOT NULL,
	"title" text NOT NULL,
	"release_year" integer,
	"poster_url" text,
	CONSTRAINT "similar_titles_mediaId_type_providerId_unique" UNIQUE("media_id","type","provider_id")
);
--> statement-breakpoint
ALTER TABLE "similar_checks" ADD CONSTRAINT "similar_checks_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "similar_titles" ADD CONSTRAINT "similar_titles_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "similar_titles_media_id_position_index" ON "similar_titles" USING btree ("media_id","position");