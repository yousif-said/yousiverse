CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"service_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_subscriptions_userId_serviceId_unique" UNIQUE("user_id","service_id")
);
--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "subscription" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "rank" integer;--> statement-breakpoint
ALTER TABLE "streaming_services" ADD COLUMN "listed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_service_id_streaming_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."streaming_services"("id") ON DELETE cascade ON UPDATE no action;