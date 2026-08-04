import withPWAInit from "@ducanh2912/next-pwa";
import type { NextConfig } from "next";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // The service worker must never answer a request that the App Router made.
  //
  // next-pwa's defaults put HTML documents in a `pages` cache and RSC payloads
  // in `pages-rsc` / `pages-rsc-prefetch`, all NetworkFirst. For this app that
  // is all downside: every page is `force-dynamic` and auth-gated, so a cached
  // copy is either stale or belongs to a different session, and two concrete
  // failures come out of it — a cached document from an older build keeps that
  // build's Server Action IDs alive across deploys, and any cache-served body
  // can reach the router as `text/html` where it expects `text/x-component`,
  // which surfaces as "An unexpected response was received from the server".
  //
  // Reusing the default cacheNames makes resolveRuntimeCaching() drop the
  // defaults (see @ducanh2912/next-pwa dist/index.js), and our entries are
  // registered first so they win. Static assets (JS, CSS, fonts, images,
  // /uploads/*.jpg) keep their own caches and stay offline-capable — the
  // document matcher is scoped to `destination === "document"` precisely so it
  // doesn't shadow those.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          request.headers.get("RSC") === "1" &&
          request.headers.get("Next-Router-Prefetch") === "1" &&
          !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages-rsc-prefetch" },
      },
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          request.headers.get("RSC") === "1" &&
          !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages-rsc" },
      },
      {
        urlPattern: ({ request, url: { pathname }, sameOrigin }) =>
          sameOrigin &&
          request.destination === "document" &&
          !pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        options: { cacheName: "pages" },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withPWA(nextConfig);
