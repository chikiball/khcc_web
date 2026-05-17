import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { db, schema } from "@/db";
import { inArray } from "drizzle-orm";

const galleryPhotos = [
  { src: "/gallery/01-new-kit.jpg", alt: "KHCC new kit ride" },
  { src: "/gallery/02-comme-femmes.jpg", alt: "Comme Femmes Thursday ride" },
  { src: "/gallery/03-bunch.jpg", alt: "Bunch on the bridge at dawn" },
  { src: "/gallery/04-skinsuit.jpg", alt: "KHCC kit portrait" },
  { src: "/gallery/05-tri-factor.jpg", alt: "Tri-Factor celebratory ride" },
  { src: "/gallery/06-tour-de-batam.jpg", alt: "Tour de Batam 2024" },
];

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) {
    if (!user.onboarded) redirect("/onboarding");
    redirect(user.status === "approved" ? "/rides" : "/pending");
  }

  // Fetch admin-editable content blocks. Migration seeds default copy
  // for "about" and "achievements" so the page renders from day one.
  const blocks = await db
    .select()
    .from(schema.contentBlocks)
    .where(inArray(schema.contentBlocks.key, ["about", "achievements"]));
  const about = blocks.find((b) => b.key === "about");
  const achievements = blocks.find((b) => b.key === "achievements");

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <section className="relative overflow-hidden">
        <div className="brush-divider absolute inset-0 opacity-60" aria-hidden="true" />
        <div className="relative max-w-2xl mx-auto px-6 pt-20 pb-16 text-center">
          <span className="inline-block hex-clip bg-coral-400 text-cream-50 px-6 py-2 text-xs font-bold tracking-widest">
            KHCC
          </span>
          <h1 className="mt-6 font-display text-5xl sm:text-6xl font-bold tracking-tight text-ink leading-[0.95]">
            Knock House
            <br />
            <span className="text-brand-strong">Chop Chop.</span>
          </h1>
          <p className="mt-6 text-lg text-ink-soft max-w-md mx-auto">
            Fast-pace road cycling. Show up, ride hard, coffee, go home. No
            three-paragraph WhatsApp messages.
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
              {about?.title ?? "What is KHCC?"}
            </Link>
            <Link
              href="#achievements"
              className="inline-flex items-center justify-center rounded-2xl bg-transparent ring-1 ring-maroon-300 text-ink px-6 py-3 font-semibold hover:bg-cream-100"
            >
              {achievements?.title ?? "Achievements"}
            </Link>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto">
        <div className="flex gap-3 px-6 pb-8 snap-x snap-mandatory">
          {galleryPhotos.map((photo, i) => (
            <div
              key={photo.src}
              className="relative shrink-0 w-[78vw] sm:w-72 aspect-square rounded-2xl overflow-hidden snap-start ring-1 ring-maroon-200"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="(max-width: 640px) 78vw, 288px"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
      </section>

      {about && <ContentSection id="about" block={about} />}
      {achievements && <ContentSection id="achievements" block={achievements} />}

      <footer className="border-t border-maroon-200/40 py-8 text-center text-xs text-ink-soft/70">
        Knock House Chop Chop · Cycling Club
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
