import Link from "next/link";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { canManageRides, requireApproved } from "@/lib/auth-helpers";
import { parseGpxCoords } from "@/lib/gpx";
import { getRideForecast, weatherIcon, WIND_THRESHOLD_KPH } from "@/lib/weather";
import { RideDetailMap } from "@/components/ride-detail-map";
import { RsvpButton } from "@/components/rsvp-button";
import { AddRiderControl } from "@/components/add-rider-control";
import { CopyRideButton } from "@/components/copy-ride-button";
import { PaceBadge } from "@/components/ride-card";
import { RecapEditor } from "@/components/recap-editor";
import { RidePhotoUploader, DeleteRidePhotoButton } from "@/components/ride-photo-uploader";
import { colorClasses } from "@/lib/ride-types";
import { buildRideShareText } from "@/lib/share";
import { maybeAutoCompleteRide } from "@/lib/series";
import { and, asc, desc, eq } from "drizzle-orm";

type Params = Promise<{ id: string }>;
export const dynamic = "force-dynamic";

async function loadGpxRoute(rideId: string) {
  const fp = path.join(process.cwd(), "public", "uploads", "routes", `${rideId}.gpx`);
  try {
    const s = await stat(fp);
    if (!s.isFile()) return null;
    const xml = await readFile(fp, "utf8");
    const coords = parseGpxCoords(xml);
    if (coords.length < 2) return null;
    return { coords, publicUrl: `/uploads/routes/${rideId}.gpx` };
  } catch { return null; }
}

function slugify(s: string) {
  return (s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "ride");
}

