import type { Metadata } from "next";
import { Alegreya, Commissioner, IBM_Plex_Mono } from "next/font/google";

import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthProvider } from "@/features/auth/auth-context";
import { BuzaProvider } from "@/features/home/buza-context";
import { SmoothScroll } from "@/features/transitions/smooth-scroll";

import "./globals.css";

// Interface/running text. Ships a real Cyrillic cut (verified against
// next/font's google font-data before adopting, same diligence Playfair
// needed below) — replaces Inter for the "Живой архив" v2 type system.
const commissioner = Commissioner({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
  variable: "--font-commissioner",
  display: "swap",
});

// Fraunces (originally considered) has no Cyrillic subset; Alegreya does and
// gives the same "carved/editorial" display character at heading sizes —
// replaces Playfair Display as the display face.
const alegreya = Alegreya({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
  variable: "--font-alegreya",
  display: "swap",
});

// The third type role: the "record" face. IBM Plex Mono over JetBrains/Space
// Mono for two reasons — it ships a real Cyrillic cut (so stamped uppercase
// labels like "ДЕЙСТВУЕТ" stay in the same voice as the digits instead of
// falling back to Inter), and its typewriter-institutional drawing sits under
// Playfair without competing with it the way a geometric code face would.
// Applied via `.font-record` / `.record-label` in globals.css, never as body text.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Мстинская традиция",
    template: "%s · Мстинская традиция",
  },
  description:
    "Цифровая платформа сообщества Мстинской традиции: обучение, правила, турниры, клубы и снаряжение.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="ru"
      className={`${commissioner.variable} ${alegreya.variable} ${plexMono.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <SmoothScroll>
          <AuthProvider>
            <BuzaProvider>
              <SiteHeader />
              <main className="flex-1">{children}</main>
              <SiteFooter />
              <ScrollToTop />
            </BuzaProvider>
          </AuthProvider>
        </SmoothScroll>
      </body>
    </html>
  );
}
