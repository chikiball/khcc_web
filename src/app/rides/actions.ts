"use server";

import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

export async function toggleRsvp(rideId: string, currentlyIn: boolean) {
  const user = await requireUser();

  if (currentlyIn) {
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
      .values({ rideId, userId: user.id, status: "in" })
      .onConflictDoUpdate({
        target: [schema.rideRsvps.rideId, schema.rideRsvps.userId],
        set: { status: "in", updatedAt: new Date() },
      });
  }

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
}
