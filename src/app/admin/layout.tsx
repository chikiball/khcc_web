import { canManageRides } from "@/lib/auth-helpers";
import { requireApproved } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Single chokepoint — every /admin/* route runs through this gate.
  // Non-managers get a 404 (we don't reveal admin URLs to members).
  // Approved-only too: a pending leader (rare, but possible in edge cases)
  // can't act on the queue until they're approved themselves.
  const user = await requireApproved();
  if (!canManageRides(user.role)) notFound();

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-maroon-200/40">
        <Link href="/admin/rides" className="font-display text-2xl font-bold tracking-tight">
          KHCC <span className="text-coral-600">·</span> admin
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/admin/rides" className="text-ink-soft hover:text-ink">
            Rides
          </Link>
          {user.role === "admin" && (
            <Link href="/admin/members" className="text-ink-soft hover:text-ink">
              Members
            </Link>
          )}
          <Link href="/rides" className="text-ink-soft hover:text-ink">
            ← Back
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
