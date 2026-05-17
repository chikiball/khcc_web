import { requireRideManager } from "@/lib/auth-helpers";
import Link from "next/link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Single chokepoint — every /admin/* route runs through this gate.
  // Non-managers get a 404 (we don't reveal admin URLs to members).
  await requireRideManager();

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-maroon-200/40">
        <Link href="/admin/rides" className="font-display text-2xl font-bold tracking-tight">
          KHCC <span className="text-coral-600">·</span> admin
        </Link>
        <Link href="/rides" className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">
          ← Back to rides
        </Link>
      </header>
      {children}
    </div>
  );
}
