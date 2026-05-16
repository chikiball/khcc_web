import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RideCard } from "@/components/ride-card";
import { signOut } from "@/app/auth/actions";

export const metadata = { title: "Rides" };
export const dynamic = "force-dynamic";

export default async function RidesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Onboarding gate.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarded_at) redirect("/onboarding");

  // Next 14 days of scheduled rides.
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 14);

  const { data: rides } = await supabase
    .from("rides")
    .select("id, title, starts_at, start_point_name, distance_km, elevation_m, pace_group, status")
    .gte("starts_at", new Date().toISOString())
    .lte("starts_at", horizon.toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: true });

  // RSVP counts (single round-trip)
  const rideIds = (rides ?? []).map((r) => r.id);
  const { data: rsvpRows } = rideIds.length
    ? await supabase
        .from("ride_rsvps")
        .select("ride_id, user_id")
        .in("ride_id", rideIds)
        .eq("status", "in")
    : { data: [] as { ride_id: string; user_id: string }[] };

  const counts = new Map<string, number>();
  const myRsvps = new Set<string>();
  for (const row of rsvpRows ?? []) {
    counts.set(row.ride_id, (counts.get(row.ride_id) ?? 0) + 1);
    if (row.user_id === user.id) myRsvps.add(row.ride_id);
  }

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
          Hi {profile.display_name.split(" ")[0]} — here&apos;s the next 14 days.
        </p>
      </div>

      <section className="px-5 mt-6 space-y-3 pb-16">
        {!rides?.length && (
          <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
            <p className="font-display text-lg text-ink">No rides scheduled.</p>
            <p className="text-sm text-ink-soft mt-1">
              A leader will post one soon. Sit tight.
            </p>
          </div>
        )}
        {rides?.map((ride) => (
          <RideCard
            key={ride.id}
            ride={ride}
            rsvpCount={counts.get(ride.id) ?? 0}
            isIn={myRsvps.has(ride.id)}
          />
        ))}
      </section>
    </main>
  );
}
