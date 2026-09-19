"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { MenuToggleGlyph } from "@/components/brand/menu-glyph";
import { SiteLogo } from "@/components/brand/site-logo";
import { WEAPON_MOTIFS, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { ButtonLink, Container, cn } from "@/components/ui";
import { useAuth } from "@/features/auth/auth-context";
import { IMPULSE_TAP, TURN_EASE, TURN_EASE_EXIT, stepIn } from "@/lib/motion";
import { routes } from "@/lib/routes";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { CurrentUser } from "@/types";

const NAV_BASE = [
  { href: routes.tournaments(), label: "Турниры" },
  { href: routes.athletes(), label: "Спортсмены" },
  { href: routes.clubs(), label: "Клубы" },
  { href: routes.rules(), label: "Правила" },
  { href: routes.equipment(), label: "Снаряжение" },
  { href: routes.education(), label: "Обучение" },
];
const MODERATION_NAV_ITEM = { href: routes.moderationRoleRequests(), label: "Модерация" };

/**
 * Weapon assigned to each nav item's dice-roll reverse face. Hand-picked
 * rather than cycled by index: "Безоружный" is the longest of the four
 * weapon labels, so it goes on "Клубы" (the shortest own-label, but a middle item with a
 * full nav-width of clearance on both sides) instead of an edge item, where
 * it would overhang past the logo or off the header entirely.
 */
const NAV_WEAPON: Record<string, WeaponMotifKey> = {
  [routes.tournaments()]: "kisten",
  [routes.athletes()]: "hands",
  [routes.clubs()]: "nozh",
  [routes.rules()]: "palka",
  [routes.equipment()]: "hands",
  [routes.education()]: "kisten",
  [routes.moderationRoleRequests()]: "nozh",
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
 * start, not a re-render, so it never "jumps". State-driven (mirrors the
 * logo's own hover-state flip in `SiteLogo`) rather than `whileHover`, so
 * keyboard focus drives the identical animation via the same `animate` prop.
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

/**
 * Черта, которая дочерчивается. `useLinkStatus` reports whether *this* `Link`
 * is the one currently navigating, and the hook only works from inside the
 * `Link`, which is why this is its own component rather than a flag computed
 * up in `SiteHeader`.
 *
 * Rendered only for the words you are not already on: the section you are in
 * already carries the finished rule (`nav-active-pill`), and drawing a second
 * one under it would be the same mark twice saying two different things.
 *
 * Always mounted while pending and animated by `transform` alone — the docs
 * for this hook warn that inline indicators cause layout shift, and this nav
 * is a flex row where anything that changes size moves every word beside it.
 */
function NavPendingRule() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={cn("nav-pending-rule absolute inset-x-2 bottom-1 h-[2px] bg-[var(--accent)]", pending && "is-pending")}
    />
  );
}

/**
 * The one signed-in-state action, shared between the desktop bar and the
 * slide-out menu — those two used to carry their own copy of this same
 * loading/name/login branch, differing only in sizing and whether picking
 * "Войти" or the profile link should also close the menu.
 */
function AccountAction({
  user,
  loading,
  compact,
  onNavigate,
}: {
  user: CurrentUser | null;
  loading: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  if (loading) {
    return <span className="font-record text-xs text-[var(--muted)]">…</span>;
  }
  if (user) {
    // Name only — "Выйти" lives on the profile page this leads to, and
    // having it here as well put two identical actions a few pixels apart.
    // `account-chip` (globals.css) carries the fill-from-left hover and the
    // врез press; the plain `hover:bg-*` it replaced was too soft to read as
    // a state at header size.
    return (
      <Link
        href={routes.profile()}
        onClick={onNavigate}
        className={cn(
          "account-chip truncate rounded-[var(--radius-sm)] px-2.5 py-2 text-sm font-medium",
          compact ? "max-w-full" : "max-w-[12rem]",
        )}
      >
        {user.name || user.email}
      </Link>
    );
  }
  return compact ? (
    <ButtonLink
      href={routes.login()}
      size="lg"
      onClick={onNavigate}
      className="w-full justify-center"
      stampRing={false}
    >
      Войти
    </ButtonLink>
  ) : (
    // `md`, not `sm`. At `sm` this was 55×30 inside a 66px header — the only
    // action in the bar, and the smallest thing in it, sitting beside 33px-
    // tall nav items it was supposed to outrank.
    <ButtonLink href={routes.login()}>Войти</ButtonLink>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const menuRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const NAV = useMemo(
    () => (user?.roles.includes("MODERATOR") ? [...NAV_BASE, MODERATION_NAV_ITEM] : NAV_BASE),
    [user],
  );

  // The scroll lock's own previous inline styles + scroll position, restored
  // once the close animation actually finishes (see
  // `restoreScrollLock`/`onExitComplete` below) rather than in this effect's
  // cleanup — a ref because that restoration happens well after `open` has
  // already flipped back to `false` and this effect has already torn down.
  const scrollLock = useRef<{
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    scrollY: number;
  } | null>(null);

  // A full-screen takeover locks page scroll behind it and closes on Escape,
  // same as any modal-ish overlay — the old accordion needed neither, since
  // it never covered the page. Also moves focus onto the panel's own close
  // button so Tab starts inside it, matching the focus trap below.
  useEffect(() => {
    if (!open) return;
    // `position: fixed` on `body` at its current scroll offset, not
    // `overflow: hidden` — two earlier versions of this lock toggled
    // `overflow` (first bare, then with a JS-measured `padding-right`
    // compensation, then backed by `scrollbar-gutter: stable` in globals.css)
    // and all three still changed the page's width the instant the lock
    // engaged: `scrollbar-gutter: stable` only reserves space for `auto`/
    // `scroll` overflow — browsers never show a scrollbar for `hidden` in
    // the first place, so there's no gutter to reserve and `documentElement.
    // clientWidth` snapped back to the full viewport width every time
    // regardless. Fixing `body` in place instead never touches `overflow`
    // at all, so there is nothing for any of that to recompute — the widely
    // used scroll-lock pattern for exactly this reason (react-remove-scroll,
    // Radix, etc. all do the same thing under the hood).
    const scrollY = window.scrollY;
    scrollLock.current = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      scrollY,
    };
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    menuRef.current?.querySelector<HTMLElement>('button[aria-label="Закрыть меню"]')?.focus();
    // Captured now, not read from the ref inside the cleanup: React may have
    // already cleared `menuToggleRef.current` (unmount) by the time cleanup
    // runs, which is exactly the case — closing the menu — this exists for.
    const toggleButton = menuToggleRef.current;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      // NOT restoring the lock styles here: this cleanup fires the instant
      // `open` flips to `false` — well before the panel's own exit animation
      // below has actually played. That restoration happens in
      // `restoreScrollLock`, called from the panel's own `onExitComplete`
      // once it's really gone.
      window.removeEventListener("keydown", onKeyDown);
      // Otherwise closing (Escape, the panel's own close button, or picking
      // a nav item) drops focus to <body> — the menu unmounts taking
      // whatever had focus with it, and a keyboard user has to Tab in from
      // the top of the page again to get back to where they were.
      toggleButton?.focus();
    };
  }, [open]);

  function restoreScrollLock() {
    const lock = scrollLock.current;
    if (!lock) return;
    document.body.style.position = lock.position;
    document.body.style.top = lock.top;
    document.body.style.left = lock.left;
    document.body.style.right = lock.right;
    document.body.style.width = lock.width;
    // `window.scrollTo` (not `scrollIntoView` or letting the browser figure
    // it out): unfixing `body` drops it back into normal flow at its
    // natural scroll-0 position first, so without this the page would jump
    // to the top instead of back to where the menu was opened from.
    window.scrollTo(0, lock.scrollY);
    scrollLock.current = null;
  }

  useFocusTrap(menuRef, open);

  return (
    <header
      // z-40, not z-30: `<ScrollToTop>` (layout.tsx) is a sibling, also
      // z-30 — a tie the later-DOM element (the scroll button) would win,
      // painting it over this header's own full-screen mobile menu despite
      // the menu's internal z-40 (that value only ranks within this header's
      // own stacking context, it can't out-rank a same-z-index sibling one
      // level up). Bumping the header itself above the button's z-30 fixes it
      // at the source instead of chasing z-index inside the menu.
      className="sticky top-0 z-40 border-b-2 border-[var(--rule)] bg-[var(--background)] shadow-[0_3px_0_-2px_var(--rule)]"
      style={{ viewTransitionName: "site-header" }}
    >
      <Container className="flex h-16 items-center gap-6">
        <SiteLogo size={20} />

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
                ) : (
                  <NavPendingRule />
                )}
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
          <AccountAction user={user} loading={loading} compact={false} />
        </div>

        <div className="ml-auto flex items-center gap-1.5 lg:hidden">
          <button
            ref={menuToggleRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-menu-panel"
            aria-label="Меню"
            className="flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--chrome-line)] p-2 text-[var(--chrome-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <MenuToggleGlyph open={open} reduceMotion={reduceMotion ?? false} size={22} />
          </button>
        </div>
      </Container>

      {/* The header used to carry a 56px river strip here — three symbols
          (seal, boat, mug) whose only job was opening the "Буза" section far
          below, on the homepage alone. It cost a second storey of header on
          every phone, and the control it offered was so far from the thing it
          opened that the section needed a sentence explaining where to click.

          The opener now lives inside "Буза" itself (`features/home/buza.tsx`),
          where it needs no instructions, and the header is one storey
          everywhere. */}

      {/* Full-screen takeover, not a dropdown: reuses the site's own
          numbered-index grammar (01/02/… ruled rows in `font-display`, the
          same pattern `directory-index.tsx` uses for its real-route ToC)
          instead of a small accordion panel, so the "table of contents"
          pattern carries the primary nav too. */}
      <AnimatePresence onExitComplete={restoreScrollLock}>
        {open ? (
          <motion.div
            key="mobile-menu"
            id="mobile-menu-panel"
            ref={menuRef}
            // Exit is the true time-reverse of the entrance, not a separate
            // faster cut: same 250ms, same `scale: 1 <-> 0.98`, but
            // `TURN_EASE_EXIT` (`TURN_EASE`'s mirror image) instead of
            // reusing `TURN_EASE` itself. An earlier version gave exit a
            // longer duration (380ms) still on `TURN_EASE` — but that curve
            // is fast-start/slow-finish, so most of the opacity drop still
            // landed in the first third and the rest was an invisible tail;
            // it *felt* just as fast, only technically lasted longer.
            // `TURN_EASE_EXIT` is slow-start/fast-finish, so the panel stays
            // visibly present for most of the duration and then leaves —
            // matching how the entrance visibly arrives — instead of
            // vanishing early and lingering unseen.
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: reduceMotion ? { duration: 0 } : { duration: 0.25, ease: TURN_EASE },
            }}
            exit={{
              opacity: 0,
              scale: reduceMotion ? 1 : 0.98,
              // 0.4s, not 0.25s: matches the total length of the nav list's
              // own reverse-stagger exit below (5 × 0.035s delay + 0.22s for
              // the last item to finish, ≈0.4s) — otherwise the panel's own
              // background hit opacity 0 while items were still mid-cascade,
              // which made the *whole* close read as one abrupt cut the
              // instant the background vanished, no matter how staggered the
              // items themselves were underneath it.
              transition: reduceMotion ? { duration: 0 } : { duration: 0.4, ease: TURN_EASE_EXIT },
            }}
            // `h-dvh` (dynamic viewport height), not just `inset-0`/implicit
            // 100%: on real mobile browsers the address bar shows/hides as
            // you scroll, and a plain `vh`-based full-screen overlay visibly
            // jumps/resizes as that happens — `dvh` tracks the *current*
            // visual viewport instead of the largest possible one.
            // `overflow-x-hidden` alongside `overflow-y-auto`, not just the
            // latter alone: per the CSS overflow spec, a box with one axis
            // set to non-`visible` computes the other axis as `auto` too —
            // so `.btn-stamp-ring` on the "Войти" button (bleeds out to
            // `scale(1.9)` on hover, see globals.css) turned into real
            // horizontal scrollable overflow on every hover, without this.
            className="fixed inset-x-0 top-0 z-40 flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-[var(--background)] lg:hidden"
          >
            <div className="flex h-16 shrink-0 items-center justify-between border-b-2 border-[var(--rule)] px-4 sm:px-6">
              <SiteLogo size={20} onNavigate={() => setOpen(false)} />
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
                // `exit` mirrors the entrance (`initial`'s own target)
                // instead of being left undefined: without one,
                // AnimatePresence has nothing to wait for on *this* element
                // specifically, so every item just vanished together with
                // the panel the instant its own 250ms fade finished, no
                // matter how nicely staggered the entrance was. Its own
                // `transition` (nested inside the target object — the only
                // way to give exit a different delay than the top-level
                // `transition` prop, which only ever applies to enter) runs
                // the same stagger in reverse: the bottom item leaves first
                // (`NAV.length - 1 - index`), so closing reads as unwinding
                // the same reveal — the list rolling back the way it rolled
                // in, not a mirror-image cascade starting from the top again.
                return (
                  <motion.div
                    key={item.href}
                    initial={reduceMotion ? { opacity: 0 } : initial}
                    animate={reduceMotion ? { opacity: 1 } : animate}
                    exit={
                      reduceMotion
                        ? { opacity: 0 }
                        : { ...initial, transition: { ...transition, delay: (NAV.length - 1 - index) * 0.035 } }
                    }
                    transition={{ ...transition, delay: reduceMotion ? 0 : index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-5 border-b border-[var(--border)] py-5 transition-colors",
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
              <AccountAction user={user} loading={loading} compact onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
