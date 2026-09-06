"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { WeaponSeal } from "@/components/brand/seal";
import { WEAPON_MOTIFS } from "@/components/brand/weapon-glyphs";

/**
 * Блик — light running along the colophon's four seals when they come into
 * view.
 *
 * This started as a scroll-driven animation (`animation-timeline: view()`) to
 * keep the footer entirely server-rendered and free of a timer. That cannot
 * work for this particular row, and the measurement is worth recording so it
 * isn't tried again: the seals sit at the very bottom of the document, so they
 * become fully visible at 22.4% of the footer's view timeline while the page's
 * own maximum scroll only reaches 23.3% of it. Under 1% of the timeline — some
 * 20px of scroll — exists after the thing is visible. A scroll-driven glint
 * therefore ran its whole course while the row was still below the fold and
 * was over before anyone could see it.
 *
 * So the trigger is arrival in view, and the animation runs on its own clock
 * once it gets there. That costs one small client component — this file, and
 * nothing else in the footer moves.
 *
 * Not `disconnect()`ed after the first sighting: the flag follows visibility
 * both ways, so leaving the footer and coming back plays it again. That is the
 * "sometimes it catches the light" this is for; firing once per page load
 * would mean most visits never see it at all.
 */
export function FooterSeals() {
  const ref = useRef<HTMLDivElement>(null);
  const [lit, setLit] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setLit(entry.isIntersecting),
      /* The row is 28px tall and the last thing on the page; a high threshold
         would need it clear of the bottom edge, which on a short viewport it
         may never be. */
      { threshold: 0.25 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex items-center gap-3" aria-hidden="true">
      {WEAPON_MOTIFS.map((motif, index) => (
        <span
          key={motif.key}
          className="inline-flex"
          /* Staggered so the light travels along the row rather than four
             marks lifting together. */
          style={{ "--glint-lead": index } as CSSProperties}
        >
          <WeaponSeal
            motif={motif.key}
            size={28}
            /* `record`, not the component's default `iron`: iron is drawn for
               seals standing on a lit surface and comes out at 1.77:1 on the
               colophon's near-black ground — below the point at which a shape
               reads at all. */
            tone="record"
            className={lit ? "seal-glint" : undefined}
          />
        </span>
      ))}
    </div>
  );
}
