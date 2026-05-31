import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db, schema } from "@/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    if (!user.onboarded) redirect("/onboarding");
    redirect(user.status === "approved" ? "/rides" : "/pending");
  }

  // Fetch admin-editable About block + gallery photos in parallel.
  // NOTE: the "achievements" / trophy-case block is intentionally hidden for
  // now — to revive it, switch this back to inArray(..., ["about", "achievements"])
  // and uncomment the matching JSX below.
  const [blocks, photos] = await Promise.all([
    db
      .select()
      .from(schema.contentBlocks)
      .where(eq(schema.contentBlocks.key, "about")),
    db
      .select()
      .from(schema.galleryPhotos)
      .orderBy(desc(schema.galleryPhotos.createdAt)),
  ]);
  const about = blocks.find((b) => b.key === "about");
  // const achievements = blocks.find((b) => b.key === "achievements");

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <section className="relative overflow-hidden">
        <div className="brush-divider absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
          <Image
            src="/icon-512.png"
            alt="Burkam"
            width={240}
            height={240}
            priority
            className="mx-auto block h-56 w-56 sm:h-64 sm:w-64 object-contain"
          />
          <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight text-ink leading-[0.95]">
            Bubur
            <br />
            <span className="text-brand-strong">Kampung.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-soft max-w-md mx-auto">
            Chill rides along East Coast & Changi. Pedal, bubur, repeat.
            Weekends and the occasional sunrise weekday.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-8 py-3 font-semibold shadow-md active:scale-[0.98] transition-transform"
            >
              I&apos;m in →
            </Link>
            <Link
              href="#about"
              className="inline-flex items-center justify-center rounded-2xl bg-transparent ring-1 ring-maroon-300 text-ink px-6 py-3 font-semibold hover:bg-cream-100"
            >
              {about?.title ?? "What is Burkam?"}
            </Link>
            {/* Trophy case button — hidden for now. Restore when ready.
            <Link
              href="#achievements"
              className="inline-flex items-center justify-center rounded-2xl bg-transparent ring-1 ring-maroon-300 text-ink px-6 py-3 font-semibold hover:bg-cream-100"
            >
              {achievements?.title ?? "Achievements"}
            </Link>
            */}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto">
        <div className="flex gap-3 px-6 pb-8 snap-x snap-mandatory">
          {photos.map((photo, i) => (
            <div
              key={photo.id}
              className="relative shrink-0 w-[78vw] sm:w-72 aspect-square rounded-2xl overflow-hidden snap-start ring-1 ring-maroon-200"
            >
              <Image
                src={photo.imageUrl}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 78vw, 288px"
                className="object-cover"
                priority={i === 0}
                unoptimized={photo.imageUrl.startsWith("/uploads/")}
              />
            </div>
          ))}
        </div>
      </section>

      {about && <ContentSection id="about" block={about} />}
      {/* Trophy case section — hidden for now. Restore when ready.
      {achievements && <ContentSection id="achievements" block={achievements} />}
      */}

      <footer className="border-t border-maroon-200/40 py-8 text-center text-xs text-ink-soft/70">
        Burkam · Bubur Kampung Cycling
      </footer>
    </main>
  );
}

function ContentSection({
  id,
  block,
}: {
  id: string;
  block: { title: string; body: string };
}) {
  return (
    <section id={id} className="max-w-2xl mx-auto px-6 py-16">
      <h2 className="font-display text-3xl font-bold text-ink">{block.title}</h2>
      <div className="mt-6 text-ink-soft text-base leading-relaxed whitespace-pre-wrap">
        {block.body}
      </div>
    </section>
  );
}
