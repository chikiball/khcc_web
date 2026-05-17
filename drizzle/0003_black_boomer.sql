CREATE TABLE IF NOT EXISTS "content_blocks" (
	"key" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "content_blocks" ADD CONSTRAINT "content_blocks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Seed default copy so the landing page has content from day one.
-- Admin can edit via /admin/content. ON CONFLICT DO NOTHING means a
-- second run never overwrites whatever the admin has typed.
INSERT INTO "content_blocks" ("key", "title", "body") VALUES
  (
    'about',
    'What it is.',
    E'KHCC — Knock House Chop Chop — is a road cycling club. We post rides, you tap In, we ride, we go home. Chop chop.\n\nThree pace groups so nobody gets dropped on the wrong day: A for the climbers, B for the steady bunch, C for the no-drop friendly roll.\n\nThis app replaces the WhatsApp scroll: see the next ride, see who''s in, tap In yourself. That''s the whole pitch.'
  ),
  (
    'achievements',
    'Trophy case.',
    E'Tour de Batam 2024 — Day 1 ICF Gran Fondo. Strong finishes across the bunch.\n\nHambalang Hill — first KHCC group ride up. Beautiful climbs, every minute earned.\n\nKHCC NEW KIT RIDE #3 — third training kit launch, the brightest yet.\n\nEdit this from /admin/content as the trophy case grows.'
  )
ON CONFLICT ("key") DO NOTHING;
