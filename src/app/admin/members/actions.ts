"use server";

import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { sendEmail, emailTemplate } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://khcc.nandharu.uk";

export async function approveUser(userId: string) {
  const admin = await requireAdmin();

  const [target] = await db
    .update(schema.users)
    .set({
      status: "approved",
      approvedAt: new Date(),
      approvedBy: admin.id,
      rejectedReason: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning({ email: schema.users.email, name: schema.users.name });

  if (target?.email) {
    sendEmail({
      to: target.email,
      subject: "You're in — KHCC",
      html: emailTemplate({
        title: "Welcome to KHCC",
        body: `<p>Hi ${target.name?.split(" ")[0] ?? "rider"},</p>
               <p>Your KHCC application is approved. Sign in at <a href="${SITE_URL}">${SITE_URL}</a> to RSVP to rides.</p>
               <p>See you on the road. Chop chop.</p>`,
        ctaText: "Open KHCC",
        ctaUrl: SITE_URL,
      }),
    }).catch((err) => console.error("[approve email]", err.message));
  }

  revalidatePath("/admin/members");
}

/**
 * Reject a pending applicant OR remove an approved member.
 * Same DB transition (status='rejected'); email copy branches on the
 * user's previous state. If a rejected user later signs in again, the
 * Credentials authorize() callback auto-flips them back to pending.
 */
export async function rejectUser(userId: string, formData: FormData) {
  await requireAdmin();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) throw new Error("A reason is required.");

  const [previous] = await db
    .select({ status: schema.users.status })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const wasApproved = previous?.status === "approved";

  const [target] = await db
    .update(schema.users)
    .set({
      status: "rejected",
      approvedAt: null,
      approvedBy: null,
      rejectedReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning({ email: schema.users.email, name: schema.users.name });

  if (target?.email) {
    const subject = wasApproved ? "Your KHCC access" : "About your KHCC application";
    const headline = wasApproved
      ? "Your KHCC access has been removed"
      : "About your KHCC application";
    const lead = wasApproved
      ? "Your KHCC access has been removed by an admin."
      : "Thanks for your interest. We weren&rsquo;t able to approve your application at this time.";

    sendEmail({
      to: target.email,
      subject,
      html: emailTemplate({
        title: headline,
        body: `<p>Hi ${target.name?.split(" ")[0] ?? "there"},</p>
               <p>${lead}</p>
               <p><strong>Reason:</strong><br>${reason.replace(/\n/g, "<br>")}</p>
               <p>If you think this was a mistake, sign in again at <a href="${SITE_URL}">${SITE_URL}</a> and an admin will take another look.</p>`,
        ctaText: "Open KHCC",
        ctaUrl: SITE_URL,
      }),
    }).catch((err) => console.error("[reject email]", err.message));
  }

  revalidatePath("/admin/members");
}
