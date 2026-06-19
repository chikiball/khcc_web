"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { COLOR_KEYS } from "@/lib/ride-types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

const CODE_PATTERN = /^[A-Za-z0-9]{1,8}$/;

/**
 * Marker class for validation errors that should be surfaced inline on the
 * form rather than as a generic 500 page. Naked `throw new Error` produces an
 * unhelpful "Application error" page in production (Next.js scrubs the message)
 * — same pattern as src/app/admin/rides/actions.ts.
 */
class FormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormError";
  }
}

function parseInput(formData: FormData) {
  // Codes are stored as typed (trimmed only) — do NOT force-uppercase. Burkam's
  // catalogue uses lowercase word codes (`chill`, `pacy`); uppercasing here made
  // every update of those rows fail the immutable-code guard in updateRideType
  // ("CHILL" !== "chill") and crash with a generic 500.
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "coral");
  const positionRaw = formData.get("position");
  const position = positionRaw ? Number(positionRaw) : 0;
  const active = formData.get("active") === "on";

  if (!CODE_PATTERN.test(code)) {
    throw new FormError("Code must be 1–8 letters or digits.");
  }
  if (!name) throw new FormError("Name is required.");
  if (!COLOR_KEYS.includes(color as (typeof COLOR_KEYS)[number])) {
    throw new FormError("Invalid color.");
  }

  return { code, name, description, color, position, active };
}

export async function createRideType(formData: FormData) {
  await requireAdmin();

  let input: ReturnType<typeof parseInput>;
  try {
    input = parseInput(formData);
  } catch (err) {
    if (err instanceof FormError) {
      redirect(`/admin/types?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  await db.insert(schema.rideTypes).values(input);

  revalidatePath("/admin/types");
  revalidatePath("/");
  redirect("/admin/types?saved=1");
}

export async function updateRideType(code: string, formData: FormData) {
  await requireAdmin();

  let input: ReturnType<typeof parseInput>;
  try {
    input = parseInput(formData);
    // Code is the primary key — disallow renaming via this action so existing
    // rides + users keep their FK pointing somewhere valid. To "rename", admin
    // creates a new type and migrates rows by hand (rare).
    if (input.code !== code) {
      throw new FormError("Code cannot be changed once the type exists.");
    }
  } catch (err) {
    if (err instanceof FormError) {
      redirect(`/admin/types?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
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
    redirect(
      `/admin/types?error=${encodeURIComponent(
        "Cannot delete — ride pace groups or users still use this type. Mark it inactive instead.",
      )}`,
    );
  }

  await db.delete(schema.rideTypes).where(eq(schema.rideTypes.code, code));

  revalidatePath("/admin/types");
}
