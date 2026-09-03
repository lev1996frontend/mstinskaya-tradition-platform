"use client";

import { useState } from "react";

import { SealDisc } from "@/components/brand/seal-disc";
import { useBuza } from "@/features/home/buza-context";

const SHIELD_SIZE = 48;

/**
 * Щит традиции — the club emblem struck into a disc of red wax, riding the
 * header river's left third (`river-strip.tsx`) as a second symbol of "Буза"
 * alongside the boat (`river-boat.tsx`) and the mug (`river-mug.tsx`),
 * standing for the "буянить" theory of the word's origin.
 *
 * It carries the real emblem (`SealDisc emblem`), which is why it's 48px
 * against the boat's 38 and the mug's 28 — the traced logo needs the room, and
 * the strip grew to 56px to give it. The two symbols beside it were scaled up
 * with the strip so they still read as three things riding one body of water.
 *
 * Clicking strikes it rather than breaking it. An earlier version cracked the
 * seal into two halves that parted and stayed parted until the section closed;
 * a shield that shatters is a one-shot prop, and this one is meant to be hit
 * again on every visit. So the blow lands (`.shield-brace` — the shield gives
 * ground, then comes back) with a ring of impact over its face
 * (`.strike-ring`, shared with the clash plate), and afterwards it *holds the
 * guard* (`.shield-guard-raised`) for as long as "Буза" is open. The open
 * section gets a visible posture instead of a visible wound.
 *
 * The guard drops when "Буза" closes, however it closed — the boat and the mug
 * close the same section, and a shield still braced against a section that
 * isn't there would be lying about the page's state. That falls out of
 * deriving the pose from `open` rather than storing it here.
 */
export function RiverWaxSeal() {
  const { open, toggle, openWith } = useBuza();
  const [struck, setStruck] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        // Opens on the "буянить" reading, the one this symbol stands for —
        // the same contract as the boat's and the mug's.
        if (open) toggle();
        else openWith("buyat");
        setStruck(true);
      }}
      onAnimationEnd={(event) => {
        // `.strike-ring` (650ms) outlasts `.shield-brace` (420ms), so clearing
        // on the ring clears both. Bound on the button, not the spans: the two
        // animations run on separate elements and `animationend` only bubbles
        // up, never sideways — see the same note in `river-mug.tsx`.
        if (event.animationName !== "strike-ring") return;
        setStruck(false);
      }}
      title="Щит традиции"
      aria-expanded={open}
      aria-controls="buza"
      aria-label={open ? "Свернуть раздел «Буза»" : "Раскрыть раздел «Буза»"}
      className={`river-symbol grid h-full w-full cursor-pointer place-items-center border-0 bg-transparent p-0 ${
        open ? "shield-on-guard" : ""
      }`}
    >
      <span
        className="river-bob relative grid place-items-center"
        style={{ width: SHIELD_SIZE, height: SHIELD_SIZE, animationDelay: "-1.1s" }}
      >
        {/* Three nested layers, one transform each: the bob rides the water,
            the guard holds the raised pose, the brace plays the recoil. A
            single element can't run all three — the last one to write
            `transform` would win and the other two would vanish. */}
        <span className={`shield-guard grid place-items-center ${open ? "shield-guard-raised" : ""}`}>
          <span className={`grid place-items-center ${struck ? "shield-brace" : ""}`}>
            <SealDisc size={SHIELD_SIZE} emblem />
          </span>
        </span>

        {/* Above the shield, not behind it: the ring starts at a third of its
            own 32px and grows past the disc, so it reads as the blow flashing
            across the shield's face rather than something peeking out from
            under it. */}
        {struck ? (
          <span aria-hidden="true" className="strike-ring pointer-events-none absolute inset-0 m-auto size-8" />
        ) : null}
      </span>
    </button>
  );
}
