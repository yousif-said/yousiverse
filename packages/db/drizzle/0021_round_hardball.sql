CREATE TYPE "public"."alert_kind" AS ENUM('on_my_subscriptions', 'streamable', 'price_at_most');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"media_id" uuid NOT NULL,
	"kind" "alert_kind" NOT NULL,
	"target_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggered_at" timestamp with time zone,
	"outcome" text,
	"notified_at" timestamp with time zone,
	CONSTRAINT "alerts_userId_mediaId_kind_unique" UNIQUE("user_id","media_id","kind"),
	CONSTRAINT "alerts_price_has_target" CHECK (("alerts"."kind" = 'price_at_most') = ("alerts"."target_cents" is not null)),
	CONSTRAINT "alerts_target_positive" CHECK ("alerts"."target_cents" is null or "alerts"."target_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE "email_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"alert_emails" boolean DEFAULT true NOT NULL,
	"unsubscribe_token" text NOT NULL,
	CONSTRAINT "email_preferences_unsubscribeToken_unique" UNIQUE("unsubscribe_token")
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_preferences" ADD CONSTRAINT "email_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_media_id_triggered_at_index" ON "alerts" USING btree ("media_id","triggered_at");