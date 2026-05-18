"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { COLOR_KEYS } from "@/lib/ride-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

const CODE_PATTERN = /^[A-Za-z0-9]{1,8}$/;

function parseInput(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "coral");
  const positionRaw = formData.get("position");
  const position = positionRaw ? Number(positionRaw) : 0;
  const active = formData.get("active") === "on";

  if (!CODE_PATTERN.test(code)) {
    throw new Error("Code must be 1–8 letters or digits.");
  }
  if (!name) throw new Error("Name is required.");
  if (!COLOR_KEYS.includes(color as (typeof COLOR_KEYS)[number])) {
    throw new Error("Invalid color.");
  }

  return { code, name, description, color, position, active };
}

export async function createRideType(formData: FormData) {
  await requireAdmin();
  const input = parseInput(formData);

  await db.insert(schema.rideTypes).values(input);

  revalidatePath("/admin/types");
  revalidatePath("/");
  redirect("/admin/types?saved=1");
}

export async function updateRideType(code: string, formData: FormData) {
  await requireAdmin();
  const input = parseInput(formData);

  // Code is the primary key — disallow renaming via this action so existing
  // rides + users keep their FK pointing somewhere valid. To "rename", admin
  // creates a new type and migrates rows by hand (rare).
  if (input.code !== code) {
    throw new Error("Code cannot be changed once the type exists.");
  }

  await db
    .update(schema.rideTypes)
    .set({
      name: input.name,
      description: input.description,
      color: input.color,
      position: input.position,
      active: input.active,
    })
    .where(eq(schema.rideTypes.code, code));

  revalidatePath("/admin/types");
  revalidatePath("/");
  redirect("/admin/types?saved=1");
}

export async function deleteRideType(code: string) {
  await requireAdmin();

  // Refuse if any pace groups or users still reference this type.
  const [paceUse] = await db
    .select({ id: schema.ridePaceGroups.id })
    .from(schema.ridePaceGroups)
    .where(eq(schema.ridePaceGroups.paceCode, code))
    .limit(1);
  const [userUse] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.paceGroup, code))
    .limit(1);

  if (paceUse || userUse) {
    throw new Error(
      "Cannot delete — ride pace groups or users still use this type. Mark it inactive instead.",
    );
  }

  await db.delete(schema.rideTypes).where(eq(schema.rideTypes.code, code));

  revalidatePath("/admin/types");
}
