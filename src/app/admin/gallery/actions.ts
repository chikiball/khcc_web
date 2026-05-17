"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { processGalleryPhoto } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function uploadGalleryPhoto(formData: FormData) {
  const admin = await requireAdmin();

  const file = formData.get("photo");
  const alt = String(formData.get("alt") ?? "").trim();

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick an image to upload.");
  }

  // Insert the row first to get an id, then process the file using that id
  // as the on-disk filename. Any sharp/IO failure rolls back via try/catch.
  const [row] = await db
    .insert(schema.galleryPhotos)
    .values({ imageUrl: "", alt: alt || "KHCC photo", uploadedBy: admin.id })
    .returning({ id: schema.galleryPhotos.id });

  try {
    const url = await processGalleryPhoto(file, row.id);
    await db
      .update(schema.galleryPhotos)
      .set({ imageUrl: url })
      .where(eq(schema.galleryPhotos.id, row.id));
  } catch (err) {
    // Best-effort cleanup of the empty placeholder row
    await db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, row.id));
    throw err;
  }

  revalidatePath("/");
  revalidatePath("/admin/gallery");
  redirect("/admin/gallery?saved=1");
}

export async function updateGalleryAlt(photoId: string, formData: FormData) {
  await requireAdmin();
  const alt = String(formData.get("alt") ?? "").trim() || "KHCC photo";

  await db
    .update(schema.galleryPhotos)
    .set({ alt })
    .where(eq(schema.galleryPhotos.id, photoId));

  revalidatePath("/");
  revalidatePath("/admin/gallery");
}

export async function deleteGalleryPhoto(photoId: string) {
  await requireAdmin();

  // Note: the on-disk file (under /uploads/gallery/) is left in place.
  // Cleaning up orphan files would need a periodic sweep; not worth it at
  // this scale (a few KB per orphan, days between manual deletions).
  await db.delete(schema.galleryPhotos).where(eq(schema.galleryPhotos.id, photoId));

  revalidatePath("/");
  revalidatePath("/admin/gallery");
}
