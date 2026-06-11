import { db, schema } from "@/db";
import { and, asc, desc, eq, gt, inArray, lt } from "drizzle-orm";
import type { RideSeries } from "@/db/schema";
import type { PaceGroupInput } from "@/app/admin/rides/actions";
import { copySeriesSeedGpxToRide, promoteRideGpxToSeriesSeed, seriesSeedExists } from "@/lib/upload";
import { generateRoutePreview } from "@/lib/static-map";
import { parseGpxCoords } from "@/lib/gpx";

/**
 * Lazy materialisation: a recurring series only ever has ONE live future
 * occurrence at a time. When that occurrence passes (or is cancelled), the
 * next call to materializeSeries() spawns the following one. Keeps the
 * member-facing rides list short and obvious instead of a wall of
 * "every Saturday for the next month" rows.
 *
 * Trigger points: cron (idempotent sweep), series creation, ride/pace
 * cancellation that takes the whole ride down.
 */

const SAFETY_HORIZON_DAYS = 60;

/**
 * Compute the dates of the next occurrences of a series strictly after
 * `from` and not past `through`. Used by materializeSeries() to find the
 * single next slot — we only ever consume dates[0].
 *
 * The weekday and time-of-day from the series template are used so the
 * schedule is stable even if an individual occurrence is cancelled —
 * the series still ticks on the right day each week.
 */
export function generateOccurrences(
  series: Pick<RideSeries, "rule" | "weekday" | "timeOfDay">,
  from: Date,
  through: Date,
): Date[] {
  const [hh, mm] = series.timeOfDay.split(":").map(Number);
  const interval = series.rule === "biweekly" ? 14 : 7;
  const dates: Date[] = [];

  const candidate = new Date(from);
  candidate.setHours(hh, mm, 0, 0);
  // Strictly after `from` — step at least one day forward
  candidate.setDate(candidate.getDate() + 1);
  while (candidate.getDay() !== series.weekday) {
    candidate.setDate(candidate.getDate() + 1);
  }

  while (candidate <= through) {
    dates.push(new Date(candidate));
    candidate.setDate(candidate.getDate() + interval);
  }

  return dates;
}

/**
 * Ensure exactly one live future occurrence exists for `series`. Returns
 * the number of new rides created (0 or 1).
 *
 * Also sweeps stale extras: any future occurrences for this series with
 * zero RSVPs beyond the soonest live one get deleted. This cleans up
 * data left over from the previous 4-week-ahead strategy and keeps the
 * one-occurrence invariant tidy if a series rule changes.
 */
export async function materializeSeries(series: RideSeries): Promise<number> {
  const now = new Date();

  // Step 1 — find all future occurrences for this series, soonest first.
  const future = await db
    .select({ id: schema.rides.id, startsAt: schema.rides.startsAt, status: schema.rides.status })
    .from(schema.rides)
    .where(and(eq(schema.rides.seriesId, series.id), gt(schema.rides.startsAt, now)))
    .orderBy(asc(schema.rides.startsAt));

  // Step 2 — sweep extras. Keep the soonest non-cancelled future ride; delete
  // the rest if they have no RSVPs (FK cascade handles pace groups).
  const liveFuture = future.filter((r) => r.status !== "cancelled");
  const keepId = liveFuture[0]?.id;
  const candidatesToDelete = future.filter((r) => r.id !== keepId).map((r) => r.id);

  if (candidatesToDelete.length > 0) {
    const withRsvps = await db
      .select({ rideId: schema.rideRsvps.rideId })
      .from(schema.rideRsvps)
      .where(inArray(schema.rideRsvps.rideId, candidatesToDelete))
      .groupBy(schema.rideRsvps.rideId);
    const protect = new Set(withRsvps.map((r) => r.rideId));
    const toDelete = candidatesToDelete.filter((id) => !protect.has(id));
    if (toDelete.length > 0) {
      await db.delete(schema.rides).where(inArray(schema.rides.id, toDelete));
    }
  }

  // Step 3 — if a live future occurrence already exists, we're done.
  if (keepId) return 0;

  // Step 4 — find pivot date (latest ride of any status) and generate next.
  const [latest] = await db
    .select({ startsAt: schema.rides.startsAt })
    .from(schema.rides)
    .where(eq(schema.rides.seriesId, series.id))
    .orderBy(desc(schema.rides.startsAt))
    .limit(1);

  const pivot = latest?.startsAt ?? now;
  const through = new Date(now);
  through.setDate(through.getDate() + SAFETY_HORIZON_DAYS);

  const dates = generateOccurrences(series, pivot, through);
  // Pick the first occurrence that is genuinely in the future. Pivoting off
  // the latest existing ride keeps the weekly/biweekly cadence stable, but if
  // the series went dormant (cron off for a while) the on-cadence date nearest
  // the pivot can already be in the past — skip those so we always surface a
  // real upcoming ride rather than a stale back-dated one.
  const date = dates.find((d) => d > now);
  if (!date) return 0;

  // Idempotency — race-safe even if two cron runs collide.
  const existing = await db
    .select({ id: schema.rides.id })
    .from(schema.rides)
    .where(and(eq(schema.rides.seriesId, series.id), eq(schema.rides.startsAt, date)))
    .limit(1);
  if (existing.length > 0) return 0;

  const templates = JSON.parse(series.paceGroupsTemplate) as PaceGroupInput[];

  const [ride] = await db
    .insert(schema.rides)
    .values({
      title: series.title,
      startsAt: date,
      startPointName: series.startPointName,
      startPointLat: series.startPointLat,
      startPointLng: series.startPointLng,
      distanceKm: series.distanceKm,
      elevationM: series.elevationM,
      routeUrl: series.routeUrl,
      description: series.description,
      seriesId: series.id,
    })
    .returning({ id: schema.rides.id });

  if (templates.length > 0) {
    await db.insert(schema.ridePaceGroups).values(
      templates.map((pg, i) => ({
        rideId: ride.id,
        paceCode: pg.pace_code,
        leaderId: pg.leader_id ?? null,
        distanceKm: pg.distance_km ?? null,
        elevationM: pg.elevation_m ? Number(pg.elevation_m) : null,
        cap: pg.cap ? Number(pg.cap) : null,
        notes: pg.notes ?? null,
        position: pg.position ?? i,
      })),
    );
  }

  // Carry the series' seed route into this occurrence's per-ride slot so the
  // map polyline, GPX download, and static preview match week one. Best-effort:
  // a missing seed (series created without a GPX) or preview failure must never
  // block materialisation.
  //
  // Self-heal for series created before seeding existed: if there's no seed but
  // a prior occurrence has a GPX on disk, promote it to the seed first.
  if (!(await seriesSeedExists(series.id))) {
    const prior = await db
      .select({ id: schema.rides.id })
      .from(schema.rides)
      .where(eq(schema.rides.seriesId, series.id))
      .orderBy(desc(schema.rides.startsAt));
    for (const p of prior) {
      if (p.id === ride.id) continue;
      if (await promoteRideGpxToSeriesSeed(p.id, series.id)) break;
    }
  }

  const gpxText = await copySeriesSeedGpxToRide(series.id, ride.id);
  if (gpxText) {
    try {
      const coords = parseGpxCoords(gpxText);
      if (coords.length >= 2) await generateRoutePreview(coords, ride.id);
    } catch (err) {
      console.error("[series] preview generation failed", err);
    }
  }

  await db
    .update(schema.rideSeries)
    .set({ updatedAt: new Date() })
    .where(eq(schema.rideSeries.id, series.id));

  return 1;
}

