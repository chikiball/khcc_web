"use server";

import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

/**
 * Self-reapply: a rejected user clicks "Request another review" on /pending
 * and lands back in the admin's pending queue. Their rejected_reason is
 * cleared (a new admin decision overrides the old one).
 *
 * Guarded so non-rejected users can't accidentally (or maliciously) demote
 * themselves to pending. Admin can re-reject from the queue if needed.
 */
export async function requestReapproval() {
  const user = await requireUser();

  await db
    .update(schema.users)
    .set({
      status: "pending",
      rejectedReason: null,
      approvedAt: null,
      approvedBy: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.users.id, user.id),
        eq(schema.users.status, "rejected"),
      ),
    );

  revalidatePath("/pending");
  revalidatePath("/admin/members");
}
