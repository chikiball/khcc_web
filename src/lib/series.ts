import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import type { RideSeries } from "@/db/schema";
import type { PaceGroupInput } from "@/app/admin/rides/actions";

const WEEKS_AHEAD = 4;

/**
 * Compute the dates of the next N occurrences of a series starting
 * strictly after `from` and not past `through`.
 *
 * The weekday and time-of-day from the series template are used so the
 * schedule is stable even if an individual occurrence is cancelled or
 * rescheduled — the series still ticks on the right day each week.
 */
export function generateOccurrences(
  series: Pick<RideSeries, "rule" | "weekday" | "timeOfDay">,
  from: Date,
  through: Date,
): Date[] {
  const [hh, mm] = series.timeOfDay.split(":").map(Number);
  const interval = series.rule === "biweekly" ? 14 : 7;
  const dates: Date[] = [];

  // Step forward one day at a time until we hit the right weekday
  const candidate = new Date(from);
  candidate.setHours(hh, mm, 0, 0);
  // Start from the next full day after `from`
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
 * Materialise all missing occurrences for `series` within the next
 * WEEKS_AHEAD weeks. Returns the number of new rides created.
 *
 * Each call is idempotent — it checks whether a ride already exists
 * for (series_id, starts_at) before inserting.
 */
export async function materializeSeries(series: RideSeries): Promise<number> {
  const from = series.materializeThroughAt ?? new Date(0);
  const through = new Date();
  through.setDate(through.getDate() + WEEKS_AHEAD * 7);

  const dates = generateOccurrences(series, from, through);
  if (dates.length === 0) return 0;

  let created = 0;
  const templates = JSON.parse(series.paceGroupsTemplate) as PaceGroupInput[];

  for (const date of dates) {
    // Idempotency check
    const existing = await db
      .select({ id: schema.rides.id })
      .from(schema.rides)
      .where(
        and(
          eq(schema.rides.seriesId, series.id),
          eq(schema.rides.startsAt, date),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;

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

    // Materialise pace groups from template
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

    created++;
  }

  // Advance the watermark so the next cron call doesn't re-scan old dates
  await db
    .update(schema.rideSeries)
    .set({ materializeThroughAt: through, updatedAt: new Date() })
    .where(eq(schema.rideSeries.id, series.id));

  return created;
}
