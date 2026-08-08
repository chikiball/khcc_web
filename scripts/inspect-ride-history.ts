/**
 * Read-only. Dump every ride whose title matches a substring, plus the
 * created_at of each RSVP and photo attached to it.
 *
 * Use this when a past ride's riders/photos look like they belong to a
 * different date: `ride_rsvps`, `ride_photos` and `recap_*` hang off the ride
 * *row*, so a row that was re-dated (reopen → edit date → save) carries the
 * previous running's data under the new date, and the old date disappears from
 * /rides/past because there was never a second row. The timestamps below are
 * what tells the two runnings apart, and the cutoff you feed to
 * split-redated-ride.ts.
 *
 * Run via:
 *   npx tsx scripts/inspect-ride-history.ts "Ngopi"
 *   docker exec burkam-web node node_modules/tsx/dist/cli.mjs scripts/inspect-ride-history.ts "Ngopi"
 */

import { db, schema } from "../src/db";
import { asc, eq, ilike } from "drizzle-orm";

const fmt = (d: Date | null) =>
  d ? d.toISOString().replace("T", " ").slice(0, 19) + "Z" : "—";

async function main() {
  const needle = process.argv[2];
  if (!needle) {
    console.error('Usage: inspect-ride-history.ts "<title substring>"');
    process.exit(1);
  }

  const rides = await db
    .select()
    .from(schema.rides)
    .where(ilike(schema.rides.title, `%${needle}%`))
    .orderBy(asc(schema.rides.startsAt));

  if (!rides.length) {
    console.log(`No rides matching "${needle}".`);
    return;
  }

  console.log(`${rides.length} ride row(s) matching "${needle}":\n`);

  for (const ride of rides) {
    console.log("─".repeat(72));
    console.log(`id          ${ride.id}`);
    console.log(`title       ${ride.title}`);
    console.log(`starts_at   ${fmt(ride.startsAt)}`);
    console.log(`status      ${ride.status}`);
    console.log(`series_id   ${ride.seriesId ?? "— (one-off)"}`);
    console.log(`created_at  ${fmt(ride.createdAt)}`);
    console.log(`updated_at  ${fmt(ride.updatedAt)}`);
    console.log(`recap_at    ${fmt(ride.recapAt)}`);
    if (ride.recapNote) {
      console.log(`recap_note  ${ride.recapNote.slice(0, 120).replace(/\s+/g, " ")}`);
    }

    // A row whose created_at is far older than its starts_at was almost
    // certainly re-dated forward rather than created for that date.
    if (ride.createdAt && ride.startsAt.getTime() - ride.createdAt.getTime() > 21 * 864e5) {
      console.log(
        `⚠ starts_at is ${Math.round(
          (ride.startsAt.getTime() - ride.createdAt.getTime()) / 864e5,
        )} days after this row was created — looks re-dated.`,
      );
    }

    const rsvps = await db
      .select({
        userId: schema.rideRsvps.userId,
        name: schema.users.name,
        status: schema.rideRsvps.status,
        paceCode: schema.ridePaceGroups.paceCode,
        createdAt: schema.rideRsvps.createdAt,
        updatedAt: schema.rideRsvps.updatedAt,
      })
      .from(schema.rideRsvps)
      .innerJoin(schema.users, eq(schema.users.id, schema.rideRsvps.userId))
      .innerJoin(
        schema.ridePaceGroups,
        eq(schema.ridePaceGroups.id, schema.rideRsvps.paceGroupId),
      )
      .where(eq(schema.rideRsvps.rideId, ride.id))
      .orderBy(asc(schema.rideRsvps.createdAt));

    console.log(`\nRSVPs (${rsvps.length}) — signed up at:`);
    for (const r of rsvps) {
      console.log(
        `  ${fmt(r.createdAt)}  upd ${fmt(r.updatedAt)}  ${r.status.padEnd(5)} ${(
          r.paceCode ?? "?"
        ).padEnd(6)} ${r.name ?? r.userId}`,
      );
    }

    const photos = await db
      .select({
        id: schema.ridePhotos.id,
        uploaderName: schema.users.name,
        createdAt: schema.ridePhotos.createdAt,
      })
      .from(schema.ridePhotos)
      .leftJoin(schema.users, eq(schema.users.id, schema.ridePhotos.uploadedBy))
      .where(eq(schema.ridePhotos.rideId, ride.id))
      .orderBy(asc(schema.ridePhotos.createdAt));

    console.log(`\nPhotos (${photos.length}) — uploaded at:`);
    for (const p of photos) {
      console.log(`  ${fmt(p.createdAt)}  ${p.id}  by ${p.uploaderName ?? "—"}`);
    }
    console.log();
  }

  console.log("─".repeat(72));
  console.log(
    "If one row holds RSVPs/photos from two clearly separate dates, that row was\n" +
      "re-dated. Repair it with:\n" +
      "  scripts/split-redated-ride.ts --ride <id> --cutoff <ISO> --restore-date <ISO>",
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
