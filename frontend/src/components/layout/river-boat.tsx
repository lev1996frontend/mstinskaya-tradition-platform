"use client";

import { useState } from "react";

import { BoatIcon } from "@/components/brand/boat-icon";
import { useBuza } from "@/features/home/buza-context";

const BOAT_WIDTH = 38;
const BOAT_HEIGHT = 30;

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
  const { open, toggle, openWith } = useBuza();
  const [struck, setStruck] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        // Still a repeatable open/close, but opening lands on this symbol's
        // own reading of the word rather than leaving the section on whatever
        // was last chosen — see `openWith` in `buza-context.tsx`.
        if (open) toggle();
        else openWith("korabl");
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
        <BoatIcon size={BOAT_WIDTH} />
      </span>
    </button>
  );
}
