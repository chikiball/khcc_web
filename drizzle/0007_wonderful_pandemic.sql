CREATE TABLE IF NOT EXISTS "ride_series" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"rule" text NOT NULL,
	"weekday" integer NOT NULL,
	"time_of_day" text NOT NULL,
	"start_point_name" text NOT NULL,
	"start_point_lat" numeric(10, 6),
	"start_point_lng" numeric(10, 6),
	"distance_km" numeric(6, 2),
	"elevation_m" integer,
	"route_url" text,
	"description" text,
	"pace_groups_template" text DEFAULT '[]' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"materialize_through_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rides" ADD COLUMN "series_id" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_series_id_ride_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."ride_series"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
