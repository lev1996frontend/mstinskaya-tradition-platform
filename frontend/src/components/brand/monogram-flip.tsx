"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { Monogram } from "@/components/brand/monogram";
import { Seal } from "@/components/brand/seal";
import { WEAPON_MOTIFS, type WeaponMotifKey } from "@/components/brand/weapon-glyphs";
import { IMPULSE_TAP, TURN_EASE } from "@/lib/motion";

/**
 * The header plate turns over on hover/focus (driven by the enclosing link in
 * `SiteHeader`, so keyboard users get it too) and lands on the next weapon
 * glyph in sequence — a different one each time, cycling in a fixed order so
 * it stays predictable rather than showing a single fixed reverse face.
 *
 * A single 180° turn per toggle (not an extra full spin): a bigger throw-style
 * rotation crosses the edge-on boundary three times instead of once at this
 * icon size, which read as flicker/jitter rather than a flourish.
 *
 * `struck` layers a second, independent gesture on top of the hover flip: a
 * click-triggered сшибка — the same two-seal duel as `clash-card.tsx` (both
 * ported from the design canvas's "Живая сшибка" prototype), scaled down to
 * fit the badge: the current cycling weapon (`weaponIndex`, the same one
 * already on the flip's reverse face) against `opponent` (rolled by the
 * caller — `SiteHeader` — at click time via `randomWeaponMotif()`; picking it
 * here instead would mean calling `Math.random()` during render, which
 * `eslint-plugin-react-hooks`'s purity rule rightly rejects) lunge in from
 * either side and collide where the monogram sits. It briefly
 * *replaces* the flip's own `motion.span` (rather than layering on top of
 * it) — an early version overlaid the two seals over the badge and, at this
 * 36px scale, they mostly just occluded the "М" instead of reading as a
 * duel; swapping avoids both that and any fight between the duel's plain-CSS
 * transforms and the flip's framer-motion-driven ones on the same element.
 */
export function MonogramFlip({
  flipped,
  struck = false,
  opponent = "kisten",
  onStrikeEnd,
  size = 20,
}: {
  flipped: boolean;
  struck?: boolean;
  /** The `struck` duel's opponent motif — rolled by the caller, see above. */
  opponent?: WeaponMotifKey;
  onStrikeEnd?: () => void;
  size?: number;
}) {
  const reduceMotion = useReducedMotion();
  const [rotation, setRotation] = useState(0);
  const [weaponIndex, setWeaponIndex] = useState(0);
  // Adjusting state on a prop change, done during render rather than in an
  // effect (react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // — this is the recommended escape hatch for "prop changed -> derive next
  // state" and avoids the extra render an effect-based version would cause.
  const [prevFlipped, setPrevFlipped] = useState(flipped);
  if (flipped !== prevFlipped) {
    setPrevFlipped(flipped);
    setRotation((r) => r + 180);
    if (flipped) {
      setWeaponIndex((current) => (current + 1) % WEAPON_MOTIFS.length);
    }
  }

  const { Icon } = WEAPON_MOTIFS[weaponIndex];
  const OpponentIcon = WEAPON_MOTIFS.find((motif) => motif.key === opponent)?.Icon ?? Icon;

  return (
    <span
      className="relative grid size-9 shrink-0 place-items-center"
      style={{ perspective: 400 }}
      // `.lunge-a-sm`/`.lunge-b-sm` (760ms) outlast `.strike-ring` (650ms)
      // and `.flash` (600ms), all three of which bubble `animationend` here;
      // wait for the lunge specifically so clearing `struck` doesn't unmount
      // the ring/flash overlay while the seals are still mid-collision.
      onAnimationEnd={(event) => {
        if (event.animationName !== "lunge-a-sm" && event.animationName !== "lunge-b-sm") return;
        onStrikeEnd?.();
      }}
    >
      {struck ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-[-15px] inset-y-0 flex items-center justify-center gap-2">
          <span
            className="flash absolute inset-0 m-auto size-9 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(176,42,32,.6), transparent 70%)" }}
          />
          <span className="strike-ring absolute inset-0 m-auto size-6" />
          <span className="lunge-a-sm">
            <Seal size={20} tone="accent" filled>
              <Icon size={9} />
            </Seal>
          </span>
          <span className="lunge-b-sm">
            <Seal size={20} tone="accent" filled>
              <OpponentIcon size={9} />
            </Seal>
          </span>
        </div>
      ) : (
        <motion.span
          className="grid size-9 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-white"
          style={{ transformStyle: "preserve-3d" }}
          // rotateX carries the turn; scale dips briefly at the edge-on hold so
          // the flip reads as a weighted toss with a beat, not a frictionless spin.
          animate={reduceMotion ? { rotateX: rotation } : { rotateX: rotation, scale: [1, IMPULSE_TAP.scale, 1] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: TURN_EASE }}
        >
          <span className="grid place-items-center" style={{ backfaceVisibility: "hidden" }}>
            <Monogram size={size} />
          </span>
          <span
            className="absolute inset-0 grid place-items-center"
            style={{ backfaceVisibility: "hidden", transform: "rotateX(180deg)" }}
          >
            <Icon size={size} />
          </span>
        </motion.span>
      )}
    </span>
  );
}
