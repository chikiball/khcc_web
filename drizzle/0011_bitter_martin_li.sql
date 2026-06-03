CREATE TABLE IF NOT EXISTS "ride_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"uploaded_by" text,
	"image_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "recap_note" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "recap_by" text;--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "recap_at" timestamp;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_photos" ADD CONSTRAINT "ride_photos_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_photos" ADD CONSTRAINT "ride_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_photos_ride_id_idx" ON "ride_photos" USING btree ("ride_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_recap_by_users_id_fk" FOREIGN KEY ("recap_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
