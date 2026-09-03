"use client";

import { useState } from "react";

import { useBuza } from "@/features/home/buza-context";

const BOAT_WIDTH = 30;
const BOAT_HEIGHT = 24;

/** Side-silhouette boat — hull, mast, two triangular sails — in the same
 *  single-color `currentColor` line/fill language as `weapon-glyphs.tsx`. */
function BoatIcon({ size = BOAT_WIDTH }: { size?: number }) {
  return (
    <svg width={size} height={(size * 24) / 29} viewBox="0 0 29 24" fill="none" aria-hidden="true">
      <path d="M2 16.5 L27 16.5 L22.5 21.5 L6.5 21.5 Z" fill="currentColor" />
      <path d="M14.5 16.5 L14.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M15.2 3.6 L22 15 L15.2 15 Z" fill="currentColor" opacity="0.8" />
      <path d="M13.8 7.4 L8.5 15 L13.8 15 Z" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/**
 * Кораблик — the first symbol of "Буза" in the header river's middle third
 * (`river-strip.tsx` divides the strip into three equal zones — this one,
 * the wax seal's, and the mug's; see `river-wax-seal.tsx`/`river-mug.tsx`),
 * standing for the "корабль" theory of the word's origin (`ETYMOLOGY_CHIPS`
 * in `buza.tsx`). A fixed, bobbing (`.river-bob`) hull now, not a
 * cursor-tracked one — an earlier version chased the pointer around the
 * whole strip and had to actively steer clear of the other two symbols to
 * avoid sailing over them; three fixed zones, each dimming/brightening on
 * its own hover (`.river-symbol`, globals.css), is the same "something is
 * here, look closer" affordance with far fewer moving parts, and it means
 * this boat is never lit up outside its own third the way the tracked
 * version used to read as "always highlighted" wherever the cursor was.
 */
export function RiverBoat() {
  const { open, toggle } = useBuza();
  const [struck, setStruck] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        toggle();
        setStruck(true);
      }}
      onAnimationEnd={(event) => {
        if (event.animationName !== "strike-ring") return;
        setStruck(false);
      }}
      title="Плывёт кораблик"
      aria-expanded={open}
      aria-controls="buza"
      aria-label={open ? "Свернуть раздел «Буза»" : "Раскрыть раздел «Буза»"}
      className="river-symbol grid h-full w-full cursor-pointer place-items-center border-0 bg-transparent p-0 text-[var(--gold)]"
    >
      <span
        className="river-bob relative grid place-items-center"
        style={{ width: BOAT_WIDTH, height: BOAT_HEIGHT }}
      >
        {struck ? (
          <span aria-hidden="true" className="strike-ring pointer-events-none absolute inset-0 m-auto size-6" />
        ) : null}
        <BoatIcon size={30} />
      </span>
    </button>
  );
}
