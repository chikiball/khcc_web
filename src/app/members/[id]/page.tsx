import Link from "next/link";
import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { colorClasses, type RideTypeOption } from "@/lib/ride-types";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

const ROLE_LABEL: Record<string, string> = {
  leader: "Ride leader",
  organiser: "Organiser",
  admin: "Admin",
};

export default async function MemberProfilePage({ params }: { params: Params }) {
  const { id } = await params;
  await requireApproved();

  // Approved-only. Hide-from-directory members are still reachable here —
  // the opt-out only suppresses listing on /members.
  const [member] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      image: schema.users.image,
      role: schema.users.role,
      paceGroup: schema.users.paceGroup,
      bike: schema.users.bike,
      stravaHandle: schema.users.stravaHandle,
      bio: schema.users.bio,
    })
    .from(schema.users)
    .where(and(eq(schema.users.id, id), eq(schema.users.status, "approved")))
    .limit(1);

  if (!member) notFound();

  const [rideType] = (await db
    .select()
    .from(schema.rideTypes)
    .where(eq(schema.rideTypes.code, member.paceGroup))
    .limit(1)) as RideTypeOption[];

  const tone = colorClasses(rideType?.color ?? "coral");
  const initial = (member.name ?? "?")[0]?.toUpperCase() ?? "?";
  const stravaUrl = member.stravaHandle
    ? `https://www.strava.com/athletes/${encodeURIComponent(member.stravaHandle.replace(/^@/, ""))}`
    : null;

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-2">
        <Link href="/members" className="text-sm text-ink-soft hover:text-ink">
          ← Members
        </Link>
      </header>

      <article className="max-w-md mx-auto px-5 pt-4 pb-12">
        <div className="flex items-start gap-4">
          {member.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={member.image}
              alt=""
              className="size-20 rounded-full object-cover ring-1 ring-maroon-200 shrink-0"
            />
          ) : (
            <span className="size-20 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center font-display font-bold text-3xl shrink-0">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-bold leading-tight break-words">
              {member.name ?? "Unnamed rider"}
            </h1>
            {ROLE_LABEL[member.role] && (
              <span className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-maroon-100 text-maroon-700">
                {ROLE_LABEL[member.role]}
              </span>
            )}
          </div>
        </div>

        <dl className="mt-6 space-y-4">
          <Row label="Pace group">
            <span className="inline-flex items-center gap-2">
              <span
                className={`hex-clip inline-flex items-center justify-center w-9 h-9 ring-1 font-display font-bold text-sm ${tone.bg} ${tone.text} ${tone.ring}`}
                title={rideType?.name}
              >
                {member.paceGroup}
              </span>
              {rideType?.name && (
                <span className="text-sm text-ink">{rideType.name}</span>
              )}
            </span>
          </Row>

          {member.bike && <Row label="Bike">{member.bike}</Row>}

          {member.stravaHandle && stravaUrl && (
            <Row label="Strava">
              <a
                href={stravaUrl}
                target="_blank"
                rel="noreferrer"
                className="text-coral-700 hover:text-coral-800 underline underline-offset-4 break-all"
              >
                @{member.stravaHandle.replace(/^@/, "")} ↗
              </a>
            </Row>
          )}

          {member.bio && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                About
              </dt>
              <dd className="mt-1 text-sm text-ink whitespace-pre-wrap leading-relaxed">
                {member.bio}
              </dd>
            </div>
          )}
        </dl>
      </article>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {label}
      </dt>
      <dd className="text-sm text-ink text-right min-w-0">{children}</dd>
    </div>
  );
}
