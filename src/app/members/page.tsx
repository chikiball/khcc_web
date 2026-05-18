import Link from "next/link";
import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { MemberCard } from "@/components/member-card";
import { and, asc, eq, ilike, or } from "drizzle-orm";
import type { RideTypeOption } from "@/lib/ride-types";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ q?: string; pace?: string }>;

export default async function MembersPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireApproved();
  const { q, pace } = await searchParams;
  const query = q?.trim() ?? "";
  const paceFilter = pace?.trim() ?? "";

  const conditions = [
    eq(schema.users.status, "approved"),
    eq(schema.users.hideFromDirectory, false),
  ];
  if (paceFilter) conditions.push(eq(schema.users.paceGroup, paceFilter));
  if (query) {
    const like = `%${query}%`;
    const nameOrBike = or(
      ilike(schema.users.name, like),
      ilike(schema.users.bike, like),
    );
    if (nameOrBike) conditions.push(nameOrBike);
  }

  const [members, rideTypes] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        image: schema.users.image,
        paceGroup: schema.users.paceGroup,
        bike: schema.users.bike,
      })
      .from(schema.users)
      .where(and(...conditions))
      .orderBy(asc(schema.users.name)),
    db
      .select()
      .from(schema.rideTypes)
      .where(eq(schema.rideTypes.active, true))
      .orderBy(asc(schema.rideTypes.position)) as Promise<RideTypeOption[]>,
  ]);

  const typeByCode = new Map(rideTypes.map((t) => [t.code, t]));
  const others = members.filter((m) => m.id !== me.id);
  const selfInList = members.find((m) => m.id === me.id);

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between">
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink">
          ← Rides
        </Link>
        <Link href="/profile" className="text-sm text-ink-soft hover:text-ink">
          Your profile →
        </Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto pb-16">
        <h1 className="font-display text-3xl font-bold mt-2">Members</h1>
        <p className="text-sm text-ink-soft mt-1">
          {others.length} {others.length === 1 ? "rider" : "riders"} besides you.
        </p>

        <form className="mt-5 flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search name or bike"
            className="flex-1 rounded-2xl bg-white ring-1 ring-maroon-200/60 px-4 py-2.5 text-sm placeholder:text-ink-soft/60 focus:ring-coral-400 focus:outline-none"
          />
          {paceFilter && <input type="hidden" name="pace" value={paceFilter} />}
          <button
            type="submit"
            className="rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-4 py-2.5 text-sm font-semibold"
          >
            Search
          </button>
        </form>

        <nav className="mt-4 flex flex-wrap gap-2 text-sm">
          <PacePill label="All paces" href={query ? `/members?q=${encodeURIComponent(query)}` : "/members"} active={!paceFilter} />
          {rideTypes.map((t) => (
            <PacePill
              key={t.code}
              label={`${t.code} · ${t.name}`}
              href={`/members?pace=${encodeURIComponent(t.code)}${query ? `&q=${encodeURIComponent(query)}` : ""}`}
              active={paceFilter === t.code}
            />
          ))}
        </nav>

        <ul className="mt-6 space-y-2">
          {others.length === 0 && (
            <li className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
              <p className="font-display text-lg text-ink">No riders found.</p>
              <p className="text-sm text-ink-soft mt-1">
                Try a different search or pace filter.
              </p>
            </li>
          )}
          {others.map((m) => (
            <li key={m.id}>
              <MemberCard member={m} rideType={typeByCode.get(m.paceGroup)} />
            </li>
          ))}
        </ul>

        {selfInList && (
          <>
            <h2 className="mt-8 text-xs font-semibold uppercase tracking-wider text-ink-soft">
              You
            </h2>
            <ul className="mt-2">
              <li>
                <MemberCard member={selfInList} rideType={typeByCode.get(selfInList.paceGroup)} />
              </li>
            </ul>
          </>
        )}
      </div>
    </main>
  );
}

function PacePill({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full ring-1 transition-colors ${
        active
          ? "bg-coral-500 text-cream-50 ring-coral-600"
          : "bg-white text-ink-soft ring-maroon-200 hover:bg-cream-100"
      }`}
    >
      {label}
    </Link>
  );
}
