"use server";

import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

/**
 * Mark the current user's terms as accepted. Idempotent — re-accepting
 * just refreshes the timestamp, which we use as the "version accepted at"
 * marker if we ever need to re-prompt after a material policy change.
 */
export async function acceptTerms() {
  const user = await requireUser();

  await db
    .update(schema.users)
    .set({ acceptedTermsAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.users.id, user.id));

  // Onboarding picks up where new members go next; the /onboarding page
  // self-redirects to /rides for users who already finished it (existing
  // approved members re-accepting after a future policy change), so this
  // single redirect target works for everyone.
  redirect("/onboarding");
}
