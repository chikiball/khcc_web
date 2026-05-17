import Link from "next/link";
import { signInWithEmail, signInWithGoogle } from "./actions";

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
          New here? Pick how to sign in. An admin will review you. Already a
          member? Same thing — sign in to come back.
        </p>

        <form action={signInWithGoogle}>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-6 py-3 text-base font-medium text-maroon-800 shadow-sm ring-1 ring-maroon-200 hover:bg-cream-50 active:scale-[0.98] transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M19.6 10.23c0-.74-.07-1.46-.2-2.16H10v4.09h5.39c-.23 1.25-.94 2.32-2 3.04v2.52h3.24c1.9-1.74 2.97-4.32 2.97-7.49z" fill="#4285F4"/>
              <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.24-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.59-4.12H1.05v2.59A9.99 9.99 0 0 0 10 20z" fill="#34A853"/>
              <path d="M4.41 11.89A6.01 6.01 0 0 1 4.1 10c0-.66.11-1.3.31-1.89V5.52H1.05A9.99 9.99 0 0 0 0 10c0 1.61.39 3.14 1.05 4.48l3.36-2.59z" fill="#FBBC05"/>
              <path d="M10 3.98c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.96.99 12.7 0 10 0A9.99 9.99 0 0 0 1.05 5.52l3.36 2.59C5.19 5.74 7.4 3.98 10 3.98z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-soft/60 uppercase tracking-wider">
          <span className="flex-1 h-px bg-maroon-200" />
          or
          <span className="flex-1 h-px bg-maroon-200" />
        </div>

        <form action={signInWithEmail} className="space-y-3">
          <label className="block">
            <span className="sr-only">Email</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-2xl bg-white ring-1 ring-maroon-200 focus:ring-2 focus:ring-coral-400 px-4 py-3 text-base outline-none"
            />
          </label>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-6 py-3 font-semibold shadow-sm active:scale-[0.98] transition-transform"
          >
            Continue with email →
          </button>
        </form>

        {error && (
          <p className="mt-4 text-sm text-coral-700 text-center">
            Could not sign in. Try again.
          </p>
        )}

        <p className="mt-8 text-xs text-ink-soft/70 text-center">
          By signing in you agree to be a fast, friendly, helmet-on member of the bunch.
        </p>
      </div>
    </main>
  );
}
