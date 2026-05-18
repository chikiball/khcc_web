-- STEP 1: create the new pace groups table
CREATE TABLE IF NOT EXISTS "ride_pace_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"ride_id" text NOT NULL,
	"pace_code" text NOT NULL,
	"leader_id" text,
	"distance_km" numeric(6, 2),
	"elevation_m" integer,
	"cap" integer,
	"notes" text,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"cancelled_at" timestamp,
	"cancelled_by" text,
	"cancelled_reason" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- STEP 2: add FK constraints on ride_pace_groups (table is empty so FKs OK)
DO $$ BEGIN
 ALTER TABLE "ride_pace_groups" ADD CONSTRAINT "ride_pace_groups_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pace_groups" ADD CONSTRAINT "ride_pace_groups_pace_code_ride_types_code_fk" FOREIGN KEY ("pace_code") REFERENCES "public"."ride_types"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pace_groups" ADD CONSTRAINT "ride_pace_groups_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_pace_groups" ADD CONSTRAINT "ride_pace_groups_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_pace_groups_ride_id_idx" ON "ride_pace_groups" USING btree ("ride_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ride_pace_groups_ride_pace_idx" ON "ride_pace_groups" USING btree ("ride_id","pace_code");
--> statement-breakpoint

-- STEP 3: backfill — one pace group per existing ride while rides.pace_group,
-- rides.leader_id and rides.cap still exist.
-- cancelled rides get status='cancelled' on the pace group too.
INSERT INTO "ride_pace_groups" (
  "id", "ride_id", "pace_code", "leader_id",
  "distance_km", "elevation_m", "cap", "status",
  "cancelled_at", "cancelled_reason", "position"
)
SELECT
  gen_random_uuid()::text,
  r.id,
  r.pace_group,
  r.leader_id,
  r.distance_km,
  r.elevation_m,
  r.cap,
  CASE WHEN r.status = 'cancelled' THEN 'cancelled' ELSE 'scheduled' END,
  r.cancelled_at,
  r.cancelled_reason,
  0
FROM "rides" r;
--> statement-breakpoint

-- STEP 4: add pace_group_id to ride_rsvps as nullable first so the column
-- can be created without violating NOT NULL on existing rows.
ALTER TABLE "ride_rsvps" ADD COLUMN IF NOT EXISTS "pace_group_id" text;
--> statement-breakpoint

-- STEP 5: backfill every existing RSVP to point at the one pace group that
-- was just created for its ride.
UPDATE "ride_rsvps" rr
SET "pace_group_id" = rpg.id
FROM "ride_pace_groups" rpg
WHERE rpg.ride_id = rr.ride_id;
--> statement-breakpoint

-- STEP 6: now that every row has a value, enforce NOT NULL and add the FK.
ALTER TABLE "ride_rsvps" ALTER COLUMN "pace_group_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_rsvps" ADD CONSTRAINT "ride_rsvps_pace_group_id_ride_pace_groups_id_fk" FOREIGN KEY ("pace_group_id") REFERENCES "public"."ride_pace_groups"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_rsvps_pace_group_id_idx" ON "ride_rsvps" USING btree ("pace_group_id");
--> statement-breakpoint

-- STEP 7: drop the now-redundant columns from rides.
-- The FK constraints on these columns must be dropped first.
ALTER TABLE "rides" DROP CONSTRAINT IF EXISTS "rides_pace_group_ride_types_code_fk";
ALTER TABLE "rides" DROP CONSTRAINT IF EXISTS "rides_leader_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "rides" DROP COLUMN IF EXISTS "pace_group";--> statement-breakpoint
ALTER TABLE "rides" DROP COLUMN IF EXISTS "leader_id";--> statement-breakpoint
ALTER TABLE "rides" DROP COLUMN IF EXISTS "cap";
