ALTER TABLE "rides" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "cancelled_by" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "cancelled_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
