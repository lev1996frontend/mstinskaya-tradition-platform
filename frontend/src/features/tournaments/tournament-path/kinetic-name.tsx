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
      className={`m-0 flex flex-wrap ${align === "right" ? "justify-end" : "justify-start"}`}
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
