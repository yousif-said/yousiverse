CREATE TYPE "public"."email_kind" AS ENUM('sign_in', 'alerts');--> statement-breakpoint
CREATE TABLE "sent_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient" text NOT NULL,
	"kind" "email_kind" NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sent_emails_recipient_sent_at_index" ON "sent_emails" USING btree ("recipient","sent_at");--> statement-breakpoint
CREATE INDEX "sent_emails_sent_at_index" ON "sent_emails" USING btree ("sent_at");