/**
 * Flip past `scheduled` rides to `completed`. Run from the cron alongside
 * series materialisation so the rides list and `/rides/past` reflect what
 * actually happened without admins having to mark each ride by hand.
 *
 * The cutoff per ride is distance-based: a chill Burkam ride averages
 * ~14 km/h overall (moving + bubur stop), with a 2 h floor and a 4 h
 * fallback when distance is unset. The same estimate also drives
 * the lazy completion that runs on the ride detail page.
 */
const KMH_OVERALL = 14;
const MIN_RIDE_HOURS = 2;
const FALLBACK_RIDE_HOURS = 4;

export function estimateRideHours(distanceKm: number | string | null | undefined): number {
  if (distanceKm == null) return FALLBACK_RIDE_HOURS;
  const km = typeof distanceKm === "string" ? Number(distanceKm) : distanceKm;
  if (!Number.isFinite(km) || km <= 0) return FALLBACK_RIDE_HOURS;
  return Math.max(MIN_RIDE_HOURS, km / KMH_OVERALL);
}

export function isRideOverdue(
  startsAt: Date,
  distanceKm: number | string | null | undefined,
): boolean {
  const endsAt = new Date(startsAt.getTime() + estimateRideHours(distanceKm) * 60 * 60 * 1000);
  return new Date() > endsAt;
}

export async function autoCompletePastRides(): Promise<number> {
  const now = new Date();
  const candidates = await db
    .select({
      id: schema.rides.id,
      startsAt: schema.rides.startsAt,
      distanceKm: schema.rides.distanceKm,
    })
    .from(schema.rides)
    .where(and(eq(schema.rides.status, "scheduled"), lt(schema.rides.startsAt, now)));

  const overdueIds = candidates
    .filter((r) => isRideOverdue(r.startsAt, r.distanceKm))
    .map((r) => r.id);
  if (!overdueIds.length) return 0;

  await db
    .update(schema.rides)
    .set({ status: "completed", updatedAt: now })
    .where(inArray(schema.rides.id, overdueIds));
  return overdueIds.length;
}

/**
 * Lazy-completion variant for hot paths like the ride detail page —
 * flips a single ride if it's past its estimated end. Returns true if
 * the status was updated (caller should reflect the new value locally).
 */
export async function maybeAutoCompleteRide(ride: {
  id: string;
  status: string;
  startsAt: Date;
  distanceKm: number | string | null | undefined;
}): Promise<boolean> {
  if (ride.status !== "scheduled") return false;
  if (!isRideOverdue(ride.startsAt, ride.distanceKm)) return false;
  await db
    .update(schema.rides)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(schema.rides.id, ride.id));
  return true;
}
