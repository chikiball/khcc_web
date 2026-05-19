"use server";

import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function completeOnboarding(formData: FormData) {
  const user = await requireUser();

  const display_name = String(formData.get("display_name") ?? "").trim();
  const pace_group = String(formData.get("pace_group") ?? "").trim();
  const bike = String(formData.get("bike") ?? "").trim() || null;
  const strava_handle = String(formData.get("strava_handle") ?? "").trim() || null;
  const emergency_name = String(formData.get("emergency_name") ?? "").trim() || null;
  const emergency_phone = String(formData.get("emergency_phone") ?? "").trim() || null;

  if (!display_name) throw new Error("Display name is required.");
  if (!pace_group) throw new Error("Pick a pace group.");

  // Validate against the live ride_types catalogue — admin can add / rename
  // / disable codes at any time, so the old hardcoded A/B/C enum here was
  // rejecting any custom code.
  const validCodes = await db
    .select({ code: schema.rideTypes.code })
    .from(schema.rideTypes);
  if (!new Set(validCodes.map((r) => r.code)).has(pace_group)) {
    throw new Error("That pace group is no longer available — pick another.");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.users)
      .set({
        name: display_name,
        paceGroup: pace_group,
        bike,
        stravaHandle: strava_handle,
        onboardedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));

    await tx
      .insert(schema.usersPrivate)
      .values({
        userId: user.id,
        emergencyContactName: emergency_name,
        emergencyContactPhone: emergency_phone,
      })
      .onConflictDoUpdate({
        target: schema.usersPrivate.userId,
        set: {
          emergencyContactName: emergency_name,
          emergencyContactPhone: emergency_phone,
          updatedAt: new Date(),
        },
      });
  });

  revalidatePath("/rides");
  redirect("/pending");
}
