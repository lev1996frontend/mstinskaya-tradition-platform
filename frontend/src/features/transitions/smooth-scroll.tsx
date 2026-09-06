"use client";

import { useEffect, useRef } from "react";
import { ReactLenis, useLenis, type LenisRef } from "lenis/react";

import { gsap, ScrollTrigger } from "@/lib/gsap";
import { publishLenis } from "./lenis-instance";

/** Runs inside the `ReactLenis` tree purely to keep GSAP's ScrollTrigger
 *  aware of Lenis-driven scroll positions — without this, ScrollTrigger
 *  still measures the browser's native (unsmoothed) scroll and every pinned/
 *  scrubbed animation drifts out of sync with what's actually on screen.
 *
 *  It also republishes the live instance to `lenis-instance.ts`, so consumers
 *  can reach it without importing the Lenis react bindings themselves. */
function ScrollTriggerSync() {
  const lenis = useLenis(() => ScrollTrigger.update());

  useEffect(() => {
    publishLenis(lenis ?? null);
    return () => publishLenis(null);
  }, [lenis]);

  return null;
}

/**
 * Smooth scroll for the whole app, mounted once near the root layout — but as
 * a *sibling* of the page content rather than a wrapper around it.
 *
 * That distinction is the whole point. While this component wrapped
 * `{children}`, it could never be code-split: deferring it with
 * `next/dynamic({ ssr: false })` would have deferred the entire page with it
 * and stripped the content out of the server-rendered HTML. Lenis's `root`
 * mode drives `document.documentElement` and, per its own source, renders
 * `children` straight through without a wrapper element — so it has no need
 * to enclose anything, and passing it none costs nothing. With the wrapper
 * gone, `smooth-scroll-mount.tsx` can load this (and GSAP, ~43 KB gzipped)
 * after hydration instead of on the critical path of every route.
 *
 * `prefers-reduced-motion` is gated one level up, in the mount component, so
 * that a reader who prefers reduced motion never downloads this chunk at all.
 *
 * `autoRaf={false}` + driving Lenis's `raf()` from `gsap.ticker` (rather than
 * Lenis's own independent rAF loop) is the integration GSAP's own docs call
 * out as critical: it keeps Lenis's scroll tick and every GSAP/ScrollTrigger
 * animation on one shared clock instead of two rAF loops that can drift and
 * visibly jitter against each other.
 */
export function SmoothScrollRoot() {
  const lenisRef = useRef<LenisRef>(null);

  useEffect(() => {
    function raf(time: number) {
      lenisRef.current?.lenis?.raf(time * 1000);
    }
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(raf);
    };
  }, []);

  return (
    <ReactLenis root ref={lenisRef} autoRaf={false} options={{ lerp: 0.1, duration: 1.2, smoothWheel: true }}>
      <ScrollTriggerSync />
    </ReactLenis>
  );
}
