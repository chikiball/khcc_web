import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { db, schema } from "@/db";
import { DEFAULT_THEME, THEME_BLOCK_KEY, isThemeKey } from "@/lib/themes";
import { eq } from "drizzle-orm";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://burkam.nandharu.uk";
const SITE_DESCRIPTION = "Bubur Kampung — chill weekend rides along East Coast & Changi.";

export const metadata: Metadata = {
  // Needed so relative og:image paths resolve to absolute URLs — chat apps
  // reject relative ones.
  metadataBase: new URL(SITE_URL),
  title: { default: "Burkam", template: "%s · Burkam" },
  description: SITE_DESCRIPTION,
  applicationName: "Burkam",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Burkam",
  },
  // Link previews (WhatsApp, Telegram, iMessage). Without an explicit
  // og:image, scrapers fall back to the largest icon they can find —
  // icon-512.png — and any image 300px or larger renders as a full-width
  // preview card, which is why a shared ride used to paste in with a huge
  // logo. Pinning a 192px image keeps it a small square thumbnail.
  //
  // Note: these come from /login, not the ride page. /rides/* is behind
  // middleware, so an unauthenticated scraper is redirected there — per-ride
  // openGraph tags would never be read.
  openGraph: {
    type: "website",
    siteName: "Burkam",
    title: "Burkam",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: "Burkam" }],
  },
  twitter: {
    card: "summary", // "summary" = small square thumbnail; "summary_large_image" = the big card
    title: "Burkam",
    description: SITE_DESCRIPTION,
    images: ["/icon-192.png"],
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
    shortcut: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Resolve the active theme from content_blocks. Falls back to the default
 * on any failure (missing row, DB unavailable at boot, invalid key from a
 * stale row, etc.) so the site never breaks because of theme state.
 */
async function getActiveTheme(): Promise<string> {
  try {
    const [row] = await db
      .select({ body: schema.contentBlocks.body })
      .from(schema.contentBlocks)
      .where(eq(schema.contentBlocks.key, THEME_BLOCK_KEY))
      .limit(1);
    const value = row?.body?.trim();
    return value && isThemeKey(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getActiveTheme();
  return (
    <html lang="en" data-theme={theme} className={`${inter.variable} ${bricolage.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
