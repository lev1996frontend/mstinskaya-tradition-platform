"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";

import { MonogramFlip } from "@/components/brand/monogram-flip";
import { WEAPON_MOTIFS, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { ButtonLink, Container, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { IMPULSE_TAP } from "@/lib/motion";

const NAV = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/athletes", label: "Спортсмены" },
  { href: "/clubs", label: "Клубы" },
  { href: "/rules", label: "Правила" },
  { href: "/education", label: "Обучение" },
];

/**
 * Weapon assigned to each nav item's dice-roll reverse face. Hand-picked
 * rather than cycled by index: "Голыми руками" is the longest label by far,
 * so it goes on "Клубы" (the shortest own-label, but a middle item with a
 * full nav-width of clearance on both sides) instead of an edge item, where
 * it would overhang past the logo or off the header entirely.
 */
const NAV_WEAPON: Record<string, WeaponMotifKey> = {
  "/tournaments": "kisten",
  "/athletes": "hands",
  "/clubs": "nozh",
  "/rules": "palka",
  "/education": "kisten",
};

/**
 * Header as the head of a filed document, not a floating app bar: opaque
 * paper (the old translucent `backdrop-blur` was the one piece of glass in the
 * system), a cold double rule closing it off, and the section index set in the
 * record face — the same voice as the labels stamped on every value below.
 *
 * The active-section indicator moved from a rounded tinted pill to an oxblood
 * underline struck under the word. It keeps the shared `layoutId` so the mark
 * still slides between sections, which is the part that carries meaning
 * (where you are, and where you came from).
 */
const navItemBase =
  "font-record relative px-3 py-2 text-[0.72rem] uppercase tracking-[0.1em] transition-colors";

/**
 * A full rotateX spin (0 → 180 → 180 → 360) reads as a die tumbling end-over-
 * end (a toss, not a revolving-door spin around the vertical axis): the
 * label's own reverse face (which carries its own fixed `rotateX(180deg)`, so
 * the weapon glyph reads right-way-up) comes fully square to the viewer at
 * the 180 hold, then the spin completes back to the label — same face as the
 * start, not a re-render, so it never "jumps". State-driven (mirrors
 * `logoActive` above) rather than `whileHover`, so keyboard focus drives the
 * identical animation via the same `animate` prop.
 *
 * A brief импульс (compress, `IMPULSE_TAP.scale`) is inserted right at the
 * edge-on hold, between the existing grow-in and grow-out, so the toss reads
 * as weighted — a die actually landing edge-on for an instant — rather than a
 * frictionless spin that only ever expands.
 */
const navSpinKeyframes = {
  rotateX: [0, 180, 180, 180, 360],
  scale: [1, 1.05, IMPULSE_TAP.scale, 1.05, 1.1],
};
const navSpinTransition = {
  duration: 0.8,
  times: [0, 0.38, 0.5, 0.62, 1],
  ease: "easeInOut" as const,
};
const navRestState = { rotateX: 0, scale: 1 };
const navRestTransition = { duration: 0.25, ease: "easeOut" as const };

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [logoActive, setLogoActive] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--rule)] bg-[var(--background)] shadow-[0_3px_0_-2px_var(--rule)]">
      <Container className="flex h-16 items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          onMouseEnter={() => setLogoActive(true)}
          onMouseLeave={() => setLogoActive(false)}
          onFocus={() => setLogoActive(true)}
          onBlur={() => setLogoActive(false)}
        >
          <MonogramFlip flipped={logoActive} size={20} />
          {/* The wordmark states the three type roles in miniature: display
              serif name over a stamped record caption. */}
          <span className="leading-tight">
            <span className="font-display block text-[0.9375rem] font-semibold tracking-tight">
              Мстинская
            </span>
            <span className="font-record block text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
              традиция
            </span>
          </span>
        </Link>

        <nav aria-label="Основная навигация" className="hidden flex-1 items-center lg:flex">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const spinning = hoveredNav === item.href;
            const { label: weaponLabel, Icon: WeaponIcon } =
              WEAPON_MOTIFS.find((motif) => motif.key === NAV_WEAPON[item.href]) ?? WEAPON_MOTIFS[0];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onMouseEnter={() => setHoveredNav(item.href)}
                onMouseLeave={() => setHoveredNav((current) => (current === item.href ? null : current))}
                onFocus={() => setHoveredNav(item.href)}
                onBlur={() => setHoveredNav((current) => (current === item.href ? null : current))}
                className={cn(
                  navItemBase,
                  active
                    ? "font-medium text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId="nav-active-pill"
                    className="absolute inset-x-2 bottom-1 h-[2px] bg-[var(--accent)]"
                    transition={
                      reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }
                    }
                  />
                ) : null}
                <span className="relative block min-w-[88px] text-center" style={{ perspective: 480 }}>
                  <motion.span
                    className="block"
                    style={{ transformStyle: "preserve-3d" }}
                    animate={spinning && !reduceMotion ? navSpinKeyframes : navRestState}
                    transition={spinning && !reduceMotion ? navSpinTransition : navRestTransition}
                  >
                    <span className="block [backface-visibility:hidden]">{item.label}</span>
                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 whitespace-nowrap text-[var(--accent)] [backface-visibility:hidden] [transform:rotateX(180deg)]">
                      <WeaponIcon size={14} className="shrink-0" />
                      {weaponLabel}
                    </span>
                  </motion.span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-3 lg:flex">
          {loading ? (
            <span className="font-record text-xs text-[var(--muted)]">…</span>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="max-w-[12rem] truncate rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                {user.name || user.email}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                className="font-record rounded-[var(--radius-sm)] px-2.5 py-2 text-[0.7rem] uppercase tracking-[0.1em] text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              >
                Выйти
              </button>
            </>
          ) : (
            <ButtonLink href="/login" size="sm">
              Войти
            </ButtonLink>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 lg:hidden">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Меню"
            className="rounded-[var(--radius-sm)] border border-[var(--chrome-line)] p-2 text-[var(--chrome-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </Container>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-[var(--rule)] bg-[var(--surface)] lg:hidden"
          >
            <Container className="flex flex-col py-2">
              {NAV.map((item, index) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "flex items-baseline gap-3 border-b border-[var(--border)] px-1 py-3 text-sm",
                    isActive(item.href) && "font-medium text-[var(--accent)]",
                  )}
                >
                  {/* the same numbered-entry grammar as the homepage index */}
                  <span className="font-record text-[0.65rem] text-[var(--muted)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {item.label}
                </Link>
              ))}
              <div className="flex items-center gap-2 pt-3">
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      onClick={() => setOpen(false)}
                      className="rounded-[var(--radius-sm)] px-2 py-2 text-sm hover:bg-[var(--surface-muted)]"
                    >
                      Профиль
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        void logout();
                      }}
                      className="font-record rounded-[var(--radius-sm)] px-2 py-2 text-left text-[0.7rem] uppercase tracking-[0.1em] text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                    >
                      Выйти
                    </button>
                  </>
                ) : (
                  <ButtonLink href="/login" size="sm" onClick={() => setOpen(false)}>
                    Войти
                  </ButtonLink>
                )}
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
