import { canManageRides } from "@/lib/auth-helpers";
import { requireApproved } from "@/lib/auth-helpers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminMobileMenu } from "@/components/admin-mobile-menu";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Single chokepoint — every /admin/* route runs through this gate.
  // Non-managers get a 404 (we don't reveal admin URLs to members).
  // Approved-only too: a pending leader (rare, but possible in edge cases)
  // can't act on the queue until they're approved themselves.
  const user = await requireApproved();
  if (!canManageRides(user.role)) notFound();

  const isAdmin = user.role === "admin";
  const links: Array<{ href: string; label: string }> = [
    { href: "/admin/rides", label: "Rides" },
    ...(isAdmin
      ? [
          { href: "/admin/members", label: "Members" },
          { href: "/admin/types", label: "Types" },
          { href: "/admin/content", label: "Content" },
          { href: "/admin/gallery", label: "Gallery" },
          { href: "/admin/theme", label: "Theme" },
        ]
      : []),
    { href: "/rides", label: "← Back" },
  ];

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-maroon-200/40">
        <Link href="/admin/rides" className="font-display text-2xl font-bold tracking-tight">
          Burkam <span className="text-coral-600">·</span> admin
        </Link>

        {/* Inline nav on tablet/desktop */}
        <nav className="hidden sm:flex items-center gap-4 text-sm">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-ink-soft hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Hamburger dropdown on mobile — closes on outside tap or Escape */}
        <AdminMobileMenu links={links} />
      </header>
      {children}
    </div>
  );
}
