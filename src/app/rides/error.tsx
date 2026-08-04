"use client";

/**
 * Route-level error boundary for everything under /rides.
 *
 * Without this, an uncaught throw from a Server Action invoked by a client
 * component (the RSVP toggle, recap editor, photo uploader) has nothing to
 * catch it and Next.js falls back to the global "Application error: a
 * client-side exception has occurred" screen — no message, no way back, and
 * the member's page contents gone. Actions that can fail for user-fixable
 * reasons should still return a message instead of throwing (see
 * PhotoActionState in src/app/rides/actions.ts); this is the backstop for
 * everything else.
 *
 * Production note: Next.js scrubs `error.message` for server-originated
 * errors (you get an empty message and a `digest` to grep the container logs
 * with). Client-origin errors keep their real message, so we show whichever we
 * got — that's the difference between "Application error: a client-side
 * exception" telling the member nothing and it naming the actual failure.
 */
export default function RidesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-dvh bg-paper text-ink grid place-items-center px-5">
      <div className="max-w-md w-full rounded-2xl bg-white ring-1 ring-maroon-200/60 p-8 text-center">
        <p className="text-4xl">🚲</p>
        <h1 className="font-display text-2xl font-bold mt-3">That didn&apos;t work</h1>
        <p className="text-sm text-ink-soft mt-2">
          Something broke while loading this page. Your ride and RSVP are safe —
          nothing was lost. If you were posting a photo, check the recap before
          trying again: it may have gone through.
        </p>
        {error.message && (
          <p className="mt-4 rounded-xl bg-cream-100 px-3 py-2 text-xs text-ink-soft font-mono text-left break-words">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-2xl bg-coral-500 hover:bg-coral-600 text-cream-50 px-5 py-2.5 text-sm font-semibold active:scale-[0.98] transition-transform"
          >
            Try again
          </button>
          {/* Plain <a>, not <Link>: a soft navigation can re-fetch the same
              broken RSC payload and bounce straight back here. A full document
              load is the reliable way out. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/rides"
            className="inline-flex items-center justify-center rounded-2xl bg-white ring-1 ring-maroon-200 hover:bg-cream-100 text-ink px-5 py-2.5 text-sm font-semibold"
          >
            Back to rides
          </a>
        </div>
        {error.digest && (
          <p className="text-[10px] text-ink-soft/70 mt-5 font-mono">
            ref {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
