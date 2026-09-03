"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MonogramFlip } from "@/components/brand/monogram-flip";
import { MenuToggleGlyph } from "@/components/brand/menu-glyph";
import { WEAPON_MOTIFS, randomWeaponMotif, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { RiverStrip } from "@/components/layout/river-strip";
import { Button, ButtonLink, Container, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { IMPULSE_TAP, TURN_EASE, stepIn } from "@/lib/motion";
import { useFocusTrap } from "@/lib/use-focus-trap";

const NAV = [
  { href: "/tournaments", label: "Турниры" },
  { href: "/athletes", label: "Спортсмены" },
  { href: "/clubs", label: "Клубы" },
  { href: "/rules", label: "Правила" },
  { href: "/equipment", label: "Снаряжение" },
  { href: "/education", label: "Обучение" },
];

/**
 * Weapon assigned to each nav item's dice-roll reverse face. Hand-picked
 * rather than cycled by index: "Безоружный" is the longest of the four
 * weapon labels, so it goes on "Клубы" (the shortest own-label, but a middle item with a
 * full nav-width of clearance on both sides) instead of an edge item, where
 * it would overhang past the logo or off the header entirely.
 */
const NAV_WEAPON: Record<string, WeaponMotifKey> = {
  "/tournaments": "kisten",
  "/athletes": "hands",
  "/clubs": "nozh",
  "/rules": "palka",
  "/equipment": "hands",
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
  const [logoStruck, setLogoStruck] = useState(false);
  const [logoOpponent, setLogoOpponent] = useState<WeaponMotifKey>("kisten");
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // A full-screen takeover locks page scroll behind it and closes on Escape,
  // same as any modal-ish overlay — the old accordion needed neither, since
  // it never covered the page. Also moves focus onto the panel's own close
  // button so Tab starts inside it, matching the focus trap below.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>('button[aria-label="Закрыть меню"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useFocusTrap(menuRef, open);

  return (
    <header
      className="sticky top-0 z-30 border-b-2 border-[var(--rule)] bg-[var(--background)] shadow-[0_3px_0_-2px_var(--rule)]"
      style={{ viewTransitionName: "site-header" }}
    >
      <Container className="flex h-16 items-center gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5"
          onMouseEnter={() => setLogoActive(true)}
          onMouseLeave={() => setLogoActive(false)}
          onFocus={() => setLogoActive(true)}
          onBlur={() => setLogoActive(false)}
          onClick={() => {
            setLogoOpponent(randomWeaponMotif());
            setLogoStruck(true);
          }}
        >
          <MonogramFlip
            flipped={logoActive}
            struck={logoStruck}
            opponent={logoOpponent}
            onStrikeEnd={() => setLogoStruck(false)}
            size={20}
          />
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
              <Button type="button" variant="ghost" size="sm" onClick={() => void logout()}>
                Выйти
              </Button>
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
            className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--chrome-line)] p-2 text-[var(--chrome-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <MenuToggleGlyph open={open} reduceMotion={reduceMotion ?? false} size={22} />
          </button>
        </div>
      </Container>

      {/* River strip only exists to open the "Буза" section, which only
          lives on the homepage — showing it elsewhere would be a control
          with nothing to open.

          Hidden past ~1400px, where the margin river's own three bays take
          over the same three symbols (`components/layout/river-spine.tsx`
          mirrors this breakpoint). Below it there is no margin wide enough to
          hold a bay, so the strip stays — the symbols are always in exactly
          one place, never two. */}
      {pathname === "/" ? (
        <div className="min-[1400px]:hidden">
          <RiverStrip />
        </div>
      ) : null}

      {/* Full-screen takeover, not a dropdown: reuses the site's own
          numbered-index grammar (01/02/… ruled rows in `font-display`, the
          same pattern `directory-index.tsx` uses for its real-route ToC)
          instead of a small accordion panel, so the "table of contents"
          pattern carries the primary nav too. */}
      <AnimatePresence>
        {open ? (
          <motion.div
            key="mobile-menu"
            ref={menuRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.25, ease: TURN_EASE }}
            // `h-dvh` (dynamic viewport height), not just `inset-0`/implicit
            // 100%: on real mobile browsers the address bar shows/hides as
            // you scroll, and a plain `vh`-based full-screen overlay visibly
            // jumps/resizes as that happens — `dvh` tracks the *current*
            // visual viewport instead of the largest possible one.
            className="fixed inset-x-0 top-0 z-40 flex h-dvh flex-col overflow-y-auto bg-[var(--background)] lg:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b-2 border-[var(--rule)] px-4 sm:px-6">
              <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                <MonogramFlip flipped={false} size={20} />
                <span className="leading-tight">
                  <span className="font-display block text-[0.9375rem] font-semibold tracking-tight">
                    Мстинская
                  </span>
                  <span className="font-record block text-[0.6rem] uppercase tracking-[0.22em] text-[var(--muted)]">
                    традиция
                  </span>
                </span>
              </Link>
              {/* Same square as the collapsed header's own toggle button
                  (`p-2.5`, 18px glyph) — it used to be a bigger `p-3`/24px
                  `CloseGlyph`, so the button visibly changed size between
                  closed and open states. Reusing `MenuToggleGlyph` in its
                  open shape (rather than the standalone `CloseGlyph`) keeps
                  the X pixel-identical to the one the header's toggle morphs
                  into, too. */}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть меню"
                className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--chrome-line)] p-2 text-[var(--chrome-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                <MenuToggleGlyph open reduceMotion={reduceMotion ?? false} size={22} />
              </button>
            </div>

            <nav aria-label="Основная навигация" className="flex flex-1 flex-col justify-center px-4 sm:px-6">
              {NAV.map((item, index) => {
                const active = isActive(item.href);
                // `stepIn` (шаг) — the codebase's own one-shot entrance-
                // stagger primitive, not a one-off tween: a 14px offset reads
                // clearly (the earlier 10px + `reduceMotion ? undefined`
                // read as an instant pop for anyone with reduced motion on,
                // since `undefined` skips the fade too, not just the move —
                // reduced motion should drop the *movement*, not the
                // transition entirely). 50ms/item keeps five items inside
                // the 30–80ms stagger band while still reading as a cascade.
                const { initial, animate, transition } = stepIn(14);
                return (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? { opacity: 0 } : initial}
                    animate={reduceMotion ? { opacity: 1 } : animate}
                    transition={{ ...transition, delay: reduceMotion ? 0 : index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-baseline gap-5 border-b border-[var(--border)] py-5 transition-colors",
                        active ? "text-[var(--accent)]" : "hover:text-[var(--accent)]",
                      )}
                    >
                      <span className="font-record text-sm text-[var(--muted)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="font-display text-[2rem] font-semibold tracking-tight transition-transform duration-300 group-hover:translate-x-1.5 sm:text-[2.5rem]">
                        {item.label}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            <div className="shrink-0 border-t-2 border-[var(--rule)] px-4 py-5 sm:px-6">
              {loading ? (
                <span className="font-record text-xs text-[var(--muted)]">…</span>
              ) : user ? (
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="truncate rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]"
                  >
                    {user.name || user.email}
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                  >
                    Выйти
                  </Button>
                </div>
              ) : (
                <ButtonLink
                  href="/login"
                  size="lg"
                  onClick={() => setOpen(false)}
                  className="w-full justify-center"
                >
                  Войти
                </ButtonLink>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
