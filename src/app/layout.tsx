import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "KHCC", template: "%s · KHCC" },
  description: "Knock House Chop Chop — fast-pace road cycling, ride and go home.",
  applicationName: "KHCC",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KHCC",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ec6e8a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
