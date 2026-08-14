import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Providers from "./providers";
import { tournamentName } from "@/lib/config";
import { siteUrl } from "@/lib/site-url";

// D-DIN is a commercial font with no free/Google Fonts license, so it can't
// be loaded here. Barlow Condensed is the closest free match — same
// geometric, industrial, condensed-technical feel used across sports UIs.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-din",
});

const SITE_NAME = `AKSU Score — ${tournamentName}`;
const SITE_DESCRIPTION =
  "Live scores, group tables, formations and stats for the AKSU Vice-Chancellor's Cup inter-departmental football league.";

/**
 * `metadataBase` is what makes relative Open Graph image paths resolve to
 * absolute URLs. Without it Next emits no og:image at all, which is why a
 * shared link previewed as bare text.
 *
 * NEXT_PUBLIC_SITE_URL when set; Vercel supplies VERCEL_URL on every
 * deployment, so a preview build links to itself rather than to production.
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_NAME,
    // Match pages set their own title; this keeps the site name attached.
    template: `%s · AKSU Score`,
  },
  description: SITE_DESCRIPTION,
  applicationName: "AKSU Score",
  openGraph: {
    type: "website",
    siteName: "AKSU Score",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "en_NG",
  },
  twitter: { card: "summary_large_image", title: SITE_NAME, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable}>
      <body className="min-h-screen bg-base font-sans antialiased">
        {/* Widens in steps rather than jumping straight from phone to desktop,
            so tablets don't sit inside a 512px column with empty space either
            side. Header uses the identical ladder so the two stay aligned. */}
        <Providers>
          <div className="mx-auto min-h-screen w-full max-w-lg border-x border-line/60 md:max-w-2xl lg:max-w-5xl xl:max-w-6xl">
            <Header />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
