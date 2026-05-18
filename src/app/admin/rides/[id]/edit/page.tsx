import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import type { RideTypeOption } from "@/lib/ride-types";
import { CancelRideButton } from "@/components/cancel-ride-button";
import { updateRide } from "../../actions";
import type { PaceGroupInput } from "../../actions";
import { PaceCancelButtons } from "@/components/pace-cancel-buttons";

export const metadata = { title: "Edit ride" };

type Params = Promise<{ id: string }>;

function toLocalDateTimeInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditRidePage({ params }: { params: Params }) {
  const { id } = await params;

  const [ride] = await db.select().from(schema.rides).where(eq(schema.rides.id, id)).limit(1);
  if (!ride) notFound();

  const [paceGroups, leaders, rideTypes] = await Promise.all([
    db.select().from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, id))
      .orderBy(asc(schema.ridePaceGroups.position)),
    db.select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.role, ["leader", "organiser", "admin"])),
    db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position)) as Promise<RideTypeOption[]>,
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

      <RideForm
        action={action}
        leaders={leaders}
        rideTypes={rideTypes}
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
