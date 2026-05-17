import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  primaryKey,
  index,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ===========================================================================
// Auth.js core tables (Drizzle adapter contract)
// https://authjs.dev/getting-started/adapters/drizzle
//
// We extend `users` with our domain fields (role, paceGroup, bike, etc.)
// rather than maintaining a separate `profiles` table. JWT session strategy
// is used, so we don't need a `sessions` table — Auth.js still uses `users`
// and `accounts` to link the Google account.
// ===========================================================================

export const roleEnum = pgEnum("role", ["member", "leader", "organiser", "admin"]);
export const paceEnum = pgEnum("pace_group", ["A", "B", "C"]);
export const rideStatusEnum = pgEnum("ride_status", [
  "scheduled",
  "weather-watch",
  "cancelled",
  "completed",
]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["in", "waitlist", "cancelled"]);

export const users = pgTable("users", {
  // Auth.js fields
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  // KHCC profile fields
  role: roleEnum("role").notNull().default("member"),
  paceGroup: paceEnum("pace_group").notNull().default("B"),
  bike: text("bike"),
  stravaHandle: text("strava_handle"),
  bio: text("bio"),
  hideFromDirectory: boolean("hide_from_directory").notNull().default(false),
  onboardedAt: timestamp("onboarded_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [primaryKey({ columns: [account.provider, account.providerAccountId] })],
);

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })],
);

// ===========================================================================
// Private user data — emergency contact.
// Separated so any query that doesn't explicitly join cannot leak it.
// Authorisation is enforced in app code (no RLS without Supabase auth context).
// ===========================================================================

export const usersPrivate = pgTable("users_private", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ===========================================================================
// Rides
// ===========================================================================

export const rides = pgTable(
  "rides",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    startPointName: text("start_point_name").notNull(),
    startPointLat: numeric("start_point_lat", { precision: 10, scale: 6 }),
    startPointLng: numeric("start_point_lng", { precision: 10, scale: 6 }),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    elevationM: integer("elevation_m"),
    paceGroup: paceEnum("pace_group").notNull(),
    routeUrl: text("route_url"),
    description: text("description"),
    leaderId: text("leader_id").references(() => users.id, { onDelete: "set null" }),
    status: rideStatusEnum("status").notNull().default("scheduled"),
    cap: integer("cap"),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    cancelledBy: text("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("rides_starts_at_idx").on(t.startsAt), index("rides_status_idx").on(t.status)],
);

// ===========================================================================
// RSVPs
// ===========================================================================

export const rideRsvps = pgTable(
  "ride_rsvps",
  {
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull().default("in"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.rideId, t.userId] }),
    index("ride_rsvps_user_id_idx").on(t.userId),
  ],
);

export type User = typeof users.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideRsvp = typeof rideRsvps.$inferSelect;
