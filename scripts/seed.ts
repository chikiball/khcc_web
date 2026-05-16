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

  await db.insert(schema.rides).values([
    {
      title: "Saturday Bunch — East Coast",
      startsAt: inDays(2, 5),
      startPointName: "Marina Barrage",
      distanceKm: "65",
      elevationM: 180,
      paceGroup: "B",
      routeUrl: "https://www.strava.com/routes/example",
      description: "Steady B-pace loop. Coffee at the usual spot after.",
    },
    {
      title: "Hambalang Hill Repeats",
      startsAt: inDays(5, 6),
      startPointName: "Sentul Circuit",
      distanceKm: "80",
      elevationM: 1200,
      paceGroup: "A",
      routeUrl: "https://www.strava.com/routes/example",
      description: "4× hill repeats. Bring the climbing legs.",
    },
    {
      title: "Sunday Easy Roll",
      startsAt: inDays(6, 6),
      startPointName: "Knock House",
      distanceKm: "40",
      elevationM: 90,
      paceGroup: "C",
      description: "No-drop. New riders welcome.",
    },
  ]);

  console.log("✓ seeded 3 rides");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
