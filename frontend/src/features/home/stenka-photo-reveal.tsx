"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/components/ui";

/**
 * Shared scroll-triggered `.unmask` reveal for the archive's photo blocks
 * (stenka-krug, chronicle, paintings) — one implementation instead of three
 * near-duplicates, despite the file living under the "stenka" section that
 * needed it first.
 *
 * IntersectionObserver rather than pointer-tracking: the reveal has to fire
 * identically on touch and desktop, not just for fine-pointer devices. Fires
 * once — `.unmask` is a one-shot clip-path sweep, not a loop — then the
 * observer disconnects. `prefers-reduced-motion` is handled by the global
 * override on `.unmask` itself in globals.css, so no duplicate check here.
 */
export function PhotoReveal({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  /** Lets callers stagger/retime the shared `.unmask` animation per instance
   *  (`animationDelay`, `animationDuration`) without a variant prop. */
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.disconnect();
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(revealed && "unmask", className)} style={style}>
      {children}
    </div>
  );
}
