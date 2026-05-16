import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

const PROTECTED = ["/rides", "/onboarding"];

export default auth(async function middleware(request: NextRequest & { auth: unknown }) {
  const { pathname } = request.nextUrl;
  const session = (request as unknown as { auth: { user?: { onboarded?: boolean } } | null }).auth;
  const user = session?.user;

  const requiresAuth = PROTECTED.some((p) => pathname.startsWith(p));

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = user.onboarded ? "/rides" : "/onboarding";
    return NextResponse.redirect(url);
  }

  // Onboarding gate: signed-in but profile not complete → onboarding only
  if (user && !user.onboarded && pathname.startsWith("/rides")) {
    const url = request.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
