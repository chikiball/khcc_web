"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseGpx, parseGpxCoords } from "@/lib/gpx";
import { saveLibraryGpx } from "@/lib/upload";
import { generateRoutePreview } from "@/lib/static-map";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

class FormError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormError";
  }
}

export async function uploadRouteToLibrary(formData: FormData) {
  const admin = await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const file = formData.get("gpx");

  try {
    if (!name) throw new FormError("Name is required.");
    if (!(file instanceof File) || file.size === 0) {
      throw new FormError("Pick a GPX file to upload.");
    }
    if (!file.name.toLowerCase().endsWith(".gpx")) {
      throw new FormError("Route file must end in .gpx.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new FormError("GPX file is too big (5 MB max).");
    }

    const text = await file.text();
    let parsed;
    try {
      parsed = parseGpx(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not parse GPX file.";
      throw new FormError(msg);
    }

    const [row] = await db
      .insert(schema.routeLibrary)
      .values({
        name,
        description,
        distanceKm: String(parsed.distanceKm),
        elevationM: parsed.elevationM,
        uploadedBy: admin.id,
      })
      .returning({ id: schema.routeLibrary.id });

    try {
      await saveLibraryGpx(file, row.id);
      try {
        await generateRoutePreview(parseGpxCoords(text), row.id, { subdir: "library" });
      } catch (err) {
        console.error("[library preview]", err instanceof Error ? err.message : err);
      }
    } catch (err) {
      await db.delete(schema.routeLibrary).where(eq(schema.routeLibrary.id, row.id));
      throw err;
    }
  } catch (err) {
    if (err instanceof FormError) {
      redirect(`/admin/routes?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  revalidatePath("/admin/routes");
  redirect("/admin/routes?saved=1");
}

export async function updateRouteLibraryEntry(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!name) {
    redirect(`/admin/routes?error=${encodeURIComponent("Name is required.")}`);
  }

  await db
    .update(schema.routeLibrary)
    .set({ name, description })
    .where(eq(schema.routeLibrary.id, id));

  revalidatePath("/admin/routes");
}

export async function deleteRouteLibraryEntry(id: string) {
  await requireAdmin();
  await db.delete(schema.routeLibrary).where(eq(schema.routeLibrary.id, id));
  revalidatePath("/admin/routes");
}
