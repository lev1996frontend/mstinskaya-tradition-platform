"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLenis } from "lenis/react";
import { useEffect, useState } from "react";

import { IMPULSE_SPRING, IMPULSE_TAP, STOP_SPRING } from "@/lib/motion";

const SHOW_AFTER_PX = 480;

/** ease-out-quint — a gentler decel than Lenis's default, so the scroll-to-top settles instead of snapping. */
const SCROLL_TOP_EASING = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * Floating "back to top" control. Scroll position is tracked off the native
 * `scroll` event rather than Lenis's own callback — Lenis keeps
 * `window.scrollY` in sync every frame regardless of whether it's mounted
 * (see `SmoothScroll`, which skips `ReactLenis` entirely under reduced
 * motion), so this stays correct in both branches without depending on the
 * Lenis context being present.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();
  const lenis = useLenis();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = () => {
    if (lenis) {
      lenis.scrollTo(0, { duration: reduceMotion ? 0 : 1.6, easing: SCROLL_TOP_EASING });
    } else {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          onClick={handleClick}
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
