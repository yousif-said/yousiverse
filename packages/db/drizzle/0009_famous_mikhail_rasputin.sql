CREATE TYPE "public"."offer_kind" AS ENUM('subscription', 'free', 'tv_provider', 'rent', 'buy');--> statement-breakpoint
CREATE TABLE "availability_checks" (
	"media_id" uuid PRIMARY KEY NOT NULL,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streaming_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"kind" "offer_kind" NOT NULL,
	"price_cents" integer,
	"url" text NOT NULL,
	CONSTRAINT "streaming_offers_mediaId_serviceId_kind_unique" UNIQUE("media_id","service_id","kind")
);
--> statement-breakpoint
CREATE TABLE "streaming_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchmode_id" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "streaming_services_watchmodeId_unique" UNIQUE("watchmode_id")
);
--> statement-breakpoint
ALTER TABLE "availability_checks" ADD CONSTRAINT "availability_checks_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_offers" ADD CONSTRAINT "streaming_offers_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaming_offers" ADD CONSTRAINT "streaming_offers_service_id_streaming_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."streaming_services"("id") ON DELETE cascade ON UPDATE no action;