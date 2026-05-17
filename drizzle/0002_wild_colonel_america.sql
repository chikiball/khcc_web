CREATE TYPE "public"."user_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" "user_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "approved_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rejected_reason" text;--> statement-breakpoint
-- Backfill: existing users were "implicitly approved" before this migration
-- ran. Auto-approve them all (admin/leader/organiser AND ordinary members
-- who had already onboarded) so the upgrade is non-disruptive.
UPDATE "users" SET "status" = 'approved', "approved_at" = now() WHERE "status" = 'pending';
