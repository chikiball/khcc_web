import Link from "next/link";
import { stat } from "node:fs/promises";
import path from "node:path";
import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { ridePhotoThumbUrl } from "@/lib/upload";
import { count, desc, eq, inArray } from "drizzle-orm";

export const metadata = { title: "Past rides" };
export const dynamic = "force-dynamic";

// How many photos a card's collage shows before collapsing the rest into a
// "+N" overlay on the last tile.
const COLLAGE_MAX = 4;

async function fileExists(publicPath: string): Promise<boolean> {
  const fp = path.join(process.cwd(), "public", publicPath);
  try {
    const s = await stat(fp);
    return s.isFile();
  } catch {
    return false;
  }
}

async function findPreview(rideId: string): Promise<string | null> {
  const rel = `/uploads/routes/${rideId}-preview.jpg`;
  return (await fileExists(rel)) ? rel : null;
}

/**
 * Prefer the small square thumbnail; fall back to the full image when the
 * thumb is missing on disk (photos uploaded before thumbnails existed, until
 * the backfill script runs).
 */
async function resolvePhotoSrc(imageUrl: string): Promise<string> {
  const thumb = ridePhotoThumbUrl(imageUrl);
  return (await fileExists(thumb)) ? thumb : imageUrl;
}

function PhotoCollage({ photos, extra }: { photos: string[]; extra: number }) {
  const n = photos.length;
  const gridClass =
    n === 1 ? "grid-cols-1" : n === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2";
  return (
    <div className={`relative aspect-[2/1] bg-cream-100 grid gap-0.5 ${gridClass}`}>
      {photos.map((src, i) => {
        // 3-photo layout: first tile spans both rows on the left.
        const spanClass = n === 3 && i === 0 ? "row-span-2" : "";
        const showOverlay = i === photos.length - 1 && extra > 0;
        return (
          <div key={i} className={`relative overflow-hidden ${spanClass}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
            {showOverlay && (
              <div className="absolute inset-0 bg-black/45 grid place-items-center">
                <span className="text-white font-display text-2xl font-semibold">+{extra}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
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

  // Fetch photo rows (newest first) for every listed ride in one query, then
  // group in JS — cheap at this scale (weekend rides, few photos each) and
  // avoids a per-group top-N window query.
  const photoRows = rideIds.length
    ? await db
        .select({
          rideId: schema.ridePhotos.rideId,
          imageUrl: schema.ridePhotos.imageUrl,
        })
        .from(schema.ridePhotos)
        .where(inArray(schema.ridePhotos.rideId, rideIds))
        .orderBy(desc(schema.ridePhotos.createdAt))
    : [];

  const photosByRide = new Map<string, string[]>();
  for (const row of photoRows) {
    if (!row.imageUrl) continue; // skip half-written rows
    const list = photosByRide.get(row.rideId) ?? [];
    list.push(row.imageUrl);
    photosByRide.set(row.rideId, list);
  }

  const rsvpCounts = rideIds.length
    ? await db
        .select({ rideId: schema.rideRsvps.rideId, n: count() })
        .from(schema.rideRsvps)
        .where(eq(schema.rideRsvps.status, "in"))
        .groupBy(schema.rideRsvps.rideId)
    : [];
  const ridersByRide = new Map(rsvpCounts.map((r) => [r.rideId, Number(r.n)]));

  // Resolve the hero for each card: a photo collage (thumbnails) when the ride
  // has photos, otherwise the static map preview.
  const heroByRide = new Map<
    string,
    { photos: string[]; extra: number } | { preview: string } | null
  >();
  await Promise.all(
    rides.map(async (ride) => {
      const all = photosByRide.get(ride.id) ?? [];
      if (all.length > 0) {
        const shown = all.slice(0, COLLAGE_MAX);
        const photos = await Promise.all(shown.map(resolvePhotoSrc));
        heroByRide.set(ride.id, { photos, extra: all.length - photos.length });
      } else {
        const preview = await findPreview(ride.id);
        heroByRide.set(ride.id, preview ? { preview } : null);
      }
    }),
  );

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
          const photoCount = (photosByRide.get(ride.id) ?? []).length;
          const riders = ridersByRide.get(ride.id) ?? 0;
          const hero = heroByRide.get(ride.id) ?? null;
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
              {hero && "photos" in hero && (
                <PhotoCollage photos={hero.photos} extra={hero.extra} />
              )}
              {hero && "preview" in hero && (
                <div className="relative aspect-[2/1] bg-cream-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero.preview} alt="" className="absolute inset-0 size-full object-cover" />
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
