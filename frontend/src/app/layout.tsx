import type { Metadata } from "next";
import { Alegreya, Bad_Script, Commissioner, IBM_Plex_Mono } from "next/font/google";

import { CookieNotice } from "@/components/layout/cookie-notice";
import { CookieNoticeProvider } from "@/components/layout/cookie-notice-context";
import { RiverSpine } from "@/components/layout/river-spine";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthProvider } from "@/features/auth/auth-context";
import { EmailVerificationBanner } from "@/features/auth/email-verification-banner";
import { BuzaProvider } from "@/features/home/buza-context";
import { SmoothScrollMount } from "@/features/transitions/smooth-scroll-mount";

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

// The fourth type role, added for the Badge component's material stamps
// (roles, statuses): a handwritten cut, not the record face's typewriter
// voice — a status here reads as marked by hand, not machine-stamped.
// Applied only via `.badge-hand` in globals.css, never as body text.
const badScript = Bad_Script({
  subsets: ["latin", "cyrillic"],
  weight: ["400"],
  variable: "--font-bad-script",
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
      className={`${commissioner.variable} ${alegreya.variable} ${plexMono.variable} ${badScript.variable}`}
    >
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[var(--radius-sm)] focus:bg-[var(--accent)] focus:px-4 focus:py-2 focus:text-[var(--background)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent-strong)]"
        >
          Перейти к содержимому
        </a>
        {/* Smooth scroll is a sibling, not a wrapper: it drives
            `document.documentElement` in Lenis's `root` mode, so it has no
            need to enclose the page — and not enclosing it is what lets the
            Lenis/GSAP chunk load after hydration instead of blocking every
            route. See `smooth-scroll-mount.tsx`. */}
        <SmoothScrollMount />
        <AuthProvider>
          <BuzaProvider>
            <CookieNoticeProvider>
              <RiverSpine />
              <SiteHeader />
              <EmailVerificationBanner />
              <main id="main-content" tabIndex={-1} className="flex-1">{children}</main>
              <SiteFooter />
              <ScrollToTop />
              <CookieNotice />
            </CookieNoticeProvider>
          </BuzaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
