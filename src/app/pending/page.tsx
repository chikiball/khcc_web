import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { signOut } from "@/app/auth/actions";
import { ReapplyButton } from "@/components/reapply-button";
import { eq } from "drizzle-orm";

export const metadata = { title: "Awaiting approval" };
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await requireUser();

  // If they're approved and somehow landed here, bounce them to /rides.
  if (user.status === "approved") redirect(user.onboarded ? "/rides" : "/onboarding");
  // If they haven't onboarded yet, send them through onboarding first —
  // we only show pending/rejected messaging after they've given us a profile.
  if (!user.onboarded) redirect("/onboarding");

  // Pull rejection reason if any (it's not in the JWT — only fetched here).
  let rejectedReason: string | null = null;
  if (user.status === "rejected") {
    const [row] = await db
      .select({ rejectedReason: schema.users.rejectedReason })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1);
    rejectedReason = row?.rejectedReason ?? null;
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 bg-paper text-ink">
      <div className="w-full max-w-md">
        <span className="inline-block hex-clip bg-coral-400 text-cream-50 px-5 py-1.5 text-[10px] font-bold tracking-widest">
          KHCC
        </span>

        {user.status === "pending" ? (
          <>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight">
              Hold tight.
            </h1>
            <p className="mt-3 text-base text-ink-soft">
              Thanks {user.name?.split(" ")[0] ?? "rider"} — we&apos;ve got your
              profile. An admin will check you in soon. You&apos;ll get an email the
              moment it happens.
            </p>
            <p className="mt-4 text-sm text-ink-soft">
              Chop chop. Usually within a day.
            </p>
          </>
        ) : (
          <>
            <h1 className="mt-6 font-display text-3xl font-bold leading-tight">
              We weren&apos;t able to approve you.
            </h1>
            <p className="mt-3 text-base text-ink-soft">
              Sorry {user.name?.split(" ")[0] ?? "there"} — KHCC isn&apos;t the right
              fit for you right now.
            </p>
            {rejectedReason && (
              <div className="mt-4 rounded-2xl bg-maroon-100 ring-1 ring-maroon-200 p-4 text-sm">
                <p className="font-semibold text-maroon-800">Reason</p>
                <p className="text-ink mt-0.5 whitespace-pre-wrap">{rejectedReason}</p>
              </div>
            )}
            <p className="mt-4 text-sm text-ink-soft">
              If you think this was a mistake, reply to the email we sent —
              or request another review below.
            </p>

            <div className="mt-6">
              <ReapplyButton />
            </div>
          </>
        )}

        <form action={signOut} className="mt-8">
          <button className="text-sm text-ink-soft hover:text-ink underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
