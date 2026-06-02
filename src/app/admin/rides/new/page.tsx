import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import type { RideTypeOption } from "@/lib/ride-types";
import { createRide } from "../actions";
import { requireRideManager } from "@/lib/auth-helpers";

export const metadata = { title: "New ride" };

type SearchParams = Promise<{ error?: string }>;

async function getLeaders(): Promise<LeaderOption[]> {
  return db.select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.role, ["leader", "organiser", "admin"]));
}

async function getRideTypes(): Promise<RideTypeOption[]> {
  return db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position));
}

export default async function NewRidePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const manager = await requireRideManager();
  const { error } = await searchParams;

  const [[managerProfile], leaders, rideTypes, libraryRoutes] = await Promise.all([
    db.select({ paceGroup: schema.users.paceGroup })
      .from(schema.users)
      .where(eq(schema.users.id, manager.id))
      .limit(1),
    getLeaders(),
    getRideTypes(),
    db.select({ id: schema.routeLibrary.id, name: schema.routeLibrary.name })
      .from(schema.routeLibrary)
      .orderBy(asc(schema.routeLibrary.name)),
  ]);

  const activeTypes = rideTypes.filter((t) => t.active);
  const creatorPace = managerProfile?.paceGroup ?? activeTypes[0]?.code ?? "B";
  const defaultPaceGroups = [{ pace_code: creatorPace, leader_id: manager.id, position: 0 }];

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">New ride</h1>
      <p className="text-sm text-ink-soft mt-1">Set the basics, hit save.</p>
      {error && (
        <div className="mt-4 rounded-2xl bg-flash-500/10 ring-1 ring-flash-500/40 px-4 py-3 text-sm text-flash-600">
          ⚠ {error}
        </div>
      )}
      <RideForm
        action={createRide}
        defaultPaceGroups={defaultPaceGroups}
        leaders={leaders}
        rideTypes={rideTypes}
        libraryRoutes={libraryRoutes}
        submitLabel="Create ride"
      />
    </main>
  );
}
