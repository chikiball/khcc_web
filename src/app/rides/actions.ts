"use server";

import { db, schema } from "@/db";
import { canManageRides, requireApproved, requireUser } from "@/lib/auth-helpers";
import { processRidePhoto, deleteRidePhotoFiles } from "@/lib/upload";
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

/**
 * Manually add a rider to a pace group on behalf of someone who didn't RSVP
 * themselves. Manager-only (leader / organiser / admin) — role re-read from
 * DB, never trusted from the JWT. The added rider can still remove themselves
 * later via the normal RSVP toggle (same (ride_id, user_id) row).
 *
 * Upserts on (ride_id, user_id): if the target is already in another pace on
 * this ride, this moves them to the chosen pace (mirrors the self-switch).
 */
export async function addRiderToPace(rideId: string, paceGroupId: string, userId: string) {
  const actor = await requireApproved();

  const [actorRow] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, actor.id))
    .limit(1);
  if (!actorRow || !canManageRides(actorRow.role)) {
    throw new Error("Only ride managers can add riders.");
  }

  const [ride] = await db
    .select({ status: schema.rides.status })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) throw new Error("Ride not found.");
  if (ride.status === "cancelled" || ride.status === "completed") {
    throw new Error("This ride is closed to new riders.");
  }

  const [pace] = await db
    .select({ id: schema.ridePaceGroups.id, status: schema.ridePaceGroups.status })
    .from(schema.ridePaceGroups)
    .where(and(eq(schema.ridePaceGroups.id, paceGroupId), eq(schema.ridePaceGroups.rideId, rideId)))
    .limit(1);
  if (!pace) throw new Error("Pace group not found.");
  if (pace.status === "cancelled") throw new Error("That pace group is cancelled.");

  const [target] = await db
    .select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target || target.status !== "approved") {
    throw new Error("Rider must be an approved member.");
  }

  await db
    .insert(schema.rideRsvps)
    .values({ rideId, userId, paceGroupId, status: "in" })
    .onConflictDoUpdate({
      target: [schema.rideRsvps.rideId, schema.rideRsvps.userId],
      set: { paceGroupId, status: "in", updatedAt: new Date() },
    });

  revalidatePath("/rides");
  revalidatePath(`/rides/${rideId}`);
}

const PHOTOS_PER_UPLOADER_PER_RIDE = 3;

/**
 * Upload a recap photo for a completed ride. Any approved member can post,
 * up to 3 photos per uploader per ride. Restricted to status=completed —
 * recap is for after-the-fact storytelling, not pre-ride coordination.
 */
export async function uploadRidePhoto(rideId: string, formData: FormData) {
  const user = await requireApproved();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick a photo to upload.");
  }

  const [ride] = await db
    .select({ status: schema.rides.status })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) throw new Error("Ride not found.");
  if (ride.status !== "completed") {
    throw new Error("Photos can only be added to completed rides.");
  }

  const existing = await db
    .select({ id: schema.ridePhotos.id })
    .from(schema.ridePhotos)
    .where(
      and(
        eq(schema.ridePhotos.rideId, rideId),
        eq(schema.ridePhotos.uploadedBy, user.id),
      ),
    );
  if (existing.length >= PHOTOS_PER_UPLOADER_PER_RIDE) {
    throw new Error(`You've already uploaded ${PHOTOS_PER_UPLOADER_PER_RIDE} photos for this ride.`);
  }

  const [row] = await db
    .insert(schema.ridePhotos)
    .values({ rideId, uploadedBy: user.id, imageUrl: "" })
    .returning({ id: schema.ridePhotos.id });

  try {
    const url = await processRidePhoto(file, row.id);
    await db
      .update(schema.ridePhotos)
      .set({ imageUrl: url })
      .where(eq(schema.ridePhotos.id, row.id));
  } catch (err) {
    await db.delete(schema.ridePhotos).where(eq(schema.ridePhotos.id, row.id));
    throw err;
  }

  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/rides/past");
}

/**
 * Delete a ride photo. Allowed for the original uploader or any admin /
 * organiser / leader on the ride.
 */
export async function deleteRidePhoto(photoId: string) {
  const user = await requireApproved();

  const [photo] = await db
    .select({
      id: schema.ridePhotos.id,
      rideId: schema.ridePhotos.rideId,
      uploadedBy: schema.ridePhotos.uploadedBy,
    })
    .from(schema.ridePhotos)
    .where(eq(schema.ridePhotos.id, photoId))
    .limit(1);
  if (!photo) return;

  const isUploader = photo.uploadedBy === user.id;
  const isManager = canManageRides(user.role);
  if (!isUploader && !isManager) {
    throw new Error("You can only delete your own photos.");
  }

  await db.delete(schema.ridePhotos).where(eq(schema.ridePhotos.id, photoId));
  await deleteRidePhotoFiles(photoId);
  revalidatePath(`/rides/${photo.rideId}`);
  revalidatePath("/rides/past");
}

/**
 * Save the leader recap for a completed ride. Allowed for any leader on
 * the ride (any pace) or admin / organiser. Empty body clears the recap.
 */
export async function saveRecap(rideId: string, formData: FormData) {
  const user = await requireApproved();
  const note = String(formData.get("recap_note") ?? "").trim();

  const [ride] = await db
    .select({ status: schema.rides.status })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) throw new Error("Ride not found.");
  if (ride.status !== "completed") {
    throw new Error("Recap can only be added to completed rides.");
  }

  const isManager = canManageRides(user.role);
  let allowed = isManager;
  if (!allowed) {
    const leaderRows = await db
      .select({ leaderId: schema.ridePaceGroups.leaderId })
      .from(schema.ridePaceGroups)
      .where(eq(schema.ridePaceGroups.rideId, rideId));
    allowed = leaderRows.some((r) => r.leaderId === user.id);
  }
  if (!allowed) throw new Error("Only ride leaders or admins can edit the recap.");

  await db
    .update(schema.rides)
    .set({
      recapNote: note || null,
      recapBy: note ? user.id : null,
      recapAt: note ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(schema.rides.id, rideId));

  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/rides/past");
}
