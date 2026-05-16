import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";

const galleryPhotos = [
  { src: "/gallery/01-new-kit.jpg", alt: "KHCC new kit ride" },
  { src: "/gallery/02-comme-femmes.jpg", alt: "Comme Femmes Thursday ride" },
  { src: "/gallery/03-bunch.jpg", alt: "Bunch on the bridge at dawn" },
  { src: "/gallery/04-skinsuit.jpg", alt: "KHCC kit portrait" },
  { src: "/gallery/05-tri-factor.jpg", alt: "Tri-Factor celebratory ride" },
  { src: "/gallery/06-tour-de-batam.jpg", alt: "Tour de Batam 2024" },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.onboarded ? "/rides" : "/onboarding");

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
              href="#what"
              className="inline-flex items-center justify-center rounded-2xl bg-transparent ring-1 ring-maroon-300 text-ink px-8 py-3 font-semibold hover:bg-cream-100"
            >
              What is KHCC?
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

      <section id="what" className="max-w-2xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-bold text-ink">What it is.</h2>
        <div className="mt-6 space-y-4 text-ink-soft text-base leading-relaxed">
          <p>
            <strong className="text-ink">KHCC</strong> — Knock House Chop Chop —
            is a road cycling club. We post rides, you tap In, we ride, we go
            home. Chop chop.
          </p>
          <p>
            Three pace groups so nobody gets dropped on the wrong day:{" "}
            <span className="font-semibold text-ink">A</span> for the climbers,{" "}
            <span className="font-semibold text-ink">B</span> for the steady
            bunch, <span className="font-semibold text-ink">C</span> for the
            no-drop friendly roll.
          </p>
          <p>
            This app replaces the WhatsApp scroll: see the next ride, see who&apos;s
            in, tap In yourself. That&apos;s the whole pitch.
          </p>
        </div>
      </section>

      <footer className="border-t border-maroon-200/40 py-8 text-center text-xs text-ink-soft/70">
        Knock House Chop Chop · Cycling Club
      </footer>
    </main>
  );
}
