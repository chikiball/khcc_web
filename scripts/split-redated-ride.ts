/**
 * Repair a re-dated ride by splitting it back into two rows.
 *
 * Symptom this fixes: one ride row was reopened, given a later date and saved,
 * so it served two runnings of the same ride. Because `ride_rsvps`,
 * `ride_photos` and `recap_*` are keyed to the ride *row*, the first running's
 * riders and photos now show under the second running's date, and the first
 * date is gone from /rides/past entirely — there was only ever one row.
 *
 * What this does:
 *   1. inserts a NEW row for the later running (the row's current starts_at),
 *      cloning the plan + pace groups + GPX, standalone (series_id = null);
 *   2. moves every RSVP and photo created at/after --cutoff onto that new row
 *      (RSVPs are repointed to the clone's matching pace group);
 *   3. rewinds the ORIGINAL row's starts_at to --restore-date, so it becomes
 *      the earlier running again and keeps that running's riders/photos/recap.
 *
 * Photo files are keyed by photo id (`/uploads/ride-photos/<photoId>.jpg`), so
 * moving photo rows between rides needs no file moves. The GPX and its preview
 * are ride-id keyed, hence the copy in step 1.
 *
 * Dry-run by default — pass --apply to write. Run scripts/inspect-ride-history.ts
 * first to pick the cutoff and confirm there really is only one row.
 *
 * Limitation worth knowing: `ride_rsvps` is PK'd on (ride_id, user_id) and
 * `toggleRsvp` upserts, so a rider who attended BOTH runnings has one row with
 * the earlier `created_at` — the cutoff leaves them on the earlier ride only.
 * `inspect-ride-history.ts` prints `updated_at` alongside `created_at`; a row
 * created before the cutoff but updated after it is such a rider. Pass them to
 * --also to copy (not move) their RSVP onto the new row as well. A rider who
 * un-RSVP'd for the second running deleted the row outright — that one is gone
 * and can only be re-added by hand.
 *
 * Run via:
 *   npx tsx scripts/split-redated-ride.ts --ride <id> \
 *     --cutoff 2026-08-01T00:00:00Z --restore-date 2026-07-25T07:00:00Z
 *   docker exec burkam-web node node_modules/tsx/dist/cli.mjs \
 *     scripts/split-redated-ride.ts --ride <id> --cutoff ... --restore-date ... --apply
 */

import { db, schema } from "../src/db";
import { asc, eq, gte, inArray, and } from "drizzle-orm";
import { copyRideGpxToRide } from "../src/lib/upload";
import { generateRoutePreview } from "../src/lib/static-map";
import { parseGpxCoords } from "../src/lib/gpx";

const fmt = (d: Date | null) =>
  d ? d.toISOString().replace("T", " ").slice(0, 19) + "Z" : "—";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function requireDate(name: string): Date {
  const raw = arg(name);
  if (!raw) {
    console.error(`Missing --${name}`);
    process.exit(1);
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    console.error(`--${name} is not a valid date: ${raw}`);
    process.exit(1);
  }
  return d;
}

