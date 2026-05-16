import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/**
 * Use in Server Components / Actions that require an authenticated user.
 * Redirects to /login if not signed in. Returns the session user with
 * `id`, `role`, `onboarded` populated from the JWT.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require admin role. Redirects to /rides if signed in but not admin.
 */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/rides");
  return user;
}

/**
 * Roles that can create / edit / cancel rides.
 */
export function canManageRides(role: string) {
  return role === "leader" || role === "organiser" || role === "admin";
}
