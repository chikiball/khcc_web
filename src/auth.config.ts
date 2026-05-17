import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Edge-safe Auth.js config — used by middleware and re-used as the base
 * for the full config in `auth.ts`. Must NOT import anything that pulls
 * in Node-only modules (no DB adapter, no `pg`, no `crypto` direct use).
 *
 * The full Auth.js setup with the Drizzle adapter and DB-touching
 * callbacks lives in `auth.ts` and runs on the Node runtime via the
 * `/api/auth/[...nextauth]` route handler.
 *
 * Reference: https://authjs.dev/guides/edge-compatibility
 */
export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // The `authorized` callback is the edge-safe way to gate routes.
    // It runs in middleware. Returning true allows; returning false (or
    // a Response) denies / redirects. The onboarded redirect is handled
    // by Server Components that have access to the full session.
    authorized({ auth, request }) {
      const isSignedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const protectedPath =
        pathname.startsWith("/rides") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/pending");

      if (protectedPath && !isSignedIn) return false; // redirect to /login
      // Signed-in users hitting /login are bounced by the page itself.
      return true;
    },
  },
} satisfies NextAuthConfig;
