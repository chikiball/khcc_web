import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth-helpers";
import { TERMS_EFFECTIVE_DATE, TERMS_SECTIONS } from "@/lib/terms";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Member agreement" };

export default async function TermsPage() {
  const user = await requireUser();

  // If they've already accepted, send them along — nothing to do here.
  const [row] = await db
    .select({ acceptedTermsAt: schema.users.acceptedTermsAt })
    .from(schema.users)
    .where(eq(schema.users.id, user.id))
    .limit(1);

  if (row?.acceptedTermsAt) redirect("/rides");

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <span className="inline-block hex-clip bg-coral-400 text-cream-50 px-5 py-1.5 text-[10px] font-bold tracking-widest">
          KHCC
        </span>
        <h1 className="mt-6 font-display text-3xl font-bold leading-tight">
          Before we ride.
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Quick read — the rules of the club site, the data we keep, and the
          fact that road cycling is dangerous and you accept that. Have a
          look, then tick the box at the bottom to continue.
        </p>
        <p className="mt-1 text-xs text-ink-soft/70">
          Effective {TERMS_EFFECTIVE_DATE}
        </p>

        <article className="mt-8 space-y-6 rounded-2xl bg-white ring-1 ring-maroon-200/60 p-6 max-h-[60vh] overflow-y-auto text-sm leading-relaxed">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-base font-semibold text-ink">
                {section.heading}
              </h2>
              <div className="mt-2 space-y-2 text-ink">
                {section.body.map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </article>

        <AcceptForm />
      </div>
    </main>
  );
}
