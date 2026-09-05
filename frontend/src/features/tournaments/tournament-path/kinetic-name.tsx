"use client";

import { letterDelayMs } from "@/lib/motion";

/**
 * Per-letter reveal for the fighter name, re-triggered whenever the name
 * itself changes (opponent changes every ladder step): the `key={name}`
 * on the wrapping list remounts every span so the `.letter` animation
 * (globals.css) plays again from delay 0, matching the prototype's "letters
 * walk into the circle on every new step" behaviour.
 */
export function KineticName({ name, align = "left" }: { name: string; align?: "left" | "right" }) {
  return (
    <p
      key={name}
      /* Centred until the duel row splits into three columns, then pulled to
         its own side — the cards are stacked on a phone, and a name shoved
         hard against the opposite edge from the one above it reads as
         misalignment rather than as two fighters facing each other. */
      className={`m-0 flex flex-wrap justify-center ${align === "right" ? "lg:justify-end" : "lg:justify-start"}`}
      style={{ perspective: 700 }}
    >
      {[...name].map((ch, i) => (
        <span
          key={`${name}-${i}`}
          className="letter font-display whitespace-pre text-[clamp(1.75rem,3vw,3rem)] font-bold leading-[1.06] tracking-tight"
          style={{ animationDelay: `${letterDelayMs(i)}ms` }}
        >
          {ch}
        </span>
      ))}
    </p>
  );
}
