/**
 * Seed sample rides for local dev.
 *
 *   DATABASE_URL=postgres://... npx tsx scripts/seed.ts
 *
 * Idempotent: skips if rides already exist. Requires that ride_types is
 * already populated (run scripts/seed-types.ts first if you used db:push).
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

  // East Coast Park - Marina Barrage area (typical Burkam start)
  const ECP_LAT = "1.3010";
  const ECP_LNG = "103.8730";
  // Changi Village turnaround (bubur kampung stop)
  const CHANGI_LAT = "1.3893";
  const CHANGI_LNG = "103.9851";

  const inserted = await db
    .insert(schema.rides)
    .values([
      {
        title: "Saturday Bubur Run",
        startsAt: inDays(2, 6),
        startPointName: "East Coast Park (Marina Barrage)",
        startPointLat: ECP_LAT,
        startPointLng: ECP_LNG,
        distanceKm: "55",
        elevationM: 60,
        description:
          "ECP to Changi Village and back. No-drop, breakfast stop for bubur kampung at Changi Village hawker.",
      },
      {
        title: "Wednesday Wake-up",
        startsAt: inDays(5, 6),
        startPointName: "East Coast Park (Marina Barrage)",
        startPointLat: ECP_LAT,
        startPointLng: ECP_LNG,
        distanceKm: "30",
        elevationM: 30,
        description: "Short weekday spin. Be done by 8 and head to work.",
      },
      {
        title: "Sunday Mixed Pace",
        startsAt: inDays(6, 6),
        startPointName: "Changi Village",
        startPointLat: CHANGI_LAT,
        startPointLng: CHANGI_LNG,
        distanceKm: "65",
        elevationM: 80,
        description: "Two groups: chill out front, pacy chasing. Same start, same finish.",
      },
    ])
    .returning({ id: schema.rides.id, title: schema.rides.title });

  await db.insert(schema.ridePaceGroups).values([
    // Saturday: single chill
    { rideId: inserted[0].id, paceCode: "chill", position: 0 },
    // Wednesday: single chill
    { rideId: inserted[1].id, paceCode: "chill", position: 0 },
    // Sunday: chill + pacy
    { rideId: inserted[2].id, paceCode: "chill", position: 0 },
    { rideId: inserted[2].id, paceCode: "pacy", position: 1 },
  ]);

  console.log("✓ seeded 3 rides (2 single-pace, 1 multi-pace)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
