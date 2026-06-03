import Link from "next/link";
import { stat } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { count, desc, eq, inArray } from "drizzle-orm";

export const metadata = { title: "Past rides" };
export const dynamic = "force-dynamic";

async function findPreview(rideId: string): Promise<string | null> {
  const fp = path.join(process.cwd(), "public", "uploads", "routes", `${rideId}-preview.jpg`);
  try {
    const s = await stat(fp);
    return s.isFile() ? `/uploads/routes/${rideId}-preview.jpg` : null;
  } catch {
    return null;
  }
}

export default async function PastRidesPage() {
  await requireApproved();

  const rides = await db
    .select({
      id: schema.rides.id,
      title: schema.rides.title,
      startsAt: schema.rides.startsAt,
      startPointName: schema.rides.startPointName,
      distanceKm: schema.rides.distanceKm,
      elevationM: schema.rides.elevationM,
      recapNote: schema.rides.recapNote,
    })
    .from(schema.rides)
    .where(eq(schema.rides.status, "completed"))
    .orderBy(desc(schema.rides.startsAt))
    .limit(60);

  const rideIds = rides.map((r) => r.id);

  const photoCounts = rideIds.length
    ? await db
        .select({ rideId: schema.ridePhotos.rideId, n: count() })
        .from(schema.ridePhotos)
        .where(inArray(schema.ridePhotos.rideId, rideIds))
        .groupBy(schema.ridePhotos.rideId)
    : [];
  const countByRide = new Map(photoCounts.map((r) => [r.rideId, Number(r.n)]));

  const rsvpCounts = rideIds.length
    ? await db
        .select({ rideId: schema.rideRsvps.rideId, n: count() })
        .from(schema.rideRsvps)
        .where(eq(schema.rideRsvps.status, "in"))
        .groupBy(schema.rideRsvps.rideId)
    : [];
  const ridersByRide = new Map(rsvpCounts.map((r) => [r.rideId, Number(r.n)]));

  const previews = await Promise.all(rides.map(async (r) => [r.id, await findPreview(r.id)] as const));
  const previewByRide = new Map(previews);

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">← All rides</Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        <h1 className="font-display text-3xl font-bold mt-2">Past rides</h1>
        <p className="text-sm text-ink-soft mt-1">Recaps and photos from completed rides.</p>
      </div>

      <section className="px-5 mt-6 space-y-3 pb-16 max-w-2xl mx-auto">
        {!rides.length && (
          <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
            <p className="font-display text-lg text-ink">Nothing here yet.</p>
            <p className="text-sm text-ink-soft mt-1">Past rides will show up after they wrap.</p>
          </div>
        )}

        {rides.map((ride) => {
          const photoCount = countByRide.get(ride.id) ?? 0;
          const riders = ridersByRide.get(ride.id) ?? 0;
          const preview = previewByRide.get(ride.id) ?? null;
          const snippet =
            ride.recapNote && ride.recapNote.length > 140
              ? ride.recapNote.slice(0, 140).trimEnd() + "…"
              : ride.recapNote;
          const date = new Date(ride.startsAt).toLocaleDateString(undefined, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });
          return (
            <Link
              key={ride.id}
              href={`/rides/${ride.id}`}
              className="block rounded-2xl bg-white ring-1 ring-maroon-200/60 overflow-hidden hover:ring-coral-300 transition"
            >
              {preview && (
                <div className="relative aspect-[2/1] bg-cream-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="" className="absolute inset-0 size-full object-cover" />
                </div>
              )}
              <div className="p-4 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">{date}</p>
                <h3 className="font-display text-lg font-semibold leading-snug text-ink">{ride.title}</h3>
                <p className="text-xs text-ink-soft">{ride.startPointName}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-soft pt-1">
                  {ride.distanceKm && <span>{Number(ride.distanceKm)} km</span>}
                  {ride.elevationM != null && <span>↗ {ride.elevationM} m</span>}
                  <span>{riders} rider{riders === 1 ? "" : "s"}</span>
                  {photoCount > 0 && <span>📷 {photoCount}</span>}
                </div>
                {snippet && (
                  <p className="text-sm text-ink mt-2 leading-snug">{snippet}</p>
                )}
              </div>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
