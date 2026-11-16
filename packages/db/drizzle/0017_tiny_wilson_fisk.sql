CREATE TYPE "public"."link_kind" AS ENUM('adaptation_of', 'sequel_of', 'same_franchise');--> statement-breakpoint
CREATE TYPE "public"."link_source" AS ENUM('wikidata', 'manual');--> statement-breakpoint
CREATE TYPE "public"."suggestion_state" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "link_checks" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"target_type" "media_type" NOT NULL,
	"target_provider_id" text NOT NULL,
	"target_title" text NOT NULL,
	"kind" "link_kind" NOT NULL,
	"reversed" boolean DEFAULT false NOT NULL,
	"state" "suggestion_state" DEFAULT 'pending' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_suggestions_mediaId_targetType_targetProviderId_unique" UNIQUE("media_id","target_type","target_provider_id")
);
--> statement-breakpoint
CREATE TABLE "media_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_media_id" uuid NOT NULL,
	"to_media_id" uuid NOT NULL,
	"kind" "link_kind" NOT NULL,
	"source" "link_source" NOT NULL,
	"verified_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_links_not_self" CHECK ("media_links"."from_media_id" <> "media_links"."to_media_id")
);
--> statement-breakpoint
ALTER TABLE "link_checks" ADD CONSTRAINT "link_checks_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_suggestions" ADD CONSTRAINT "link_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_from_media_id_media_id_fk" FOREIGN KEY ("from_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_to_media_id_media_id_fk" FOREIGN KEY ("to_media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_links" ADD CONSTRAINT "media_links_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "link_suggestions_state_created_at_index" ON "link_suggestions" USING btree ("state","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "media_links_pair_unique" ON "media_links" USING btree (least("from_media_id", "to_media_id"),greatest("from_media_id", "to_media_id"));--> statement-breakpoint
CREATE INDEX "media_links_to_media_id_index" ON "media_links" USING btree ("to_media_id");