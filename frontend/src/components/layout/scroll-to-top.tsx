"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

import { IMPULSE_SPRING, IMPULSE_TAP, STOP_SPRING } from "@/lib/motion";
import { useScrollToTop } from "@/lib/use-scroll-to-top";

const SHOW_AFTER_PX = 480;

/**
 * Floating "back to top" control, for the length of the page above the
 * colophon.
 *
 * It steps aside when the footer arrives. The colophon carries its own
 * «Наверх» — labelled, in the register of the record — and two controls for the
 * same act, one of them sitting on top of the seals, is one too many.
 *
 * That handover replaced an attempt to keep this button on screen throughout by
 * mooring it above the footer's top edge, and the reason it was dropped is
 * worth keeping: at 640–767px the colophon's bottom row has already gone
 * horizontal (`sm`) and put the seals under this corner, while the link columns
 * have not yet (`md`), leaving a footer 635px tall on a 720px viewport — more
 * than there was room to rise past. The band where the button most needed to
 * move was exactly the band where it could not, and no amount of arithmetic
 * fixes that. Standing down where the footer's own control takes over needs no
 * room at all, and behaves the same at every width.
 *
 * `IntersectionObserver`, not a scroll measurement: "is the footer on screen"
 * is precisely the question, and the browser answers it without this reading
 * layout on every tick.
 *
 * Scroll position is tracked off the native `scroll` event rather than Lenis's
 * own callback — Lenis keeps `window.scrollY` in sync every frame regardless of
 * whether it's mounted (see `SmoothScrollMount`, which skips smooth scrolling
 * entirely under reduced motion), so this stays correct in both branches
 * without depending on the Lenis context being present.
 */
export function ScrollToTop() {
  const [scrolled, setScrolled] = useState(false);
  const [footerInView, setFooterInView] = useState(false);
  const reduceMotion = useReducedMotion();
  const scrollToTop = useScrollToTop();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterInView(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {scrolled && !footerInView ? (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="Наверх"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          whileHover={reduceMotion ? undefined : { scale: 1.08, transition: STOP_SPRING }}
          whileTap={reduceMotion ? undefined : { scale: IMPULSE_TAP.scale, transition: STOP_SPRING }}
          className="scroll-top-btn fixed right-4 bottom-4 z-30 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--chrome-line)] bg-[var(--background)] p-2.5 text-[var(--chrome-muted)] transition-[color,border-color,box-shadow] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-[0_10px_24px_-8px_rgba(0,0,0,0.55)] sm:right-6 sm:bottom-6"
        >
          {!reduceMotion ? <span aria-hidden="true" className="scroll-top-ring" /> : null}
          <motion.svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            whileHover={reduceMotion ? undefined : { scale: 1.2 }}
            transition={IMPULSE_SPRING}
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
