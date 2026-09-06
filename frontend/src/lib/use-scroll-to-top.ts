"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

import {
  getLenis,
  getLenisServerSnapshot,
  subscribeLenis,
} from "@/features/transitions/lenis-instance";

/** ease-out-quint — a gentler decel than Lenis's default, so the return to the
 *  top settles instead of snapping. */
const SCROLL_TOP_EASING = (t: number) => 1 - Math.pow(1 - t, 5);

/**
 * Идти наверх. One way up the page, shared by the two controls that offer it —
 * the floating button and the colophon's own «Наверх» — so they can never
 * disagree about how the journey back feels.
 *
 * The Lenis instance is read from `lenis-instance.ts` rather than Lenis's own
 * `useLenis`: these controls sit in the root layout, and importing the Lenis
 * react bindings here would drag Lenis (and GSAP behind it) into the shared
 * chunk of every route — exactly what mounting smooth scroll lazily was meant
 * to prevent. `null` until that chunk has loaded, which the fallback below
 * treats as "no smooth scroll available".
 */
export function useScrollToTop(): () => void {
  const reduceMotion = useReducedMotion();
  const lenis = useSyncExternalStore(subscribeLenis, getLenis, getLenisServerSnapshot);

  return useCallback(() => {
    if (lenis) {
      lenis.scrollTo(0, { duration: reduceMotion ? 0 : 1.6, easing: SCROLL_TOP_EASING });
    } else {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    }
  }, [lenis, reduceMotion]);
}
