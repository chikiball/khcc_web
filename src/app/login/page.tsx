import Link from "next/link";
import { signInWithEmail } from "./actions";

export const metadata = { title: "Sign in" };

type SearchParams = Promise<{ error?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-6 py-10 bg-paper">
      <div className="w-full max-w-sm">
        <Link href="/" className="block text-center mb-8">
          <span className="font-display text-3xl font-bold tracking-tight text-ink">KHCC</span>
        </Link>
        <h1 className="text-2xl font-display font-semibold text-ink text-center mb-2">
          Ride and go home.
        </h1>
        <p className="text-sm text-ink-soft text-center mb-8">
          New here? Enter your email and an admin will review you. Already a
          member? Same thing — enter your email to come back in.
        </p>

        <form action={signInWithEmail} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              className="w-full rounded-2xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-6 py-3 font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            Continue →
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-coral-700 text-center">
            Could not sign in. Check the email and try again.
          </p>
        )}

        <p className="mt-8 text-xs text-ink-soft/70 text-center">
          By signing in you agree to be a fast, friendly, helmet-on member of the bunch.
        </p>
      </div>
    </main>
  );
}
