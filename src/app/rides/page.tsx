import Link from "next/link";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { RideCard } from "@/components/ride-card";
import { signOut } from "@/app/auth/actions";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";

export const metadata = { title: "Rides" };
export const dynamic = "force-dynamic";

export default async function RidesPage() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 14);

  const rides = await db
    .select({
      id: schema.rides.id,
      title: schema.rides.title,
      starts_at: schema.rides.startsAt,
      start_point_name: schema.rides.startPointName,
      distance_km: schema.rides.distanceKm,
      elevation_m: schema.rides.elevationM,
      pace_group: schema.rides.paceGroup,
      status: schema.rides.status,
    })
    .from(schema.rides)
    .where(
      and(
        gte(schema.rides.startsAt, now),
        lte(schema.rides.startsAt, horizon),
        ne(schema.rides.status, "cancelled"),
      ),
    )
    .orderBy(schema.rides.startsAt);

  const rideIds = rides.map((r) => r.id);
  const rsvps = rideIds.length
    ? await db
        .select({
          rideId: schema.rideRsvps.rideId,
          userId: schema.rideRsvps.userId,
        })
        .from(schema.rideRsvps)
        .where(
          and(
            inArray(schema.rideRsvps.rideId, rideIds),
            eq(schema.rideRsvps.status, "in"),
          ),
        )
    : [];

  const counts = new Map<string, number>();
  const myRsvps = new Set<string>();
  for (const row of rsvps) {
    counts.set(row.rideId, (counts.get(row.rideId) ?? 0) + 1);
    if (row.userId === user.id) myRsvps.add(row.rideId);
  }

  const firstName = (user.name ?? "rider").split(" ")[0];

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link href="/rides" className="font-display text-2xl font-bold tracking-tight">
          KHCC
        </Link>
        <form action={signOut}>
          <button className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      <div className="px-5">
        <h1 className="font-display text-3xl font-bold mt-2">Next rides</h1>
        <p className="text-sm text-ink-soft mt-1">
          Hi {firstName} — here&apos;s the next 14 days.
        </p>
      </div>

      <section className="px-5 mt-6 space-y-3 pb-16">
        {!rides.length && (
          <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
            <p className="font-display text-lg text-ink">No rides scheduled.</p>
            <p className="text-sm text-ink-soft mt-1">
              A leader will post one soon. Sit tight.
            </p>
          </div>
        )}
        {rides.map((ride) => (
          <RideCard
            key={ride.id}
            ride={{
              id: ride.id,
              title: ride.title,
              starts_at: ride.starts_at.toISOString(),
              start_point_name: ride.start_point_name,
              distance_km: ride.distance_km != null ? Number(ride.distance_km) : null,
              elevation_m: ride.elevation_m,
              pace_group: ride.pace_group,
              status: ride.status,
            }}
            rsvpCount={counts.get(ride.id) ?? 0}
            isIn={myRsvps.has(ride.id)}
          />
        ))}
      </section>
    </main>
  );
}
