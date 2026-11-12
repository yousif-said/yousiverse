ALTER TYPE "public"."provider" ADD VALUE 'open_library';--> statement-breakpoint
CREATE TABLE "books" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"authors" text[] DEFAULT '{}' NOT NULL,
	"page_count" integer
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;