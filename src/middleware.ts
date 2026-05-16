import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Run on every path except Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.json|sw.js|workbox-.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
