"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function updateContentBlock(key: string, formData: FormData) {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title) throw new Error("Title is required.");
  if (!body) throw new Error("Body is required.");

  await db
    .update(schema.contentBlocks)
    .set({ title, body, updatedAt: new Date(), updatedBy: admin.id })
    .where(eq(schema.contentBlocks.key, key));

  revalidatePath("/");
  revalidatePath("/admin/content");
  redirect("/admin/content?saved=1");
}
