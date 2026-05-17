import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config — used by middleware. Must NOT import anything
 * that pulls in Node-only modules (no DB adapter, no `pg`).
 *
 * Providers list is empty here (kept in auth.ts only) because middleware
 * does not need to know about providers — it only checks the JWT and runs
 * the `authorized` callback.
 */
export default {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isSignedIn = !!auth?.user;
      const { pathname } = request.nextUrl;
      const protectedPath =
        pathname.startsWith("/rides") ||
        pathname.startsWith("/onboarding") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/pending");

      if (protectedPath && !isSignedIn) return false;
      return true;
    },
  },
} satisfies NextAuthConfig;
