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
 * Result shape for `addRiderToPace`. It's driven from a client component, so
 * it returns failures rather than throwing — see the note on
 * `PhotoActionState` below for why a throw there is so costly.
 */
export type AddRiderState = { ok: true } | { error: string };

/**
 * Manually add a rider to a pace group on behalf of someone who didn't RSVP
 * themselves. Manager-only (leader / organiser / admin) — role re-read from
 * DB, never trusted from the JWT. The added rider can still remove themselves
 * later via the normal RSVP toggle (same (ride_id, user_id) row).
 *
 * Upserts on (ride_id, user_id): if the target is already in another pace on
 * this ride, this moves them to the chosen pace (mirrors the self-switch).
 *
 * Allowed on `completed` rides on purpose. Recording who actually turned up is
 * a post-ride act, like the recap note and the photos — and auto-complete is
 * unconditional and distance-based, so reopening a finished ride to backfill an
 * attendee doesn't work: the next page view flips it straight back. Only
 * `cancelled` is closed to new riders. Members still can't self-RSVP after the
 * fact — the RSVP button is hidden on completed rides.
 */
export async function addRiderToPace(
  rideId: string,
  paceGroupId: string,
  userId: string,
): Promise<AddRiderState> {
  const actor = await requireApproved();

  const [actorRow] = await db
    .select({ role: schema.users.role })
    .from(schema.users)
    .where(eq(schema.users.id, actor.id))
    .limit(1);
  if (!actorRow || !canManageRides(actorRow.role)) {
    return { error: "Only ride managers can add riders." };
  }

  const [ride] = await db
    .select({ status: schema.rides.status })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) return { error: "Ride not found." };
  if (ride.status === "cancelled") {
    return { error: "This ride is cancelled." };
  }

  const [pace] = await db
    .select({ id: schema.ridePaceGroups.id, status: schema.ridePaceGroups.status })
    .from(schema.ridePaceGroups)
    .where(and(eq(schema.ridePaceGroups.id, paceGroupId), eq(schema.ridePaceGroups.rideId, rideId)))
    .limit(1);
  if (!pace) return { error: "Pace group not found." };
  if (pace.status === "cancelled") return { error: "That pace group is cancelled." };

  const [target] = await db
    .select({ id: schema.users.id, status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!target || target.status !== "approved") {
    return { error: "Rider must be an approved member." };
  }

  await db
    .insert(schema.rideRsvps)
    .values({ rideId, userId, paceGroupId, status: "in" })
    .onConflictDoUpdate({
      target: [schema.rideRsvps.rideId, schema.rideRsvps.userId],
      set: { paceGroupId, status: "in", updatedAt: new Date() },
    });

  revalidatePath("/rides");
  revalidatePath("/rides/past");
  revalidatePath(`/rides/${rideId}`);
  return { ok: true };
}

const PHOTOS_PER_UPLOADER_PER_RIDE = 3;

/**
 * Result shape for the recap photo actions. These are driven from a client
 * component, so they **return** failures instead of throwing: a throw out of
 * a server action passed to <form action> has no error boundary to catch it
 * and surfaces as "Application error: a client-side exception has occurred",
 * which tells the member nothing and loses their photo. Same reasoning as the
 * FormError pattern in src/app/admin/rides/actions.ts, different mechanism.
 */
export type PhotoActionState = { ok: true } | { error: string } | null;

/**
 * Upload a recap photo for a completed ride. Any approved member can post,
 * up to 3 photos per uploader per ride. Restricted to status=completed —
 * recap is for after-the-fact storytelling, not pre-ride coordination.
 */
export async function uploadRidePhoto(
  rideId: string,
  _prev: PhotoActionState,
  formData: FormData,
): Promise<PhotoActionState> {
  const user = await requireApproved();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Pick a photo to upload." };
  }

  const [ride] = await db
    .select({ status: schema.rides.status })
    .from(schema.rides)
    .where(eq(schema.rides.id, rideId))
    .limit(1);
  if (!ride) return { error: "Ride not found." };
  if (ride.status !== "completed") {
    return { error: "Photos can only be added to completed rides." };
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
    return { error: `You've already uploaded ${PHOTOS_PER_UPLOADER_PER_RIDE} photos for this ride.` };
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
    // Roll back the placeholder row so a failed resize/write leaves no
    // half-written photo behind (the /rides/past collage skips empty
    // imageUrl, but the detail grid would render a broken tile).
    await db.delete(schema.ridePhotos).where(eq(schema.ridePhotos.id, row.id));
    console.error("[ride photo] upload failed", err);
    // processRidePhoto's messages are written for members ("Image is too big",
    // "Could not read that image…"); anything else is ours, not theirs.
    return {
      error: err instanceof Error && err.message
        ? err.message
        : "Could not save that photo. Try again.",
    };
  }

  revalidatePath(`/rides/${rideId}`);
  revalidatePath("/rides/past");
  return { ok: true };
}

/**
 * Delete a ride photo. Allowed for the original uploader or any admin /
 * organiser / leader on the ride.
 */
export async function deleteRidePhoto(photoId: string): Promise<PhotoActionState> {
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
  if (!photo) return { ok: true }; // already gone — nothing to report

  const isUploader = photo.uploadedBy === user.id;
  const isManager = canManageRides(user.role);
  if (!isUploader && !isManager) {
    return { error: "You can only delete your own photos." };
  }

  await db.delete(schema.ridePhotos).where(eq(schema.ridePhotos.id, photoId));
  await deleteRidePhotoFiles(photoId);
  revalidatePath(`/rides/${photo.rideId}`);
  revalidatePath("/rides/past");
  return { ok: true };
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
