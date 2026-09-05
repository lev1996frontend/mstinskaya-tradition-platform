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
 *
 * It also carries the loading state for the picture inside it. These are large
 * public-domain scans on a `loading="lazy"` img, so on a cold connection the
 * archive showed a run of empty bordered boxes with no sign that anything was
 * on its way. Every archive photo on the site already goes through this
 * component, which is why the indicator lives here rather than being repeated
 * in the four sections that show pictures.
 *
 * The reveal now waits for the picture as well as for the viewport: the wipe is
 * one-shot, so firing it while the box was still empty spent the animation on
 * nothing and the picture then simply appeared.
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
  const [loaded, setLoaded] = useState(false);

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

  /* Read off the real element rather than an `onLoad` prop: the picture is
     passed in as `children`, so this component never touches the `<img>` tag
     itself and can't hand it a handler.

     `complete` is checked first and matters — a cached image is already loaded
     before this effect runs and would otherwise sit behind the indicator
     forever, waiting for a `load` event that fired before anyone was
     listening. An `error` counts as done too: a picture that will never arrive
     must not spin for the rest of the session. */
  useEffect(() => {
    const image = ref.current?.querySelector("img");
    if (!image) {
      setLoaded(true);
      return;
    }
    if (image.complete) {
      setLoaded(true);
      return;
    }
    const done = () => setLoaded(true);
    image.addEventListener("load", done);
    image.addEventListener("error", done);
    return () => {
      image.removeEventListener("load", done);
      image.removeEventListener("error", done);
    };
  }, []);

  return (
    <div ref={ref} className={cn("relative", revealed && loaded && "unmask", className)} style={style}>
      {children}
      {loaded ? null : (
        <span aria-hidden="true" className="archive-loading">
          <span className="archive-loading-ring" />
        </span>
      )}
    </div>
  );
}
