import { db, schema } from "@/db";
import { asc, eq, inArray } from "drizzle-orm";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import type { RideTypeOption } from "@/lib/ride-types";
import { createRide } from "../actions";
import { requireRideManager } from "@/lib/auth-helpers";

export const metadata = { title: "New ride" };

async function getLeaders(): Promise<LeaderOption[]> {
  return db.select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.role, ["leader", "organiser", "admin"]));
}

async function getRideTypes(): Promise<RideTypeOption[]> {
  return db.select().from(schema.rideTypes).orderBy(asc(schema.rideTypes.position));
}

export default async function NewRidePage() {
  const manager = await requireRideManager();

  const [[managerProfile], leaders, rideTypes] = await Promise.all([
    db.select({ paceGroup: schema.users.paceGroup })
      .from(schema.users)
      .where(eq(schema.users.id, manager.id))
      .limit(1),
    getLeaders(),
    getRideTypes(),
  ]);

  const activeTypes = rideTypes.filter((t) => t.active);
  const creatorPace = managerProfile?.paceGroup ?? activeTypes[0]?.code ?? "B";
  const defaultPaceGroups = [{ pace_code: creatorPace, leader_id: manager.id, position: 0 }];

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">New ride</h1>
      <p className="text-sm text-ink-soft mt-1">Set the basics, hit save.</p>
      <RideForm
        action={createRide}
        defaultPaceGroups={defaultPaceGroups}
        leaders={leaders}
        rideTypes={rideTypes}
        submitLabel="Create ride"
      />
    </main>
  );
}
