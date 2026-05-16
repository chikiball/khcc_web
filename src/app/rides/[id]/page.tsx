import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RsvpButton } from "@/components/rsvp-button";
import { PaceBadge } from "@/components/ride-card";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function RideDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ride } = await supabase
    .from("rides")
    .select("id, title, starts_at, start_point_name, distance_km, elevation_m, pace_group, route_url, description, status")
    .eq("id", id)
    .maybeSingle();

  if (!ride) notFound();

  const { data: rsvps } = await supabase
    .from("ride_rsvps")
    .select("user_id, profiles!inner(display_name, avatar_url, pace_group)")
    .eq("ride_id", id)
    .eq("status", "in")
    .order("created_at", { ascending: true });

  const isIn = !!rsvps?.some((r) => r.user_id === user.id);
  const start = new Date(ride.starts_at);

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-2">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">
          ← All rides
        </Link>
      </header>

      <article className="px-5 pt-2 pb-32 max-w-xl mx-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">
              {start.toLocaleDateString(undefined, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </p>
            <h1 className="font-display text-3xl font-bold mt-1 leading-tight">
              {ride.title}
            </h1>
            <p className="text-base text-ink-soft mt-2">{ride.start_point_name}</p>
          </div>
          <PaceBadge pace={ride.pace_group as "A" | "B" | "C"} />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="km" value={ride.distance_km} />
          <Stat label="m up" value={ride.elevation_m} />
          <Stat label="riders" value={rsvps?.length ?? 0} />
        </dl>

        {ride.description && (
          <p className="mt-6 text-base text-ink leading-relaxed whitespace-pre-wrap">
            {ride.description}
          </p>
        )}

        {ride.route_url && (
          <a
            href={ride.route_url}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-coral-700 hover:text-coral-800 underline underline-offset-4"
          >
            Route ↗
          </a>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Riding ({rsvps?.length ?? 0})
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {rsvps?.length ? (
              rsvps.map((r) => {
                const p = r.profiles as unknown as { display_name: string; avatar_url: string | null };
                return (
                  <li
                    key={r.user_id}
                    className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-maroon-200/60 pl-1 pr-3 py-1"
                  >
                    {p.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.avatar_url} alt="" className="size-7 rounded-full object-cover" />
                    ) : (
                      <span className="size-7 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center text-xs font-bold">
                        {p.display_name[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-ink">{p.display_name}</span>
                  </li>
                );
              })
            ) : (
              <li className="text-sm text-ink-soft">Be the first.</li>
            )}
          </ul>
        </section>
      </article>

      {/* Sticky RSVP bar — always reachable on mobile, ≥44pt tap */}
      <div className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur ring-1 ring-maroon-200/60 px-5 py-4">
        <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
          <span className="text-sm text-ink-soft">
            {isIn ? "You're in." : "Tap to commit."}
          </span>
          <RsvpButton rideId={ride.id} isIn={isIn} size="lg" />
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 py-3">
      <dd className="font-display text-2xl font-bold text-ink">
        {value ?? "—"}
      </dd>
      <dt className="text-xs uppercase tracking-wider text-ink-soft">{label}</dt>
    </div>
  );
}
