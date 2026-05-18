/**
 * Seed sample rides for local dev.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/seed.ts
 *
 * Idempotent: skips if rides already exist.
 */

import { db, schema } from "../src/db";
import { count } from "drizzle-orm";

async function main() {
  const [{ value: existing }] = await db
    .select({ value: count() })
    .from(schema.rides);

  if (existing > 0) {
    console.log(`rides table already has ${existing} row(s) — skipping seed.`);
    process.exit(0);
  }

  const now = new Date();
  const inDays = (n: number, hour = 6) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  // Insert ride shells (no pace_group, leader_id or cap on rides any more)
  const inserted = await db.insert(schema.rides).values([
    {
      title: "Saturday Bunch — East Coast",
      startsAt: inDays(2, 5),
      startPointName: "Marina Barrage",
      distanceKm: "65",
      elevationM: 180,
      routeUrl: "https://www.strava.com/routes/example",
      description: "Steady B-pace loop. Coffee at the usual spot after.",
    },
    {
      title: "Hambalang Hill Repeats",
      startsAt: inDays(5, 6),
      startPointName: "Sentul Circuit",
      distanceKm: "80",
      elevationM: 1200,
      routeUrl: "https://www.strava.com/routes/example",
      description: "4× hill repeats. Bring the climbing legs.",
    },
    {
      title: "Sunday Easy Roll",
      startsAt: inDays(6, 6),
      startPointName: "Knock House",
      distanceKm: "40",
      elevationM: 90,
      description: "No-drop. New riders welcome.",
    },
  ]).returning({ id: schema.rides.id, title: schema.rides.title });

  // Add pace groups for each ride
  await db.insert(schema.ridePaceGroups).values([
    // Saturday Bunch: A + B + C
    { rideId: inserted[0].id, paceCode: "A", notes: "Fast loop, extra hill detour.", position: 0 },
    { rideId: inserted[0].id, paceCode: "B", position: 1 },
    { rideId: inserted[0].id, paceCode: "C", notes: "No-drop, turn back at 30km.", position: 2 },
    // Hambalang: A only
    { rideId: inserted[1].id, paceCode: "A", position: 0 },
    // Sunday roll: C only
    { rideId: inserted[2].id, paceCode: "C", position: 0 },
  ]);

  console.log("✓ seeded 3 rides with pace groups");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
