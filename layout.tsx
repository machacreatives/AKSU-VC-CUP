import type { Metadata } from "next";
import { Barlow_Condensed } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

// D-DIN is a commercial font with no free/Google Fonts license, so it can't
// be loaded here. Barlow Condensed is the closest free match — same
// geometric, industrial, condensed-technical feel used across sports UIs.
const barlow = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-din",
});

export const metadata: Metadata = {
  title: "AKSU Score — Vice-Chancellor's Cup",
  description: "Live scores, group tables, formations and stats for the AKSU Vice-Chancellor's Cup inter-departmental football league.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlow.variable}>
      <body className="min-h-screen bg-base font-sans antialiased">
        <div className="mx-auto min-h-screen max-w-lg border-x border-line/60">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
