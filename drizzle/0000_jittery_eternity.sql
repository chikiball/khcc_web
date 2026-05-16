CREATE TYPE "public"."pace_group" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."ride_status" AS ENUM('scheduled', 'weather-watch', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('member', 'leader', 'organiser', 'admin');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('in', 'waitlist', 'cancelled');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ride_rsvps" (
	"ride_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" "rsvp_status" DEFAULT 'in' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ride_rsvps_ride_id_user_id_pk" PRIMARY KEY("ride_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rides" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"start_point_name" text NOT NULL,
	"start_point_lat" numeric(10, 6),
	"start_point_lng" numeric(10, 6),
	"distance_km" numeric(6, 2),
	"elevation_m" integer,
	"pace_group" "pace_group" NOT NULL,
	"route_url" text,
	"description" text,
	"leader_id" text,
	"status" "ride_status" DEFAULT 'scheduled' NOT NULL,
	"cap" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"emailVerified" timestamp,
	"image" text,
	"role" "role" DEFAULT 'member' NOT NULL,
	"pace_group" "pace_group" DEFAULT 'B' NOT NULL,
	"bike" text,
	"strava_handle" text,
	"bio" text,
	"hide_from_directory" boolean DEFAULT false NOT NULL,
	"onboarded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users_private" (
	"user_id" text PRIMARY KEY NOT NULL,
	"emergency_contact_name" text,
	"emergency_contact_phone" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_rsvps" ADD CONSTRAINT "ride_rsvps_ride_id_rides_id_fk" FOREIGN KEY ("ride_id") REFERENCES "public"."rides"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ride_rsvps" ADD CONSTRAINT "ride_rsvps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rides" ADD CONSTRAINT "rides_leader_id_users_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users_private" ADD CONSTRAINT "users_private_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ride_rsvps_user_id_idx" ON "ride_rsvps" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rides_starts_at_idx" ON "rides" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rides_status_idx" ON "rides" USING btree ("status");