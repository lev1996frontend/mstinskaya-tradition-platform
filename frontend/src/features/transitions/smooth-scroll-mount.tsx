"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

/**
 * The seam that keeps Lenis and GSAP off the critical path.
 *
 * `ssr: false` is legal here and only here: this component renders no page
 * content, so deferring it defers decoration and nothing else. (The Next docs
 * are explicit that `ssr: false` belongs in a Client Component, which is why
 * this tiny file exists rather than the `dynamic()` call sitting in the root
 * layout.) Everything the reader actually came for is still server-rendered.
 *
 * The reduced-motion gate is deliberately *above* the dynamic import rather
 * than inside `SmoothScrollRoot`: someone who prefers reduced motion gets no
 * smooth scrolling either way, so there is no reason to make them download
 * the chunk that implements it.
 */
const SmoothScrollRoot = dynamic(
  () => import("./smooth-scroll").then((mod) => mod.SmoothScrollRoot),
  { ssr: false },
);

export function SmoothScrollMount() {
  const reduceMotion = useReducedMotion();

  // Mount unless motion is explicitly unwanted — the same polarity the old
  // wrapper used (`if (reduceMotion) return children`), so the null value this
  // hook can report before it has resolved doesn't suppress smooth scroll.
  if (reduceMotion) return null;

  return <SmoothScrollRoot />;
}
