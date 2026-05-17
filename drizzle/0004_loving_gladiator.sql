CREATE TABLE IF NOT EXISTS "gallery_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"image_url" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_by" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "gallery_photos" ADD CONSTRAINT "gallery_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Seed the existing six static photos so the landing page renders
-- identically on first deploy of this migration. Spread the created_at
-- timestamps so order is deterministic (photo 1 newest among seeded,
-- photo 6 oldest). WHERE NOT EXISTS keeps a rerun a no-op once the
-- table has any rows.
INSERT INTO "gallery_photos" ("id", "image_url", "alt", "created_at")
SELECT gen_random_uuid()::text, image_url, alt, ts FROM (VALUES
  ('/gallery/01-new-kit.jpg', 'KHCC new kit ride',          NOW() - INTERVAL '1 day'),
  ('/gallery/02-comme-femmes.jpg', 'Comme Femmes Thursday ride', NOW() - INTERVAL '2 days'),
  ('/gallery/03-bunch.jpg', 'Bunch on the bridge at dawn',  NOW() - INTERVAL '3 days'),
  ('/gallery/04-skinsuit.jpg', 'KHCC kit portrait',          NOW() - INTERVAL '4 days'),
  ('/gallery/05-tri-factor.jpg', 'Tri-Factor celebratory ride', NOW() - INTERVAL '5 days'),
  ('/gallery/06-tour-de-batam.jpg', 'Tour de Batam 2024',         NOW() - INTERVAL '6 days')
) AS v(image_url, alt, ts)
WHERE NOT EXISTS (SELECT 1 FROM "gallery_photos");
