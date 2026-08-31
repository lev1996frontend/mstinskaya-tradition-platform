import Link from "next/link";

import { Monogram } from "@/components/brand/monogram";
import { WeaponSeal } from "@/components/brand/seal";
import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";
import { Container } from "@/components/ui";

const COLUMNS = [
  {
    title: "Соревнования",
    links: [
      { href: "/tournaments", label: "Турниры" },
      { href: "/rules", label: "Правила и регламенты" },
    ],
  },
  {
    title: "Сообщество",
    links: [
      { href: "/athletes", label: "Спортсмены" },
      { href: "/clubs", label: "Клубы" },
    ],
  },
  {
    title: "Развитие",
    links: [{ href: "/education", label: "Обучение" }],
  },
];

/**
 * Colophon rather than a sitemap footer: a cold double rule closes the
 * document, columns are headed with stamped field labels, and the seal row is
 * the one place the four motifs appear as a set — the same frame used
 * everywhere else, so it reads as the issuing mark of the archive instead of a
 * strip of decorative icons.
 */
export function SiteFooter() {
  return (
    <footer className="mt-14 bg-[var(--background-deep)]">
      <Container>
        <div className="rule-double pt-8" />
      </Container>

      <Container className="grid gap-10 py-10 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <Monogram size={20} className="text-[var(--accent)]" />
            <span className="leading-tight">
              <span className="font-display block text-[0.9375rem] font-semibold">Мстинская</span>
              <span className="font-record block text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                традиция
              </span>
            </span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
            Цифровая платформа сообщества: обучение, правила, турниры, клубы и снаряжение.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-3">
            <p className="record-label border-b border-[var(--border-strong)] pb-2 text-[var(--chrome-muted)]">
              {column.title}
            </p>
            <ul className="space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm transition-colors hover:text-[var(--accent)]"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <Container className="flex flex-col gap-5 border-t border-[var(--border-strong)] py-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-record text-[0.7rem] uppercase tracking-[0.14em] text-[var(--muted)]">
          © {new Date().getFullYear()} · Мстинская традиция
        </p>
        <div className="flex items-center gap-3" aria-hidden="true">
          {WEAPON_MOTIFS.map((motif) => (
            <WeaponSeal key={motif.key} motif={motif.key} size={28} tone="iron" />
          ))}
        </div>
      </Container>
    </footer>
  );
}
