import Link from "next/link";
import { stat } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { canManageRides, requireApproved } from "@/lib/auth-helpers";
import { RideCard } from "@/components/ride-card";
import { signOut } from "@/app/auth/actions";
import { getRideForecast } from "@/lib/weather";
import { and, asc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import type { RideTypeOption } from "@/lib/ride-types";

export const metadata = { title: "Rides" };
export const dynamic = "force-dynamic";

async function findPreview(rideId: string): Promise<string | null> {
  const fp = path.join(process.cwd(), "public", "uploads", "routes", `${rideId}-preview.jpg`);
  try { const s = await stat(fp); return s.isFile() ? `/uploads/routes/${rideId}-preview.jpg` : null; }
  catch { return null; }
}

export default async function RidesPage() {
  const user = await requireApproved();

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const [rides, rideTypes] = await Promise.all([
    db.select({
      id: schema.rides.id, title: schema.rides.title,
      starts_at: schema.rides.startsAt, start_point_name: schema.rides.startPointName,
      start_point_lat: schema.rides.startPointLat, start_point_lng: schema.rides.startPointLng,
      status: schema.rides.status,
      series_rule: schema.rideSeries.rule,
    }).from(schema.rides)
      .leftJoin(schema.rideSeries, eq(schema.rideSeries.id, schema.rides.seriesId))
      .where(and(gte(schema.rides.startsAt, now), lte(schema.rides.startsAt, horizon), ne(schema.rides.status, "cancelled")))
      .orderBy(schema.rides.startsAt),
    db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position)) as Promise<RideTypeOption[]>,
  ]);

  const rideIds = rides.map((r) => r.id);
  const typeByCode = new Map(rideTypes.map((t) => [t.code, t]));

  // Pace groups for all rides in window
  const paceGroups = rideIds.length
    ? await db.select().from(schema.ridePaceGroups)
        .where(inArray(schema.ridePaceGroups.rideId, rideIds))
        .orderBy(asc(schema.ridePaceGroups.position))
    : [];

  // RSVP counts per pace group + which ones the current user is in
  const rsvps = rideIds.length
    ? await db.select({ rideId: schema.rideRsvps.rideId, userId: schema.rideRsvps.userId, paceGroupId: schema.rideRsvps.paceGroupId })
        .from(schema.rideRsvps)
        .where(and(inArray(schema.rideRsvps.rideId, rideIds), eq(schema.rideRsvps.status, "in")))
    : [];

  const countByPace = new Map<string, number>();
  for (const r of rsvps) countByPace.set(r.paceGroupId, (countByPace.get(r.paceGroupId) ?? 0) + 1);

  const pacesByRide = new Map<string, typeof paceGroups>();
  for (const pg of paceGroups) {
    if (!pacesByRide.has(pg.rideId)) pacesByRide.set(pg.rideId, []);
    pacesByRide.get(pg.rideId)!.push(pg);
  }

  const previewEntries = await Promise.all(rides.map(async (r) => [r.id, await findPreview(r.id)] as const));
  const previewByRide = new Map(previewEntries);

  // Forecast per ride (parallel; null when ride has no lat/lng or fetch fails)
  const forecastEntries = await Promise.all(
    rides.map(async (r) => {
      if (!r.start_point_lat || !r.start_point_lng) return [r.id, null] as const;
      const fc = await getRideForecast(
        Number(r.start_point_lat),
        Number(r.start_point_lng),
        r.starts_at,
      );
      return [r.id, fc] as const;
    }),
  );
  const forecastByRide = new Map(forecastEntries);

  const firstName = (user.name ?? "rider").split(" ")[0];

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link href="/rides" className="font-display text-2xl font-bold tracking-tight">KHCC</Link>
        <div className="flex items-center gap-4">
          {canManageRides(user.role) && (
            <Link href="/admin/rides" className="text-sm font-medium text-coral-700 hover:text-coral-800 underline-offset-4 hover:underline">
              Manage rides
            </Link>
          )}
          <Link href="/profile" className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">Profile</Link>
          <Link href="/members" className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">Members</Link>
          <form action={signOut}>
            <button className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">Sign out</button>
          </form>
        </div>
      </header>

      <div className="px-5">
        <h1 className="font-display text-3xl font-bold mt-2">Next rides</h1>
        <p className="text-sm text-ink-soft mt-1">Hi {firstName} — here&apos;s the next 14 days.</p>
      </div>

      <section className="px-5 mt-6 space-y-3 pb-16">
        {!rides.length && (
          <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
            <p className="font-display text-lg text-ink">No rides scheduled.</p>
            <p className="text-sm text-ink-soft mt-1">A leader will post one soon. Sit tight.</p>
          </div>
        )}
        {rides.map((ride) => {
          const ridePageGroups = pacesByRide.get(ride.id) ?? [];
          return (
            <RideCard
              key={ride.id}
              ride={{ id: ride.id, title: ride.title, starts_at: ride.starts_at.toISOString(), start_point_name: ride.start_point_name, status: ride.status }}
              paces={ridePageGroups.map((pg) => ({ paceGroup: pg, rideType: typeByCode.get(pg.paceCode), count: countByPace.get(pg.id) ?? 0 }))}
              previewUrl={previewByRide.get(ride.id) ?? null}
              forecast={forecastByRide.get(ride.id) ?? null}
              seriesRule={ride.series_rule}
            />
          );
        })}
      </section>
    </main>
  );
}
