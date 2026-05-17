import Link from "next/link";
import { notFound } from "next/navigation";
import { db, schema } from "@/db";
import { canManageRides, requireApproved } from "@/lib/auth-helpers";
import { RsvpButton } from "@/components/rsvp-button";
import { PaceBadge } from "@/components/ride-card";
import { and, eq } from "drizzle-orm";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export default async function RideDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const user = await requireApproved();

  const [ride] = await db
    .select()
    .from(schema.rides)
    .where(eq(schema.rides.id, id))
    .limit(1);

  if (!ride) notFound();

  const isManager = canManageRides(user.role);

  // Build the RSVP query. Managers also see private emergency-contact data
  // for riders on THIS ride; everyone else sees only public profile fields.
  // The users_private table is only joined inside this isManager branch —
  // that's the audit-grep-friendly chokepoint for emergency-contact access.
  const rsvps = isManager
    ? await db
        .select({
          userId: schema.rideRsvps.userId,
          name: schema.users.name,
          image: schema.users.image,
          createdAt: schema.rideRsvps.createdAt,
          emergencyName: schema.usersPrivate.emergencyContactName,
          emergencyPhone: schema.usersPrivate.emergencyContactPhone,
        })
        .from(schema.rideRsvps)
        .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
        .leftJoin(
          schema.usersPrivate,
          eq(schema.usersPrivate.userId, schema.rideRsvps.userId),
        )
        .where(
          and(eq(schema.rideRsvps.rideId, id), eq(schema.rideRsvps.status, "in")),
        )
        .orderBy(schema.rideRsvps.createdAt)
    : await db
        .select({
          userId: schema.rideRsvps.userId,
          name: schema.users.name,
          image: schema.users.image,
          createdAt: schema.rideRsvps.createdAt,
        })
        .from(schema.rideRsvps)
        .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
        .where(
          and(eq(schema.rideRsvps.rideId, id), eq(schema.rideRsvps.status, "in")),
        )
        .orderBy(schema.rideRsvps.createdAt);

  const isIn = rsvps.some((r) => r.userId === user.id);
  const start = new Date(ride.startsAt);
  const distance = ride.distanceKm != null ? Number(ride.distanceKm) : null;
  const isCancelled = ride.status === "cancelled";

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">
          ← All rides
        </Link>
        {isManager && (
          <Link
            href={`/admin/rides/${ride.id}/edit`}
            className="text-sm font-medium text-coral-700 hover:text-coral-800"
          >
            Edit ride →
          </Link>
        )}
      </header>

      <article className={`px-5 pt-2 ${isCancelled ? "pb-12" : "pb-32"} max-w-xl mx-auto`}>
        {isCancelled && (
          <div className="mb-6 rounded-2xl bg-maroon-100 ring-1 ring-maroon-300 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-maroon-800">
              Ride cancelled
            </p>
            {ride.cancelledReason && (
              <p className="text-sm text-ink mt-1">{ride.cancelledReason}</p>
            )}
            {ride.cancelledAt && (
              <p className="text-xs text-ink-soft mt-2">
                {new Date(ride.cancelledAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

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
            <p className="text-base text-ink-soft mt-2">{ride.startPointName}</p>
          </div>
          <PaceBadge pace={ride.paceGroup} />
        </div>

        <dl className="mt-6 grid grid-cols-3 gap-2 text-center">
          <Stat label="km" value={distance} />
          <Stat label="m up" value={ride.elevationM} />
          <Stat label="riders" value={rsvps.length} />
        </dl>

        {ride.description && (
          <p className="mt-6 text-base text-ink leading-relaxed whitespace-pre-wrap">
            {ride.description}
          </p>
        )}

        {ride.routeUrl && (
          <a
            href={ride.routeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-coral-700 hover:text-coral-800 underline underline-offset-4"
          >
            Route ↗
          </a>
        )}

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            {isManager ? "Riders (with emergency contacts)" : "Riding"} ({rsvps.length})
          </h2>

          {isManager ? (
            <ul className="mt-3 space-y-2">
              {rsvps.length === 0 && (
                <li className="text-sm text-ink-soft">No RSVPs yet.</li>
              )}
              {rsvps.map((r) => {
                const er = r as typeof r & {
                  emergencyName: string | null;
                  emergencyPhone: string | null;
                };
                return (
                  <li
                    key={r.userId}
                    className="rounded-xl bg-white ring-1 ring-maroon-200/60 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image}
                          alt=""
                          className="size-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="size-9 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center text-sm font-bold">
                          {(r.name ?? "?")[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="font-medium text-ink">{r.name ?? "Rider"}</span>
                    </div>
                    {(er.emergencyName || er.emergencyPhone) ? (
                      <p className="text-xs text-ink-soft mt-2 pl-12">
                        ICE: <span className="text-ink">{er.emergencyName ?? "—"}</span>
                        {er.emergencyPhone && (
                          <>
                            {" · "}
                            <a
                              href={`tel:${er.emergencyPhone}`}
                              className="text-coral-700 hover:underline"
                            >
                              {er.emergencyPhone}
                            </a>
                          </>
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-ink-soft/70 mt-2 pl-12 italic">
                        No emergency contact set
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {rsvps.length ? (
                rsvps.map((r) => (
                  <li
                    key={r.userId}
                    className="inline-flex items-center gap-2 rounded-full bg-white ring-1 ring-maroon-200/60 pl-1 pr-3 py-1"
                  >
                    {r.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image} alt="" className="size-7 rounded-full object-cover" />
                    ) : (
                      <span className="size-7 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center text-xs font-bold">
                        {(r.name ?? "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <span className="text-sm text-ink">{r.name ?? "Rider"}</span>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-soft">Be the first.</li>
              )}
            </ul>
          )}
        </section>
      </article>

      {!isCancelled && (
        <div className="fixed bottom-0 inset-x-0 bg-paper/95 backdrop-blur ring-1 ring-maroon-200/60 px-5 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <span className="text-sm text-ink-soft">
              {isIn ? "You're in." : "Tap to commit."}
            </span>
            <RsvpButton rideId={ride.id} isIn={isIn} size="lg" />
          </div>
        </div>
      )}
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