async function main() {
  const rideId = arg("ride");
  if (!rideId) {
    console.error(
      "Usage: split-redated-ride.ts --ride <id> --cutoff <ISO> --restore-date <ISO> " +
        "[--also <userId,userId>] [--move-recap] [--apply]",
    );
    process.exit(1);
  }
  const cutoff = requireDate("cutoff");
  const restoreDate = requireDate("restore-date");
  const moveRecap = process.argv.includes("--move-recap");
  const apply = process.argv.includes("--apply");
  const alsoUserIds = (arg("also") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const [ride] = await db
    .select()
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) {
    console.error(`No ride with id ${rideId}`);
    process.exit(1);
  }

  if (restoreDate >= ride.startsAt) {
    console.error(
      `--restore-date (${fmt(restoreDate)}) must be earlier than the row's current ` +
        `starts_at (${fmt(ride.startsAt)}) — the original running came first.`,
    );
    process.exit(1);
  }

  const paces = await db
    .select()
    .from(schema.ridePaceGroups)
    .where(eq(schema.ridePaceGroups.rideId, rideId))
    .orderBy(asc(schema.ridePaceGroups.position));

  const movingRsvps = await db
    .select({
      userId: schema.rideRsvps.userId,
      paceGroupId: schema.rideRsvps.paceGroupId,
      createdAt: schema.rideRsvps.createdAt,
      name: schema.users.name,
    })
    .from(schema.rideRsvps)
    .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
    .where(and(eq(schema.rideRsvps.rideId, rideId), gte(schema.rideRsvps.createdAt, cutoff)))
    .orderBy(asc(schema.rideRsvps.createdAt));

  const movingPhotos = await db
    .select({ id: schema.ridePhotos.id, createdAt: schema.ridePhotos.createdAt })
    .from(schema.ridePhotos)
    .where(and(eq(schema.ridePhotos.rideId, rideId), gte(schema.ridePhotos.createdAt, cutoff)))
    .orderBy(asc(schema.ridePhotos.createdAt));

  const paceById = new Map(paces.map((p) => [p.id, p.paceCode]));

  // Riders who attended both runnings: their single RSVP row stays with the
  // earlier ride and is *copied* onto the new one.
  const movingUserIds = new Set(movingRsvps.map((r) => r.userId));
  const alsoRsvps = alsoUserIds.length
    ? (
        await db
          .select({
            userId: schema.rideRsvps.userId,
            paceGroupId: schema.rideRsvps.paceGroupId,
            status: schema.rideRsvps.status,
            name: schema.users.name,
          })
          .from(schema.rideRsvps)
          .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
          .where(
            and(
              eq(schema.rideRsvps.rideId, rideId),
              inArray(schema.rideRsvps.userId, alsoUserIds),
            ),
          )
      ).filter((r) => !movingUserIds.has(r.userId))
    : [];

  for (const id of alsoUserIds) {
    if (!alsoRsvps.some((r) => r.userId === id)) {
      console.log(
        `⚠ --also ${id}: no pre-cutoff RSVP on this ride to copy (already moving, or never signed up).`,
      );
    }
  }

  console.log(`Ride "${ride.title}" (${rideId})`);
  console.log(`  starts_at now      ${fmt(ride.startsAt)}  status=${ride.status}`);
  console.log(`  cutoff             ${fmt(cutoff)}`);
  console.log();
  console.log(`Stays on this row, rewound to ${fmt(restoreDate)}:`);
  console.log(`  everything created before the cutoff`);
  if (ride.recapNote && !moveRecap) console.log(`  the recap note`);
  console.log();
  console.log(`Moves to a NEW row dated ${fmt(ride.startsAt)}:`);
  console.log(`  ${movingRsvps.length} RSVP(s):`);
  for (const r of movingRsvps) {
    console.log(
      `    ${fmt(r.createdAt)}  ${paceById.get(r.paceGroupId) ?? "?"}  ${r.name ?? r.userId}`,
    );
  }
  console.log(`  ${movingPhotos.length} photo(s):`);
  for (const p of movingPhotos) console.log(`    ${fmt(p.createdAt)}  ${p.id}`);
  if (alsoRsvps.length) {
    console.log(`  ${alsoRsvps.length} RSVP(s) copied (attended both runnings):`);
    for (const r of alsoRsvps) {
      console.log(`    ${paceById.get(r.paceGroupId) ?? "?"}  ${r.name ?? r.userId}`);
    }
  }
  if (ride.recapNote && moveRecap) console.log(`  the recap note (--move-recap)`);
  console.log(`  ${paces.length} pace group(s) cloned: ${paces.map((p) => p.paceCode).join(", ")}`);
  console.log();

  if (!movingRsvps.length && !movingPhotos.length && !alsoRsvps.length && !moveRecap) {
    console.log(
      "Nothing sits at or after the cutoff — check the cutoff against\n" +
        "scripts/inspect-ride-history.ts before applying.",
    );
  }

  if (!apply) {
    console.log("Dry run — nothing written. Re-run with --apply to commit.");
    return;
  }

  let newRideId = "";
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.rides)
      .values({
        title: ride.title,
        startsAt: ride.startsAt,
        startPointName: ride.startPointName,
        startPointLat: ride.startPointLat,
        startPointLng: ride.startPointLng,
        distanceKm: ride.distanceKm,
        elevationM: ride.elevationM,
        routeUrl: ride.routeUrl,
        description: ride.description,
        status: ride.status,
        // Standalone, like duplicateRide: a second live occurrence would
        // violate the one-occurrence-per-series invariant.
        seriesId: null,
        recapNote: moveRecap ? ride.recapNote : null,
        recapBy: moveRecap ? ride.recapBy : null,
        recapAt: moveRecap ? ride.recapAt : null,
      })
      .returning({ id: schema.rides.id });
    newRideId = created.id;

    // Clone pace groups so the moved RSVPs have somewhere to point.
    const clonedPaces = paces.length
      ? await tx
          .insert(schema.ridePaceGroups)
          .values(
            paces.map((p, i) => ({
              rideId: created.id,
              paceCode: p.paceCode,
              leaderId: p.leaderId,
              distanceKm: p.distanceKm,
              elevationM: p.elevationM,
              cap: p.cap,
              notes: p.notes,
              status: p.status,
              position: p.position ?? i,
            })),
          )
          .returning({ id: schema.ridePaceGroups.id, paceCode: schema.ridePaceGroups.paceCode })
      : [];
    const newPaceByCode = new Map(clonedPaces.map((p) => [p.paceCode, p.id]));

    for (const r of movingRsvps) {
      const code = paceById.get(r.paceGroupId);
      const destPace = code ? newPaceByCode.get(code) : undefined;
      if (!destPace) throw new Error(`No cloned pace group for code ${code ?? "?"}`);
      await tx
        .update(schema.rideRsvps)
        .set({ rideId: created.id, paceGroupId: destPace, updatedAt: new Date() })
        .where(
          and(eq(schema.rideRsvps.rideId, rideId), eq(schema.rideRsvps.userId, r.userId)),
        );
    }

    for (const p of movingPhotos) {
      await tx
        .update(schema.ridePhotos)
        .set({ rideId: created.id })
        .where(eq(schema.ridePhotos.id, p.id));
    }

    for (const r of alsoRsvps) {
      const code = paceById.get(r.paceGroupId);
      const destPace = code ? newPaceByCode.get(code) : undefined;
      if (!destPace) throw new Error(`No cloned pace group for code ${code ?? "?"}`);
      await tx.insert(schema.rideRsvps).values({
        rideId: created.id,
        userId: r.userId,
        paceGroupId: destPace,
        status: r.status,
      });
    }

    await tx
      .update(schema.rides)
      .set({
        startsAt: restoreDate,
        ...(moveRecap ? { recapNote: null, recapBy: null, recapAt: null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.rides.id, rideId));
  });

  // Route files, outside the transaction — best-effort, like every other
  // GPX/preview write in the app.
  const gpxText = await copyRideGpxToRide(rideId, newRideId);
  if (gpxText) {
    try {
      const coords = parseGpxCoords(gpxText);
      if (coords.length >= 2) await generateRoutePreview(coords, newRideId);
    } catch (err) {
      console.error("[split] preview generation failed", err);
    }
  }

  console.log(`Done.`);
  console.log(`  original row ${rideId} → ${fmt(restoreDate)}`);
  console.log(`  new row      ${newRideId} → ${fmt(ride.startsAt)}`);
  console.log(
    `\nCheck both at /rides/past, then re-run scripts/inspect-ride-history.ts to verify.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
