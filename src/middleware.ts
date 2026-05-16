import NextAuth from "next-auth";
import authConfig from "@/auth.config";

// Edge-safe middleware: uses only the lightweight config (no DB adapter).
// The `authorized` callback in auth.config.ts handles the protected-path
// gate. Anything that needs the role / onboarded fields runs in Server
// Components or Server Actions where the full `auth()` from auth.ts is
// available.
export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
