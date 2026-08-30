import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter, Playfair_Display } from "next/font/google";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { AuthProvider } from "@/features/auth/auth-context";
import { ThemeProvider } from "@/features/theme/theme-context";
import { ThemeScript } from "@/features/theme/theme-script";

import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
});

// Fraunces (originally planned) has no Cyrillic subset; Playfair Display does
// and gives the same "carved/editorial" display character at heading sizes.
const playfairDisplay = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  variable: "--font-playfair",
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
      className={`${inter.variable} ${playfairDisplay.variable} ${plexMono.variable}`}
    >
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-dvh flex-col">
        <ThemeProvider>
          <AuthProvider>
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
