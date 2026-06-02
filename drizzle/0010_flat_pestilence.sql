CREATE TABLE IF NOT EXISTS "route_library" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"distance_km" numeric(6, 2),
	"elevation_m" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "route_library" ADD CONSTRAINT "route_library_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
