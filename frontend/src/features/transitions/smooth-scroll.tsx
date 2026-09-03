"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";
import { useReducedMotion } from "framer-motion";

import { gsap, ScrollTrigger } from "@/lib/gsap";

/** Runs inside the `ReactLenis` tree purely to keep GSAP's ScrollTrigger
 *  aware of Lenis-driven scroll positions — without this, ScrollTrigger
 *  still measures the browser's native (unsmoothed) scroll and every pinned/
 *  scrubbed animation drifts out of sync with what's actually on screen. */
function ScrollTriggerSync() {
  useLenis(() => ScrollTrigger.update());
  return null;
}

/**
 * Smooth scroll for the whole app, mounted once near the root layout —
 * skipped entirely under `prefers-reduced-motion`, same gate as every other
 * pointer/scroll-driven effect in this codebase.
 *
 * `autoRaf={false}` + driving Lenis's `raf()` from `gsap.ticker` (rather than
 * Lenis's own independent rAF loop) is the integration GSAP's own docs call
 * out as critical: it keeps Lenis's scroll tick and every GSAP/ScrollTrigger
 * animation on one shared clock instead of two rAF loops that can drift and
 * visibly jitter against each other.
 */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    if (reduceMotion) return;
    function raf(time: number) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
    };
  }, [reduceMotion]);

  if (reduceMotion) return <>{children}</>;

  return (
    <ReactLenis root ref={lenisRef} autoRaf={false} options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
      <ScrollTriggerSync />
      {children}
    </ReactLenis>
  );
}
