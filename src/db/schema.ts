import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  primaryKey,
  index,
  uniqueIndex,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const roleEnum = pgEnum("role", ["member", "leader", "organiser", "admin"]);
export const userStatusEnum = pgEnum("user_status", ["pending", "approved", "rejected"]);
export const rideStatusEnum = pgEnum("ride_status", [
  "scheduled",
  "weather-watch",
  "cancelled",
  "completed",
]);
export const rsvpStatusEnum = pgEnum("rsvp_status", ["in", "waitlist", "cancelled"]);

// ===========================================================================
// Ride types — admin-managed pace catalogue
// ===========================================================================

export const rideTypes = pgTable("ride_types", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("coral"),
  position: integer("position").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type RideType = typeof rideTypes.$inferSelect;

// ===========================================================================
// Auth.js core tables
// ===========================================================================

export const users = pgTable("users", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),

  role: roleEnum("role").notNull().default("member"),
  status: userStatusEnum("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  approvedBy: text("approved_by"),
  rejectedReason: text("rejected_reason"),
  // users.pace_group is the rider's PREFERENCE, used to pre-select the
  // matching pace card on each ride detail page.
  paceGroup: text("pace_group")
    .notNull()
    .default("chill")
    .references(() => rideTypes.code, { onDelete: "no action" }),
  bike: text("bike"),
  stravaHandle: text("strava_handle"),
  bio: text("bio"),
  hideFromDirectory: boolean("hide_from_directory").notNull().default(false),
  acceptedTermsAt: timestamp("accepted_terms_at", { mode: "date" }),
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

export const usersPrivate = pgTable("users_private", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ===========================================================================
// Ride series — recurring ride templates
// ===========================================================================
// A series owns the schedule (weekday, time, rule) and a JSON snapshot of
// the pace groups. Materialised rides reference the series via series_id.
// The cron at /api/cron/materialize-rides keeps the next 4 weeks filled.

export const rideSeries = pgTable("ride_series", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: text("title").notNull(),
  rule: text("rule").notNull(),        // "weekly" | "biweekly"
  weekday: integer("weekday").notNull(), // 0=Sun … 6=Sat (derived from first starts_at)
  timeOfDay: text("time_of_day").notNull(), // "HH:MM" e.g. "05:45"
  startPointName: text("start_point_name").notNull(),
  startPointLat: numeric("start_point_lat", { precision: 10, scale: 6 }),
  startPointLng: numeric("start_point_lng", { precision: 10, scale: 6 }),
  distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
  elevationM: integer("elevation_m"),
  routeUrl: text("route_url"),
  description: text("description"),
  // JSON snapshot of pace groups (PaceGroupInput[] without id/status)
  paceGroupsTemplate: text("pace_groups_template").notNull().default("[]"),
  active: boolean("active").notNull().default(true),
  // Latest date through which occurrences have been materialised. The cron
  // picks up from here and generates forward to now + 4 weeks.
  materializeThroughAt: timestamp("materialize_through_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type RideSeries = typeof rideSeries.$inferSelect;

// ===========================================================================
// Rides — shared event header
// ===========================================================================
// Per-pace details (leader, cap, distance override, etc.) live in
// ride_pace_groups below. A ride has at least one active pace group to be
// considered "live"; it is cancelled at ride level when the whole event is off.

export const rides = pgTable(
  "rides",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { mode: "date", withTimezone: true }).notNull(),
    startPointName: text("start_point_name").notNull(),
    startPointLat: numeric("start_point_lat", { precision: 10, scale: 6 }),
    startPointLng: numeric("start_point_lng", { precision: 10, scale: 6 }),
    // Default distance + elevation shown when no per-pace override is set.
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    elevationM: integer("elevation_m"),
    routeUrl: text("route_url"),
    description: text("description"),
    // Null for one-off rides; set for materialised occurrences of a series.
    seriesId: text("series_id").references(() => rideSeries.id, { onDelete: "set null" }),
    status: rideStatusEnum("status").notNull().default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    cancelledBy: text("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelledReason: text("cancelled_reason"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("rides_starts_at_idx").on(t.startsAt), index("rides_status_idx").on(t.status)],
);

// ===========================================================================
// Ride pace groups — per-pace details for a ride
// ===========================================================================
// One ride can offer multiple pace groups (A + B + C all at 5:45 AM from the
// same start). Each has its own leader, cap, and optional distance / elevation
// overrides. `status` is per-pace: admin can cancel just the B group while
// keeping A and C running.

export const ridePaceGroups = pgTable(
  "ride_pace_groups",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    rideId: text("ride_id")
      .notNull()
      .references(() => rides.id, { onDelete: "cascade" }),
    paceCode: text("pace_code")
      .notNull()
      .references(() => rideTypes.code, { onDelete: "no action" }),
    leaderId: text("leader_id").references(() => users.id, { onDelete: "set null" }),
    distanceKm: numeric("distance_km", { precision: 6, scale: 2 }),
    elevationM: integer("elevation_m"),
    cap: integer("cap"),
    notes: text("notes"),
    // 'scheduled' | 'cancelled' — only these two states at pace level
    status: text("status").notNull().default("scheduled"),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    cancelledBy: text("cancelled_by").references(() => users.id, { onDelete: "set null" }),
    cancelledReason: text("cancelled_reason"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("ride_pace_groups_ride_id_idx").on(t.rideId),
    uniqueIndex("ride_pace_groups_ride_pace_idx").on(t.rideId, t.paceCode),
  ],
);

export type RidePaceGroup = typeof ridePaceGroups.$inferSelect;

// ===========================================================================
// RSVPs — one per user per ride (one pace choice)
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
    paceGroupId: text("pace_group_id")
      .notNull()
      .references(() => ridePaceGroups.id, { onDelete: "cascade" }),
    status: rsvpStatusEnum("status").notNull().default("in"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.rideId, t.userId] }),
    index("ride_rsvps_user_id_idx").on(t.userId),
    index("ride_rsvps_pace_group_id_idx").on(t.paceGroupId),
  ],
);

export type User = typeof users.$inferSelect;
export type Ride = typeof rides.$inferSelect;
export type RideRsvp = typeof rideRsvps.$inferSelect;

export const contentBlocks = pgTable("content_blocks", {
  key: text("key").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export type ContentBlock = typeof contentBlocks.$inferSelect;

export const galleryPhotos = pgTable("gallery_photos", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  imageUrl: text("image_url").notNull(),
  alt: text("alt").notNull().default(""),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
});

export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
