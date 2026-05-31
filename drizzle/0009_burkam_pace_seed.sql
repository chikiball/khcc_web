-- Burkam pace catalogue: replace the inherited KHCC A/B/C with Burkam's
-- chill-first ride types. Idempotent so repeat runs are no-ops.
--
-- Single-pace 'chill' is the default; 'pacy' exists for the occasional
-- multi-pace day (faster bunch alongside the chill bunch). Existing A/B/C
-- rows are deactivated rather than deleted so any historical FK references
-- (rides.pace_group, ride_pace_groups.pace_code, users.pace_group) still
-- resolve. Admins can hard-delete them via /admin/types after confirming
-- nothing references them.

INSERT INTO "ride_types" ("code", "name", "description", "color", "position", "active") VALUES
  ('chill', 'Chill',  'Easy weekend roll. ECP to Changi Village, no-drop, breakfast stop.', 'sky',   1, true),
  ('pacy',  'Pacy',   'A little quicker for the multi-pace days. Still friendly.',         'flash', 2, true)
ON CONFLICT ("code") DO NOTHING;
--> statement-breakpoint

UPDATE "ride_types" SET "active" = false WHERE "code" IN ('A', 'B', 'C');
--> statement-breakpoint

-- New default for users created from this point on. Existing users keep
-- their stored pace until they next edit it on /profile.
ALTER TABLE "users" ALTER COLUMN "pace_group" SET DEFAULT 'chill';
