"use client";

import { useState } from "react";

import { MugIcon } from "@/components/brand/mug-icon";
import { useBuza } from "@/features/home/buza-context";

const MUG_SIZE = 28;

/**
 * Кружка — the third symbol of "Буза" in the header river's right third
 * (`river-strip.tsx`), standing for the "напиток" theory of the word's
 * origin (`ETYMOLOGY_CHIPS` in `buza.tsx`) the way the boat stands for
 * "корабль". A single, repeatable `toggle()` — the same register as the
 * boat — with a quick pour-tip flourish (`.mug-tip`) on click.
 */
export function RiverMug() {
  const { open, toggle, openWith } = useBuza();
  const [struck, setStruck] = useState(false);
  const [tipped, setTipped] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        // Opens on the "напиток" reading, the one this symbol stands for.
        if (open) toggle();
        else openWith("drink");
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
      // Cold tin, not the boat's brass: three symbols on one strip need three
      // materials, or they read as one ochre family (see `river-spine.tsx`).
      className="river-symbol grid h-full w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--chrome)]"
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
