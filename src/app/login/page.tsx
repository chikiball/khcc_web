import Link from "next/link";
import { Suspense } from "react";
import { GoogleSignIn } from "@/components/google-sign-in";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 bg-paper">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-8">
          <span className="font-display text-3xl font-bold tracking-tight text-ink">KHCC</span>
        </Link>
        <h1 className="text-2xl font-display font-semibold text-ink text-center mb-2">
          Ride and go home.
        </h1>
        <p className="text-sm text-ink-soft text-center mb-8">
          Sign in to RSVP to the next ride.
        </p>
        <Suspense>
          <GoogleSignIn />
        </Suspense>
        <p className="mt-6 text-xs text-ink-soft/70 text-center">
          By signing in you agree to be a fast, friendly, helmet-on member of the bunch.
        </p>
      </div>
    </main>
  );
}
