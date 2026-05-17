import Link from "next/link";
import { db, schema } from "@/db";
import { requireAdmin } from "@/lib/auth-helpers";
import { ApproveButton, RejectButton } from "@/components/member-action-buttons";
import { desc, eq } from "drizzle-orm";

export const metadata = { title: "Members" };
export const dynamic = "force-dynamic";

const STATUS_LABELS = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
} as const;

type Status = keyof typeof STATUS_LABELS;
type SearchParams = Promise<{ status?: string }>;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Admin-only — leaders can manage rides but not members.
  await requireAdmin();
  const { status } = await searchParams;
  const tab: Status = (Object.keys(STATUS_LABELS) as Status[]).includes(status as Status)
    ? (status as Status)
    : "pending";

  const members = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      image: schema.users.image,
      role: schema.users.role,
      paceGroup: schema.users.paceGroup,
      createdAt: schema.users.createdAt,
      approvedAt: schema.users.approvedAt,
      rejectedReason: schema.users.rejectedReason,
    })
    .from(schema.users)
    .where(eq(schema.users.status, tab))
    .orderBy(desc(schema.users.createdAt));

  const counts = await Promise.all(
    (Object.keys(STATUS_LABELS) as Status[]).map(async (s) => {
      const rows = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.status, s));
      return [s, rows.length] as const;
    }),
  );
  const countsMap = Object.fromEntries(counts) as Record<Status, number>;

  return (
    <main className="px-5 py-8 max-w-3xl mx-auto">
      <h1 className="font-display text-3xl font-bold">Members</h1>

      <nav className="mt-6 flex gap-2 text-sm">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <Link
            key={s}
            href={`/admin/members?status=${s}`}
            className={`px-3 py-1.5 rounded-full ring-1 transition-colors ${
              tab === s
                ? "bg-coral-500 text-cream-50 ring-coral-600"
                : "bg-white text-ink-soft ring-maroon-200 hover:bg-cream-100"
            }`}
          >
            {STATUS_LABELS[s]} <span className="opacity-70">({countsMap[s]})</span>
          </Link>
        ))}
      </nav>

      <ul className="mt-6 space-y-2">
        {members.length === 0 && (
          <li className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-6 text-center text-sm text-ink-soft">
            Nobody {tab === "pending" ? "waiting" : tab === "rejected" ? "rejected" : "approved"} right now.
          </li>
        )}
        {members.map((m) => (
          <li key={m.id} className="rounded-2xl bg-white ring-1 ring-maroon-200/60 p-4">
            <div className="flex items-start gap-3">
              {m.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.image} alt="" className="size-10 rounded-full object-cover" />
              ) : (
                <span className="size-10 rounded-full bg-coral-200 text-coral-800 inline-flex items-center justify-center text-sm font-bold shrink-0">
                  {(m.name ?? "?")[0]?.toUpperCase()}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-display font-semibold text-ink">{m.name ?? "(unnamed)"}</p>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-cream-200 text-ink-soft">
                    {m.role}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-coral-200 text-coral-800">
                    Pace {m.paceGroup}
                  </span>
                </div>
                <p className="text-xs text-ink-soft mt-1 truncate">
                  {m.email ?? "no email"} · joined {new Date(m.createdAt).toLocaleDateString()}
                </p>
                {tab === "rejected" && m.rejectedReason && (
                  <p className="text-xs text-ink-soft mt-2 italic">{m.rejectedReason}</p>
                )}
              </div>
              {tab === "pending" && (
                <div className="flex gap-2 shrink-0 self-center">
                  <ApproveButton userId={m.id} />
                  <RejectButton userId={m.id} userName={m.name ?? "this rider"} variant="reject" />
                </div>
              )}
              {tab === "approved" && (
                <div className="flex gap-2 shrink-0 self-center">
                  <RejectButton userId={m.id} userName={m.name ?? "this rider"} variant="remove" />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
