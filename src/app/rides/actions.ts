"use server";

import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

/**
 * RSVP to a specific pace group within a ride.
 *
 * - Same pace as current RSVP → cancel (toggle off)
 * - Different pace → switch (upsert updates pace_group_id)
 * - No current RSVP → new RSVP
 *
 * PK is (ride_id, user_id) so only one pace per rider per ride is
 * enforced at the DB level. The upsert handles the switch atomically.
 */
export async function toggleRsvp(
  rideId: string,
  paceGroupId: string,
  currentlyInThisPace: boolean,
) {
  const user = await requireUser();

  if (currentlyInThisPace) {
    await db
      .delete(schema.rideRsvps)
      .where(
        and(
          eq(schema.rideRsvps.rideId, rideId),
          eq(schema.rideRsvps.userId, user.id),
        ),
      );
  } else {
    await db
      .insert(schema.rideRsvps)
      .values({ rideId, userId: user.id, paceGroupId, status: "in" })
      .onConflictDoUpdate({
        target: [schema.rideRsvps.rideId, schema.rideRsvps.userId],
        set: { paceGroupId, status: "in", updatedAt: new Date() },
      });
  }

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
}
