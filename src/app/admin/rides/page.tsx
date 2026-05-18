import Link from "next/link";
import { db, schema } from "@/db";
import { asc, desc, eq } from "drizzle-orm";
import { colorClasses } from "@/lib/ride-types";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  "weather-watch": "Weather watch",
  completed: "Completed",
  cancelled: "Cancelled",
};

type SearchParams = Promise<{ status?: string }>;

export default async function AdminRidesPage({ searchParams }: { searchParams: SearchParams }) {
  const { status } = await searchParams;

  const [rides, paceGroups, rideTypes] = await Promise.all([
    db.select().from(schema.rides).orderBy(desc(schema.rides.startsAt)),
    db.select().from(schema.ridePaceGroups).orderBy(asc(schema.ridePaceGroups.position)),
    db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position)),
  ]);

  const typeByCode = new Map(rideTypes.map((t) => [t.code, t]));
  const pacesByRide = new Map<string, typeof paceGroups>();
  for (const pg of paceGroups) {
    if (!pacesByRide.has(pg.rideId)) pacesByRide.set(pg.rideId, []);
    pacesByRide.get(pg.rideId)!.push(pg);
  }

  const filtered = status ? rides.filter((r) => r.status === status) : rides;

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Rides</h1>
        <Link href="/admin/rides/new"
          className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-5 py-2.5 text-sm font-semibold shadow-sm active:scale-[0.98] transition-transform">
          + New ride
        </Link>
      </div>

      <nav className="mt-6 flex flex-wrap gap-2 text-sm">
        <FilterPill label="All" href="/admin/rides" active={!status} />
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <FilterPill key={value} label={label} href={`/admin/rides?status=${value}`} active={status === value} />
        ))}
      </nav>

      <ul className="mt-6 space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-6 text-center text-sm text-ink-soft">
            No rides {status ? `with status "${status}"` : "yet"}.
          </li>
        )}
        {filtered.map((ride) => {
          const ridePaces = (pacesByRide.get(ride.id) ?? []).filter((pg) => pg.status !== "cancelled");
          return (
            <li key={ride.id} className="rounded-2xl bg-white ring-1 ring-maroon-200/60 px-4 py-3 flex items-center gap-3">
              {/* Show pace strip */}
              <div className="flex gap-1 shrink-0">
                {ridePaces.slice(0, 3).map((pg) => {
                  const t = typeByCode.get(pg.paceCode);
                  const tone = colorClasses(t?.color ?? "coral");
                  return (
                    <span key={pg.id}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-display font-bold text-sm ring-1 ${tone.bg} ${tone.text} ${tone.ring}`}
                      title={t?.name}>
                      {pg.paceCode}
                    </span>
                  );
                })}
                {ridePaces.length > 3 && (
                  <span className="text-xs text-ink-soft self-center">+{ridePaces.length - 3}</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-display text-base font-semibold truncate">{ride.title}</p>
                  {ride.status !== "scheduled" && <StatusPill status={ride.status} />}
                </div>
                <p className="text-xs text-ink-soft mt-0.5 truncate">
                  {new Date(ride.startsAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  {" · "}{ride.startPointName}
                </p>
              </div>

              <Link href={`/admin/rides/${ride.id}/edit`} className="text-sm text-coral-700 hover:text-coral-800 font-medium">
                Edit →
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function FilterPill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link href={href} className={`px-3 py-1.5 rounded-full ring-1 transition-colors ${active ? "bg-coral-500 text-cream-50 ring-coral-600" : "bg-white text-ink-soft ring-maroon-200 hover:bg-cream-100"}`}>
      {label}
    </Link>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "cancelled" ? "bg-maroon-200 text-maroon-800" : status === "weather-watch" ? "bg-flash-500/20 text-flash-600" : status === "completed" ? "bg-cream-300 text-ink-soft" : "bg-coral-200 text-coral-800";
  return <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${tone}`}>{STATUS_LABELS[status] ?? status}</span>;
}
