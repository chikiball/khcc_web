import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import type { RideTypeOption } from "@/lib/ride-types";
import { CancelRideButton } from "@/components/cancel-ride-button";
import { updateRide, stopSeries, markRideCompleted } from "../../actions";
import type { PaceGroupInput } from "../../actions";
import { PaceCancelButtons } from "@/components/pace-cancel-buttons";

export const metadata = { title: "Edit ride" };

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function toLocalDateTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditRidePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const [ride, seriesResult] = await Promise.all([
    db.select().from(schema.rides).where(eq(schema.rides.id, id)).limit(1).then((r) => r[0]),
    db.select().from(schema.rides).where(eq(schema.rides.id, id)).limit(1)
      .then(async (r) => r[0]?.seriesId
        ? db.select().from(schema.rideSeries).where(eq(schema.rideSeries.id, r[0].seriesId)).limit(1)
        : []),
  ]);
  const series = seriesResult[0] ?? null;
  if (!ride) notFound();

  const [paceGroups, leaders, rideTypes, libraryRoutes] = await Promise.all([
    db.select().from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, id))
      .orderBy(asc(schema.ridePaceGroups.position)),
    db.select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.role, ["leader", "organiser", "admin"])),
    db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position)) as Promise<RideTypeOption[]>,
    db.select({ id: schema.routeLibrary.id, name: schema.routeLibrary.name })
      .from(schema.routeLibrary)
      .orderBy(asc(schema.routeLibrary.name)),
  ]);

  const isCancelled = ride.status === "cancelled";
  const action = updateRide.bind(null, id);

  const defaultPaceGroups: PaceGroupInput[] = paceGroups.map((pg) => ({
    id: pg.id,
    pace_code: pg.paceCode,
    leader_id: pg.leaderId ?? undefined,
    distance_km: pg.distanceKm != null ? String(pg.distanceKm) : undefined,
    elevation_m: pg.elevationM != null ? String(pg.elevationM) : undefined,
    cap: pg.cap != null ? String(pg.cap) : undefined,
    notes: pg.notes ?? undefined,
    status: pg.status,
    position: pg.position,
  }));

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">
        {isCancelled ? "Cancelled ride" : "Edit ride"}
      </h1>

      {isCancelled && ride.cancelledReason && (
        <div className="mt-4 rounded-2xl bg-maroon-100 ring-1 ring-maroon-200 px-4 py-3 text-sm">
          <p className="font-semibold text-maroon-800">Reason</p>
          <p className="text-ink mt-0.5">{ride.cancelledReason}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-2xl bg-flash-500/10 ring-1 ring-flash-500/40 px-4 py-3 text-sm text-flash-600">
          ⚠ {error}
        </div>
      )}

      <RideForm
        action={action}
        leaders={leaders}
        rideTypes={rideTypes}
        libraryRoutes={libraryRoutes}
        submitLabel="Save changes"
        readOnly={isCancelled}
        defaultPaceGroups={isCancelled ? defaultPaceGroups : defaultPaceGroups}
        defaultValues={{
          title: ride.title,
          starts_at: toLocalDateTimeInput(new Date(ride.startsAt)),
          start_point_name: ride.startPointName,
          start_point_lat: ride.startPointLat,
          start_point_lng: ride.startPointLng,
          distance_km: ride.distanceKm,
          elevation_m: ride.elevationM,
          route_url: ride.routeUrl,
          description: ride.description,
        }}
      />

      {!isCancelled && (
        <div className="mt-10 pt-6 border-t border-maroon-200/40 space-y-6">

          {ride.status === "scheduled" && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-maroon-700">
                Mark as completed
              </h2>
              <p className="text-sm text-ink-soft mt-1 mb-3">
                Unlocks the recap section so leaders can post a note and members
                can attach photos. The cron does this automatically a few hours
                after the ride starts — use this to skip the wait.
              </p>
              <form action={markRideCompleted.bind(null, id)}>
                <button type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform">
                  Mark completed
                </button>
              </form>
            </div>
          )}

          {ride.status === "completed" && (
            <p className="text-sm text-ink-soft">
              ✓ This ride is marked completed — recap and photos are unlocked.
            </p>
          )}

          {series && series.active && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-maroon-700">
                Recurring series
              </h2>
              <p className="text-sm text-ink-soft mt-1 mb-3">
                This ride is part of a <strong>{series.rule}</strong> series
                ({["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][series.weekday]}s at {series.timeOfDay}).
                Stopping the series prevents future occurrences from being created;
                existing rides (including this one) are unaffected.
              </p>
              <form action={stopSeries.bind(null, series.id)}>
                <button type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-maroon-700 hover:bg-maroon-800 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform">
                  Stop this series
                </button>
              </form>
            </div>
          )}

          {series && !series.active && (
            <p className="text-sm text-ink-soft">
              ↻ This was part of a <strong>{series.rule}</strong> series — the series has been stopped.
              No further rides will be auto-created from it.
            </p>
          )}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-maroon-700">
              Cancel individual paces
            </h2>
            <p className="text-sm text-ink-soft mt-1 mb-3">
              Cancel just one group while keeping others running. If all paces are
              cancelled the whole ride is also marked cancelled.
            </p>
            <PaceCancelButtons paceGroups={paceGroups} />
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-maroon-700">
              Cancel whole ride
            </h2>
            <p className="text-sm text-ink-soft mt-1 mb-3">
              Cancels the ride and all remaining pace groups at once.
            </p>
            <CancelRideButton rideId={id} rideTitle={ride.title} />
          </div>
        </div>
      )}
    </main>
  );
}
