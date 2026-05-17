"use server";

import { db, schema } from "@/db";
import { requireApproved } from "@/lib/auth-helpers";
import { processAvatar } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

const PACE = ["A", "B", "C"] as const;
type Pace = (typeof PACE)[number];

export async function updateProfile(formData: FormData) {
  const user = await requireApproved();

  const name = String(formData.get("name") ?? "").trim();
  const paceGroup = String(formData.get("pace_group") ?? "B") as Pace;
  const bike = String(formData.get("bike") ?? "").trim() || null;
  const stravaHandle = String(formData.get("strava_handle") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const emergencyName = String(formData.get("emergency_name") ?? "").trim() || null;
  const emergencyPhone = String(formData.get("emergency_phone") ?? "").trim() || null;

  if (!name) throw new Error("Display name is required.");
  if (!PACE.includes(paceGroup)) throw new Error("Pick a pace group.");

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
}
