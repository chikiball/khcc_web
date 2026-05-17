-- Step 1: create the new table
CREATE TABLE IF NOT EXISTS "ride_types" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT 'coral' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Step 2: seed A/B/C BEFORE adding FK constraints so existing 'A','B','C'
-- values on rides + users validate cleanly.
INSERT INTO "ride_types" ("code", "name", "description", "color", "position") VALUES
  ('A', 'Climbers',     'Fast pace. Hill-keen. No stopping for slow.',     'flash',  1),
  ('B', 'Steady bunch', 'The everyday tempo. Most rides are this.',        'coral',  2),
  ('C', 'No-drop',      'Friendly roll. We wait at the top. New riders welcome.', 'maroon', 3)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

-- Step 3: convert columns from the pace_group enum to plain text. Values
-- pass through as 'A'/'B'/'C' strings.
ALTER TABLE "rides" ALTER COLUMN "pace_group" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "pace_group" SET DATA TYPE text;--> statement-breakpoint

-- Step 3b: SET DATA TYPE leaves the column DEFAULT clause typed as the
-- old enum ('B'::pace_group). DROP TYPE below would then fail with
-- "cannot drop type pace_group because other objects depend on it".
-- Re-issue the default as a plain text literal so the dependency is gone.
ALTER TABLE "users" ALTER COLUMN "pace_group" SET DEFAULT 'B';--> statement-breakpoint

-- Step 4: now that ride_types is populated, the FKs can be added.
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_pace_group_ride_types_code_fk" FOREIGN KEY ("pace_group") REFERENCES "public"."ride_types"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_pace_group_ride_types_code_fk" FOREIGN KEY ("pace_group") REFERENCES "public"."ride_types"("code") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Step 5: drop the old enum, no columns reference it any more.
DROP TYPE "public"."pace_group";
