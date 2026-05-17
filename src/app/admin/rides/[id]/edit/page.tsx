import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import type { RideTypeOption } from "@/lib/ride-types";
import { CancelRideButton } from "@/components/cancel-ride-button";
import { updateRide } from "../../actions";

export const metadata = { title: "Edit ride" };

type Params = Promise<{ id: string }>;

async function getLeaders(): Promise<LeaderOption[]> {
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.role, ["leader", "organiser", "admin"]));
}

async function getRideTypes(): Promise<RideTypeOption[]> {
  return db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position));
}

function toLocalDateTimeInput(d: Date) {
  // datetime-local input expects "YYYY-MM-DDTHH:mm" in the browser's local
  // timezone. We render the server's interpretation of the date, which gets
  // displayed identically as long as server tz matches user tz (close enough
  // for SG-only club use; revisit if multi-region).
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function EditRidePage({ params }: { params: Params }) {
  const { id } = await params;

  const [ride] = await db.select().from(schema.rides).where(eq(schema.rides.id, id)).limit(1);
  if (!ride) notFound();

  const [leaders, rideTypes] = await Promise.all([getLeaders(), getRideTypes()]);
  const isCancelled = ride.status === "cancelled";
  const action = updateRide.bind(null, id);

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">
        {isCancelled ? "Cancelled ride" : "Edit ride"}
      </h1>

      {isCancelled && ride.cancelledReason && (
        <div className="mt-4 rounded-2xl bg-maroon-100 ring-1 ring-maroon-200 px-4 py-3 text-sm">
          <p className="font-semibold text-maroon-800">Reason</p>
          <p className="text-ink mt-0.5">{ride.cancelledReason}</p>
          {ride.cancelledAt && (
            <p className="text-xs text-ink-soft mt-1">
              Cancelled {new Date(ride.cancelledAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <RideForm
        action={action}
        leaders={leaders}
        rideTypes={rideTypes}
        submitLabel="Save changes"
        readOnly={isCancelled}
        defaultValues={{
          title: ride.title,
          starts_at: toLocalDateTimeInput(new Date(ride.startsAt)),
          start_point_name: ride.startPointName,
          start_point_lat: ride.startPointLat,
          start_point_lng: ride.startPointLng,
          distance_km: ride.distanceKm,
          elevation_m: ride.elevationM,
          pace_group: ride.paceGroup,
          route_url: ride.routeUrl,
          description: ride.description,
          cap: ride.cap,
          leader_id: ride.leaderId,
        }}
      />

      {!isCancelled && (
        <div className="mt-10 pt-6 border-t border-maroon-200/40">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-maroon-700">
            Danger zone
          </h2>
          <p className="text-sm text-ink-soft mt-1 mb-3">
            Cancelling notifies nobody yet (Stage 3 will add email). The ride
            disappears from the rider list immediately.
          </p>
          <CancelRideButton rideId={id} rideTitle={ride.title} />
        </div>
      )}
    </main>
  );
}
