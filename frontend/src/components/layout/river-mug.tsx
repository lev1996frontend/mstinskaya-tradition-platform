"use client";

import { useState } from "react";

import { useBuza } from "@/features/home/buza-context";

const MUG_SIZE = 22;

/** Plain handled mug — a cylindrical cup, not a stemmed goblet: "буза" is
 *  a drink, but a goblet reads as wine/alcohol in a way this shouldn't lean
 *  into. Same single-color `currentColor` line/fill language as `BoatIcon`
 *  (`river-strip.tsx`) and `weapon-glyphs.tsx`. */
function MugIcon({ size = MUG_SIZE }: { size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 22} viewBox="0 0 22 24" fill="none" aria-hidden="true">
      <path d="M4 5 H15 V17 C15 19.2 13.2 21 11 21 H8 C5.8 21 4 19.2 4 17 Z" fill="currentColor" opacity="0.9" />
      <path
        d="M15 8 H16.5 C18 8 19 9 19 10.5 C19 12 18 13 16.5 13 H15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M4 5 H15" stroke="currentColor" strokeWidth="1.3" opacity="0.6" />
    </svg>
  );
}

/**
 * Кружка — the third symbol of "Буза" in the header river's right third
 * (`river-strip.tsx`), standing for the "напиток" theory of the word's
 * origin (`ETYMOLOGY_CHIPS` in `buza.tsx`) the way the boat stands for
 * "корабль". A single, repeatable `toggle()` — the same register as the
 * boat — with a quick pour-tip flourish (`.mug-tip`) on click.
 */
export function RiverMug() {
  const { open, toggle } = useBuza();
  const [struck, setStruck] = useState(false);
  const [tipped, setTipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        toggle();
        setStruck(true);
        setTipped(true);
      }}
      title="Кружка традиции"
      aria-expanded={open}
      aria-controls="buza"
      aria-label={open ? "Свернуть раздел «Буза»" : "Раскрыть раздел «Буза»"}
      onAnimationEnd={(event) => {
        // Bound here, not on either inner span directly: `.strike-ring` and
        // `.mug-tip` animate on sibling elements, and `animationend` only
        // bubbles up an ancestor chain, never sideways to a sibling's own
        // handler — this button is the nearest element that's an ancestor
        // of both.
        if (event.animationName === "strike-ring") setStruck(false);
        if (event.animationName === "mug-tip") setTipped(false);
      }}
      className="river-symbol grid h-full w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--gold)]"
    >
      <span
        className="river-bob relative grid place-items-center"
        style={{ width: MUG_SIZE, height: MUG_SIZE, animationDelay: "-2.3s" }}
      >
        {struck ? (
          <span aria-hidden="true" className="strike-ring pointer-events-none absolute inset-0 m-auto size-6" />
        ) : null}
        <span className={tipped ? "mug-tip" : undefined}>
          <MugIcon size={MUG_SIZE} />
        </span>
      </span>
    </button>
  );
}
