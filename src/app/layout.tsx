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

export const metadata: Metadata = {
  title: { default: "Burkam", template: "%s · Burkam" },
  description: "Bubur Kampung — chill weekend rides along East Coast & Changi.",
  applicationName: "Burkam",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Burkam",
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