export default async function RideDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireApproved();

  const [ride] = await db.select().from(schema.rides).where(eq(schema.rides.id, id)).limit(1);
  if (!ride) notFound();

  // Lazy completion: if the ride is past its estimated end, flip status
  // before render so the recap surface unlocks without waiting on cron.
  if (
    await maybeAutoCompleteRide({
      id: ride.id,
      status: ride.status,
      startsAt: ride.startsAt,
      distanceKm: ride.distanceKm,
    })
  ) {
    ride.status = "completed";
  }

  const isManager = canManageRides(user.role);

  const [paceGroups, allRideTypes, gpx, forecast, seriesRow] = await Promise.all([
    db.select().from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, id))
      .orderBy(asc(schema.ridePaceGroups.position)),
    db.select().from(schema.rideTypes),
    loadGpxRoute(ride.id),
    ride.startPointLat && ride.startPointLng
      ? getRideForecast(Number(ride.startPointLat), Number(ride.startPointLng), ride.startsAt)
      : Promise.resolve(null),
    ride.seriesId
      ? db.select({ rule: schema.rideSeries.rule })
          .from(schema.rideSeries)
          .where(eq(schema.rideSeries.id, ride.seriesId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  const seriesRule = seriesRow[0]?.rule ?? null;

  const typeByCode = new Map(allRideTypes.map((t) => [t.code, t]));

  // All RSVPs for this ride
  const rsvps = await db.select({
    userId: schema.rideRsvps.userId,
    paceGroupId: schema.rideRsvps.paceGroupId,
    name: schema.users.name,
    image: schema.users.image,
    emergencyName: schema.usersPrivate.emergencyContactName,
    emergencyPhone: schema.usersPrivate.emergencyContactPhone,
  })
    .from(schema.rideRsvps)
    .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
    .leftJoin(schema.usersPrivate, eq(schema.usersPrivate.userId, schema.rideRsvps.userId))
    .where(and(eq(schema.rideRsvps.rideId, id), eq(schema.rideRsvps.status, "in")));

  // Group rsvps by pace group
  const rsvpsByPace = new Map<string, typeof rsvps>();
  for (const r of rsvps) {
    if (!rsvpsByPace.has(r.paceGroupId)) rsvpsByPace.set(r.paceGroupId, []);
    rsvpsByPace.get(r.paceGroupId)!.push(r);
  }

  // Which pace is the current user RSVP'd to?
  const userRsvp = rsvps.find((r) => r.userId === user.id);
  const userPaceGroupId = userRsvp?.paceGroupId ?? null;

  const start = new Date(ride.startsAt);
  const isCancelled = ride.status === "cancelled";
  const isCompleted = ride.status === "completed";
  const totalRiders = rsvps.length;

  // Managers can add riders on behalf of members who didn't RSVP themselves —
  // fetch the approved roster only when that control will actually render.
  const rideOpen = !isCancelled && !isCompleted;
  const approvedMembers = isManager && rideOpen
    ? await db
        .select({ id: schema.users.id, name: schema.users.name })
        .from(schema.users)
        .where(eq(schema.users.status, "approved"))
        .orderBy(asc(schema.users.name))
    : [];

  // Recap data — only relevant for completed rides
  const ridePhotos = isCompleted
    ? await db
        .select({
          id: schema.ridePhotos.id,
          imageUrl: schema.ridePhotos.imageUrl,
          uploadedBy: schema.ridePhotos.uploadedBy,
          uploaderName: schema.users.name,
        })
        .from(schema.ridePhotos)
        .leftJoin(schema.users, eq(schema.users.id, schema.ridePhotos.uploadedBy))
        .where(eq(schema.ridePhotos.rideId, id))
        .orderBy(desc(schema.ridePhotos.createdAt))
    : [];

  let recapAuthorName: string | null = null;
  if (isCompleted && ride.recapBy) {
    const [author] = await db
      .select({ name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, ride.recapBy))
      .limit(1);
    recapAuthorName = author?.name ?? null;
  }

  // Auth gates for recap editing & photo upload
  const isLeaderOnRide = paceGroups.some((pg) => pg.leaderId === user.id);
  const canEditRecap = isCompleted && (isManager || isLeaderOnRide);
  const userPhotoCount = ridePhotos.filter((p) => p.uploadedBy === user.id).length;
  const PHOTO_CAP = 3;
  const uploadsRemaining = Math.max(0, PHOTO_CAP - userPhotoCount);

  const shareText = buildRideShareText({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://burkam.nandharu.uk",
    rideId: ride.id,
    title: ride.title,
    startsAt: start,
    startPointName: ride.startPointName,
    distanceKm: ride.distanceKm != null ? Number(ride.distanceKm) : null,
    elevationM: ride.elevationM,
    isCancelled,
    paceGroups: paceGroups.map((pg) => ({
      code: pg.paceCode,
      name: typeByCode.get(pg.paceCode)?.name ?? pg.paceCode,
      status: pg.status,
      riders: (rsvpsByPace.get(pg.id) ?? []).map((r) => r.name ?? "Rider"),
    })),
  });

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">← All rides</Link>
        {isManager && (
          <Link href={`/admin/rides/${ride.id}/edit`} className="text-sm font-medium text-coral-700 hover:text-coral-800">Edit ride →</Link>
        )}
      </header>

      <article className="px-5 pt-2 pb-12 max-w-xl mx-auto">
        {isCancelled && (
          <div className="mb-6 rounded-2xl bg-maroon-100 ring-1 ring-maroon-300 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-maroon-800">Ride cancelled</p>
            {ride.cancelledReason && <p className="text-sm text-ink mt-1">{ride.cancelledReason}</p>}
          </div>
        )}

        {/* Ride header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-coral-600">
            {start.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          <h1 className="font-display text-3xl font-bold mt-1 leading-tight">{ride.title}</h1>
          <p className="text-base text-ink-soft mt-2">
            {ride.startPointName}
            {seriesRule && (
              <span className="ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-maroon-100 text-maroon-700 align-middle">
                {seriesRule === "biweekly" ? "Biweekly" : "Weekly"}
              </span>
            )}
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="km" value={ride.distanceKm != null ? Number(ride.distanceKm) : null} />
          <Stat label="m up" value={ride.elevationM} />
          <Stat label="riders" value={totalRiders} />
        </dl>

        {forecast && (() => {
          const fc = weatherIcon(forecast.weatherCode);
          const windy = forecast.windKph >= WIND_THRESHOLD_KPH;
          return (
            <div className="mt-4 rounded-2xl bg-cream-100 ring-1 ring-maroon-200/60 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-xl">{fc.icon}</span>
                <span className="font-semibold text-ink">
                  {fc.label} · {Math.round(forecast.temperatureC)}°
                </span>
                <span className={windy ? "text-flash-600 font-medium" : "text-ink-soft"}>
                  🌬 {Math.round(forecast.windKph)} km/h
                </span>
                <span className="text-ink-soft">
                  ☔ {forecast.precipChancePct}%
                </span>
                {forecast.sunriseLocal && (
                  <span className="text-ink-soft">☀ {forecast.sunriseLocal}</span>
                )}
                {forecast.sunsetLocal && (
                  <span className="text-ink-soft">🌙 {forecast.sunsetLocal}</span>
                )}
              </div>
            </div>
          );
        })()}

        {ride.description && (
          <p className="mt-6 text-base text-ink leading-relaxed whitespace-pre-wrap">{ride.description}</p>
        )}

        {(ride.routeUrl || gpx) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
            {ride.routeUrl && (
              <a href={ride.routeUrl} target="_blank" rel="noreferrer"
                className="text-coral-700 hover:text-coral-800 underline underline-offset-4">Route ↗</a>
            )}
            {gpx && (
              <a href={gpx.publicUrl} download={`${slugify(ride.title)}.gpx`}
                className="text-coral-700 hover:text-coral-800 underline underline-offset-4">Download GPX ↓</a>
            )}
          </div>
        )}

        <div className="mt-4">
          <CopyRideButton text={shareText} />
        </div>

        {ride.startPointLat && ride.startPointLng && (
          <div className="mt-6">
            <RideDetailMap lat={Number(ride.startPointLat)} lng={Number(ride.startPointLng)} routeCoords={gpx?.coords} />
          </div>
        )}

        {/* Recap — only on completed rides */}
        {isCompleted && (
          <section className="mt-8 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              Recap
            </h2>

            {ride.recapNote || canEditRecap ? (
              canEditRecap ? (
                <RecapEditor
                  rideId={ride.id}
                  initialNote={ride.recapNote ?? null}
                  authorName={recapAuthorName}
                  authorAt={ride.recapAt ?? null}
                />
              ) : (
                <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4">
                  <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">{ride.recapNote}</p>
                  {(recapAuthorName || ride.recapAt) && (
                    <p className="mt-2 text-xs text-ink-soft">
                      {recapAuthorName && `— ${recapAuthorName}`}
                      {ride.recapAt && (
                        <span className="opacity-60">
                          {" · "}
                          {ride.recapAt.toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            ) : (
              <p className="text-sm text-ink-soft italic">
                No recap yet — a ride leader can post one.
              </p>
            )}

            {/* Photo grid */}
            {ridePhotos.length > 0 && (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ridePhotos.map((photo) => {
                  const canDelete = photo.uploadedBy === user.id || isManager;
                  return (
                    <li
                      key={photo.id}
                      className="relative aspect-square rounded-xl bg-cream-100 overflow-hidden ring-1 ring-maroon-200/60"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.imageUrl}
                        alt={`Ride photo by ${photo.uploaderName ?? "rider"}`}
                        className="absolute inset-0 size-full object-cover"
                      />
                      {canDelete && <DeleteRidePhotoButton photoId={photo.id} />}
                    </li>
                  );
                })}
              </ul>
            )}

            <RidePhotoUploader rideId={ride.id} uploadsRemaining={uploadsRemaining} />
          </section>
        )}

        {/* Per-pace RSVP cards */}
        <section className="mt-8 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Pace groups ({paceGroups.length})
          </h2>

          {paceGroups.map((pg) => {
            const rideType = typeByCode.get(pg.paceCode);
            const tone = colorClasses(rideType?.color ?? "coral");
            const pgRsvps = rsvpsByPace.get(pg.id) ?? [];
            const isInThisPace = userPaceGroupId === pg.id;
            const isInAnyPace = userPaceGroupId !== null;
            const isCancelledPace = pg.status === "cancelled";
            const effectiveDist = pg.distanceKm ?? ride.distanceKm;
            const effectiveElev = pg.elevationM ?? ride.elevationM;
            const canAddRiders = isManager && rideOpen && !isCancelledPace;
            const eligibleMembers = canAddRiders
              ? approvedMembers.filter((m) => !pgRsvps.some((r) => r.userId === m.id))
              : [];

            return (
              <div key={pg.id}
                className={`rounded-2xl ring-1 overflow-hidden ${isCancelledPace ? "opacity-60 ring-maroon-200/40" : "ring-maroon-200/60"} ${isInThisPace ? "ring-2 ring-coral-400" : ""}`}>
                {/* Pace header */}
                <div className={`px-4 py-3 flex items-start gap-3 ${tone.bg}`}>
                  <PaceBadge code={pg.paceCode} rideType={rideType} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-display font-semibold text-lg ${tone.text}`}>
                        {rideType?.name ?? pg.paceCode}
                      </span>
                      {isCancelledPace && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-maroon-200 text-maroon-800">
                          Cancelled
                        </span>
                      )}
                      {isInThisPace && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-coral-500 text-cream-50">
                          Your pace
                        </span>
                      )}
                    </div>
                    {rideType?.description && (
                      <p className="text-xs mt-0.5 text-ink-soft">{rideType.description}</p>
                    )}
                    {pg.notes && <p className="text-xs mt-1 text-ink italic">{pg.notes}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-soft mt-1">
                      {pg.leaderId && (() => {
                        const leader = rsvps.find((r) => r.userId === pg.leaderId);
                        return leader ? <span>Led by {leader.name ?? "Leader"}</span> : null;
                      })()}
                      {effectiveDist && <span>{Number(effectiveDist)} km</span>}
                      {effectiveElev && <span>{effectiveElev} m ↑</span>}
                      {pg.cap && <span>{pgRsvps.length}/{pg.cap} spots</span>}
                    </div>
                  </div>

                  {!isCancelled && !isCancelledPace && !isCompleted && (
                    <RsvpButton rideId={ride.id} paceGroupId={pg.id} isInThisPace={isInThisPace} isInAnyPace={isInAnyPace} size="sm" />
                  )}
                </div>

                {/* Rider list */}
                {pgRsvps.length > 0 && (
                  <div className="px-4 py-3 bg-white border-t border-maroon-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">
                      {isManager ? `Riders + emergency contacts (${pgRsvps.length})` : `Riding (${pgRsvps.length})`}
                    </p>
                    <ul className={isManager ? "space-y-2" : "flex flex-wrap gap-2"}>
                      {pgRsvps.map((r) => (
                        <li key={r.userId}
                          className={isManager ? "rounded-xl bg-cream-50 ring-1 ring-maroon-200/60 px-3 py-2" : "inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-maroon-200/60 pl-1 pr-3 py-1"}>
                          <Link href={`/members/${r.userId}`} className="flex items-center gap-2 hover:opacity-80">
                            {r.image
                              ? <img src={r.image} alt="" className={isManager ? "size-8 rounded-full object-cover" : "size-7 rounded-full object-cover"} /> // eslint-disable-line @next/next/no-img-element
                              : <span className={`${isManager ? "size-8" : "size-7"} rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center text-xs font-bold`}>{(r.name ?? "?")[0]?.toUpperCase()}</span>}
                            <span className="text-sm text-ink">{r.name ?? "Rider"}</span>
                          </Link>
                          {isManager && (
                            <p className="text-xs text-ink-soft mt-1 pl-10">
                              {(r.emergencyName || r.emergencyPhone)
                                ? <>ICE: <span className="text-ink">{r.emergencyName ?? "—"}</span>{r.emergencyPhone && <> · <a href={`tel:${r.emergencyPhone}`} className="text-coral-700 hover:underline">{r.emergencyPhone}</a></>}</>
                                : <span className="opacity-60 italic">No emergency contact</span>}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Manager: add a rider who didn't RSVP themselves */}
                {canAddRiders && (
                  <div className="px-4 py-3 bg-white border-t border-maroon-100">
                    <AddRiderControl
                      rideId={ride.id}
                      paceGroupId={pg.id}
                      members={eligibleMembers}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </section>
      </article>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl bg-white ring-1 ring-maroon-200/60 py-3">
      <dd className="font-display text-2xl font-bold text-ink">{value ?? "—"}</dd>
      <dt className="text-xs uppercase tracking-wider text-ink-soft">{label}</dt>
    </div>
  );
}
