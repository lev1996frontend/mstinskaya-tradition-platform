"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { IMPULSE_SPRING, IMPULSE_TAP, STOP_SPRING } from "@/lib/motion";
import { useScrollToTop } from "@/lib/use-scroll-to-top";
import { useScrollToTopVisible } from "@/lib/use-scroll-to-top-visible";

// Same values as `Button`'s own `liftVariants`/`iconHoverVariants` (see
// `components/ui/button.tsx`) — a hair of lift plus a slightly bolder icon,
// not the two independent `scale` jumps this used before, which read as the
// button and the arrow disagreeing about how much bigger to get.
const liftVariants = { hover: { y: -1, scale: 1.012, transition: STOP_SPRING } };
const iconHoverVariants = { hover: { scale: 1.15, transition: IMPULSE_SPRING } };

/**
 * Floating "back to top" control — stays on screen the whole way down,
 * including over the colophon, rather than the footer growing its own
 * separate control to hand off to. One control for the one act, everywhere.
 *
 * An earlier version stood this button down once the footer scrolled into
 * view (an `IntersectionObserver` on `<footer>`), specifically because
 * at 640–767px the colophon's bottom row has already gone horizontal (`sm`)
 * and puts the seals in this same bottom-right corner while the link columns
 * have not yet stacked away (`md`), leaving the two visually on top of each
 * other. Kept on screen everywhere now instead: `footer-bottom-row.tsx`
 * reserves clearance (`sm:pr-24`) so the seals sit clear of this corner —
 * but only while this exact button is actually showing (via the same
 * `useScrollToTopVisible` hook below), not permanently. Scrolling down
 * hides the button, and the seals sit flush against the row's right edge
 * again — there is nothing left to clear.
 *
 * `bottom-4` at every width, not a larger offset from `sm` up: the seal
 * row's own icons sit at a fixed height above the true page bottom (the
 * container's `py-6` plus half the icon's own size, ~38px, since this footer
 * row is the last thing on the page), and `bottom-4` happens to centre this
 * button on that same line. A bigger offset at `sm` and up — tried first —
 * raised the button clear of that line and put it visibly off-centre next to
 * the seals once both were on screen together at the page's true bottom.
 *
 * Filled in the site's own primary-button colour rather than a muted outline
 * at rest — sitting over page content on every scroll position now, not just
 * appearing in the empty margin above the old footer hand-off, it needs to
 * read as a control at a glance rather than blend into whatever is behind it.
 * The hover now borrows `Button`'s own primary recipe outright (`.btn-stamp-ring`
 * in gold, a 1px lift, not a scale) rather than the fixed accent-coloured
 * `.scroll-top-ring` this used before: that ring stamped in `--accent`, same
 * as this button's own fill, so once the fill changed from the old muted
 * outline to solid `--accent` the ring stopped reading against it at all —
 * gold is what every other filled button on the site stamps with for exactly
 * that reason.
 *
 * Scroll position is tracked off the native `scroll` event rather than Lenis's
 * own callback — Lenis keeps `window.scrollY` in sync every frame regardless of
 * whether it's mounted (see `SmoothScrollMount`, which skips smooth scrolling
 * entirely under reduced motion), so this stays correct in both branches
 * without depending on the Lenis context being present.
 *
 * Direction-aware, not just position-aware: past `SHOW_AFTER_PX`, the button
 * shows while scrolling *up* and hides while scrolling *down* (the standard
 * "don't compete with reading" pattern — a fixed control sitting over page
 * content is more of a distraction while someone is actively reading their
 * way down than a help, and it's exactly scrolling back up where wanting to
 * jump to the top becomes likely). `DIRECTION_HYSTERESIS_PX` (in the shared
 * hook below) is what keeps that from flickering on scroll-event noise.
 *
 * The show/hide logic itself lives in `useScrollToTopVisible`
 * (`lib/use-scroll-to-top-visible.ts`), shared with `footer-bottom-row.tsx`
 * so the footer's own bottom-right corner can shift the "Знаки традиции"
 * row clear of this exact button only while it's actually on screen.
 */
export function ScrollToTop() {
  const scrolled = useScrollToTopVisible();
  const reduceMotion = useReducedMotion();
  const scrollToTop = useScrollToTop();

  return (
    <AnimatePresence>
      {scrolled ? (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Наверх"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          whileHover={reduceMotion ? undefined : "hover"}
          whileTap={reduceMotion ? undefined : { scale: IMPULSE_TAP.scale, transition: STOP_SPRING }}
          variants={reduceMotion ? undefined : liftVariants}
          className="scroll-top-btn fixed right-4 bottom-4 z-30 flex items-center justify-center rounded-[var(--radius-sm)] border-b-2 border-[var(--accent-strong)] bg-[var(--accent)] p-2.5 text-white shadow-[0_10px_20px_-12px_rgba(176,42,32,0.45)] transition-[background-color,box-shadow] hover:bg-[var(--accent-strong)] hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] sm:right-6"
        >
          {!reduceMotion ? <span aria-hidden="true" className="btn-stamp-ring" /> : null}
          <motion.svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            variants={reduceMotion ? undefined : iconHoverVariants}
          >
            <path
              d="M6 14.5 L12 8.5 L18 14.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
