"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { isThemeKey, THEME_BLOCK_KEY } from "@/lib/themes";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Set the live site theme. Admin-only. Persists as a content_blocks row
 * keyed "active_theme"; the body field holds the theme key string.
 * Revalidates the root layout so the new data-theme attribute ships on
 * the very next request.
 */
export async function setTheme(formData: FormData) {
  const admin = await requireAdmin();
  const key = String(formData.get("theme") ?? "").trim();
  if (!isThemeKey(key)) throw new Error("Unknown theme.");

  await db
    .insert(schema.contentBlocks)
    .values({
      key: THEME_BLOCK_KEY,
      title: "Active theme",
      body: key,
      updatedBy: admin.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.contentBlocks.key,
      set: { body: key, updatedBy: admin.id, updatedAt: new Date() },
    });

  // Root layout reads this on every request; force a fresh render of all
  // routes so the swap is immediate everywhere.
  revalidatePath("/", "layout");
  redirect("/admin/theme?saved=1");
}
