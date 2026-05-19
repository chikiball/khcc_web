"use server";

import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { processAvatar } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function updateProfile(formData: FormData) {
  const user = await requireApproved();

  const name = String(formData.get("name") ?? "").trim();
  const paceGroup = String(formData.get("pace_group") ?? "").trim();
  const bike = String(formData.get("bike") ?? "").trim() || null;
  const stravaHandle = String(formData.get("strava_handle") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const emergencyName = String(formData.get("emergency_name") ?? "").trim() || null;
  const emergencyPhone = String(formData.get("emergency_phone") ?? "").trim() || null;

  if (!name) throw new Error("Display name is required.");
  if (!paceGroup) throw new Error("Pick a pace group.");

  // Validate against the live ride_types catalogue, not a hardcoded
  // A/B/C enum — admins can add / rename / disable codes at any time.
  // Allow the user's current code even if deactivated (matches the form,
  // which still renders it as a selectable option until they pick a new one).
  const validCodes = await db
    .select({ code: schema.rideTypes.code })
    .from(schema.rideTypes);
  const allowed = new Set(validCodes.map((r) => r.code));
  if (!allowed.has(paceGroup)) {
    throw new Error("That pace group is no longer available — pick another.");
  }

  // Image is optional. An empty File (zero bytes) means "no new upload".
  let newImage: string | null = null;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    newImage = await processAvatar(avatar, user.id);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({
        name,
        paceGroup,
        bike,
        stravaHandle,
        bio,
        ...(newImage ? { image: newImage } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    await tx
      .insert(schema.usersPrivate)
      .values({
        userId: user.id,
        emergencyContactName: emergencyName,
        emergencyContactPhone: emergencyPhone,
      })
      .onConflictDoUpdate({
        target: schema.usersPrivate.userId,
        set: {
          emergencyContactName: emergencyName,
          emergencyContactPhone: emergencyPhone,
          updatedAt: new Date(),
        },
      });
  });

  revalidatePath("/profile");
  revalidatePath("/rides");
  // Redirect so the page fully remounts — the AvatarPicker's React state
  // resets to the freshly-saved image URL instead of clinging to the local
  // blob URL preview, and the user sees the actual server-side avatar.
  redirect("/profile?saved=1");
}
