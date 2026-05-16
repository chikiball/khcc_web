"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

export function GoogleSignIn() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/rides";

  return (
    <button
      onClick={() => signIn("google", { callbackUrl: next })}
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
  );
}
