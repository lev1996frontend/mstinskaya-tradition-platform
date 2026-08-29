"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Container, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";

const NAV = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/athletes", label: "Спортсмены" },
  { href: "/clubs", label: "Клубы" },
  { href: "/rules", label: "Правила" },
  { href: "/education", label: "Обучение" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/90 backdrop-blur">
      <Container className="flex h-16 items-center gap-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-8 place-items-center rounded-md bg-[var(--accent)] text-sm font-bold text-white"
          >
            М
          </span>
          <span className="text-sm font-semibold leading-tight">
            Мстинская
            <span className="block text-xs font-normal text-[var(--muted)]">традиция</span>
          </span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden flex-1 items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive(item.href)
                  ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {loading ? (
            <span className="text-sm text-[var(--muted)]">…</span>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                {user.name || user.email}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-md px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-[var(--accent)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--accent-strong)]"
            >
              Войти
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Меню"
          className="ml-auto rounded-md border border-[var(--border-strong)] px-3 py-1.5 text-sm md:hidden"
        >
          Меню
        </button>
      </Container>

      {open ? (
        <div className="border-t border-[var(--border)] md:hidden">
          <Container className="flex flex-col py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm hover:bg-[var(--surface-muted)]"
              >
                {item.label}
              </Link>
            ))}
            <div className="my-2 border-t border-[var(--border)]" />
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2.5 text-sm hover:bg-[var(--surface-muted)]"
                >
                  Профиль
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void logout();
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-sm text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                >
                  Выйти
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--surface-muted)]"
              >
                Войти
              </Link>
            )}
          </Container>
        </div>
      ) : null}
    </header>
  );
}
