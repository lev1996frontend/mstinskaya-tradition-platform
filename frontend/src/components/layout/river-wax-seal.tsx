"use client";

import { useEffect, useRef, useState } from "react";

import { useBuza } from "@/features/home/buza-context";

const SEAL_SIZE = 38;

/**
 * Simplified silhouette of the club crest — two confronting bears rearing
 * up, paws reaching toward each other, over a two-barred cross, ringed. Not
 * a literal trace of the source mark (a ~26px wax disc can't carry that
 * much fur/claw detail; it would just turn to mud), but the same
 * composition — head, raised paw, cross — reduced to shapes that still read
 * at stamp size. Always solid black, `currentColor` deliberately unused
 * here — an emboss reads as pressed-in shadow, not as the wax's own tint.
 */
function SealCrestIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="#000" strokeWidth="1.2" />

      {/* left bear: head + ear + a paw reaching up toward center */}
      <path
        d="M5 15 C4.3 11 6.5 8 9.6 8.3 C11.3 8.5 12.4 9.6 13.3 11.2 L15.4 14.6 L11.4 15.2 C9 15.6 6.6 15 5 13.6 Z"
        fill="#000"
      />
      <path d="M6.8 8.6 L8.4 10.9 L5.6 11.2 Z" fill="#000" />
      <path d="M12.5 15 L15.5 12.8 L15.9 14.3 L17.3 13 L16.9 14.8 L18.2 14 L17.1 16.1 L13.6 16.6 Z" fill="#000" />

      {/* right bear — mirrored (x' = 32 − x) */}
      <path
        d="M27 15 C27.7 11 25.5 8 22.4 8.3 C20.7 8.5 19.6 9.6 18.7 11.2 L16.6 14.6 L20.6 15.2 C23 15.6 25.4 15 27 13.6 Z"
        fill="#000"
      />
      <path d="M25.2 8.6 L23.6 10.9 L26.4 11.2 Z" fill="#000" />
      <path d="M19.5 15 L16.5 12.8 L16.1 14.3 L14.7 13 L15.1 14.8 L13.8 14 L14.9 16.1 L18.4 16.6 Z" fill="#000" />

      {/* two-barred cross, below where the paws meet */}
      <path
        d="M16 17.5 V25 M13.7 19.2 H18.3 M14.8 21.6 H17.2"
        stroke="#000"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The wax disc itself — rendered twice once cracked (each copy clipped to
 *  one half via the caller's `clip-path`), once otherwise. Red wax (`--accent`,
 *  the brighter oxblood register — `--accent-deep` read too dark/brown to
 *  land as "red") with the crest showing plainly on it from the start, not
 *  hidden under anything. */
function SealDisc({ size, dim = false }: { size: number; dim?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--accent) 55%, white) 0%, var(--accent) 55%, color-mix(in srgb, var(--accent) 85%, black) 100%)",
        boxShadow: "var(--shadow-sm)",
        opacity: dim ? 0.85 : 1,
      }}
    >
      <SealCrestIcon size={size * 0.62} />
    </span>
  );
}

/**
 * Сургучная печать — a wax seal in the header river's left third
 * (`river-strip.tsx`), a second symbol of "Буза" alongside the boat
 * (`river-boat.tsx`) and the mug (`river-mug.tsx`), standing for the
 * "буянить" theory of the word's origin. The crest sits plainly on the red
 * wax from the start — no patina/oxide veil hiding it (an earlier version
 * covered it and required scratching the layer off first; dropped, both for
 * simplicity and because a seal that hasn't been touched yet should still
 * show what's stamped on it). One click cracks it into two halves
 * (`.wax-crack-a`/`.wax-crack-b`), opening "Буза" via `openSection()` —
 * never `toggle()`, since the section could already be open from another
 * symbol, and a "reveal" ritual shouldn't be the one that accidentally
 * closes it.
 *
 * The crack isn't permanent: closing "Буза" (from *any* symbol, not just
 * this one) reseals it — next click starts the reveal over. A wax seal that
 * stays broken forever would make itself a one-shot prop instead of a
 * recurring ritual.
 */
export function RiverWaxSeal() {
  const { open, toggle, openSection } = useBuza();
  const [cracked, setCracked] = useState(false);
  const [flash, setFlash] = useState(false);
  const wasOpen = useRef(open);

  // Reseal when "Буза" closes, however it closed — not just when *this*
  // symbol closes it.
  useEffect(() => {
    if (wasOpen.current && !open) setCracked(false);
    wasOpen.current = open;
  }, [open]);

  function handleClick() {
    if (cracked) {
      toggle();
      return;
    }
    setCracked(true);
    setFlash(true);
    openSection();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onAnimationEnd={(event) => {
        if (event.animationName !== "strike-ring") return;
        setFlash(false);
      }}
      title="Печать традиции"
      aria-label={
        cracked
          ? open
            ? "Свернуть раздел «Буза»"
            : "Раскрыть раздел «Буза»"
          : "Расколоть печать традиции"
      }
      className="river-symbol grid h-full w-full cursor-pointer place-items-center border-0 bg-transparent p-0"
    >
      <span
        className="river-bob relative grid place-items-center"
        style={{ width: SEAL_SIZE, height: SEAL_SIZE, animationDelay: "-1.1s" }}
      >
        {flash ? (
          <span aria-hidden="true" className="strike-ring pointer-events-none absolute inset-0 m-auto size-6" />
        ) : null}

        {cracked ? (
          <>
            <span aria-hidden="true" className="wax-crack-a absolute inset-0" style={{ clipPath: "inset(0 50% 0 0)" }}>
              <SealDisc size={SEAL_SIZE} dim />
            </span>
            <span aria-hidden="true" className="wax-crack-b absolute inset-0" style={{ clipPath: "inset(0 0 0 50%)" }}>
              <SealDisc size={SEAL_SIZE} dim />
            </span>
          </>
        ) : (
          <span className="pop-in absolute inset-0">
            <SealDisc size={SEAL_SIZE} />
          </span>
        )}
      </span>
    </button>
  );
}
