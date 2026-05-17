import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Use in Server Components / Actions that require an authenticated user.
 * Redirects to /login if not signed in. Returns the session user with
 * `id`, `role`, `status`, `onboarded` populated from the JWT.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require an approved user (the bar for ALL member features). Pending
 * and rejected users are sent to /pending where they see status messaging.
 * Onboarding-incomplete users are sent through onboarding first.
 */
export async function requireApproved() {
  const user = await requireUser();
  if (!user.onboarded) redirect("/onboarding");
  if (user.status !== "approved") redirect("/pending");
  return user;
}

/**
 * Require admin role. Redirects to /rides if signed in but not admin.
 */
export async function requireAdmin() {
  const user = await requireApproved();
  if (user.role !== "admin") redirect("/rides");
  return user;
}

/**
 * Require leader / organiser / admin (anyone who can manage rides).
 * Returns 404 to non-managers (don't reveal admin URLs).
 */
export async function requireRideManager() {
  const user = await requireApproved();
  if (!canManageRides(user.role)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

/**
 * Roles that can create / edit / cancel rides.
 */
export function canManageRides(role: string) {
  return role === "leader" || role === "organiser" || role === "admin";
}
