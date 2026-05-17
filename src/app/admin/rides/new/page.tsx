import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";
import { RideForm, type LeaderOption } from "@/components/ride-form";
import { createRide } from "../actions";

export const metadata = { title: "New ride" };

async function getLeaders(): Promise<LeaderOption[]> {
  return db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(inArray(schema.users.role, ["leader", "organiser", "admin"]));
}

export default async function NewRidePage() {
  const leaders = await getLeaders();

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <h1 className="font-display text-3xl font-bold">New ride</h1>
      <p className="text-sm text-ink-soft mt-1">Chop chop. Set the basics, hit save.</p>
      <RideForm action={createRide} leaders={leaders} submitLabel="Create ride" />
    </main>
  );
}
