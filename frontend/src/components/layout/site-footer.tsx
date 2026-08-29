import Link from "next/link";

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

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface-muted)]/60">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold">Мстинская традиция</p>
          <p className="max-w-xs text-sm text-[var(--muted)]">
            Цифровая платформа сообщества: обучение, правила, турниры, клубы и снаряжение.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {column.title}
            </p>
            <ul className="space-y-1.5">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm hover:text-[var(--accent)]">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="border-t border-[var(--border)] py-5">
        <p className="text-xs text-[var(--muted)]">
          © {new Date().getFullYear()} Мстинская традиция
        </p>
      </Container>
    </footer>
  );
}
