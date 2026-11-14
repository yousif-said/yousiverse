CREATE TYPE "public"."external_id_kind" AS ENUM('imdb', 'tmdb', 'isbn', 'steam');--> statement-breakpoint
CREATE TYPE "public"."import_item_state" AS ENUM('pending', 'imported', 'already', 'not_found', 'failed');--> statement-breakpoint
CREATE TYPE "public"."import_source" AS ENUM('letterboxd', 'imdb', 'goodreads', 'storygraph', 'steam', 'trakt');--> statement-breakpoint
CREATE TABLE "import_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"creator" text,
	"external_id" text,
	"external_kind" "external_id_kind",
	"status" "library_status",
	"rating" integer,
	"review" text,
	"state" "import_item_state" DEFAULT 'pending' NOT NULL,
	"media_id" uuid,
	CONSTRAINT "import_items_importId_position_unique" UNIQUE("import_id","position"),
	CONSTRAINT "import_items_rating_range" CHECK ("import_items"."rating" between 0 and 40)
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source" "import_source" NOT NULL,
	"visibility" "visibility" NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_items" ADD CONSTRAINT "import_items_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_items_import_id_state_index" ON "import_items" USING btree ("import_id","state");--> statement-breakpoint
CREATE INDEX "imports_user_id_index" ON "imports" USING btree ("user_id");