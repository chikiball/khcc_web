/**
 * Seed default Burkam ride types into a fresh database.
 *
 * Run after `npm run db:push` (which skips migration files). On real
 * deploys this is unnecessary — migration 0009_burkam_pace_seed.sql
 * does the same thing as part of the regular migrate flow.
 *
 *   docker exec burkam-web node node_modules/tsx/dist/cli.mjs scripts/seed-types.ts
 *   # or locally:
 *   npx tsx scripts/seed-types.ts
 *
 * Idempotent — uses ON CONFLICT DO NOTHING.
 */

import { db, schema } from "../src/db";
import { sql } from "drizzle-orm";

async function main() {
  await db
    .insert(schema.rideTypes)
    .values([
      {
        code: "chill",
        name: "Chill",
        description: "Easy weekend roll. ECP to Changi Village, no-drop, breakfast stop.",
        color: "sky",
        position: 1,
      },
      {
        code: "pacy",
        name: "Pacy",
        description: "A little quicker for the multi-pace days. Still friendly.",
        color: "flash",
        position: 2,
      },
    ])
    .onConflictDoNothing({ target: schema.rideTypes.code });

  // Disable any inherited KHCC A/B/C rows so the admin types page is clean.
  await db.execute(
    sql`UPDATE "ride_types" SET "active" = false WHERE "code" IN ('A', 'B', 'C')`,
  );

  console.log("✓ ride types seeded (chill + pacy)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
